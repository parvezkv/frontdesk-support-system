/**
 * Ticket Lifecycle & Status Transitions Service
 *
 * SUPPORTED STATUSES:
 * - OPEN: Newly created ticket, awaiting agent pickup.
 * - IN_PROGRESS: Active work underway by an agent.
 * - WAITING_FOR_CUSTOMER: Agent asked question / requested info; SLA timers paused.
 * - RESOLVED: Issue solved by agent; 7-calendar-day reopening window active.
 * - CLOSED: Terminal status; ticket permanently closed.
 *
 * STRICT BUSINESS RULES:
 * 1. A newly created ticket starts as OPEN.
 * 2. An agent can take an unassigned ticket and move it to IN_PROGRESS.
 * 3. When an agent asks the customer a question, the ticket can enter WAITING_FOR_CUSTOMER.
 * 4. Entering WAITING_FOR_CUSTOMER pauses SLA timers.
 * 5. Customer response resumes the SLA timer and returns the ticket to an active status (IN_PROGRESS).
 * 6. When the agent solves the issue, they can mark it RESOLVED (with mandatory resolutionSummary).
 * 7. A resolved ticket can be reopened by an authorized agent within approximately one week (7 calendar days).
 * 8. After the reopening period expires, a new ticket must be created instead.
 * 9. When the customer does not respond for approximately one working week (5 working days / 2,700 working minutes),
 *    the system automatically closes the ticket.
 */

const prisma = require('../config/db');
const slaService = require('./sla.service');

// Valid status transitions state machine
const ALLOWED_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED', 'OPEN'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  PENDING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [], // Terminal status: no transitions permitted out of CLOSED
};

// Reopening window: 7 calendar days after resolution (documented interpretation of "about one week")
const REOPENING_WINDOW_DAYS = 7;
const REOPENING_WINDOW_MS = REOPENING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Automatic closure threshold: 5 working days (9 hours/day * 60 min = 540 min/day * 5 = 2,700 working minutes)
const AUTO_CLOSE_WORKING_DAYS = 5;
const AUTO_CLOSE_WORKING_MINUTES = AUTO_CLOSE_WORKING_DAYS * 540; // 2,700 working minutes

/**
 * Check if a status transition is permitted
 */
