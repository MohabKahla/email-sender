const {
  createTransporterFromCredentials,
  verifyTransporter,
  sendEmail
} = require('../../utils/emailService');

// Mock nodemailer
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

describe('Email Service', () => {
  let mockTransporter;

  beforeEach(() => {
    // Create mock transporter
    mockTransporter = {
      verify: jest.fn(),
      sendMail: jest.fn(),
      close: jest.fn(),
      options: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: '',
          pass: ''
        }
      }
    };

    nodemailer.createTransport.mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransporterFromCredentials', () => {
    test('should create transporter with valid credentials', () => {
      const transporter = createTransporterFromCredentials(
        'test@gmail.com',
        'abcdabcdabcdabcd',
        'Test Sender'
      );

      expect(transporter).toBe(mockTransporter);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@gmail.com',
            pass: 'abcdabcdabcdabcd'
          }
        })
      );
    });

    test('should include from name in transporter config', () => {
      createTransporterFromCredentials(
        'sender@gmail.com',
        'passwordpassword',
        'My Company'
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"My Company" <sender@gmail.com>'
        })
      );
    });

    test('should throw error for missing email', () => {
      expect(() => createTransporterFromCredentials('', 'password', 'Name')).toThrow('required');
    });

    test('should throw error for missing password', () => {
      expect(() => createTransporterFromCredentials('test@gmail.com', '', 'Name')).toThrow('required');
    });

    test('should throw error for all missing credentials', () => {
      expect(() => createTransporterFromCredentials('', '', '')).toThrow('required');
    });
  });

  describe('verifyTransporter', () => {
    test('should verify successfully', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await verifyTransporter(mockTransporter);

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    test('should throw error for EAUTH', async () => {
      const error = new Error('Authentication failed');
      error.code = 'EAUTH';
      mockTransporter.verify.mockRejectedValue(error);

      await expect(verifyTransporter(mockTransporter)).rejects.toThrow('Invalid Gmail credentials');
    });

    test('should throw error for ECONNECTION', async () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNECTION';
      mockTransporter.verify.mockRejectedValue(error);

      await expect(verifyTransporter(mockTransporter)).rejects.toThrow('connect to Gmail');
    });

    test('should throw error for ETIMEDOUT', async () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      mockTransporter.verify.mockRejectedValue(error);

      await expect(verifyTransporter(mockTransporter)).rejects.toThrow('connect to Gmail');
    });

    test('should throw error for response code 534', async () => {
      const error = new Error('Auth error');
      error.responseCode = 534;
      mockTransporter.verify.mockRejectedValue(error);

      await expect(verifyTransporter(mockTransporter)).rejects.toThrow('App Password');
    });

    test('should throw generic error for unknown error', async () => {
      const error = new Error('Unknown error');
      mockTransporter.verify.mockRejectedValue(error);

      await expect(verifyTransporter(mockTransporter)).rejects.toThrow('SMTP verification failed');
    });
  });

  describe('sendEmail', () => {
    test('should send email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@gmail.com>',
        response: '250 OK',
        accepted: ['recipient@example.com'],
        rejected: []
      });

      const result = await sendEmail(mockTransporter, {
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test body',
        html: '<p>Test body</p>'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<test@gmail.com>');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test body',
        html: '<p>Test body</p>'
      });
    });

    test('should send email with text only', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@gmail.com>',
        response: '250 OK',
        accepted: ['recipient@example.com'],
        rejected: []
      });

      const result = await sendEmail(mockTransporter, {
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Plain text body'
      });

      expect(result.success).toBe(true);
    });

    test('should send email with HTML only', async () => {
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test@gmail.com>',
        response: '250 OK',
        accepted: ['recipient@example.com'],
        rejected: []
      });

      const result = await sendEmail(mockTransporter, {
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>HTML body</p>'
      });

      expect(result.success).toBe(true);
    });

    test('should throw error for missing recipient', async () => {
      await expect(
        sendEmail(mockTransporter, { subject: 'Test', text: 'Body' })
      ).rejects.toThrow('Recipient');
    });

    test('should throw error for missing subject', async () => {
      await expect(
        sendEmail(mockTransporter, { to: 'test@example.com', text: 'Body' })
      ).rejects.toThrow('subject');
    });

    test('should throw error for missing content', async () => {
      await expect(
        sendEmail(mockTransporter, { to: 'test@example.com', subject: 'Test' })
      ).rejects.toThrow('text or html content');
    });

    test('should handle EENVELOPE error', async () => {
      const error = new Error('Invalid envelope');
      error.code = 'EENVELOPE';
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        sendEmail(mockTransporter, {
          to: 'invalid-email',
          subject: 'Test',
          text: 'Body'
        })
      ).rejects.toThrow('Invalid recipient');
    });

    test('should handle response code 550', async () => {
      const error = new Error('Recipient rejected');
      error.responseCode = 550;
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        sendEmail(mockTransporter, {
          to: 'rejected@example.com',
          subject: 'Test',
          text: 'Body'
        })
      ).rejects.toThrow('Recipient address rejected');
    });

    test('should handle generic send error', async () => {
      const error = new Error('Send failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      await expect(
        sendEmail(mockTransporter, {
          to: 'test@example.com',
          subject: 'Test',
          text: 'Body'
        })
      ).rejects.toThrow('Failed to send email');
    });
  });

  describe('transporter configuration', () => {
    test('should use correct SMTP settings for Gmail', () => {
      createTransporterFromCredentials('test@gmail.com', 'password', 'Sender');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          pool: false,
          maxConnections: 1,
          rateDelta: 1000,
          rateLimit: 1
        })
      );
    });
  });
});
