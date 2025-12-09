// backend/src/routes/campaigns.js
const express = require('express');
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadCSV, handleUploadError } = require('../middleware/fileUpload');
const { parseCSV } = require('../utils/csvParser');
const { sendCampaign } = require('../services/bulkEmailSender');
const { getEmailLogsByCampaign, exportEmailLogsCSV } = require('../services/emailLogger');
const { getCampaignProgress, getCampaignTimeline, getRecentActivity } = require('../services/progressTracker');

const router = express.Router();

// All campaign routes require authentication
router.use(authenticateToken);

/**
 * POST /api/campaigns
 * Create new campaign with CSV recipients file
 */
router.post('/', uploadCSV, handleUploadError, async (req, res) => {
  try {
    const { name, subject, email_body, html_body, has_customizations, customizations } = req.body;
    const userId = req.user.id;
    const csvFile = req.file;

    // Validation
    if (!name || !subject || !email_body) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'name, subject, and email_body are required'
      });
    }

    if (!csvFile) {
      return res.status(400).json({
        error: 'Missing CSV file',
        message: 'recipientsFile is required'
      });
    }

    // Validate field lengths
    if (name.length < 2 || name.length > 200) {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'Campaign name must be between 2 and 200 characters'
      });
    }

    if (subject.length < 5 || subject.length > 500) {
      return res.status(400).json({
        error: 'Invalid subject',
        message: 'Subject must be between 5 and 500 characters'
      });
    }

    if (email_body.length < 10 || email_body.length > 50000) {
      return res.status(400).json({
        error: 'Invalid email body',
        message: 'Email body must be between 10 and 50,000 characters'
      });
    }

    if (html_body && html_body.length > 100000) {
      return res.status(400).json({
        error: 'Invalid HTML body',
        message: 'HTML body must be less than 100,000 characters'
      });
    }

    // Parse and validate CSV
    console.log('Parsing CSV file...');
    const csvResult = await parseCSV(csvFile.buffer);

    if (!csvResult.valid) {
      return res.status(400).json({
        error: 'Invalid CSV file',
        message: 'CSV validation failed',
        validation: {
          valid: false,
          errors: csvResult.errors,
          summary: csvResult.summary
        }
      });
    }

    const recipients = csvResult.recipients;
    const recipientCount = recipients.length;

    console.log(`Creating campaign with ${recipientCount} recipients...`);

    // Begin transaction
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Insert campaign
      const campaignResult = await client.query(
        `INSERT INTO campaigns (user_id, name, subject, email_body, html_body, recipient_count, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', NOW(), NOW())
         RETURNING id, user_id, name, subject, recipient_count, sent_count, failed_count, status, created_at, updated_at`,
        [userId, name.trim(), subject.trim(), email_body, html_body || null, recipientCount]
      );

      const campaign = campaignResult.rows[0];
      const campaignId = campaign.id;

      // Insert recipients (batch insert for better performance)
      console.log('Inserting recipients...');

      // Parse customizations if provided
      let customizationsMap = {};
      if (has_customizations && customizations) {
        try {
          const customizationsList = JSON.parse(customizations);
          customizationsMap = customizationsList.reduce((acc, item) => {
            acc[item.email.toLowerCase()] = {
              customSubject: item.customSubject,
              customBody: item.customBody
            };
            return acc;
          }, {});
          console.log(`Loaded ${Object.keys(customizationsMap).length} email customizations`);
        } catch (error) {
          console.error('Failed to parse customizations:', error);
        }
      }

      for (const recipient of recipients) {
        // Check if this recipient has customizations
        const recipientEmail = recipient.email.toLowerCase();
        const customization = customizationsMap[recipientEmail];

        // Merge custom fields with customizations
        const customFields = {
          ...recipient.customFields,
          ...(customization && {
            custom_subject: customization.customSubject,
            custom_body: customization.customBody
          })
        };

        await client.query(
          `INSERT INTO campaign_recipients (campaign_id, email, name, custom_fields, status, created_at)
           VALUES ($1, $2, $3, $4, 'pending', NOW())`,
          [
            campaignId,
            recipient.email,
            recipient.name || null,
            JSON.stringify(customFields)
          ]
        );
      }

      await client.query('COMMIT');

      console.log(`Campaign ${campaignId} created successfully`);

      res.status(201).json({
        message: 'Campaign created successfully',
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          recipient_count: campaign.recipient_count,
          sent_count: campaign.sent_count,
          failed_count: campaign.failed_count,
          status: campaign.status,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at
        },
        csv_validation: {
          valid: true,
          totalRows: csvResult.summary.totalRows,
          validRows: csvResult.summary.validRows,
          errorRows: csvResult.summary.errorRows,
          warnings: csvResult.warnings || []
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      error: 'Campaign creation failed',
      message: 'An error occurred while creating the campaign'
    });
  }
});

/**
 * GET /api/campaigns
 * List user's campaigns with pagination
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM campaigns WHERE user_id = $1',
      [userId]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get campaigns
    const result = await db.query(
      `SELECT id, name, subject, recipient_count, sent_count, failed_count, status,
              started_at, completed_at, created_at, updated_at
       FROM campaigns
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const campaigns = result.rows.map(campaign => ({
      ...campaign,
      progress_percentage: campaign.recipient_count > 0
        ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.recipient_count) * 100)
        : 0
    }));

    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({
      error: 'Failed to retrieve campaigns',
      message: 'An error occurred while retrieving campaigns'
    });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign details including recipients
 */
