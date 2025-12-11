// backend/src/server.js
// Basic Express server for Phase 1 testing

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required when behind nginx/reverse proxy
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const smtpRoutes = require('./routes/smtp');
const campaignRoutes = require('./routes/campaigns');
const emailLogRoutes = require('./routes/emailLogs');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/email-logs', emailLogRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint (for Docker health checks)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'email-sender-backend',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Email Sender API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      smtp: '/api/smtp/*',
      campaigns: '/api/campaigns/*',
      email_logs: '/api/email-logs/*',
      dashboard: '/api/dashboard/*'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📧 Email Sender API is ready!`);
  });
}

// Export for testing
module.exports = app;
