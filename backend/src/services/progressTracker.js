// backend/src/services/progressTracker.js
const db = require('../models/db');

/**
 * Get campaign progress with statistics
 * @param {number} campaignId - Campaign ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<Object>} Campaign progress data
 */
async function getCampaignProgress(campaignId, userId) {
  try {
    // Get campaign details
    const campaignResult = await db.query(
      `SELECT id, name, subject, status, recipient_count, sent_count, failed_count,
              started_at, completed_at, created_at, updated_at
       FROM campaigns
       WHERE id = $1 AND user_id = $2`,
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found or access denied');
    }

    const campaign = campaignResult.rows[0];

    // Calculate progress
    const progress = calculateProgress(campaign);

    // Calculate timing information
    const timing = calculateTiming(campaign);

    // Get recent sends (last 10)
    const recentResult = await db.query(
      `SELECT recipient_email as email, status, sent_at
       FROM email_logs
       WHERE campaign_id = $1
       ORDER BY sent_at DESC
       LIMIT 10`,
      [campaignId]
    );

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        created_at: campaign.created_at,
        started_at: campaign.started_at,
        completed_at: campaign.completed_at
      },
      progress,
      timing,
      recent_sends: recentResult.rows
    };
  } catch (error) {
    console.error('Error getting campaign progress:', error);
    throw error;
  }
}

/**
 * Calculate progress statistics
 * @param {Object} campaign - Campaign object
 * @returns {Object} Progress statistics
 */
function calculateProgress(campaign) {
  const total = campaign.recipient_count;
  const sent = campaign.sent_count;
  const failed = campaign.failed_count;
  const pending = total - sent - failed;

  // Calculate percentage (0-100)
  const percentage = total > 0
    ? Math.round(((sent + failed) / total) * 100 * 10) / 10 // Round to 1 decimal
    : 0;

  // Calculate success rate (0-1)
  const successRate = (sent + failed) > 0
    ? parseFloat((sent / (sent + failed)).toFixed(4))
    : 0;

  return {
    total_recipients: total,
    sent,
    failed,
    pending,
    percentage,
    success_rate: successRate
  };
}

/**
 * Calculate timing information
 * @param {Object} campaign - Campaign object
 * @returns {Object} Timing information
 */
function calculateTiming(campaign) {
  const now = new Date();
  const timing = {
    started_at: campaign.started_at,
    completed_at: campaign.completed_at,
    elapsed_seconds: null,
    estimated_completion: null,
    estimated_remaining_seconds: null
  };

  // If not started yet
  if (!campaign.started_at) {
    return timing;
  }

  // Calculate elapsed time
  const elapsedMs = campaign.completed_at
    ? campaign.completed_at - campaign.started_at
    : now - campaign.started_at;

  timing.elapsed_seconds = Math.floor(elapsedMs / 1000);

  // If still sending, estimate completion
  if (campaign.status === 'sending') {
    const emailsSent = campaign.sent_count + campaign.failed_count;
    const remainingEmails = campaign.recipient_count - emailsSent;

    if (emailsSent > 0) {
      const secondsPerEmail = timing.elapsed_seconds / emailsSent;
      timing.estimated_remaining_seconds = Math.ceil(remainingEmails * secondsPerEmail);

      const estimatedCompletionDate = new Date(now.getTime() + (timing.estimated_remaining_seconds * 1000));
      timing.estimated_completion = estimatedCompletionDate.toISOString();
    }
  }

  return timing;
}

/**
 * Get campaign timeline (status transitions)
 * @param {number} campaignId - Campaign ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<Array>} Timeline events
 */
async function getCampaignTimeline(campaignId, userId) {
  try {
    // Verify campaign belongs to user
    const campaignResult = await db.query(
      'SELECT id, status, created_at, started_at, completed_at FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found or access denied');
    }

    const campaign = campaignResult.rows[0];
    const timeline = [];

    // Created
    timeline.push({
      event: 'created',
      status: 'draft',
      timestamp: campaign.created_at,
      description: 'Campaign created'
    });

    // Started (if started)
    if (campaign.started_at) {
      timeline.push({
        event: 'started',
        status: 'sending',
        timestamp: campaign.started_at,
        description: 'Campaign sending started'
      });
    }

    // Completed (if completed)
    if (campaign.completed_at) {
      timeline.push({
        event: 'completed',
        status: campaign.status, // 'completed' or 'failed'
        timestamp: campaign.completed_at,
        description: campaign.status === 'completed'
          ? 'Campaign sending completed'
          : 'Campaign failed'
      });
    }

    return timeline;
  } catch (error) {
    console.error('Error getting campaign timeline:', error);
    throw error;
  }
}

/**
 * Get recent campaign activity for user
 * @param {number} userId - User ID
 * @param {number} limit - Number of activities to return
 * @returns {Promise<Array>} Recent activities
 */
async function getRecentActivity(userId, limit = 10) {
  try {
    const result = await db.query(
      `SELECT
         c.id as campaign_id,
         c.name as campaign_name,
         c.status,
         c.recipient_count,
         c.sent_count,
         c.failed_count,
         c.started_at,
         c.completed_at,
         c.updated_at
       FROM campaigns c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(campaign => ({
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      status: campaign.status,
      progress_percentage: campaign.recipient_count > 0
        ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.recipient_count) * 100)
        : 0,
      last_updated: campaign.updated_at
    }));
  } catch (error) {
    console.error('Error getting recent activity:', error);
    throw error;
  }
}

module.exports = {
  getCampaignProgress,
  calculateProgress,
  calculateTiming,
  getCampaignTimeline,
  getRecentActivity
};
