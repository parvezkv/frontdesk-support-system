const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const errorHandler = require('./middlewares/errorHandler');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');

const app = express();

// Middleware
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Base API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Frontdesk Support System API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
      },
      tickets: {
        list: 'GET /api/tickets',
        create: 'POST /api/tickets',
        detail: 'GET /api/tickets/:id',
        message: 'POST /api/tickets/:id/messages',
        internalNote: 'POST /api/tickets/:id/internal-notes',
        assign: 'PATCH /api/tickets/:id/assign',
        status: 'PATCH /api/tickets/:id/status',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
