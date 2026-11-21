const http = require('http');
const app = require('./src/app');
const prisma = require('./src/config/db');

let server;
const PORT = 5099;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body } = options;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting API Verification Test Suite (including Concurrency & Ownership Rules)...\n');
  server = app.listen(PORT);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request('/api/health');
    assert(health.status === 200 && health.data.database === 'CONNECTED', 'Health check returns 200 and database CONNECTED');

    // 2. Authentication: Admin Login
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@frontdesk.com', password: 'password123' },
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin login succeeds and returns JWT');
    assert(!adminLogin.data.user.passwordHash, 'Security: passwordHash is NEVER exposed in login response');
    const adminToken = adminLogin.data.token;

    // 3. Authentication: Customer Login
    const customerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'john.doe@example.com', password: 'password123' },
    });
    assert(customerLogin.status === 200 && customerLogin.data.user.role === 'CUSTOMER', 'Customer login succeeds with CUSTOMER role');
    assert(customerLogin.data.user.customerId, 'Customer user has associated customerId');
    const customerToken = customerLogin.data.token;

    // 4. Authentication: Agent 1 (Sarah) & Agent 2 (Alex) Login
    const agent1Login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'agent.sarah@frontdesk.com', password: 'password123' },
    });
    assert(agent1Login.status === 200 && agent1Login.data.user.role === 'AGENT', 'Agent 1 (Sarah) login succeeds');
    const agent1Token = agent1Login.data.token;

    const agent2Login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'agent.alex@frontdesk.com', password: 'password123' },
    });
    assert(agent2Login.status === 200 && agent2Login.data.user.role === 'AGENT', 'Agent 2 (Alex) login succeeds');
    const agent2Token = agent2Login.data.token;

    // 5. Auth Me
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(meRes.status === 200 && meRes.data.user.email === 'admin@frontdesk.com', 'GET /api/auth/me returns authenticated profile');

    // 6. Ticket Listing: Customer Isolation (RBAC)
    const customerTickets = await request('/api/tickets', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerTickets.status === 200, 'Customer can list tickets');
    const allBelongToCustomer = customerTickets.data.data.every((t) => t.customer.id === customerLogin.data.user.customerId);
    assert(allBelongToCustomer, 'RBAC: Customer only receives their own tickets');
    assert(customerTickets.data.data[0].internalNotes === undefined, 'Security: Listing strictly omits internalNotes');

    // 7. Ticket Listing: Admin View, Filtering & Pagination
    const adminTickets = await request('/api/tickets?limit=2&page=1', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminTickets.status === 200 && adminTickets.data.data.length <= 2, 'Admin receives paginated ticket list');
    assert(adminTickets.data.pagination.total >= 4, 'Pagination total reflects seeded tickets');

    // Search filter
    const searchRes = await request('/api/tickets?search=billing', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(searchRes.status === 200 && searchRes.data.data.length > 0, 'Search by keyword "billing" returns matching tickets');

    // 8. Create Ticket: Customer creates ticket
    const createTicketRes = await request('/api/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        subject: 'API rate limits hitting unexpectedly',
        description: 'Our automated test suite is returning HTTP 429 after 50 calls.',
        priority: 'HIGH',
      },
    });
    assert(createTicketRes.status === 201 && createTicketRes.data.ticket.ticketNumber, 'Customer ticket creation succeeds with ticketNumber');
    assert(createTicketRes.data.ticket.responseDueAt && createTicketRes.data.ticket.responseDueAtIST, 'Ticket generates UTC due date and Asia/Kolkata display');
    const newTicketId = createTicketRes.data.ticket.id;

    // 9. Ticket Detail: Customer View vs Staff View (Security Check)
    const customerDetail = await request(`/api/tickets/${newTicketId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerDetail.status === 200, 'Customer can retrieve their ticket details');
    assert(customerDetail.data.ticket.internalNotes === undefined, 'Security: Customer view DOES NOT expose internalNotes');
    assert(customerDetail.data.ticket.events === undefined, 'Security: Customer view DOES NOT expose internal events');

    // 10. Staff View of Ticket
    const staffDetail = await request(`/api/tickets/${newTicketId}`, {
      headers: { Authorization: `Bearer ${agent1Token}` },
    });
    assert(staffDetail.status === 200, 'Staff can retrieve ticket details');
    assert(Array.isArray(staffDetail.data.ticket.internalNotes), 'Staff view includes internalNotes array');
    assert(Array.isArray(staffDetail.data.ticket.events), 'Staff view includes append-only events');

    // 11. Customer forbidden from viewing other customer tickets
    const otherCustomerTicket = await prisma.ticket.findFirst({
      where: { customer: { email: 'jane.smith@example.com' } },
    });
    const otherCustomerDetail = await request(`/api/tickets/${otherCustomerTicket.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` }, // John Doe
    });
    assert(otherCustomerDetail.status === 403, 'RBAC: Customer receives 403 when trying to access another customer ticket');

    // 12. Public Message Creation & Sender Identity Spoofing Protection
    const messageRes = await request(`/api/tickets/${newTicketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        content: 'Attaching server log traces showing the exact 429 response body.',
        senderId: 'hacked-agent-id', // Client tries to spoof sender identity
      },
    });
    assert(messageRes.status === 201 && messageRes.data.data.content, 'Customer can post public messages on their ticket');
    assert(
      messageRes.data.data.sender.id === customerLogin.data.user.id,
      'Security: Server uses authenticated user identity, ignoring spoofed client senderId'
    );
    assert(messageRes.data.data.sender.role === 'CUSTOMER', 'Sender role correctly reflects authenticated CUSTOMER');

    // 13. Internal Note Creation: Customer blocked (403), Agent allowed (201)
    const custNoteRes = await request(`/api/tickets/${newTicketId}/internal-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { content: 'Attempting to inject internal note as customer.' },
    });
    assert(custNoteRes.status === 403, 'Security: Customer blocked with 403 when attempting to add internal note');

    const agentNoteRes = await request(`/api/tickets/${newTicketId}/internal-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agent1Token}` },
      body: { content: 'SECRET_AGENT_NOTE: Tier was set to Starter instead of Enterprise.' },
    });
    assert(agentNoteRes.status === 201, 'Agent can post internal notes');

    // 13b. Strict Leakage Prevention Tests: Customer cannot see internal note anywhere
    console.log('    Verifying internal notes cannot leak through detail, list, or export...');
    const custDetailCheck = await request(`/api/tickets/${newTicketId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custDetailCheck.data.ticket.internalNotes === undefined, 'Leak Check 1: Customer detail response strictly omits internalNotes');
    const noteFoundInMessages = custDetailCheck.data.ticket.messages.some((m) => m.content.includes('SECRET_AGENT_NOTE'));
    assert(!noteFoundInMessages, 'Leak Check 2: Internal notes are never mixed into customer messages conversation');

    // Customer Export Leak Check
    const custExportCheck = await request(`/api/tickets/${newTicketId}/export`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custExportCheck.status === 200, 'Customer can export their ticket conversation');
    assert(custExportCheck.data.export.internalNotes === undefined, 'Leak Check 3: Customer export strictly omits internalNotes');
    const noteFoundInExportConv = custExportCheck.data.export.conversation.some((c) => c.message.includes('SECRET_AGENT_NOTE'));
    assert(!noteFoundInExportConv, 'Leak Check 4: Internal notes never appear in customer export conversation');

    // Staff Export Check
    const staffExportCheck = await request(`/api/tickets/${newTicketId}/export`, {
      headers: { Authorization: `Bearer ${agent1Token}` },
    });
    assert(staffExportCheck.status === 200, 'Staff can export full ticket audit');
    assert(Array.isArray(staffExportCheck.data.export.internalNotes), 'Staff export correctly includes internalNotes in distinct section');
    assert(staffExportCheck.data.export.internalNotes[0].note.includes('SECRET_AGENT_NOTE'), 'Staff export contains internal note content');

    // Audit Event Leak Check: event does NOT leak private note content in newValue
    const noteAuditEvents = await prisma.ticketEvent.findMany({
      where: { ticketId: newTicketId, eventType: 'INTERNAL_NOTE_ADDED' },
    });
    assert(noteAuditEvents.length > 0, 'Audit trail recorded INTERNAL_NOTE_ADDED');
    assert(
      !noteAuditEvents.some((e) => e.newValue?.includes('SECRET_AGENT_NOTE')),
      'Leak Check 5: Internal note content is NEVER stored or leaked in TicketEvent audit summary'
    );

    // --------------------------------------------------------------------------
    // CONCURRENCY & OWNERSHIP RULES TESTS
    // --------------------------------------------------------------------------
    console.log('\n  ⚡ Testing Concurrency & Ownership Rules...');

    // A. Create a fresh unassigned ticket for concurrent race condition testing
    const unassignedTicketRes = await request('/api/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        subject: 'Database connection pool starvation during spike',
        description: 'Postgres server reports too many clients connected.',
        priority: 'URGENT',
      },
    });
    const raceTicketId = unassignedTicketRes.data.ticket.id;
    assert(raceTicketId && unassignedTicketRes.data.ticket.assignedAgentId === null, 'Created unassigned ticket for concurrency simulation');

    // B. Simulate two different agents trying to take the exact same ticket CONCURRENTLY
    console.log('    Firing simultaneous POST /api/tickets/:id/assign requests from Agent 1 and Agent 2...');
    const [raceRes1, raceRes2] = await Promise.all([
      request(`/api/tickets/${raceTicketId}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent1Token}` },
        body: {}, // Takes for self
      }),
      request(`/api/tickets/${raceTicketId}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent2Token}` },
        body: {}, // Takes for self
      }),
    ]);

    const results = [raceRes1, raceRes2];
    const successRes = results.find((r) => r.status === 200);
    const conflictRes = results.find((r) => r.status === 409);

    assert(successRes !== undefined, 'Concurrency: Exactly one agent request succeeded with 200 OK');
    assert(conflictRes !== undefined, 'Concurrency: The competing agent request was rejected with 409 Conflict');
    assert(
      conflictRes && conflictRes.data.message && conflictRes.data.message.includes('already been assigned'),
      `Concurrency: 409 response contains clear conflict message: "${conflictRes?.data?.message}"`
    );

    // C. Database Verification: Active assignment count and status
    const activeAssignments = await prisma.ticketAssignment.findMany({
      where: { ticketId: raceTicketId, releasedAt: null },
    });
    assert(activeAssignments.length === 1, 'Database Integrity: Exactly one active assignment exists in PostgreSQL');

    const lockedTicketDb = await prisma.ticket.findUnique({
      where: { id: raceTicketId },
    });
    assert(lockedTicketDb.assignedAgentId !== null, 'Ticket assignedAgentId is populated');
    assert(lockedTicketDb.status === 'IN_PROGRESS', 'Ticket status transitioned from OPEN to IN_PROGRESS upon assignment');

    const winningAgentId = lockedTicketDb.assignedAgentId;
    const losingAgentId = winningAgentId === agent1Login.data.user.id ? agent2Login.data.user.id : agent1Login.data.user.id;
    const winningToken = winningAgentId === agent1Login.data.user.id ? agent1Token : agent2Token;
    const losingToken = winningAgentId === agent1Login.data.user.id ? agent2Token : agent1Token;

    // D. Reassignment: Unauthorized agent cannot reassign someone else's ticket
    const unauthorizedReassign = await request(`/api/tickets/${raceTicketId}/reassign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${losingToken}` },
      body: { agentId: losingAgentId },
    });
    assert(unauthorizedReassign.status === 403, 'Security: Unauthorized agent receives 403 Forbidden when trying to reassign someone else\'s ticket');

    // E. Reassignment: Currently assigned agent successfully reassigns to the other agent
    const successfulReassign = await request(`/api/tickets/${raceTicketId}/reassign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${winningToken}` },
      body: { agentId: losingAgentId },
    });
    assert(successfulReassign.status === 200, 'Authorized agent successfully reassigns ticket');
    assert(successfulReassign.data.ticket.assignedAgentId === losingAgentId, 'Ticket assignedAgentId updated to new agent');

    // Verify history preserved: exactly 1 released assignment and 1 active assignment
    const allAssignmentsAfterReassign = await prisma.ticketAssignment.findMany({
      where: { ticketId: raceTicketId },
      orderBy: { assignedAt: 'asc' },
    });
    assert(allAssignmentsAfterReassign.length === 2, 'History preserved: 2 assignment records exist in database');
    assert(allAssignmentsAfterReassign[0].releasedAt !== null, 'Previous assignment has releasedAt timestamp');
    assert(allAssignmentsAfterReassign[1].releasedAt === null, 'New assignment is active (releasedAt is null)');

    // Verify append-only TicketEvent logged AGENT_REASSIGNED
    const reassignEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId: raceTicketId, eventType: 'AGENT_REASSIGNED' },
    });
    assert(reassignEvent !== null, 'TicketEvent audit trail recorded AGENT_REASSIGNED');

    // F. Release: Unauthorized agent cannot release someone else's ticket
    const unauthorizedRelease = await request(`/api/tickets/${raceTicketId}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${winningToken}` }, // No longer assigned to winningToken
    });
    assert(unauthorizedRelease.status === 403, 'Security: Unauthorized agent receives 403 Forbidden when trying to release someone else\'s ticket');

    // G. Release: Currently assigned agent releases the ticket
    const successfulRelease = await request(`/api/tickets/${raceTicketId}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${losingToken}` }, // currently assigned to losingAgentId
    });
    assert(successfulRelease.status === 200, 'Currently assigned agent successfully releases ticket');
    assert(successfulRelease.data.ticket.assignedAgentId === null, 'Ticket assignedAgentId is now null (unassigned)');
    assert(successfulRelease.data.ticket.status === 'OPEN', 'Ticket status reverted to OPEN upon release');

    // Verify history preserved
    const allAssignmentsAfterRelease = await prisma.ticketAssignment.findMany({
      where: { ticketId: raceTicketId },
    });
    assert(allAssignmentsAfterRelease.every((a) => a.releasedAt !== null), 'History preserved: All past assignments have releasedAt timestamps recorded');

    // Verify append-only TicketEvent logged AGENT_RELEASED
    const releaseEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId: raceTicketId, eventType: 'AGENT_RELEASED' },
    });
    assert(releaseEvent !== null, 'TicketEvent audit trail recorded AGENT_RELEASED');

    // H. Double release returns 400 Bad Request
    const doubleRelease = await request(`/api/tickets/${raceTicketId}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(doubleRelease.status === 400, 'Calling release on an already unassigned ticket returns 400 Bad Request');

    // 14. Priority Change & SLA Recalculation (Rule 6)
    console.log('\n  ⚡ Testing SLA Recalculation & Priority Updates (Rule 6)...');
    const priorityUpdateRes = await request(`/api/tickets/${newTicketId}/priority`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agent1Token}` },
      body: { priority: 'CRITICAL' },
    });
    assert(priorityUpdateRes.status === 200, 'Staff can update ticket priority to CRITICAL');
    assert(priorityUpdateRes.data.ticket.priority === 'URGENT', 'Priority normalized and updated in database');
    assert(priorityUpdateRes.data.ticket.responseDueAt && priorityUpdateRes.data.ticket.resolutionDueAt, 'Deadlines recalculated from priority-change time');

    // Verify PRIORITY_CHANGED event logged with previous deadlines preserved
    const priorityEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId: newTicketId, eventType: 'PRIORITY_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(priorityEvent !== null, 'TicketEvent logged PRIORITY_CHANGED');
    assert(priorityEvent.metadata.previousResponseDueAt, 'Previous response due date preserved in event metadata');
    assert(priorityEvent.metadata.newResponseDueAt, 'New response due date recorded in event metadata');

    // 15. SLA Inspection Endpoint
    console.log('\n  ⚡ Testing SLA Inspection Endpoint...');
    const slaInspectRes = await request(`/api/tickets/${newTicketId}/sla`, {
      headers: { Authorization: `Bearer ${agent1Token}` },
    });
    assert(slaInspectRes.status === 200, 'GET /api/tickets/:id/sla returns 200 OK');
    assert(slaInspectRes.data.data.workingHoursConfig.timezone.includes('Asia/Kolkata'), 'SLA config specifies Asia/Kolkata');
    assert(slaInspectRes.data.data.slaDeadlines.responseDueAt, 'SLA response deadline returned');
    assert(slaInspectRes.data.data.evaluation.overdueStatus, 'SLA evaluation object returned');

    // 16. Customer Reply Resumes Paused SLA (Rules 2, 3, 4, 5)
    console.log('\n  ⚡ Testing SLA Pause & Resume on Customer Reply (Rules 2, 4)...');
    // Set status to WAITING_FOR_CUSTOMER
    const pauseStatusRes = await request(`/api/tickets/${newTicketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agent1Token}` },
      body: { status: 'WAITING_FOR_CUSTOMER' },
    });
    assert(pauseStatusRes.status === 200 && pauseStatusRes.data.ticket.status === 'WAITING_FOR_CUSTOMER', 'Ticket transitioned to WAITING_FOR_CUSTOMER');

    const openPauseRecord = await prisma.sLAPause.findFirst({
      where: { ticketId: newTicketId, endedAt: null },
    });
    assert(openPauseRecord !== null, 'Active SLAPause record created in database');

    // Customer sends message -> automatically resumes SLA clock, closes pause, and updates status to IN_PROGRESS
    const customerResumeMsg = await request(`/api/tickets/${newTicketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { content: 'Here is the requested tenant information.' },
    });
    assert(customerResumeMsg.status === 201, 'Customer message posted successfully');

    const ticketAfterResume = await prisma.ticket.findUnique({ where: { id: newTicketId } });
    assert(ticketAfterResume.status === 'IN_PROGRESS', 'Customer reply automatically transitions status back to IN_PROGRESS');

    const closedPauseRecord = await prisma.sLAPause.findUnique({ where: { id: openPauseRecord.id } });
    assert(closedPauseRecord.endedAt !== null, 'SLAPause endedAt timestamp recorded');

    const resumeEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId: newTicketId, eventType: 'SLA_RESUMED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(resumeEvent !== null, 'TicketEvent logged SLA_RESUMED audit trail');

    // 17. Status update: Validation and Resolution
    const invalidStatusRes = await request(`/api/tickets/${newTicketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agent1Token}` },
      body: { status: 'RESOLVED' }, // Missing resolutionSummary
    });
    assert(invalidStatusRes.status === 400, 'Validation: Transition to RESOLVED requires resolutionSummary');

    const resolveRes = await request(`/api/tickets/${newTicketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agent1Token}` },
      body: {
        status: 'RESOLVED',
        resolutionSummary: 'Updated rate limits on API gateway to Enterprise tier (5,000 req/min).',
      },
    });
    assert(resolveRes.status === 200 && resolveRes.data.ticket.status === 'RESOLVED', 'Ticket status successfully updated to RESOLVED');
    assert(resolveRes.data.ticket.resolvedAt, 'resolvedAt timestamp recorded in UTC');

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
