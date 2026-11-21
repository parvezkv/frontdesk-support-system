const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'CONNECTED',
      service: 'Frontdesk Support System API',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'DEGRADED',
      timestamp: new Date().toISOString(),
      database: 'DISCONNECTED',
      error: error.message,
    });
  }
});

module.exports = router;
