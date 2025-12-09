// backend/src/routes/smtp.js
const express = require('express');
const db = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');

const router = express.Router();

// All SMTP routes require authentication
router.use(authenticateToken);

/**
 * POST /api/smtp/configure
 * Save or update SMTP configuration
 */
router.post('/configure', async (req, res) => {
  try {
    const { gmail_address, app_password, from_name } = req.body;
    const userId = req.user.id;

    // Validation
    if (!gmail_address || !app_password || !from_name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'gmail_address, app_password, and from_name are required'
      });
    }

    // Validate email address format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(gmail_address)) {
      return res.status(400).json({
        error: 'Invalid email address',
        message: 'Please provide a valid email address'
      });
    }

    // Validate app password format (16 chars with or without hyphens)
    const passwordWithoutHyphens = app_password.replace(/-/g, '');
    if (passwordWithoutHyphens.length !== 16) {
      return res.status(400).json({
        error: 'Invalid app password format',
        message: 'Gmail app password must be 16 characters (format: xxxx-xxxx-xxxx-xxxx)'
      });
    }

    // Validate from_name
    if (from_name.trim().length < 2 || from_name.trim().length > 100) {
      return res.status(400).json({
        error: 'Invalid from_name',
        message: 'From name must be between 2 and 100 characters'
      });
    }

    // Encrypt app password
    const encryptedPassword = encrypt(passwordWithoutHyphens);

    // Upsert SMTP configuration (insert or update if exists)
    const result = await db.query(
      `INSERT INTO smtp_configs (user_id, gmail_address, app_password_encrypted, from_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         gmail_address = EXCLUDED.gmail_address,
         app_password_encrypted = EXCLUDED.app_password_encrypted,
         from_name = EXCLUDED.from_name,
         updated_at = NOW()
       RETURNING id, user_id, gmail_address, from_name, created_at, updated_at`,
      [userId, gmail_address.toLowerCase(), encryptedPassword, from_name.trim()]
    );

    const config = result.rows[0];

    res.status(200).json({
      message: 'SMTP configuration saved successfully',
      config: {
        ...config,
        has_password: true
      }
    });
  } catch (error) {
    console.error('SMTP configure error:', error);
    res.status(500).json({
      error: 'Configuration failed',
      message: 'An error occurred while saving SMTP configuration'
    });
  }
});

/**
 * GET /api/smtp/config
 * Get current SMTP configuration (password masked)
 */
router.get('/config', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, user_id, gmail_address, from_name,
              app_password_encrypted, created_at, updated_at
       FROM smtp_configs
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'No SMTP configuration found. Please configure your Gmail SMTP settings first.'
      });
    }

    const config = result.rows[0];

    // Mask the password (show last 4 chars only)
    const hasPassword = !!config.app_password_encrypted;
    let maskedPassword = null;

    if (hasPassword) {
      try {
        const decrypted = decrypt(config.app_password_encrypted);
        const last4 = decrypted.slice(-4);
        maskedPassword = `****-****-****-${last4}`;
      } catch (err) {
        console.error('Password decryption error:', err);
        maskedPassword = '****-****-****-****';
      }
    }

    res.json({
      config: {
        id: config.id,
        gmail_address: config.gmail_address,
        from_name: config.from_name,
        app_password_masked: maskedPassword,
        has_password: hasPassword,
        created_at: config.created_at,
        updated_at: config.updated_at
      }
    });
  } catch (error) {
    console.error('Get SMTP config error:', error);
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: 'An error occurred while retrieving SMTP configuration'
    });
  }
});

/**
 * DELETE /api/smtp/config
 * Delete SMTP configuration
 */
router.delete('/config', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM smtp_configs WHERE user_id = $1 RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'No SMTP configuration found to delete'
      });
    }

    res.json({
      message: 'SMTP configuration deleted successfully'
    });
  } catch (error) {
    console.error('Delete SMTP config error:', error);
    res.status(500).json({
      error: 'Deletion failed',
      message: 'An error occurred while deleting SMTP configuration'
    });
  }
});