router.get('/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    // Get campaign
    const campaignResult = await db.query(
      `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2`,
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: 'Campaign not found or you do not have permission to access it'
      });
    }

    const campaign = campaignResult.rows[0];

    // Get recipients
    const recipientsResult = await db.query(
      `SELECT id, email, name, custom_fields, status, sent_at, error_message
       FROM campaign_recipients
       WHERE campaign_id = $1
       ORDER BY id`,
      [campaignId]
    );

    res.json({
      campaign: {
        ...campaign,
        progress_percentage: campaign.recipient_count > 0
          ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.recipient_count) * 100)
          : 0
      },
      recipients: recipientsResult.rows
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      error: 'Failed to retrieve campaign',
      message: 'An error occurred while retrieving campaign details'
    });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete campaign and all associated data
 */
router.delete('/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    // Check if campaign is currently sending
    const statusResult = await db.query(
      'SELECT status FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (statusResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: 'Campaign not found or you do not have permission to delete it'
      });
    }

    const status = statusResult.rows[0].status;

    if (status === 'sending') {
      return res.status(400).json({
        error: 'Cannot delete campaign',
        message: 'Cannot delete campaign while it is sending. Please wait for it to complete or cancel it first.'
      });
    }

    // Delete campaign (cascade will delete recipients and logs)
    const result = await db.query(
      'DELETE FROM campaigns WHERE id = $1 AND user_id = $2 RETURNING id',
      [campaignId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: 'Campaign not found or you do not have permission to delete it'
      });
    }

    res.json({
      message: 'Campaign deleted successfully',
      campaign_id: campaignId
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      error: 'Deletion failed',
      message: 'An error occurred while deleting the campaign'
    });
  }
});

/**
 * POST /api/campaigns/:id/send
 * Start sending campaign
 */
router.post('/:id/send', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    // Get campaign
    const campaignResult = await db.query(
      'SELECT id, status, recipient_count FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: 'Campaign not found or you do not have permission to access it'
      });
    }

    const campaign = campaignResult.rows[0];

    // Check status
    if (campaign.status !== 'draft') {
      return res.status(400).json({
        error: 'Cannot send campaign',
        message: `Campaign status is "${campaign.status}". Only draft campaigns can be sent.`
      });
    }

    // Check if user has SMTP configuration
    const smtpResult = await db.query(
      'SELECT id FROM smtp_configs WHERE user_id = $1',
      [userId]
    );

    if (smtpResult.rows.length === 0) {
      return res.status(400).json({
        error: 'No SMTP configuration',
        message: 'Please configure your Gmail SMTP settings before sending campaigns'
      });
    }

    // Update status to 'queued'
    await db.query(
      'UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
      ['queued', campaignId]
    );

    // Start sending in background
    setImmediate(async () => {
      try {
        await sendCampaign(campaignId, userId);
      } catch (error) {
        console.error(`Failed to send campaign ${campaignId}:`, error);
      }
    });

    // Return immediate response
    res.json({
      message: 'Campaign sending started',
      campaign: {
        id: campaign.id,
        status: 'queued',
        recipient_count: campaign.recipient_count
      }
    });
  } catch (error) {
    console.error('Start campaign send error:', error);
    res.status(500).json({
      error: 'Failed to start campaign',
      message: 'An error occurred while starting the campaign'
    });
  }
});

/**
 * GET /api/campaigns/:id/progress
 * Get campaign progress and statistics
 */
router.get('/:id/progress', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    const progress = await getCampaignProgress(campaignId, userId);

    res.json(progress);
  } catch (error) {
    console.error('Get campaign progress error:', error);

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve progress',
      message: 'An error occurred while retrieving campaign progress'
    });
  }
});

/**
 * GET /api/campaigns/:id/timeline
 * Get campaign timeline (status transitions)
 */
router.get('/:id/timeline', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    const timeline = await getCampaignTimeline(campaignId, userId);

    res.json({ timeline });
  } catch (error) {
    console.error('Get campaign timeline error:', error);

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve timeline',
      message: 'An error occurred while retrieving campaign timeline'
    });
  }
});

/**
 * GET /api/campaigns/activity
 * Get recent campaign activity
 */
router.get('/activity', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const activity = await getRecentActivity(userId, limit);

    res.json({ activity });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      error: 'Failed to retrieve activity',
      message: 'An error occurred while retrieving recent activity'
    });
  }
});

/**
 * GET /api/campaigns/:id/logs
 * Get email logs for campaign
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;
    const page = req.query.page;
    const limit = req.query.limit;

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    const result = await getEmailLogsByCampaign(campaignId, userId, { page, limit });

    res.json(result);
  } catch (error) {
    console.error('Get campaign logs error:', error);

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: 'An error occurred while retrieving email logs'
    });
  }
});

/**
 * GET /api/campaigns/:id/logs/export
 * Export email logs as CSV
 */
router.get('/:id/logs/export', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const userId = req.user.id;
    const format = req.query.format || 'csv';

    if (isNaN(campaignId)) {
      return res.status(400).json({
        error: 'Invalid campaign ID',
        message: 'Campaign ID must be a number'
      });
    }

    if (format !== 'csv') {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Only CSV format is currently supported'
      });
    }

    const csv = await exportEmailLogsCSV(campaignId, userId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}-logs.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export logs error:', error);

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        error: 'Campaign not found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Export failed',
      message: 'An error occurred while exporting email logs'
    });
  }
});

module.exports = router;
