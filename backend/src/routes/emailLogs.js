// backend/src/routes/emailLogs.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getEmailLogsByUser, getEmailLogStats } = require('../services/emailLogger');

const router = express.Router();

// All email log routes require authentication
router.use(authenticateToken);

/**
 * GET /api/email-logs
 * Get user's email logs with filtering
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      email: req.query.email,
      campaign_id: req.query.campaign_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };

    const result = await getEmailLogsByUser(userId, options);

    res.json(result);
  } catch (error) {
    console.error('Get email logs error:', error);
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: 'An error occurred while retrieving email logs'
    });
  }
});

/**
 * GET /api/email-logs/stats
 * Get email statistics for user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await getEmailLogStats(userId);

    res.json(stats);
  } catch (error) {
    console.error('Get email stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: 'An error occurred while retrieving email statistics'
    });
  }
});

module.exports = router;