function isTransitionAllowed(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true; // Handled as safe no-op
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Check whether a resolved ticket is eligible for reopening
 * @param {Object} ticket
 * @param {Date} now
 * @returns {{ eligible: boolean, reason?: string, daysSinceResolution?: number }}
 */
function checkReopeningEligibility(ticket, now = new Date()) {
  if (!ticket) {
    return { eligible: false, reason: 'Ticket does not exist.' };
  }

  if (ticket.status !== 'RESOLVED') {
    return {
      eligible: false,
      reason: `Ticket status is ${ticket.status}. Only RESOLVED tickets can be reopened.`,
    };
  }

  if (!ticket.resolvedAt) {
    return {
      eligible: false,
      reason: 'Ticket has no recorded resolution timestamp.',
    };
  }

  const resolvedTime = new Date(ticket.resolvedAt).getTime();
  const currentTime = new Date(now).getTime();
  const elapsedMs = currentTime - resolvedTime;
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  if (elapsedMs < 0) {
    return { eligible: true, daysSinceResolution: 0 };
  }

  if (elapsedMs > REOPENING_WINDOW_MS) {
    return {
      eligible: false,
      daysSinceResolution: Math.round(elapsedDays * 10) / 10,
      reason: `Reopening window has expired. The 7-day post-resolution window passed (${Math.round(elapsedDays * 10) / 10} days ago). A new ticket must be created instead.`,
    };
  }

  return {
    eligible: true,
    daysSinceResolution: Math.round(elapsedDays * 10) / 10,
  };
}

/**
 * Validate status transition with business rules & authorization checks
 */
function validateTransition(ticket, newStatus, user, { resolutionSummary, reason, now = new Date() } = {}) {
  const currentStatus = ticket.status;

  // 1. Safe idempotent handling: no-op if status is unchanged
  if (currentStatus === newStatus) {
    return { isNoop: true };
  }

  // 2. Terminal state enforcement: CLOSED tickets cannot be altered
  if (currentStatus === 'CLOSED') {
    const err = new Error('Cannot transition ticket out of terminal CLOSED status. A new ticket must be created instead.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Customer RBAC guard: Customers can only close their own tickets
  if (user && user.role === 'CUSTOMER') {
    if (ticket.customerId !== user.customerId) {
      const err = new Error('Forbidden: You do not have permission to modify this ticket.');
      err.statusCode = 403;
      throw err;
    }
    if (newStatus !== 'CLOSED') {
      const err = new Error('Forbidden: Customers are only permitted to close their tickets.');
      err.statusCode = 403;
      throw err;
    }
  }

  // 4. State transition matrix validation
  if (!isTransitionAllowed(currentStatus, newStatus)) {
    const err = new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions from ${currentStatus}: ${(ALLOWED_TRANSITIONS[currentStatus] || []).join(', ') || 'none'}.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 5. Resolution summary requirement for RESOLVED and CLOSED (if not previously resolved)
  if (newStatus === 'RESOLVED') {
    if (!resolutionSummary || typeof resolutionSummary !== 'string' || resolutionSummary.trim().length < 5) {
      const err = new Error('A resolutionSummary of at least 5 characters is required when resolving a ticket.');
      err.statusCode = 400;
      throw err;
    }
  }

  // 6. Reopening rule enforcement (RESOLVED -> IN_PROGRESS)
  if (currentStatus === 'RESOLVED' && newStatus === 'IN_PROGRESS') {
    // Only authorized staff can reopen
    if (user && !['ADMIN', 'AGENT'].includes(user.role)) {
      const err = new Error('Forbidden: Only authorized agents or admins can reopen tickets.');
      err.statusCode = 403;
      throw err;
    }

    const eligibility = checkReopeningEligibility(ticket, now);
    if (!eligibility.eligible) {
      const err = new Error(eligibility.reason);
      err.statusCode = 400;
      throw err;
    }
  }

  return { isNoop: false };
}

/**
 * Execute automatic scheduled closure for tickets waiting for customer responses
 * Business Rule 9:
 * When the customer does not respond for approximately one working week (5 working days / 2,700 working minutes),
 * the system automatically closes the ticket.
 *
 * Excludes weekends and configured holidays.
 * Ensures tickets that received a customer reply are NOT closed.
 * Idempotent: safe to run multiple times without duplicate closures or duplicate events.
 *
 * @param {Object} options
 * @param {Date} [options.now]
 * @param {Array} [options.holidays]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<{ processedCount: number, closedCount: number, closedTickets: Array }>}
 */
async function processAutoClosure(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const dryRun = Boolean(options.dryRun);

  // 1. Fetch holidays from database if not passed
  const holidays = options.holidays || (await prisma.holiday.findMany());

  // 2. Find all tickets currently waiting for customer responses
  const waitingTickets = await prisma.ticket.findMany({
    where: {
      status: {
        in: ['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'],
      },
    },
    include: {
      slaPauses: {
        orderBy: { startedAt: 'desc' },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: { id: true, role: true, email: true },
          },
        },
      },
      customer: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const closedTickets = [];

  for (const ticket of waitingTickets) {
    // Find active SLA pause
    const activePause = ticket.slaPauses.find((p) => p.endedAt === null);
    const waitingSince = activePause ? activePause.startedAt : ticket.updatedAt;

    // Defense: Ensure ticket has not received a customer reply after the pause started
    // The first message (index 0) is the initial ticket description; subsequent customer messages are replies.
    const subsequentMessages = ticket.messages.slice(1);
    const latestCustomerReply = subsequentMessages.find(
      (m) => m.sender && m.sender.role === 'CUSTOMER' && new Date(m.createdAt) >= new Date(waitingSince)
    );

    if (latestCustomerReply) {
      // Customer has already replied; do not auto-close!
      continue;
    }

    // Calculate working minutes elapsed since the ticket entered waiting state
    // strictly excluding weekends and holidays
    const workingMinutesWaiting = slaService.calculateWorkingMinutesBetween(waitingSince, now, holidays);

    // Threshold: 5 working days (2,700 working minutes)
    if (workingMinutesWaiting >= AUTO_CLOSE_WORKING_MINUTES) {
      if (!dryRun) {
        // Perform atomic closure
        await prisma.$transaction(async (tx) => {
          // Double-check ticket is still in waiting state to guarantee idempotency under concurrency
          const currentTicket = await tx.ticket.findUnique({
            where: { id: ticket.id },
            select: { status: true, id: true },
          });

          if (!currentTicket || !['WAITING_FOR_CUSTOMER', 'PENDING_CUSTOMER'].includes(currentTicket.status)) {
            return;
          }

          // 1. Close open SLA pause
          if (activePause) {
            await tx.sLAPause.update({
              where: { id: activePause.id },
              data: { endedAt: now },
            });
          }

          // 2. Update ticket status to CLOSED
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'CLOSED',
              closedAt: now,
              resolvedAt: ticket.resolvedAt || now,
              updatedAt: now,
            },
          });

          // 3. Record append-only system auto-close event
          await tx.ticketEvent.create({
            data: {
              ticketId: ticket.id,
              actorId: null, // System-initiated event
              eventType: 'SYSTEM_AUTO_CLOSED',
              oldValue: ticket.status,
              newValue: 'CLOSED',
              metadata: {
                reason: 'Automatically closed after 5 working days without customer reply',
                waitingSince,
                closedAt: now,
                workingMinutesWaiting,
                thresholdWorkingMinutes: AUTO_CLOSE_WORKING_MINUTES,
              },
            },
          });
        });
      }

      closedTickets.push({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        waitingSince,
        workingMinutesWaiting,
        closedAt: now,
      });
    }
  }

  return {
    processedCount: waitingTickets.length,
    closedCount: closedTickets.length,
    closedTickets,
  };
}

let schedulerTimer = null;

/**
 * Start recurring background scheduler for auto-closing dormant tickets
 */
function startAutoCloseScheduler(intervalMs = 60 * 60 * 1000) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  console.log(`⏱️ Auto-close scheduler started (interval: ${intervalMs / 1000 / 60} minutes)`);

  schedulerTimer = setInterval(async () => {
    try {
      const result = await processAutoClosure();
      if (result.closedCount > 0) {
        console.log(`🤖 Auto-close job completed: Closed ${result.closedCount} ticket(s) due to customer inactivity.`);
      }
    } catch (err) {
      console.error('❌ Error in auto-close background scheduler:', err);
    }
  }, intervalMs);

  // Do not hold process alive if this is the only timer
  if (schedulerTimer.unref) {
    schedulerTimer.unref();
  }
}

/**
 * Stop background scheduler
 */
function stopAutoCloseScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('⏱️ Auto-close scheduler stopped.');
  }
}

module.exports = {
  ALLOWED_TRANSITIONS,
  REOPENING_WINDOW_DAYS,
  REOPENING_WINDOW_MS,
  AUTO_CLOSE_WORKING_DAYS,
  AUTO_CLOSE_WORKING_MINUTES,
  isTransitionAllowed,
  checkReopeningEligibility,
  validateTransition,
  processAutoClosure,
  startAutoCloseScheduler,
  stopAutoCloseScheduler,
};
