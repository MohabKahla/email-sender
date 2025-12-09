// backend/src/routes/dashboard.js
// Dashboard statistics and data endpoints

const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for the authenticated user
 */
router.get('/stats', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  console.log('=== DASHBOARD STATS REQUEST ===');
  console.log('User ID:', userId);
  console.log('User Email:', req.user.email);
  console.log('Full req.user:', req.user);

  try {
    // Check if SMTP is configured
    const smtpCheck = await pool.query(
      'SELECT id FROM smtp_configs WHERE user_id = $1',
      [userId]
    );
    const smtp_configured = smtpCheck.rows.length > 0;

    // Get total campaigns count
    const campaignsCount = await pool.query(
      'SELECT COUNT(*) as count FROM campaigns WHERE user_id = $1',
      [userId]
    );
    const total_campaigns = parseInt(campaignsCount.rows[0].count);
    console.log('Total campaigns found:', total_campaigns);

    // Get total sent and failed counts
    const emailStats = await pool.query(
      `SELECT
        COALESCE(SUM(sent_count), 0) as total_sent,
        COALESCE(SUM(failed_count), 0) as total_failed
      FROM campaigns
      WHERE user_id = $1`,
      [userId]
    );
    const total_sent = parseInt(emailStats.rows[0].total_sent);
    const total_failed = parseInt(emailStats.rows[0].total_failed);

    // Get recent 5 campaigns
    const recentCampaigns = await pool.query(
      `SELECT
        id,
        name,
        status,
        recipient_count,
        sent_count,
        failed_count,
        created_at
      FROM campaigns
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5`,
      [userId]
    );

    res.json({
      smtp_configured,
      total_campaigns,
      total_sent,
      total_failed,
      recent_campaigns: recentCampaigns.rows
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

module.exports = router;
