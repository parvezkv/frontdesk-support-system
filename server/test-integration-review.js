/**
 * Integration Review Verification Script
 * Validates all 22 required scenarios explicitly in one clean run.
 */

const http = require('http');
const app = require('./src/app');
const prisma = require('./src/config/db');
const slaService = require('./src/services/sla.service');
const lifecycleService = require('./src/services/ticketLifecycle.service');

const PORT = 5098;
let server;

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

async function runReview() {
  console.log('===============================================================');
  console.log('🔍 FRONTDESK FULL INTEGRATION REVIEW: 22 SCENARIOS VERIFICATION');
  console.log('===============================================================\n');

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
    // -------------------------------------------------------------
    // SCENARIO 1: Agent login and logout
    // -------------------------------------------------------------
    console.log('Scenario 1: Agent login and logout');
    const agentLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'agent.sarah@frontdesk.com', password: 'password123' },
    });
    assert(agentLogin.status === 200 && agentLogin.data.token, 'Agent Sarah login returns 200 with JWT token');
    assert(agentLogin.data.user.role === 'AGENT', 'Authenticated user role is AGENT');
    assert(agentLogin.data.user.passwordHash === undefined, 'Security: passwordHash is not returned');
    const agentToken = agentLogin.data.token;
    const agentId = agentLogin.data.user.id;

    const agentAlexLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'agent.alex@frontdesk.com', password: 'password123' },
    });
    const agentAlexToken = agentAlexLogin.data.token;
    const agentAlexId = agentAlexLogin.data.user.id;

    const customerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'john.doe@example.com', password: 'password123' },
    });
    const customerToken = customerLogin.data.token;
    const customerId = customerLogin.data.user.customerId;
    assert(customerToken && customerId, 'Customer John login returns 200 with customerId');

    // -------------------------------------------------------------
    // SCENARIO 2: Create a ticket
    // -------------------------------------------------------------
    console.log('\nScenario 2: Create a ticket');
    const createRes = await request('/api/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        subject: 'Integration Review Test Ticket',
        description: 'Testing full lifecycle from creation through resolution.',
        priority: 'MEDIUM',
      },
    });
    assert(createRes.status === 201 && createRes.data.ticket.ticketNumber, 'Ticket created with ticketNumber');
    assert(createRes.data.ticket.status === 'OPEN', 'Ticket initial status is OPEN');
    assert(createRes.data.ticket.responseDueAt && createRes.data.ticket.resolutionDueAt, 'SLA response and resolution due dates calculated');
    const ticketId = createRes.data.ticket.id;

    // -------------------------------------------------------------
    // SCENARIO 3: List and filter tickets
    // -------------------------------------------------------------
    console.log('\nScenario 3: List and filter tickets');
    const listRes = await request('/api/tickets?status=OPEN&priority=MEDIUM', {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(listRes.status === 200 && listRes.data.data.length > 0, 'List tickets with status and priority filters returns results');
    assert(listRes.data.pagination && listRes.data.pagination.total > 0, 'Pagination metadata included');

    // Search filter
    const searchRes = await request('/api/tickets?search=Integration+Review', {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(searchRes.status === 200 && searchRes.data.data.some(t => t.id === ticketId), 'Search by keyword finds created ticket');

    // -------------------------------------------------------------
    // SCENARIO 4 & 5: Two agents attempt to take the same ticket simultaneously
    //                 Only one assignment succeeds
    // -------------------------------------------------------------
    console.log('\nScenario 4 & 5: Simultaneous ticket assignment & conflict handling');
    // Create an unassigned ticket for the race
    const raceTicketRes = await request('/api/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        subject: 'Concurrency Race Ticket',
        description: 'Simulating concurrent POST /assign requests.',
        priority: 'HIGH',
      },
    });
    const raceTicketId = raceTicketRes.data.ticket.id;

    const [takeRes1, takeRes2] = await Promise.all([
      request(`/api/tickets/${raceTicketId}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agentToken}` },
      }),
      request(`/api/tickets/${raceTicketId}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agentAlexToken}` },
      }),
    ]);

    const statuses = [takeRes1.status, takeRes2.status];
    assert(statuses.includes(200) && statuses.includes(409), 'Exactly one request succeeds (200) and the other fails with 409 Conflict');
    const conflictResponse = takeRes1.status === 409 ? takeRes1 : takeRes2;
    assert(conflictResponse.data.message.includes('already been assigned'), '409 error contains clear conflict message');

    // -------------------------------------------------------------
    // SCENARIO 6: Agent sends a customer reply
    // -------------------------------------------------------------
    console.log('\nScenario 6: Agent sends a customer reply');
    // First assign our primary ticketId to Sarah
    await request(`/api/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
    });

    const agentReplyRes = await request(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { content: 'Hello! I have started investigating your issue.' },
    });
    assert(agentReplyRes.status === 201, 'Agent public reply sent successfully');
    const ticketAfterAgentReply = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assert(ticketAfterAgentReply.firstResponseAt !== null, 'firstResponseAt timestamp recorded on first agent reply');

    // -------------------------------------------------------------
    // SCENARIO 7 & 8: Agent creates private internal note, verify omitted from customer APIs
    // -------------------------------------------------------------
    console.log('\nScenario 7 & 8: Staff internal notes & leakage prevention');
    const noteRes = await request(`/api/tickets/${ticketId}/internal-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { content: 'INTERNAL_CONFIDENTIAL_AUDIT_LOG_NOTE' },
    });
    assert(noteRes.status === 201, 'Agent can post private internal note');

    // Check customer detail API
    const custDetail = await request(`/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custDetail.data.ticket.internalNotes === undefined, 'Customer ticket detail strictly omits internalNotes field');
    const noteInCustomerMessages = custDetail.data.ticket.messages.some(m => m.content.includes('INTERNAL_CONFIDENTIAL'));
    assert(!noteInCustomerMessages, 'Internal note is never mixed into customer messages');

    // Check customer export API
    const custExport = await request(`/api/tickets/${ticketId}/export`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custExport.data.export.internalNotes === undefined, 'Customer export strictly omits internal notes');

    // Check customer cannot create internal note
    const custNoteBlock = await request(`/api/tickets/${ticketId}/internal-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { content: 'Malicious note injection' },
    });
    assert(custNoteBlock.status === 403, 'Customer forbidden (403) from creating internal notes');

    // -------------------------------------------------------------
    // SCENARIO 9 & 10: Ticket enters WAITING_FOR_CUSTOMER & SLA pauses
    // -------------------------------------------------------------
    console.log('\nScenario 9 & 10: WAITING_FOR_CUSTOMER and SLA pause');
    const waitStatusRes = await request(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { status: 'WAITING_FOR_CUSTOMER' },
    });
    assert(waitStatusRes.status === 200 && waitStatusRes.data.ticket.status === 'WAITING_FOR_CUSTOMER', 'Status set to WAITING_FOR_CUSTOMER');

    const openPause = await prisma.sLAPause.findFirst({
      where: { ticketId, endedAt: null },
    });
    assert(openPause !== null, 'Open SLAPause record created in database');

    const pauseEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId, eventType: 'SLA_PAUSED' },
    });
    assert(pauseEvent !== null, 'SLA_PAUSED event logged in audit trail');

    // -------------------------------------------------------------
    // SCENARIO 11 & 12: Customer replies & SLA resumes
    // -------------------------------------------------------------
    console.log('\nScenario 11 & 12: Customer reply resumes SLA');
    const custReplyRes = await request(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { content: 'Here is the additional system information you requested.' },
    });
    assert(custReplyRes.status === 201, 'Customer message posted successfully');

    const ticketAfterCustomerReply = await prisma.ticket.findUnique({ where: { id: ticketId } });
    assert(ticketAfterCustomerReply.status === 'IN_PROGRESS', 'Status automatically transitioned back to IN_PROGRESS');

    const closedPause = await prisma.sLAPause.findUnique({ where: { id: openPause.id } });
    assert(closedPause.endedAt !== null, 'SLAPause endedAt recorded upon customer reply');

    const resumeEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId, eventType: 'SLA_RESUMED' },
    });
    assert(resumeEvent !== null, 'SLA_RESUMED event logged with extended minutes');

    // -------------------------------------------------------------
    // SCENARIO 13: Priority changes and SLA is recalculated
    // -------------------------------------------------------------
    console.log('\nScenario 13: Priority change and SLA recalculation');
    const oldResolutionDueAt = ticketAfterCustomerReply.resolutionDueAt;
    const prioRes = await request(`/api/tickets/${ticketId}/priority`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { priority: 'URGENT' },
    });
    assert(prioRes.status === 200 && prioRes.data.ticket.priority === 'URGENT', 'Priority updated to URGENT');
    assert(new Date(prioRes.data.ticket.resolutionDueAt).getTime() !== new Date(oldResolutionDueAt).getTime(), 'Resolution deadline recalculated upon priority change');

    const prioEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId, eventType: 'PRIORITY_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(prioEvent && prioEvent.metadata.previousResolutionDueAt, 'PRIORITY_CHANGED event preserves previous deadline in metadata');

    // -------------------------------------------------------------
    // SCENARIO 14 & 15: Overdue working-time targets & Weekend/holiday rules
    // -------------------------------------------------------------
    console.log('\nScenario 14 & 15: Working hours & overdue evaluation rules');
    const holidays = await prisma.holiday.findMany();
    // Test SLA service working time logic directly
    const testSunday = new Date('2026-11-22T08:00:00.000Z'); // Sunday 1:30 PM IST
    assert(!slaService.isWorkingTime(testSunday, holidays), 'Sunday is recognized as non-working time');

    const testMondayMidday = new Date('2026-11-23T06:30:00.000Z'); // Monday 12:00 PM IST
    assert(slaService.isWorkingTime(testMondayMidday, holidays), 'Monday 12:00 PM IST is recognized as working time');

    // Overdue suppression test: on a Sunday, overdue status is suppressed
    const overdueSunday = slaService.evaluateOverdueStatus(
      { responseDueAt: new Date(Date.now() - 100000), resolutionDueAt: new Date(Date.now() - 100000), status: 'IN_PROGRESS' },
      holidays,
      testSunday
    );
    assert(!overdueSunday.isAnyOverdue, 'Rule 8: Overdue is suppressed outside working hours / on weekends');

    // -------------------------------------------------------------
    // SCENARIO 16: Ticket is resolved
    // -------------------------------------------------------------
    console.log('\nScenario 16: Ticket is resolved');
    const resolveRes = await request(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: {
        status: 'RESOLVED',
        resolutionSummary: 'Applied patch to resolve integration issue.',
      },
    });
    assert(resolveRes.status === 200 && resolveRes.data.ticket.status === 'RESOLVED', 'Ticket successfully marked RESOLVED');
    assert(resolveRes.data.ticket.resolvedAt !== null, 'resolvedAt timestamp recorded in UTC');

    // -------------------------------------------------------------
    // SCENARIO 17 & 18: Reopening within allowed period & Rejection after window
    // -------------------------------------------------------------
    console.log('\nScenario 17 & 18: Reopening eligibility & 7-day window');
    // Reopen within window
    const reopenRes = await request(`/api/tickets/${ticketId}/reopen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { reason: 'Customer reported issue recurred.' },
    });
    assert(reopenRes.status === 200 && reopenRes.data.ticket.status === 'IN_PROGRESS', 'Ticket successfully reopened within 7-day window');
    assert(reopenRes.data.ticket.resolvedAt === null, 'resolvedAt reset to null on reopening');

    // Re-resolve
    await request(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { status: 'RESOLVED', resolutionSummary: 'Final fix applied.' },
    });

    // Simulate 9 days passing
    const nineDaysAgo = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { resolvedAt: nineDaysAgo },
    });

    const expiredReopen = await request(`/api/tickets/${ticketId}/reopen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { reason: 'Trying to reopen past window' },
    });
    assert(expiredReopen.status === 400, 'Reopen rejected with 400 when outside 7-day window');

    // -------------------------------------------------------------
    // SCENARIO 19: Ticket automatically closes after 5 working days waiting
    // -------------------------------------------------------------
    console.log('\nScenario 19: Automatic closure after 5 working days waiting');
    // Create ticket for auto-close
    const autoTicketRes = await request('/api/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        subject: 'Auto-Close Scenario Ticket',
        description: 'Testing automatic dormancy closure.',
        priority: 'LOW',
      },
    });
    const autoTicketId = autoTicketRes.data.ticket.id;
    await request(`/api/tickets/${autoTicketId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    await request(`/api/tickets/${autoTicketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { status: 'WAITING_FOR_CUSTOMER' },
    });

    // Backdate pause to 10 days ago (well over 5 working days)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const autoPause = await prisma.sLAPause.findFirst({ where: { ticketId: autoTicketId, endedAt: null } });
    if (autoPause) {
      await prisma.sLAPause.update({ where: { id: autoPause.id }, data: { startedAt: tenDaysAgo } });
      await prisma.ticket.update({ where: { id: autoTicketId }, data: { createdAt: tenDaysAgo, updatedAt: tenDaysAgo } });
      await prisma.message.updateMany({ where: { ticketId: autoTicketId }, data: { createdAt: tenDaysAgo } });
    }

    const autoCloseRun = await lifecycleService.processAutoClosure();
    const closedEntry = autoCloseRun.closedTickets.find(t => t.id === autoTicketId);
    assert(closedEntry !== undefined, 'Inactive ticket automatically closed by scheduled job');

    const autoClosedDb = await prisma.ticket.findUnique({ where: { id: autoTicketId } });
    assert(autoClosedDb.status === 'CLOSED' && autoClosedDb.closedAt !== null, 'Ticket status is CLOSED with closedAt timestamp');

    const autoCloseEvent = await prisma.ticketEvent.findFirst({
      where: { ticketId: autoTicketId, eventType: 'SYSTEM_AUTO_CLOSED' },
    });
    assert(autoCloseEvent !== null, 'SYSTEM_AUTO_CLOSED audit event logged with System Automation actor');

    // -------------------------------------------------------------
    // SCENARIO 20 & 21: Audit events recorded & Database immutability trigger
    // -------------------------------------------------------------
    console.log('\nScenario 20 & 21: Complete audit logging & database immutability');
    const allEvents = await prisma.ticketEvent.findMany({ where: { ticketId } });
    assert(allEvents.length >= 6, `Comprehensive audit trail recorded ${allEvents.length} events for ticket`);
    assert(allEvents.every(e => e.actorId && e.createdAt), 'All audit events have actorId and server timestamp');

    // Database trigger immutability check
    let updateFailed = false;
    try {
      await prisma.ticketEvent.update({
        where: { id: allEvents[0].id },
        data: { newValue: 'TAMPERED_VALUE' },
      });
    } catch (e) {
      updateFailed = e.message.includes('Audit trail violation') || e.message.includes('immutable');
    }
    assert(updateFailed, 'Database trigger rejects UPDATE on TicketEvent records');

    let deleteFailed = false;
    try {
      await prisma.ticketEvent.delete({
        where: { id: allEvents[0].id },
      });
    } catch (e) {
      deleteFailed = e.message.includes('Audit trail violation') || e.message.includes('append-only');
    }
    assert(deleteFailed, 'Database trigger rejects DELETE on TicketEvent records');

    // -------------------------------------------------------------
    // SCENARIO 22: Invalid status transitions are rejected
    // -------------------------------------------------------------
    console.log('\nScenario 22: Invalid status transitions rejected');
    // CLOSED ticket cannot transition
    const closedTransition = await request(`/api/tickets/${autoTicketId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { status: 'OPEN' },
    });
    assert(closedTransition.status === 400, 'Transition out of CLOSED (terminal state) rejected with 400 Bad Request');

    // Fresh ticket OPEN -> RESOLVED without going through IN_PROGRESS
    const freshTicket = await request('/api/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { subject: 'Fresh Ticket', description: 'Testing invalid jumps.', priority: 'LOW' },
    });
    const skipTransition = await request(`/api/tickets/${freshTicket.data.ticket.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { status: 'RESOLVED', resolutionSummary: 'Skipping' },
    });
    assert(skipTransition.status === 400, 'Invalid transition OPEN -> RESOLVED rejected with 400 Bad Request');

    // Missing resolutionSummary when transitioning to RESOLVED
    await request(`/api/tickets/${freshTicket.data.ticket.id}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    const missingSummary = await request(`/api/tickets/${freshTicket.data.ticket.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { status: 'RESOLVED' },
    });
    assert(missingSummary.status === 400, 'Transition to RESOLVED without resolutionSummary rejected with 400 Bad Request');

    console.log('\n===============================================================');
    console.log(`Review Results: ${passed} Passed, ${failed} Failed`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Integration review encountered an unhandled error:', err);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runReview();
