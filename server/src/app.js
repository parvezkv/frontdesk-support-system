const express = require('express');
const cors = require('cors');
const path = require('path');
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

// ----- Production: Serve React frontend build -----
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback: any non-API route serves index.html so React Router handles it
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  const fs = require('fs');
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// 404 handler (only for /api routes that didn't match)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
