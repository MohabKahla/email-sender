// backend/src/services/emailLogger.js
const db = require('../models/db');

/**
 * Log email send attempt
 * @param {number} userId - User ID
 * @param {number} campaignId - Campaign ID (optional)
 * @param {number} recipientId - Recipient ID (optional)
 * @param {string} recipientEmail - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} status - Send status (sent, failed, bounced)
 * @param {string} messageId - Message ID from SMTP server (if sent)
 * @param {string} errorMessage - Error message (if failed)
 * @returns {Promise<Object>} Created log entry
 */
async function logEmailSend(userId, campaignId, recipientId, recipientEmail, subject, status, messageId = null, errorMessage = null) {
  try {
    const result = await db.query(
      `INSERT INTO email_logs (user_id, campaign_id, recipient_id, recipient_email, subject, status, message_id, error_message, sent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [userId, campaignId, recipientId, recipientEmail, subject, status, messageId, errorMessage]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error logging email:', error);
    throw error;
  }
}

/**
 * Get email logs for a campaign
 * @param {number} campaignId - Campaign ID
 * @param {number} userId - User ID (for authorization)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Email logs
 */
async function getEmailLogsByCampaign(campaignId, userId, options = {}) {
  const page = parseInt(options.page) || 1;
  const limit = Math.min(parseInt(options.limit) || 50, 500);
  const offset = (page - 1) * limit;

  try {
    // Verify campaign belongs to user
    const campaignResult = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found or access denied');
    }

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM email_logs WHERE campaign_id = $1',
      [campaignId]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get logs
    const logsResult = await db.query(
      `SELECT id, recipient_email, subject, status, message_id, error_message, sent_at
       FROM email_logs
       WHERE campaign_id = $1
       ORDER BY sent_at DESC
       LIMIT $2 OFFSET $3`,
      [campaignId, limit, offset]
    );

    return {
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error getting campaign logs:', error);
    throw error;
  }
}

/**
 * Get email logs for a user with filtering
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Email logs with pagination
 */
async function getEmailLogsByUser(userId, options = {}) {
  const page = parseInt(options.page) || 1;
  const limit = Math.min(parseInt(options.limit) || 50, 500);
  const offset = (page - 1) * limit;
  const status = options.status; // sent, failed, bounced
  const email = options.email; // Search by recipient email
  const campaignId = options.campaign_id ? parseInt(options.campaign_id) : null;
  const startDate = options.start_date;
  const endDate = options.end_date;

  try {
    // Build WHERE clause
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (email) {
      conditions.push(`recipient_email ILIKE $${paramIndex++}`);
      values.push(`%${email}%`);
    }

    if (campaignId) {
      conditions.push(`campaign_id = $${paramIndex++}`);
      values.push(campaignId);
    }

    if (startDate) {
      conditions.push(`sent_at >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`sent_at <= $${paramIndex++}`);
      values.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM email_logs WHERE ${whereClause}`,
      values
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get logs
    values.push(limit, offset);
    const logsResult = await db.query(
      `SELECT el.*, c.name as campaign_name
       FROM email_logs el
       LEFT JOIN campaigns c ON el.campaign_id = c.id
       WHERE ${whereClause}
       ORDER BY el.sent_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return {
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error getting user logs:', error);
    throw error;
  }
}

/**
 * Get email statistics for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Email statistics
 */
async function getEmailLogStats(userId) {
  try {
    // Overall stats
    const overallResult = await db.query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'sent' THEN 1 END) as total_sent,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
         COUNT(CASE WHEN status = 'bounced' THEN 1 END) as total_bounced
       FROM email_logs
       WHERE user_id = $1`,
      [userId]
    );

    const stats = overallResult.rows[0];
    const total = parseInt(stats.total);
    const totalSent = parseInt(stats.total_sent);

    stats.success_rate = total > 0 ? (totalSent / total).toFixed(2) : 0;

    // Recent activity
    const recentResult = await db.query(
      `SELECT
         COUNT(CASE WHEN sent_at >= CURRENT_DATE THEN 1 END) as today,
         COUNT(CASE WHEN sent_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as this_week,
         COUNT(CASE WHEN sent_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as this_month
       FROM email_logs
       WHERE user_id = $1 AND status = 'sent'`,
      [userId]
    );

    stats.recent_activity = {
      today: parseInt(recentResult.rows[0].today),
      this_week: parseInt(recentResult.rows[0].this_week),
      this_month: parseInt(recentResult.rows[0].this_month)
    };

    // By campaign
    const byCampaignResult = await db.query(
      `SELECT
         c.id as campaign_id,
         c.name as campaign_name,
         COUNT(CASE WHEN el.status = 'sent' THEN 1 END) as sent,
         COUNT(CASE WHEN el.status = 'failed' THEN 1 END) as failed
       FROM email_logs el
       JOIN campaigns c ON el.campaign_id = c.id
       WHERE el.user_id = $1
       GROUP BY c.id, c.name
       ORDER BY c.created_at DESC
       LIMIT 10`,
      [userId]
    );

    stats.by_campaign = byCampaignResult.rows.map(row => ({
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      sent: parseInt(row.sent),
      failed: parseInt(row.failed)
    }));

    return stats;
  } catch (error) {
    console.error('Error getting email stats:', error);
    throw error;
  }
}

/**
 * Export email logs in CSV format
 * @param {number} campaignId - Campaign ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<string>} CSV string
 */
async function exportEmailLogsCSV(campaignId, userId) {
  try {
    // Verify campaign belongs to user
    const campaignResult = await db.query(
      'SELECT id, name FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found or access denied');
    }

    // Get all logs for campaign
    const logsResult = await db.query(
      `SELECT id, recipient_email, subject, status, message_id, error_message, sent_at
       FROM email_logs
       WHERE campaign_id = $1
       ORDER BY sent_at DESC`,
      [campaignId]
    );

    // Build CSV
    const headers = ['id', 'recipient_email', 'subject', 'status', 'message_id', 'error_message', 'sent_at'];
    let csv = headers.join(',') + '\n';

    for (const log of logsResult.rows) {
      const row = [
        log.id,
        `"${log.recipient_email}"`,
        `"${log.subject.replace(/"/g, '""')}"`, // Escape quotes
        log.status,
        log.message_id || '',
        log.error_message ? `"${log.error_message.replace(/"/g, '""')}"` : '',
        log.sent_at.toISOString()
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  } catch (error) {
    console.error('Error exporting logs:', error);
    throw error;
  }
}

module.exports = {
  logEmailSend,
  getEmailLogsByCampaign,
  getEmailLogsByUser,
  getEmailLogStats,
  exportEmailLogsCSV
};
