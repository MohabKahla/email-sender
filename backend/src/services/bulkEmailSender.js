// backend/src/services/bulkEmailSender.js
const db = require('../models/db');
const { createTransporter, sendEmail, closeTransporter, verifyTransporter } = require('../utils/emailService');

/**
 * Send campaign to all recipients
 * @param {number} campaignId - Campaign ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Send result
 */
async function sendCampaign(campaignId, userId) {
  console.log(`Starting campaign ${campaignId} for user ${userId}...`);

  try {
    // Get campaign details
    const campaignResult = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignResult.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaign = campaignResult.rows[0];

    // Check campaign status
    if (campaign.status !== 'queued') {
      throw new Error(`Cannot send campaign with status: ${campaign.status}`);
    }

    // Get pending recipients
    const recipientsResult = await db.query(
      `SELECT id, email, name, custom_fields
       FROM campaign_recipients
       WHERE campaign_id = $1 AND status = 'pending'
       ORDER BY id`,
      [campaignId]
    );

    const recipients = recipientsResult.rows;

    if (recipients.length === 0) {
      console.log('No pending recipients found');
      await updateCampaignStatus(campaignId, 'completed', new Date());
      return { success: true, sent: 0, failed: 0 };
    }

    console.log(`Found ${recipients.length} pending recipients`);

    // Create SMTP transporter
    let transporter;
    try {
      transporter = await createTransporter(userId);
      await verifyTransporter(transporter);
    } catch (error) {
      console.error('SMTP connection failed:', error);
      await updateCampaignStatus(campaignId, 'failed');
      throw new Error(`SMTP connection failed: ${error.message}`);
    }

    // Update campaign to 'sending'
    await updateCampaignStatus(campaignId, 'sending', new Date());

    // Process all recipients
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        await sendToRecipient(recipient, campaign, transporter, userId);
        sentCount++;

        // Update recipient status to 'sent'
        await db.query(
          'UPDATE campaign_recipients SET status = $1, sent_at = NOW() WHERE id = $2',
          ['sent', recipient.id]
        );

        // Update campaign progress
        await db.query(
          'UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1',
          [campaignId]
        );

        console.log(`✅ Sent to ${recipient.email}`);
      } catch (error) {
        failedCount++;
        console.error(`❌ Failed to send to ${recipient.email}:`, error.message);

        // Update recipient status to 'failed'
        await db.query(
          'UPDATE campaign_recipients SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error.message, recipient.id]
        );

        // Update campaign progress
        await db.query(
          'UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1',
          [campaignId]
        );

        // Log failed send
        await logEmail(userId, campaignId, recipient.id, recipient.email, campaign.subject, 'failed', null, error.message);
      }

      // Rate limiting: Wait 1 second between emails
      await sleep(1000);
    }

    // Close transporter
    closeTransporter(transporter);

    // Update campaign to 'completed'
    await updateCampaignStatus(campaignId, 'completed', null, new Date());

    console.log(`Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);

    return {
      success: true,
      sent: sentCount,
      failed: failedCount
    };
  } catch (error) {
    console.error(`Campaign ${campaignId} send error:`, error);

    // Update campaign to 'failed'
    try {
      await updateCampaignStatus(campaignId, 'failed');
    } catch (updateError) {
      console.error('Failed to update campaign status:', updateError);
    }

    throw error;
  }
}

/**
 * Send email to a single recipient with template variable replacement
 * @param {Object} recipient - Recipient object
 * @param {Object} campaign - Campaign object
 * @param {Object} transporter - Nodemailer transporter
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Send result
 */
async function sendToRecipient(recipient, campaign, transporter, userId) {
  // Prepare recipient data for template replacement
  const customFields = recipient.custom_fields || {};
  const recipientData = {
    name: recipient.name || '',
    email: recipient.email,
    ...customFields
  };

  // Check if recipient has custom subject/body
  const hasCustomSubject = customFields.custom_subject !== undefined;
  const hasCustomBody = customFields.custom_body !== undefined;

  // Use custom subject/body if provided, otherwise use campaign defaults
  const baseSubject = hasCustomSubject ? customFields.custom_subject : campaign.subject;
  const baseBody = hasCustomBody ? customFields.custom_body : campaign.email_body;

  // Replace template variables in subject and body
  const subject = replaceTemplateVariables(baseSubject, recipientData);
  const textBody = replaceTemplateVariables(baseBody, recipientData);
  const htmlBody = campaign.html_body
    ? replaceTemplateVariables(campaign.html_body, recipientData)
    : null;

  // Log if using customizations
  if (hasCustomSubject || hasCustomBody) {
    console.log(`📝 Using customized ${hasCustomSubject ? 'subject' : ''}${hasCustomSubject && hasCustomBody ? ' and ' : ''}${hasCustomBody ? 'body' : ''} for ${recipient.email}`);
  }

  // Send email
  const result = await sendEmail(transporter, {
    to: recipient.email,
    subject,
    text: textBody,
    html: htmlBody
  });

  // Log successful send
  await logEmail(
    userId,
    campaign.id,
    recipient.id,
    recipient.email,
    subject,
    'sent',
    result.messageId,
    null
  );

  return result;
}

/**
 * Replace template variables in text
 * @param {string} text - Text with template variables
 * @param {Object} data - Data object with values
 * @returns {string} Text with variables replaced
 */
function replaceTemplateVariables(text, data) {
  if (!text) return '';

  let result = text;

  // Replace each variable
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  // Remove any remaining unreplaced variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

/**
 * Update campaign status
 * @param {number} campaignId - Campaign ID
 * @param {string} status - New status
 * @param {Date} startedAt - Started timestamp (optional)
 * @param {Date} completedAt - Completed timestamp (optional)
 */
async function updateCampaignStatus(campaignId, status, startedAt = null, completedAt = null) {
  const updates = ['status = $1', 'updated_at = NOW()'];
  const values = [status];
  let paramIndex = 2;

  if (startedAt) {
    updates.push(`started_at = $${paramIndex++}`);
    values.push(startedAt);
  }

  if (completedAt) {
    updates.push(`completed_at = $${paramIndex++}`);
    values.push(completedAt);
  }

  values.push(campaignId);

  await db.query(
    `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

/**
 * Log email send attempt
 * @param {number} userId - User ID
 * @param {number} campaignId - Campaign ID
 * @param {number} recipientId - Recipient ID
 * @param {string} recipientEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} status - Send status (sent/failed)
 * @param {string} messageId - Message ID (if sent)
 * @param {string} errorMessage - Error message (if failed)
 */
async function logEmail(userId, campaignId, recipientId, recipientEmail, subject, status, messageId, errorMessage) {
  await db.query(
    `INSERT INTO email_logs (user_id, campaign_id, recipient_id, recipient_email, subject, status, message_id, error_message, sent_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [userId, campaignId, recipientId, recipientEmail, subject, status, messageId, errorMessage]
  );
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  sendCampaign,
  sendToRecipient,
  replaceTemplateVariables,
  updateCampaignStatus,
  logEmail
};
