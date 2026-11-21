const prisma = require('../config/db');
const { calculateSLADueDates, withISTDisplay } = require('../utils/date');
const slaService = require('../services/sla.service');
const lifecycleService = require('../services/ticketLifecycle.service');

/**
 * Format a ticket object with IST formatted dates
 */
function formatTicket(ticket) {
  if (!ticket) return null;
  const formatted = withISTDisplay(ticket);

  if (formatted.messages) {
    formatted.messages = formatted.messages.map((m) => withISTDisplay(m));
  }
  if (formatted.internalNotes) {
    formatted.internalNotes = formatted.internalNotes.map((n) => withISTDisplay(n));
  }
  if (formatted.assignments) {
    formatted.assignments = formatted.assignments.map((a) => withISTDisplay(a));
  }
  if (formatted.events) {
    formatted.events = formatted.events.map((e) => withISTDisplay(e));
  }
  if (formatted.slaPauses) {
    formatted.slaPauses = formatted.slaPauses.map((s) => withISTDisplay(s));
  }

  return formatted;
}

/**
 * Create a new support ticket
 */
async function createTicket(req, res, next) {
  try {
    const { subject, description, priority = 'MEDIUM' } = req.body;
    let customerId = req.user.customerId;

    // If an Agent or Admin is creating the ticket on behalf of a customer
    if (['ADMIN', 'AGENT'].includes(req.user.role)) {
      if (req.body.customerId) {
        customerId = req.body.customerId;
      } else if (req.body.customerEmail) {
        let cust = await prisma.customer.findUnique({
          where: { email: req.body.customerEmail.toLowerCase() },
        });
        if (!cust) {
          cust = await prisma.customer.create({
            data: {
              name: req.body.customerName || req.body.customerEmail.split('@')[0],
              email: req.body.customerEmail.toLowerCase(),
              phone: req.body.customerPhone || null,
            },
          });
        }
        customerId = cust.id;
      }
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Could not associate ticket with a customer. Please ensure a valid customer profile exists.',
      });
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} not found.`,
      });
    }

    // Fetch configured holidays from database
    const holidays = await prisma.holiday.findMany();

    // Calculate SLA due dates according to business working hours (stored in UTC)
    const { responseDueAt, resolutionDueAt } = slaService.calculateSLADeadlines(priority, new Date(), holidays);

    // Create ticket, initial customer message, and append-only event in a transaction
    const newTicket = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          subject,
          description,
          customerId,
          priority,
          status: 'OPEN',
          responseDueAt,
          resolutionDueAt,
          messages: {
            create: {
              senderId: req.user.id,
              content: description,
            },
          },
          events: {
            create: {
              actorId: req.user.id,
              eventType: 'TICKET_CREATED',
              newValue: `Ticket #${subject} created with priority ${priority}`,
              metadata: { priority, status: 'OPEN' },
            },
          },
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return ticket;
    });

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully.',
      ticket: formatTicket(newTicket),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List tickets with search, filtering, pagination, and RBAC security
 */
