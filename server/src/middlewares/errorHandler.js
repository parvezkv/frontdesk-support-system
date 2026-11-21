/**
 * Centralized Application Error Handling Middleware
 */

function errorHandler(err, req, res, next) {
  console.error('Unhandled Application Error:', err);

  // Prisma Unique Constraint Violation
  if (err.code === 'P2002') {
    const target = err.meta?.target ? ` (${err.meta.target.join(', ')})` : '';
    return res.status(409).json({
      success: false,
      message: `A record with this unique field${target} already exists.`,
    });
  }

  // Prisma Record Not Found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: err.meta?.cause || 'The requested resource was not found.',
    });
  }

  // Prisma Foreign Key Constraint Failure
  if (err.code === 'P2003') {
    return res.status(400).json({
      success: false,
      message: 'Foreign key constraint failed. Related record does not exist.',
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token has expired. Please re-authenticate.',
    });
  }

  // Standard or Custom Status Code
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
