const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  // Clear existing records in correct order to respect foreign key constraints
  await prisma.sLAPause.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.ticketAssignment.deleteMany();
  await prisma.internalNote.deleteMany();
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.holiday.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Seed Holidays
  await prisma.holiday.createMany({
    data: [
      { date: new Date('2026-01-01T00:00:00.000Z'), name: "New Year's Day" },
      { date: new Date('2026-01-26T00:00:00.000Z'), name: 'Republic Day' },
      { date: new Date('2026-08-15T00:00:00.000Z'), name: 'Independence Day' },
      { date: new Date('2026-10-02T00:00:00.000Z'), name: 'Gandhi Jayanti' },
      { date: new Date('2026-11-08T00:00:00.000Z'), name: 'Diwali' },
    ],
  });
  console.log('✅ Seeded 5 official holidays');

  // 2. Seed Users (Admin, Agents, Customers)
  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@frontdesk.com',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const agent1 = await prisma.user.create({
    data: {
      name: 'Sarah Connor',
      email: 'agent.sarah@frontdesk.com',
      passwordHash,
      role: 'AGENT',
    },
  });

  const agent2 = await prisma.user.create({
    data: {
      name: 'Alex Murphy',
      email: 'agent.alex@frontdesk.com',
      passwordHash,
      role: 'AGENT',
    },
  });

  const customerUser1 = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      passwordHash,
      role: 'CUSTOMER',
    },
  });

  const customerUser2 = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      passwordHash,
      role: 'CUSTOMER',
    },
  });

  console.log('✅ Seeded 5 Users:');
  console.log('   - Admin: admin@frontdesk.com');
  console.log('   - Agent 1: agent.sarah@frontdesk.com');
  console.log('   - Agent 2: agent.alex@frontdesk.com');
  console.log('   - Customer 1: john.doe@example.com');
  console.log('   - Customer 2: jane.smith@example.com');

  // 3. Seed Customers
  const customer1 = await prisma.customer.create({
    data: {
      name: customerUser1.name,
      email: customerUser1.email,
      phone: '+91-9876543210',
      userId: customerUser1.id,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: customerUser2.name,
      email: customerUser2.email,
      phone: '+91-9876543211',
      userId: customerUser2.id,
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Robert Taylor',
      email: 'robert.taylor@acme.com',
      phone: '+91-9876543212',
    },
  });

  console.log('✅ Seeded 3 Customers');

  // Helper date calculators (stored in UTC)
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const eightHoursLater = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 4. Seed Ticket 1: Urgent & In Progress
  const ticket1 = await prisma.ticket.create({
    data: {
      subject: 'Cannot access production billing dashboard',
      description: 'Getting a 403 Forbidden error after our organization updated SSO credentials yesterday morning.',
      customerId: customer1.id,
      assignedAgentId: agent1.id,
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      firstResponseAt: new Date(now.getTime() - 30 * 60 * 1000),
      responseDueAt: oneHourLater,
      resolutionDueAt: fourHoursLater,
      messages: {
        create: [
          {
            senderId: customerUser1.id,
            content: 'Getting a 403 Forbidden error after our organization updated SSO credentials yesterday morning.',
          },
          {
            senderId: agent1.id,
            content: 'Hello John, we are investigating your SSO claims now. Could you confirm your Okta tenant ID?',
          },
          {
            senderId: customerUser1.id,
            content: 'Our Okta tenant ID is inav-tech.okta.com.',
          },
        ],
      },
      internalNotes: {
        create: [
          {
            authorId: agent1.id,
            content: 'Internal Note: Investigated API Gateway logs. Token audience claims need an update in the Okta app.',
          },
        ],
      },
      assignments: {
        create: [
          {
            agentId: agent1.id,
            assignedAt: new Date(now.getTime() - 45 * 60 * 1000),
          },
        ],
      },
      events: {
        create: [
          {
            actorId: customerUser1.id,
            eventType: 'TICKET_CREATED',
            newValue: 'Created ticket with priority URGENT',
            metadata: { priority: 'URGENT', status: 'OPEN' },
          },
          {
            actorId: admin.id,
            eventType: 'AGENT_ASSIGNED',
            oldValue: null,
            newValue: agent1.name,
            metadata: { agentId: agent1.id },
          },
          {
            actorId: agent1.id,
            eventType: 'STATUS_CHANGED',
            oldValue: 'OPEN',
            newValue: 'IN_PROGRESS',
          },
        ],
      },
    },
  });

  // 5. Seed Ticket 2: Low & Open (Unassigned queue)
  const ticket2 = await prisma.ticket.create({
    data: {
      subject: 'Request for dark mode option in web portal',
      description: 'Our operations team works primarily at night and would appreciate an option to switch to a dark theme.',
      customerId: customer2.id,
      assignedAgentId: null,
      priority: 'LOW',
      status: 'OPEN',
      responseDueAt: twentyFourHoursLater,
      resolutionDueAt: fortyEightHoursLater,
      messages: {
        create: [
          {
            senderId: customerUser2.id,
            content: 'Our operations team works primarily at night and would appreciate an option to switch to a dark theme.',
          },
        ],
      },
      events: {
        create: [
          {
            actorId: customerUser2.id,
            eventType: 'TICKET_CREATED',
            newValue: 'Created ticket with priority LOW',
            metadata: { priority: 'LOW', status: 'OPEN' },
          },
        ],
      },
    },
  });

  // 6. Seed Ticket 3: High & Resolved
  const ticket3 = await prisma.ticket.create({
    data: {
      subject: 'Invoice amount mismatch for October 2026 billing cycle',
      description: 'The monthly invoice charged us for 15 seats instead of our contracted 10 seats tier.',
      customerId: customer1.id,
      assignedAgentId: agent2.id,
      priority: 'HIGH',
      status: 'RESOLVED',
      resolvedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      firstResponseAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      responseDueAt: eightHoursLater,
      resolutionDueAt: twentyFourHoursLater,
      messages: {
        create: [
          {
            senderId: customerUser1.id,
            content: 'The monthly invoice charged us for 15 seats instead of our contracted 10 seats tier.',
          },
          {
            senderId: agent2.id,
            content: 'Hello John, we verified the contract terms with our finance department and issued credit note #CN-9041 for the excess 5 seats. Revised invoice sent to your email.',
          },
        ],
      },
      internalNotes: {
        create: [
          {
            authorId: agent2.id,
            content: 'Internal Note: Confirmed contract amendment with billing desk. Credit applied successfully.',
          },
        ],
      },
      assignments: {
        create: [
          {
            agentId: agent2.id,
            assignedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
          },
        ],
      },
      events: {
        create: [
          {
            actorId: customerUser1.id,
            eventType: 'TICKET_CREATED',
            newValue: 'Created ticket with priority HIGH',
          },
          {
            actorId: agent2.id,
            eventType: 'AGENT_ASSIGNED',
            newValue: agent2.name,
          },
          {
            actorId: agent2.id,
            eventType: 'FIRST_RESPONSE_RECORDED',
          },
          {
            actorId: agent2.id,
            eventType: 'TICKET_RESOLVED',
            newValue: 'RESOLVED',
          },
        ],
      },
    },
  });

  // 7. Seed Ticket 4: Medium & Pending Customer with SLA Pause
  const ticket4 = await prisma.ticket.create({
    data: {
      subject: 'Webhook delivery failures to our backend endpoint',
      description: 'Since 3 PM yesterday, event webhooks return 500 error codes.',
      customerId: customer3.id,
      assignedAgentId: agent1.id,
      priority: 'MEDIUM',
      status: 'PENDING_CUSTOMER',
      responseDueAt: eightHoursLater,
      resolutionDueAt: twentyFourHoursLater,
      messages: {
        create: [
          {
            senderId: agent1.id,
            content: 'We noticed your server endpoint is returning 502 Bad Gateway. Could you check if your ingress proxy is restarting?',
          },
        ],
      },
      internalNotes: {
        create: [
          {
            authorId: agent1.id,
            content: 'Internal Note: Delivery attempts retried 5 times. SLA paused while awaiting customer server fix.',
          },
        ],
      },
      slaPauses: {
        create: [
          {
            startedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
          },
        ],
      },
      events: {
        create: [
          {
            actorId: agent1.id,
            eventType: 'TICKET_CREATED',
            newValue: 'Created ticket on behalf of customer',
          },
          {
            actorId: agent1.id,
            eventType: 'SLA_PAUSED',
            newValue: 'Status changed to PENDING_CUSTOMER',
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded 4 tickets: #${ticket1.ticketNumber}, #${ticket2.ticketNumber}, #${ticket3.ticketNumber}, #${ticket4.ticketNumber}`);
  console.log('🌱 Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