async function listTickets(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const { search, status, priority, assignedAgentId, customerId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const where = {};

    // 🔒 RBAC Restriction: Customers can ONLY see their own tickets
    if (req.user.role === 'CUSTOMER') {
      where.customerId = req.user.customerId;
    } else {
      // Agents & Admins can filter by customer or agent
      if (customerId) where.customerId = customerId;
      if (assignedAgentId) {
        if (assignedAgentId === 'unassigned') {
          where.assignedAgentId = null;
        } else {
          where.assignedAgentId = assignedAgentId;
        }
      }
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Search filter across subject, description, and numeric ticketNumber
    if (search && search.trim().length > 0) {
      const trimmedSearch = search.trim();
      const num = parseInt(trimmedSearch);
      const orConditions = [
        { subject: { contains: trimmedSearch, mode: 'insensitive' } },
        { description: { contains: trimmedSearch, mode: 'insensitive' } },
      ];

      if (!isNaN(num)) {
        orConditions.push({ ticketNumber: num });
      }

      where.OR = orConditions;
    }

    // Allowed sort fields
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'responseDueAt', 'resolutionDueAt', 'ticketNumber'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderDirection },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          description: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          firstResponseAt: true,
          responseDueAt: true,
          resolutionDueAt: true,
          resolvedAt: true,
          closedAt: true,
          customer: {
            select: { id: true, name: true, email: true },
          },
          assignedAgent: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: tickets.map((t) => formatTicket(t)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get ticket details by ID or ticketNumber
 * 🔒 Strictly omits internalNotes and internal audit tables for CUSTOMER role!
 */
async function getTicketById(req, res, next) {
  try {
    const { id } = req.params;
    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const isCustomer = req.user.role === 'CUSTOMER';

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: !isCustomer, // Phone visible to staff
          },
        },
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: !isCustomer, // Agent email visible to staff
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        // 🔒 Internal notes, assignments, SLA pauses, and events ONLY included for AGENT/ADMIN
        ...(!isCustomer && {
          internalNotes: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              author: {
                select: { id: true, name: true, role: true },
              },
            },
          },
          assignments: {
            orderBy: { assignedAt: 'desc' },
            select: {
              id: true,
              assignedAt: true,
              releasedAt: true,
              agent: {
                select: { id: true, name: true, role: true },
              },
            },
          },
          events: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              eventType: true,
              oldValue: true,
              newValue: true,
              metadata: true,
              createdAt: true,
              actor: {
                select: { id: true, name: true, role: true },
              },
            },
          },
          slaPauses: {
            orderBy: { startedAt: 'desc' },
            select: {
              id: true,
              startedAt: true,
              endedAt: true,
            },
          },
        }),
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Ticket with reference '${id}' was not found.`,
      });
    }

    // 🔒 Customer access guard: Customer can ONLY access their own ticket
    if (isCustomer && ticket.customerId !== req.user.customerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this ticket.',
      });
    }

    res.status(200).json({
      success: true,
      ticket: formatTicket(ticket),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a public message to a ticket
 */
async function addMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // 🔒 Customers can only reply to their own tickets
    if (req.user.role === 'CUSTOMER' && ticket.customerId !== req.user.customerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot reply to this ticket.',
      });
    }

    const isStaff = ['ADMIN', 'AGENT'].includes(req.user.role);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create message
      const message = await tx.message.create({
        data: {
          ticketId: ticket.id,
          senderId: req.user.id,
          content,
        },
        include: {
          sender: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // 2. If staff replied and firstResponseAt is not yet set, record it
      const ticketUpdateData = { updatedAt: new Date() };
      if (isStaff && !ticket.firstResponseAt) {
        ticketUpdateData.firstResponseAt = new Date();
      }

      // 3. If customer replied and ticket was paused in WAITING_FOR_CUSTOMER / PENDING_CUSTOMER:
      // Resume the SLA clock, calculate paused working minutes, and extend deadlines (Rule 4 & 5)
      if (!isStaff && ['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'].includes(ticket.status)) {
        const openPause = await tx.sLAPause.findFirst({
          where: { ticketId: ticket.id, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });

        const holidays = await tx.holiday.findMany();
        let pausedWorkingMinutes = 0;
        const now = new Date();

        if (openPause) {
          await tx.sLAPause.update({
            where: { id: openPause.id },
            data: { endedAt: now },
          });
          pausedWorkingMinutes = slaService.calculateWorkingMinutesBetween(openPause.startedAt, now, holidays);
        }

        const extended = slaService.extendDeadlinesForPause(ticket, pausedWorkingMinutes, holidays);
        ticketUpdateData.responseDueAt = extended.responseDueAt;
        ticketUpdateData.resolutionDueAt = extended.resolutionDueAt;
        ticketUpdateData.status = 'IN_PROGRESS';

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: req.user.id,
            eventType: 'SLA_RESUMED',
            newValue: `Customer replied. SLA resumed (+${pausedWorkingMinutes} working min extended). Status -> IN_PROGRESS`,
            metadata: {
              pausedWorkingMinutes,
              previousResponseDueAt: ticket.responseDueAt,
              newResponseDueAt: extended.responseDueAt,
              previousResolutionDueAt: ticket.resolutionDueAt,
              newResolutionDueAt: extended.resolutionDueAt,
              trigger: 'CUSTOMER_REPLY',
            },
          },
        });
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data: ticketUpdateData,
      });

      // 3. Append-only event
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          eventType: 'MESSAGE_SENT',
          newValue: `${req.user.role} sent a message`,
        },
      });

      if (isStaff && !ticket.firstResponseAt) {
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: req.user.id,
            eventType: 'FIRST_RESPONSE_RECORDED',
            newValue: 'First response recorded',
          },
        });
      }

      return message;
    });

    res.status(201).json({
      success: true,
      message: 'Message added successfully.',
      data: formatTicket(result),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add an internal note (Staff only: AGENT or ADMIN)
 */
async function addInternalNote(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    const note = await prisma.$transaction(async (tx) => {
      const createdNote = await tx.internalNote.create({
        data: {
          ticketId: ticket.id,
          authorId: req.user.id,
          content,
        },
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // Append-only event
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          eventType: 'INTERNAL_NOTE_ADDED',
          newValue: 'Internal note added by staff',
        },
      });

      return createdNote;
    });

    res.status(201).json({
      success: true,
      message: 'Internal note created successfully.',
      data: formatTicket(note),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 1. Assign or Take an Unassigned Ticket
 * Endpoint: POST /api/tickets/:id/assign
 *
 * Rules:
 * - Agents/Admins can take an unassigned ticket (or Admin/Agent can assign to an agent).
 * - Enforces database-level concurrency control with PostgreSQL row locking (`SELECT ... FOR UPDATE`).
 * - If already taken by another agent, returns HTTP 409 Conflict.
 * - Transitions status from OPEN to IN_PROGRESS.
 * - Creates TicketAssignment (active, releasedAt = null).
 * - Logs append-only TicketEvent (AGENT_ASSIGNED).
 */
async function assignTicket(req, res, next) {
  try {
    const { id } = req.params;
    const requestedAgentId = req.body.agentId || req.user.id;

    // Verify target agent
    const targetAgent = await prisma.user.findUnique({
      where: { id: requestedAgentId },
    });

    if (!targetAgent || !['ADMIN', 'AGENT'].includes(targetAgent.role)) {
      return res.status(400).json({
        success: false,
        message: 'The target agent must be an active user with role AGENT or ADMIN.',
      });
    }

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the ticket row using PostgreSQL FOR UPDATE
      const lockedRows = isNum
        ? await tx.$queryRaw`SELECT id, "ticketNumber", "assignedAgentId", status, subject FROM tickets WHERE "ticketNumber" = ${parseInt(id)} FOR UPDATE`
        : await tx.$queryRaw`SELECT id, "ticketNumber", "assignedAgentId", status, subject FROM tickets WHERE id = ${id} FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error('Ticket not found.');
        err.statusCode = 404;
        throw err;
      }

      const lockedTicket = lockedRows[0];

      // 2. Atomic check: If ticket is already assigned, reject with 409 Conflict
      if (lockedTicket.assignedAgentId !== null) {
        const err = new Error('Conflict: This ticket has already been assigned to another agent.');
        err.statusCode = 409;
        throw err;
      }

      const now = new Date();
      const newStatus = lockedTicket.status === 'OPEN' ? 'IN_PROGRESS' : lockedTicket.status;

      // 3. Update the ticket
      const updatedTicket = await tx.ticket.update({
        where: { id: lockedTicket.id },
        data: {
          assignedAgentId: targetAgent.id,
          status: newStatus,
          updatedAt: now,
        },
        include: {
          assignedAgent: {
            select: { id: true, name: true, email: true },
          },
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 4. Create new TicketAssignment (guaranteed unique active by DB index)
      const assignment = await tx.ticketAssignment.create({
        data: {
          ticketId: lockedTicket.id,
          agentId: targetAgent.id,
          assignedAt: now,
          releasedAt: null,
        },
        include: {
          agent: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 5. Append-only event
      await tx.ticketEvent.create({
        data: {
          ticketId: lockedTicket.id,
          actorId: req.user.id,
          eventType: 'AGENT_ASSIGNED',
          oldValue: 'Unassigned',
          newValue: targetAgent.name,
          metadata: {
            agentId: targetAgent.id,
            action: 'ASSIGN',
            assignedBy: req.user.name,
          },
        },
      });

      return { updatedTicket, assignment };
    });

    res.status(200).json({
      success: true,
      message: `Ticket #${result.updatedTicket.ticketNumber} successfully assigned to ${targetAgent.name}.`,
      ticket: formatTicket(result.updatedTicket),
      assignment: formatTicket(result.assignment),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Reassign a Ticket to Another Agent
 * Endpoint: POST /api/tickets/:id/reassign
 *
 * Rules:
 * - Only authorized agents (the currently assigned agent or an ADMIN) can reassign.
 * - Target agent must be an active AGENT or ADMIN.
 * - Cannot reassign to the currently assigned agent.
 * - Closes active TicketAssignment (releasedAt = now), preserving history.
 * - Creates new TicketAssignment for the new agent.
 * - Logs append-only TicketEvent (AGENT_REASSIGNED).
 */
async function reassignTicket(req, res, next) {
  try {
    const { id } = req.params;
    const targetAgentId = req.body.targetAgentId || req.body.agentId || req.body.newAgentId;

    if (!targetAgentId) {
      return res.status(400).json({
        success: false,
        message: 'A valid target agentId is required for reassignment.',
      });
    }

    // Verify target agent exists and has AGENT/ADMIN role
    const targetAgent = await prisma.user.findUnique({
      where: { id: targetAgentId },
    });

    if (!targetAgent || !['ADMIN', 'AGENT'].includes(targetAgent.role)) {
      return res.status(400).json({
        success: false,
        message: 'The target agent must be an active user with role AGENT or ADMIN.',
      });
    }

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the ticket row
      const lockedRows = isNum
        ? await tx.$queryRaw`SELECT id, "ticketNumber", "assignedAgentId", status, subject FROM tickets WHERE "ticketNumber" = ${parseInt(id)} FOR UPDATE`
        : await tx.$queryRaw`SELECT id, "ticketNumber", "assignedAgentId", status, subject FROM tickets WHERE id = ${id} FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error('Ticket not found.');
        err.statusCode = 404;
        throw err;
      }

      const lockedTicket = lockedRows[0];

      // 2. Validate current assignment
      if (!lockedTicket.assignedAgentId) {
        const err = new Error('Ticket is currently unassigned. Use the assign endpoint to assign an unassigned ticket.');
        err.statusCode = 400;
        throw err;
      }

      // 3. Authorization check: Rule 8 - only assigned agent or ADMIN can reassign
      if (req.user.role !== 'ADMIN' && lockedTicket.assignedAgentId !== req.user.id) {
        const err = new Error('Forbidden: You can only reassign tickets assigned to you, or you must be an Administrator.');
        err.statusCode = 403;
        throw err;
      }

      // 4. Cannot reassign to the same agent
      if (lockedTicket.assignedAgentId === targetAgent.id) {
        const err = new Error(`Ticket is already assigned to ${targetAgent.name}.`);
        err.statusCode = 400;
        throw err;
      }

      // Previous agent details for logging
      const previousAgent = await tx.user.findUnique({
        where: { id: lockedTicket.assignedAgentId },
        select: { id: true, name: true },
      });

      const now = new Date();

      // 5. Close previous active assignment (preserves history)
      await tx.ticketAssignment.updateMany({
        where: {
          ticketId: lockedTicket.id,
          releasedAt: null,
        },
        data: { releasedAt: now },
      });

      // 6. Create new active assignment
      const newAssignment = await tx.ticketAssignment.create({
        data: {
          ticketId: lockedTicket.id,
          agentId: targetAgent.id,
          assignedAt: now,
          releasedAt: null,
        },
        include: {
          agent: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 7. Update ticket
      const updatedTicket = await tx.ticket.update({
        where: { id: lockedTicket.id },
        data: {
          assignedAgentId: targetAgent.id,
          updatedAt: now,
        },
        include: {
          assignedAgent: {
            select: { id: true, name: true, email: true },
          },
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 8. Append-only event
      await tx.ticketEvent.create({
        data: {
          ticketId: lockedTicket.id,
          actorId: req.user.id,
          eventType: 'AGENT_REASSIGNED',
          oldValue: previousAgent ? previousAgent.name : 'Unknown',
          newValue: targetAgent.name,
          metadata: {
            previousAgentId: lockedTicket.assignedAgentId,
            newAgentId: targetAgent.id,
            reassignedBy: req.user.name,
            action: 'REASSIGN',
          },
        },
      });

      return { updatedTicket, newAssignment };
    });

    res.status(200).json({
      success: true,
      message: `Ticket #${result.updatedTicket.ticketNumber} successfully reassigned to ${targetAgent.name}.`,
      ticket: formatTicket(result.updatedTicket),
      assignment: formatTicket(result.newAssignment),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Release an Assigned Ticket Back to Unassigned Pool
 * Endpoint: POST /api/tickets/:id/release
 *
 * Rules:
 * - Only authorized agents (the currently assigned agent or an ADMIN) can release.
 * - Ticket must currently be assigned.
 * - Closes active TicketAssignment (releasedAt = now), preserving history.
 * - Sets ticket.assignedAgentId = null.
 * - If status is IN_PROGRESS, reverts back to OPEN.
 * - Logs append-only TicketEvent (AGENT_RELEASED).
 */
async function releaseTicket(req, res, next) {
  try {
    const { id } = req.params;
    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the ticket row
      const lockedRows = isNum
        ? await tx.$queryRaw`SELECT id, "ticketNumber", "assignedAgentId", status, subject FROM tickets WHERE "ticketNumber" = ${parseInt(id)} FOR UPDATE`
        : await tx.$queryRaw`SELECT id, "ticketNumber", "assignedAgentId", status, subject FROM tickets WHERE id = ${id} FOR UPDATE`;

      if (!lockedRows || lockedRows.length === 0) {
        const err = new Error('Ticket not found.');
        err.statusCode = 404;
        throw err;
      }

      const lockedTicket = lockedRows[0];

      // 2. Check if currently assigned
      if (!lockedTicket.assignedAgentId) {
        const err = new Error('Ticket is already unassigned.');
        err.statusCode = 400;
        throw err;
      }

      // 3. Authorization check: Rule 8 - only currently assigned agent or ADMIN can release
      if (req.user.role !== 'ADMIN' && lockedTicket.assignedAgentId !== req.user.id) {
        const err = new Error('Forbidden: You can only release tickets assigned to you, or you must be an Administrator.');
        err.statusCode = 403;
        throw err;
      }

      // Previous agent details for logging
      const previousAgent = await tx.user.findUnique({
        where: { id: lockedTicket.assignedAgentId },
        select: { id: true, name: true },
      });

      const now = new Date();

      // 4. Release active assignment (preserves history)
      await tx.ticketAssignment.updateMany({
        where: {
          ticketId: lockedTicket.id,
          releasedAt: null,
        },
        data: { releasedAt: now },
      });

      // 5. Update ticket: assignedAgentId = null, revert IN_PROGRESS to OPEN
      const newStatus = lockedTicket.status === 'IN_PROGRESS' ? 'OPEN' : lockedTicket.status;
      const updatedTicket = await tx.ticket.update({
        where: { id: lockedTicket.id },
        data: {
          assignedAgentId: null,
          status: newStatus,
          updatedAt: now,
        },
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 6. Append-only event
      await tx.ticketEvent.create({
        data: {
          ticketId: lockedTicket.id,
          actorId: req.user.id,
          eventType: 'AGENT_RELEASED',
          oldValue: previousAgent ? previousAgent.name : 'Unknown',
          newValue: 'Unassigned',
          metadata: {
            previousAgentId: lockedTicket.assignedAgentId,
            releasedBy: req.user.name,
            action: 'RELEASE',
          },
        },
      });

      return updatedTicket;
    });

    res.status(200).json({
      success: true,
      message: `Ticket #${result.ticketNumber} has been released and is now unassigned.`,
      ticket: formatTicket(result),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update ticket status (with lifecycle validation, reopening rules, resolution validation & SLA pause logic)
 */
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, resolutionSummary, reason } = req.body;

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    const now = new Date();

    // Validate transition using lifecycle service (handles RBAC, state machine, reopening window, resolution summary)
    try {
      const result = lifecycleService.validateTransition(ticket, status, req.user, {
        resolutionSummary,
        reason,
        now,
      });

      // Safe idempotent no-op: if the status is already the requested one
      if (result.isNoop) {
        return res.status(200).json({
          success: true,
          message: `Ticket is already in ${status} status. No change applied.`,
          ticket: formatTicket(ticket),
        });
      }
    } catch (validationErr) {
      return res.status(validationErr.statusCode || 400).json({
        success: false,
        message: validationErr.message,
      });
    }

    const previousStatus = ticket.status;
    const isReopening = previousStatus === 'RESOLVED' && status === 'IN_PROGRESS';

    const updateData = { status };

    if (status === 'RESOLVED') {
      updateData.resolvedAt = now;
      if (resolutionSummary) {
        updateData.description = `${ticket.description}\n\n[Resolution]: ${resolutionSummary}`;
      }
    } else if (status === 'CLOSED') {
      updateData.closedAt = now;
      if (!ticket.resolvedAt) {
        updateData.resolvedAt = now;
      }
    } else if (isReopening) {
      // Clear resolvedAt and closedAt when reopening so the ticket is active again
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // SLA Pause handling (Rules 3, 4, 5)
      const isEnteringPause = ['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'].includes(status);
      const wasPaused = ['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'].includes(previousStatus);

      if (isEnteringPause && !wasPaused) {
        // Start SLA pause
        await tx.sLAPause.create({
          data: {
            ticketId: ticket.id,
            startedAt: now,
          },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: req.user.id,
            eventType: 'SLA_PAUSED',
            newValue: `Status changed to ${status}. SLA clock paused.`,
            metadata: { pausedAt: now },
          },
        });
      } else if (wasPaused && !isEnteringPause) {
        // Resume SLA pause and extend deadlines
        const openPause = await tx.sLAPause.findFirst({
          where: { ticketId: ticket.id, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });

        const holidays = await tx.holiday.findMany();
        let pausedWorkingMinutes = 0;

        if (openPause) {
          await tx.sLAPause.update({
            where: { id: openPause.id },
            data: { endedAt: now },
          });
          pausedWorkingMinutes = slaService.calculateWorkingMinutesBetween(openPause.startedAt, now, holidays);
        }

        const extended = slaService.extendDeadlinesForPause(ticket, pausedWorkingMinutes, holidays);
        updateData.responseDueAt = extended.responseDueAt;
        updateData.resolutionDueAt = extended.resolutionDueAt;

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: req.user.id,
            eventType: 'SLA_RESUMED',
            newValue: `Status changed to ${status}. SLA resumed (+${pausedWorkingMinutes} working min extended).`,
            metadata: {
              pausedWorkingMinutes,
              previousResponseDueAt: ticket.responseDueAt,
              newResponseDueAt: extended.responseDueAt,
              previousResolutionDueAt: ticket.resolutionDueAt,
              newResolutionDueAt: extended.resolutionDueAt,
            },
          },
        });
      }

      // If reopening, record the reopening event preserving previous resolution history
      if (isReopening) {
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: req.user.id,
            eventType: 'TICKET_REOPENED',
            oldValue: previousStatus,
            newValue: status,
            metadata: {
              previousResolvedAt: ticket.resolvedAt,
              previousResolutionDueAt: ticket.resolutionDueAt,
              reason: reason || 'Reopened by authorized agent within 7-day window',
              daysSinceResolution: ticket.resolvedAt
                ? Math.round(((now - new Date(ticket.resolvedAt)) / (1000 * 60 * 60 * 24)) * 10) / 10
                : null,
            },
          },
        });

        // Recalculate SLA deadlines from the reopen time for the current priority
        const holidays = await tx.holiday.findMany();
        const { responseDueAt, resolutionDueAt } = slaService.calculateSLADeadlines(ticket.priority, now, holidays);

        // Only update response deadline if first response hasn't been sent yet
        if (!ticket.firstResponseAt) {
          updateData.responseDueAt = responseDueAt;
        }
        updateData.resolutionDueAt = resolutionDueAt;
      }

      // Update ticket
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: updateData,
      });

      // Append-only status changed event
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          eventType: 'STATUS_CHANGED',
          oldValue: previousStatus,
          newValue: status,
          metadata: { resolutionSummary: resolutionSummary || null },
        },
      });

      return updatedTicket;
    });

    res.status(200).json({
      success: true,
      message: isReopening
        ? `Ticket reopened: status changed from ${previousStatus} to ${status}.`
        : `Ticket status updated from ${previousStatus} to ${status}.`,
      ticket: formatTicket(updated),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update ticket priority and recalculate SLA deadlines (Rule 6)
 */
async function updatePriority(req, res, next) {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    if (ticket.priority === priority) {
      return res.status(400).json({
        success: false,
        message: `Ticket priority is already ${priority}.`,
      });
    }

    const holidays = await prisma.holiday.findMany();
    const now = new Date();

    // Recalculate SLA targets from priority-change time (Rule 6)
    const newDeadlines = slaService.recalculateOnPriorityChange(priority, now, holidays);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          priority,
          responseDueAt: newDeadlines.responseDueAt,
          resolutionDueAt: newDeadlines.resolutionDueAt,
          updatedAt: now,
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          assignedAgent: { select: { id: true, name: true, email: true } },
        },
      });

      // Append-only event preserving previous deadlines (Rule 6)
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          eventType: 'PRIORITY_CHANGED',
          oldValue: ticket.priority,
          newValue: priority,
          metadata: {
            previousPriority: ticket.priority,
            newPriority: priority,
            previousResponseDueAt: ticket.responseDueAt,
            previousResolutionDueAt: ticket.resolutionDueAt,
            newResponseDueAt: newDeadlines.responseDueAt,
            newResolutionDueAt: newDeadlines.resolutionDueAt,
            recalculatedAt: now,
            calculationNote: 'Recalculated from priority-change time using business hours and configured holidays.',
          },
        },
      });

      return updatedTicket;
    });

    res.status(200).json({
      success: true,
      message: `Ticket priority updated to ${priority}. SLA deadlines recalculated.`,
      ticket: formatTicket(updated),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Inspect detailed SLA calculations and status for a ticket
 */
async function getTicketSLA(req, res, next) {
  try {
    const { id } = req.params;
    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        slaPauses: { orderBy: { startedAt: 'asc' } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // Customer security guard: only view own ticket
    if (req.user.role === 'CUSTOMER' && ticket.customerId !== req.user.customerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view SLA metrics for this ticket.',
      });
    }

    const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
    const now = new Date();

    const overdueStatus = slaService.evaluateOverdueStatus(ticket, holidays, now);
    const remainingResponseMinutes = slaService.calculateRemainingSLAMinutes(ticket.responseDueAt, holidays, now);
    const remainingResolutionMinutes = slaService.calculateRemainingSLAMinutes(ticket.resolutionDueAt, holidays, now);
    const totalPausedWorkingMinutes = slaService.calculateTotalPausedWorkingMinutes(ticket.slaPauses, holidays, now);

    res.status(200).json({
      success: true,
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        workingHoursConfig: {
          timezone: 'Asia/Kolkata (UTC+05:30)',
          workingHours: '09:30 AM to 06:30 PM (9 hours / 540 min per day)',
          workingDays: 'Monday to Friday',
          weekendsExcluded: true,
          configuredHolidaysCount: holidays.length,
        },
        slaDeadlines: {
          responseDueAt: ticket.responseDueAt,
          responseDueAtIST: withISTDisplay(ticket).responseDueAtIST,
          firstResponseAt: ticket.firstResponseAt,
          firstResponseAtIST: withISTDisplay(ticket).firstResponseAtIST,
          resolutionDueAt: ticket.resolutionDueAt,
          resolutionDueAtIST: withISTDisplay(ticket).resolutionDueAtIST,
          resolvedAt: ticket.resolvedAt,
          resolvedAtIST: withISTDisplay(ticket).resolvedAtIST,
        },
        evaluation: {
          currentTime: now,
          currentTimeIST: withISTDisplay({ now }).nowIST,
          isCurrentlyWorkingTime: slaService.isWorkingTime(now, holidays),
          overdueStatus,
          remainingResponseWorkingMinutes: remainingResponseMinutes,
          remainingResolutionWorkingMinutes: remainingResolutionMinutes,
        },
        pauseMetrics: {
          pauseCount: ticket.slaPauses.length,
          totalPausedWorkingMinutes,
          pauses: ticket.slaPauses.map((p) => ({
            ...withISTDisplay(p),
            pausedWorkingMinutes: slaService.calculateWorkingMinutesBetween(p.startedAt, p.endedAt || now, holidays),
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Export ticket data (Rule: Never include internal notes in customer-facing exports!)
 */
async function exportTicket(req, res, next) {
  try {
    const { id } = req.params;
    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const isCustomer = req.user.role === 'CUSTOMER';

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: !isCustomer } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: { select: { id: true, name: true, role: true } },
          },
        },
        // 🔒 Internal notes are strictly excluded when requester is a Customer
        ...(!isCustomer && {
          internalNotes: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              author: { select: { id: true, name: true, role: true } },
            },
          },
        }),
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    if (isCustomer && ticket.customerId !== req.user.customerId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to export this ticket.',
      });
    }

    const formatted = formatTicket(ticket);

    const exportData = {
      exportType: isCustomer ? 'CUSTOMER_PORTAL_TRANSCRIPT' : 'STAFF_FULL_AUDIT_EXPORT',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        name: req.user.name,
        role: req.user.role,
      },
      ticket: {
        ticketNumber: formatted.ticketNumber,
        subject: formatted.subject,
        description: formatted.description,
        status: formatted.status,
        priority: formatted.priority,
        createdAt: formatted.createdAt,
        createdAtIST: formatted.createdAtIST,
        resolvedAt: formatted.resolvedAt,
        resolvedAtIST: formatted.resolvedAtIST,
        customer: formatted.customer,
        assignedAgent: formatted.assignedAgent ? { name: formatted.assignedAgent.name } : null,
      },
      conversation: formatted.messages.map((m) => ({
        sender: m.sender ? m.sender.name : 'Unknown',
        role: m.sender ? m.sender.role : 'USER',
        timestamp: m.createdAtIST,
        message: m.content,
      })),
      // 🔒 Internal notes included ONLY if requester is staff
      ...(!isCustomer && {
        internalNotes: formatted.internalNotes.map((n) => ({
          author: n.author ? n.author.name : 'Staff',
          timestamp: n.createdAtIST,
          note: n.content,
        })),
      }),
    };

    res.status(200).json({
      success: true,
      export: exportData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reopen a resolved ticket (dedicated endpoint with explicit eligibility check)
 * Business Rule 7: A resolved ticket can be reopened by an authorized agent within 7 calendar days.
 * Business Rule 8: After the reopening period expires, a new ticket must be created instead.
 */
async function reopenTicket(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const isNum = !isNaN(parseInt(id)) && /^\d+$/.test(id);
    const where = isNum ? { ticketNumber: parseInt(id) } : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // Check eligibility via lifecycle service
    const eligibility = lifecycleService.checkReopeningEligibility(ticket);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: eligibility.reason,
        daysSinceResolution: eligibility.daysSinceResolution,
      });
    }

    const now = new Date();
    const holidays = await prisma.holiday.findMany();
    const { responseDueAt, resolutionDueAt } = slaService.calculateSLADeadlines(ticket.priority, now, holidays);

    const updated = await prisma.$transaction(async (tx) => {
      const updateData = {
        status: 'IN_PROGRESS',
        resolvedAt: null,
        closedAt: null,
        updatedAt: now,
        resolutionDueAt,
      };

      // Only update response deadline if first response hasn't been sent yet
      if (!ticket.firstResponseAt) {
        updateData.responseDueAt = responseDueAt;
      }

      // Record TICKET_REOPENED event preserving old resolution history
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          eventType: 'TICKET_REOPENED',
          oldValue: 'RESOLVED',
          newValue: 'IN_PROGRESS',
          metadata: {
            previousResolvedAt: ticket.resolvedAt,
            previousResolutionDueAt: ticket.resolutionDueAt,
            reason: reason || 'Reopened by authorized agent within 7-day window',
            daysSinceResolution: eligibility.daysSinceResolution,
          },
        },
      });

      // Record STATUS_CHANGED event
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user.id,
          eventType: 'STATUS_CHANGED',
          oldValue: 'RESOLVED',
          newValue: 'IN_PROGRESS',
        },
      });

      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: updateData,
      });

      return updatedTicket;
    });

    res.status(200).json({
      success: true,
      message: `Ticket reopened successfully. SLA deadlines recalculated.`,
      ticket: formatTicket(updated),
      reopeningInfo: {
        daysSinceResolution: eligibility.daysSinceResolution,
        windowDays: lifecycleService.REOPENING_WINDOW_DAYS,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Run automatic closure job (admin-triggered or scheduled)
 * Closes tickets that have been in WAITING_FOR_CUSTOMER for >= 5 working days without a customer reply.
 */
async function runAutoClosure(req, res, next) {
  try {
    const dryRun = req.query.dryRun === 'true';
    const result = await lifecycleService.processAutoClosure({ dryRun });

    res.status(200).json({
      success: true,
      message: dryRun
        ? `Dry run complete. ${result.closedCount} ticket(s) would be auto-closed.`
        : `Auto-closure job complete. ${result.closedCount} ticket(s) closed.`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  exportTicket,
  addMessage,
  addInternalNote,
  assignTicket,
  reassignTicket,
  releaseTicket,
  updateStatus,
  updatePriority,
  getTicketSLA,
  reopenTicket,
  runAutoClosure,
};