/**
 * POST /api/smtp/test
 * Test SMTP connection (saved config or temporary credentials)
 * Query params:
 *   - send_email=true: Send actual test email (optional)
 */
router.post('/test', async (req, res) => {
  try {
    const { gmail_address, app_password, from_name } = req.body;
    const userId = req.user.id;
    const sendTestEmail = req.query.send_email === 'true';

    let transporter;
    let gmailAddressUsed;

    // Check if testing with temporary credentials or saved config
    if (gmail_address && app_password && from_name) {
      // Test with provided credentials (before saving)
      console.log('Testing with provided credentials...');

      // Validate format
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(gmail_address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email address',
          message: 'Please provide a valid email address'
        });
      }

      // Remove hyphens from app password
      const passwordWithoutHyphens = app_password.replace(/-/g, '');

      // Create transporter from provided credentials
      const { createTransporterFromCredentials, verifyTransporter, sendEmail } = require('../utils/emailService');
      transporter = createTransporterFromCredentials(
        gmail_address,
        passwordWithoutHyphens,
        from_name
      );
      gmailAddressUsed = gmail_address;
    } else {
      // Test with saved configuration
      console.log('Testing with saved configuration...');

      const { createTransporter, verifyTransporter, sendEmail } = require('../utils/emailService');

      try {
        transporter = await createTransporter(userId);

        // Get Gmail address from saved config
        const configResult = await db.query(
          'SELECT gmail_address FROM smtp_configs WHERE user_id = $1',
          [userId]
        );

        if (configResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Configuration not found',
            message: 'No SMTP configuration found. Please provide credentials or save configuration first.'
          });
        }

        gmailAddressUsed = configResult.rows[0].gmail_address;
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Configuration not found',
          message: error.message
        });
      }
    }

    // Verify SMTP connection
    console.log('Verifying SMTP connection...');
    const { verifyTransporter, sendEmail, closeTransporter } = require('../utils/emailService');

    try {
      await verifyTransporter(transporter);
    } catch (error) {
      closeTransporter(transporter);
      return res.status(400).json({
        success: false,
        error: 'SMTP connection failed',
        message: error.message,
        details: {
          error_code: error.code
        }
      });
    }

    // Optionally send test email
    let emailSent = false;
    let emailResult = null;

    if (sendTestEmail) {
      console.log('Sending test email...');

      try {
        emailResult = await sendEmail(transporter, {
          to: gmailAddressUsed, // Send to user's own Gmail
          subject: 'SMTP Test - Email Sender Service',
          text: `This is a test email from the Email Sender Service.\n\nYour SMTP configuration is working correctly!\n\nTimestamp: ${new Date().toISOString()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4CAF50;">✅ SMTP Test Successful</h2>
              <p>This is a test email from the <strong>Email Sender Service</strong>.</p>
              <p>Your SMTP configuration is working correctly!</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">
                Timestamp: ${new Date().toISOString()}<br>
                Service: Email Sender API v1.0
              </p>
            </div>
          `
        });

        emailSent = true;
      } catch (error) {
        console.error('Test email send error:', error);
        closeTransporter(transporter);

        return res.status(400).json({
          success: false,
          error: 'Test email failed',
          message: error.message,
          details: {
            connection_ok: true,
            email_send_failed: true
          }
        });
      }
    }

    // Close transporter
    closeTransporter(transporter);

    // Return success
    res.json({
      success: true,
      message: sendTestEmail
        ? 'SMTP connection successful and test email sent'
        : 'SMTP connection successful',
      details: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        test_email_sent: emailSent,
        recipient: emailSent ? gmailAddressUsed : null,
        message_id: emailResult ? emailResult.messageId : null
      }
    });
  } catch (error) {
    console.error('SMTP test error:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: 'An unexpected error occurred during SMTP testing',
      details: {
        error_message: error.message
      }
    });
  }
});

module.exports = router;
