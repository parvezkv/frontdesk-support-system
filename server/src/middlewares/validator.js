/**
 * Request Body Validation Middleware
 * Validates request bodies against business rules and types before controller execution.
 */

function validateRegister(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters long.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters long.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
}

function validateCreateTicket(req, res, next) {
  const { subject, description, priority } = req.body;
  const errors = [];

  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    errors.push('Subject is required and must be at least 3 characters long.');
  }

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    errors.push('Description is required and must be at least 5 characters long.');
  }

  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  if (priority && !validPriorities.includes(priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}.`);
  }

  // If created by AGENT/ADMIN, customerId or customer details must be identifiable
  if (['ADMIN', 'AGENT'].includes(req.user?.role) && !req.body.customerId && !req.body.customerEmail) {
    errors.push('Either customerId or customerEmail is required when creating a ticket as staff.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
}

function validateMessage(req, res, next) {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message content cannot be empty.',
    });
  }
  next();
}

function validateInternalNote(req, res, next) {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Internal note content cannot be empty.',
    });
  }
  next();
}

function validateAssignTicket(req, res, next) {
  const { agentId } = req.body;
  if (agentId !== undefined && agentId !== null && (typeof agentId !== 'string' || agentId.trim().length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'agentId must be a valid User ID string if provided.',
    });
  }
  next();
}

function validateReassignTicket(req, res, next) {
  const targetId = req.body.agentId || req.body.newAgentId;
  if (!targetId || typeof targetId !== 'string' || targetId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'A valid agentId or newAgentId is required to reassign the ticket.',
    });
  }
  req.body.targetAgentId = targetId.trim();
  next();
}

function validateUpdatePriority(req, res, next) {
  const { priority } = req.body;
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL', 'SMALL'];

  if (!priority || !validPriorities.includes(String(priority).toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}.`,
    });
  }

  // Normalize aliases: CRITICAL -> URGENT, SMALL -> LOW
  const normalized = String(priority).toUpperCase();
  req.body.priority = normalized === 'CRITICAL' ? 'URGENT' : normalized === 'SMALL' ? 'LOW' : normalized;

  next();
}

function validateUpdateStatus(req, res, next) {
  const { status, resolutionSummary } = req.body;
  const validStatuses = ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
    });
  }

  // Business Rule: Resolving or closing a ticket requires a resolution explanation
  if (['RESOLVED', 'CLOSED'].includes(status) && (!resolutionSummary || typeof resolutionSummary !== 'string' || resolutionSummary.trim().length < 5)) {
    return res.status(400).json({
      success: false,
      message: 'A resolutionSummary of at least 5 characters is required when resolving or closing a ticket.',
    });
  }

  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateTicket,
  validateMessage,
  validateInternalNote,
  validateAssignTicket,
  validateReassignTicket,
  validateUpdatePriority,
  validateUpdateStatus,
};
