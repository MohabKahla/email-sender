const {
  createTransporterFromCredentials,
  verifyTransporter,
  sendEmail,
  closeTransporter
} = require('./utils/emailService');

async function testEmailService() {
  try {
    console.log('Testing email service...\n');

    // NOTE: These are placeholder credentials
    // To fully test, replace with real Gmail credentials
    const GMAIL_ADDRESS = 'test@gmail.com';
    const APP_PASSWORD = 'abcdefghijklmnop'; // 16 characters
    const FROM_NAME = 'Test Sender';

    // Test 1: Create transporter from credentials
    console.log('Test 1: Creating transporter from credentials...');
    const transporter = createTransporterFromCredentials(
      GMAIL_ADDRESS,
      APP_PASSWORD,
      FROM_NAME
    );

    if (transporter && transporter.options) {
      console.log('✅ Transporter created successfully');
      console.log('  - Host:', transporter.options.host);
      console.log('  - Port:', transporter.options.port);
      console.log('  - User:', transporter.options.auth.user);
      console.log('  - Secure:', transporter.options.secure);
    } else {
      throw new Error('Transporter creation failed');
    }
    console.log('');

    // Test 2: Verify transporter structure
    console.log('Test 2: Verifying transporter configuration...');
    if (transporter.options.host === 'smtp.gmail.com' &&
        transporter.options.port === 587 &&
        transporter.options.auth.user === GMAIL_ADDRESS) {
      console.log('✅ Transporter configuration is correct');
    } else {
      throw new Error('Transporter configuration is incorrect');
    }
    console.log('');

    // Test 3: Test error handling for missing credentials
    console.log('Test 3: Testing error handling for missing credentials...');
    try {
      createTransporterFromCredentials('', '', '');
      throw new Error('Should have thrown error for empty credentials');
    } catch (error) {
      if (error.message.includes('required')) {
        console.log('✅ Error handling works for missing credentials');
      } else {
        throw error;
      }
    }
    console.log('');

    // Test 4: Close transporter
    console.log('Test 4: Testing transporter cleanup...');
    closeTransporter(transporter);
    console.log('✅ Transporter closed successfully');
    console.log('');

    console.log('🎉 All email service structural tests passed!');
    console.log('');
    console.log('📧 NOTE: To test actual email sending:');
    console.log('   1. Get a Gmail App Password from your Google Account');
    console.log('   2. Update GMAIL_ADDRESS and APP_PASSWORD in this file');
    console.log('   3. Uncomment the connection verification and email sending tests');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testEmailService();

// ============================================================================
// OPTIONAL: Uncomment the code below to test with real Gmail credentials
// ============================================================================

/*
async function testWithRealCredentials() {
  try {
    console.log('\n=== Testing with Real Gmail Credentials ===\n');

    // REPLACE WITH YOUR ACTUAL CREDENTIALS
    const GMAIL_ADDRESS = 'your-email@gmail.com';
    const APP_PASSWORD = 'your-16-char-app-password';
    const FROM_NAME = 'Test Sender';

    // Test 1: Create transporter
    console.log('Test 1: Creating transporter...');
    const transporter = createTransporterFromCredentials(
      GMAIL_ADDRESS,
      APP_PASSWORD,
      FROM_NAME
    );
    console.log('✅ Transporter created\n');

    // Test 2: Verify connection
    console.log('Test 2: Verifying SMTP connection...');
    await verifyTransporter(transporter);
    console.log('✅ SMTP connection verified\n');

    // Test 3: Send test email
    console.log('Test 3: Sending test email...');
    const result = await sendEmail(transporter, {
      to: GMAIL_ADDRESS, // Send to yourself
      subject: 'Test Email from Email Sender Service',
      text: 'This is a test email sent via Nodemailer.',
      html: '<p>This is a <strong>test email</strong> sent via Nodemailer.</p>'
    });
    console.log('✅ Email sent successfully');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);

    // Cleanup
    closeTransporter(transporter);

    console.log('\n🎉 All email service tests passed!');
    console.log('📧 Check your Gmail inbox for the test email.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Uncomment to run real credentials test:
// testWithRealCredentials();
*/
