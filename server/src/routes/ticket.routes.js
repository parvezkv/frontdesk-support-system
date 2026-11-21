const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  validateCreateTicket,
  validateMessage,
  validateInternalNote,
  validateAssignTicket,
  validateReassignTicket,
  validateUpdatePriority,
  validateUpdateStatus,
} = require('../middlewares/validator');

// All ticket endpoints require authentication
router.use(authenticate);

// 1. Ticket Creation & Listing
router.route('/')
  .post(validateCreateTicket, ticketController.createTicket)
  .get(ticketController.listTickets);

// 2. Ticket Detail Retrieval & Export
router.route('/:id')
  .get(ticketController.getTicketById);

router.route('/:id/export')
  .get(ticketController.exportTicket);

// 3. Public Messages (Customer & Staff)
router.route('/:id/messages')
  .post(validateMessage, ticketController.addMessage);

// 4. Internal Notes (Staff only: AGENT, ADMIN)
router.route('/:id/internal-notes')
  .post(authorize('ADMIN', 'AGENT'), validateInternalNote, ticketController.addInternalNote);

// 5. Ticket Ownership & Assignment Lifecycle (Staff only: AGENT, ADMIN)
// 5a. Take or assign an unassigned ticket (with pessimistic lock & 409 conflict handling)
router.post('/:id/assign', authorize('ADMIN', 'AGENT'), validateAssignTicket, ticketController.assignTicket);
router.patch('/:id/assign', authorize('ADMIN', 'AGENT'), validateAssignTicket, ticketController.assignTicket);

// 5b. Reassign an assigned ticket to a different agent (authorized agent or admin)
router.post('/:id/reassign', authorize('ADMIN', 'AGENT'), validateReassignTicket, ticketController.reassignTicket);

// 5c. Release an assigned ticket back to the unassigned pool (authorized agent or admin)
router.post('/:id/release', authorize('ADMIN', 'AGENT'), ticketController.releaseTicket);

// 6. Status Transition
router.route('/:id/status')
  .patch(validateUpdateStatus, ticketController.updateStatus);

// 6b. Reopen a resolved ticket (staff only, with 7-calendar-day window enforcement)
router.post('/:id/reopen', authorize('ADMIN', 'AGENT'), ticketController.reopenTicket);

// 7. Priority Update (recalculates SLA deadlines and logs event history)
router.route('/:id/priority')
  .patch(authorize('ADMIN', 'AGENT'), validateUpdatePriority, ticketController.updatePriority);

// 8. SLA Inspection & Metrics
router.route('/:id/sla')
  .get(ticketController.getTicketSLA);

// 8b. Chronological Audit History (Actor, Action, Timestamp)
router.get('/:id/events', ticketController.getTicketEvents);
router.get('/:id/history', ticketController.getTicketEvents);

// 9. Admin: Trigger auto-closure job manually
router.post('/admin/auto-close', authorize('ADMIN'), ticketController.runAutoClosure);

module.exports = router;
