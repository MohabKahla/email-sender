// backend/src/utils/emailService.js
const nodemailer = require('nodemailer');
const db = require('../models/db');
const { decrypt } = require('./encryption');

/**
 * Gmail SMTP configuration
 */
const GMAIL_SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  pool: false, // Disable connection pooling for better control
  maxConnections: 1,
  rateDelta: 1000, // 1 second between emails
  rateLimit: 1 // Send 1 email per rateDelta
};

/**
 * Create Nodemailer transporter from user's saved SMTP configuration
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Nodemailer transporter
 */
async function createTransporter(userId) {
  try {
    // Fetch user's SMTP configuration
    const result = await db.query(
      `SELECT gmail_address, app_password_encrypted, from_name
       FROM smtp_configs
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('SMTP configuration not found. Please configure your Gmail SMTP settings.');
    }

    const config = result.rows[0];

    // Decrypt app password
    let appPassword;
    try {
      appPassword = decrypt(config.app_password_encrypted);
    } catch (error) {
      console.error('Failed to decrypt SMTP password:', error);
      throw new Error('Failed to decrypt SMTP credentials. Please reconfigure your SMTP settings.');
    }

    // Create and return transporter
    return createTransporterFromCredentials(
      config.gmail_address,
      appPassword,
      config.from_name
    );
  } catch (error) {
    console.error('Error creating transporter:', error);
    throw error;
  }
}

/**
 * Create Nodemailer transporter from credentials (for testing or manual creation)
 * @param {string} gmailAddress - Gmail email address
 * @param {string} appPassword - Gmail app password
 * @param {string} fromName - Name to display in "From" field
 * @returns {Object} Nodemailer transporter
 */
function createTransporterFromCredentials(gmailAddress, appPassword, fromName) {
  if (!gmailAddress || !appPassword) {
    throw new Error('Gmail address and app password are required');
  }

  const transporter = nodemailer.createTransport({
    ...GMAIL_SMTP_CONFIG,
    auth: {
      user: gmailAddress,
      pass: appPassword
    },
    from: `"${fromName}" <${gmailAddress}>` // Default "from" address
  });

  return transporter;
}

/**
 * Verify SMTP connection
 * @param {Object} transporter - Nodemailer transporter
 * @returns {Promise<boolean>} True if connection successful
 */
async function verifyTransporter(transporter) {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('SMTP verification failed:', error);

    // Provide helpful error messages
    if (error.code === 'EAUTH') {
      throw new Error('Invalid Gmail credentials. Please check your email and app password.');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new Error('Failed to connect to Gmail SMTP server. Please check your internet connection.');
    } else if (error.responseCode === 534) {
      throw new Error('Gmail authentication failed. Make sure you are using an App Password, not your regular Gmail password.');
    } else {
      throw new Error(`SMTP verification failed: ${error.message}`);
    }
  }
}

/**
 * Send a single email
 * @param {Object} transporter - Nodemailer transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} Send result
 */
async function sendEmail(transporter, options) {
  const { to, subject, text, html } = options;

  if (!to || !subject) {
    throw new Error('Recipient (to) and subject are required');
  }

  if (!text && !html) {
    throw new Error('Email must have either text or html content');
  }

  try {
    const mailOptions = {
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    console.error('Email send error:', error);

    // Handle specific errors
    if (error.code === 'EENVELOPE') {
      throw new Error('Invalid recipient email address');
    } else if (error.responseCode === 550) {
      throw new Error('Recipient address rejected');
    } else {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}

/**
 * Close transporter (cleanup)
 * @param {Object} transporter - Nodemailer transporter
 */
function closeTransporter(transporter) {
  if (transporter) {
    transporter.close();
  }
}

module.exports = {
  createTransporter,
  createTransporterFromCredentials,
  verifyTransporter,
  sendEmail,
  closeTransporter
};
