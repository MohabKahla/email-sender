// backend/src/__tests__/routes/campaigns.test.js
const request = require('supertest');
const express = require('express');
const db = require('../../models/db');
const campaignsRouter = require('../../routes/campaigns');
const { authenticateToken } = require('../../middleware/auth');
const { sendCampaign } = require('../../services/bulkEmailSender');

// Mock dependencies
jest.mock('../../models/db');
jest.mock('../../middleware/auth');
jest.mock('../../services/bulkEmailSender');
jest.mock('../../services/emailLogger');
jest.mock('../../services/progressTracker');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/campaigns', campaignsRouter);

// Mock user
const mockUser = { id: 1, email: 'test@example.com' };

describe('Campaign Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticateToken middleware
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  describe('POST /api/campaigns', () => {
    test('should create campaign with valid CSV', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ // INSERT campaign
            rows: [{
              id: 1,
              user_id: 1,
              name: 'Test Campaign',
              subject: 'Test Subject',
              recipient_count: 2,
              sent_count: 0,
              failed_count: 0,
              status: 'draft',
              created_at: new Date(),
              updated_at: new Date()
            }]
          })
          .mockResolvedValue({ rows: [] }), // INSERT recipients
        release: jest.fn()
      };

      db.getClient.mockResolvedValue(mockClient);

      const csvContent = 'email,name\ntest1@example.com,Test User 1\ntest2@example.com,Test User 2';
      const buffer = Buffer.from(csvContent);

      const response = await request(app)
        .post('/api/campaigns')
        .field('name', 'Test Campaign')
        .field('subject', 'Test Subject')
        .field('email_body', 'This is a test email body with at least 10 characters.')
        .attach('recipientsFile', buffer, 'recipients.csv')
        .expect(201);

      expect(response.body.message).toBe('Campaign created successfully');
      expect(response.body.campaign.name).toBe('Test Campaign');
      expect(response.body.campaign.recipient_count).toBe(2);
      expect(response.body.csv_validation.valid).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    test('should reject campaign without name', async () => {
      const csvContent = 'email,name\ntest@example.com,Test User';
      const buffer = Buffer.from(csvContent);

      const response = await request(app)
        .post('/api/campaigns')
        .field('subject', 'Test Subject')
        .field('email_body', 'This is a test email body.')
        .attach('recipientsFile', buffer, 'recipients.csv')
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    test('should reject campaign without CSV file', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .field('name', 'Test Campaign')
        .field('subject', 'Test Subject')
        .field('email_body', 'This is a test email body.')
        .expect(400);

      expect(response.body.error).toBe('Missing CSV file');
    });

    test('should reject campaign with short name', async () => {
      const csvContent = 'email,name\ntest@example.com,Test User';
      const buffer = Buffer.from(csvContent);

      const response = await request(app)
        .post('/api/campaigns')
        .field('name', 'T')
        .field('subject', 'Test Subject')
        .field('email_body', 'This is a test email body.')
        .attach('recipientsFile', buffer, 'recipients.csv')
        .expect(400);

      expect(response.body.error).toBe('Invalid name');
    });

    test('should reject campaign with invalid CSV', async () => {
      const csvContent = 'name,company\nTest User,Acme Inc'; // Missing email column
      const buffer = Buffer.from(csvContent);

      const response = await request(app)
        .post('/api/campaigns')
        .field('name', 'Test Campaign')
        .field('subject', 'Test Subject')
        .field('email_body', 'This is a test email body.')
        .attach('recipientsFile', buffer, 'recipients.csv')
        .expect(400);

      expect(response.body.error).toBe('Invalid CSV file');
      expect(response.body.validation.valid).toBe(false);
    });

    test('should rollback on database error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')), // INSERT campaign fails
        release: jest.fn()
      };

      db.getClient.mockResolvedValue(mockClient);

      const csvContent = 'email,name\ntest@example.com,Test User';
      const buffer = Buffer.from(csvContent);

      const response = await request(app)
        .post('/api/campaigns')
        .field('name', 'Test Campaign')
        .field('subject', 'Test Subject')
        .field('email_body', 'This is a test email body.')
        .attach('recipientsFile', buffer, 'recipients.csv')
        .expect(500);

      expect(response.body.error).toBe('Campaign creation failed');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('GET /api/campaigns', () => {
    test('should list user campaigns with pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // COUNT
        .mockResolvedValueOnce({ // SELECT campaigns
          rows: [
            {
              id: 1,
              name: 'Campaign 1',
              subject: 'Subject 1',
              recipient_count: 100,
              sent_count: 50,
              failed_count: 5,
              status: 'sending',
              created_at: new Date(),
              updated_at: new Date()
            },
            {
              id: 2,
              name: 'Campaign 2',
              subject: 'Subject 2',
              recipient_count: 50,
              sent_count: 50,
              failed_count: 0,
              status: 'completed',
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        });

      const response = await request(app)
        .get('/api/campaigns')
        .expect(200);

      expect(response.body.campaigns).toHaveLength(2);
      expect(response.body.campaigns[0].progress_percentage).toBe(55); // (50+5)/100 * 100
      expect(response.body.pagination.total).toBe(10);
      expect(response.body.pagination.page).toBe(1);
    });

    test('should handle pagination parameters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/campaigns?page=2&limit=10')
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([mockUser.id, 10, 10]) // offset = (2-1) * 10 = 10
      );
    });

    test('should limit maximum page size', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/campaigns?limit=200')
        .expect(200);

      expect(response.body.pagination.limit).toBe(100); // Max limit
    });
  });

  describe('GET /api/campaigns/:id', () => {
    test('should get campaign details with recipients', async () => {
      const mockCampaign = {
        id: 1,
        name: 'Test Campaign',
        subject: 'Test Subject',
        email_body: 'Test body',
        recipient_count: 2,
        sent_count: 1,
        failed_count: 0,
        status: 'sending'
      };

      const mockRecipients = [
        { id: 1, email: 'test1@example.com', name: 'User 1', status: 'sent' },
        { id: 2, email: 'test2@example.com', name: 'User 2', status: 'pending' }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: mockRecipients }); // Get recipients

      const response = await request(app)
        .get('/api/campaigns/1')
        .expect(200);

      expect(response.body.campaign.name).toBe('Test Campaign');
      expect(response.body.campaign.progress_percentage).toBe(50);
      expect(response.body.recipients).toHaveLength(2);
    });

    test('should return 404 for non-existent campaign', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/campaigns/999')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
    });

    test('should reject invalid campaign ID', async () => {
      const response = await request(app)
        .get('/api/campaigns/invalid')
        .expect(400);

      expect(response.body.error).toBe('Invalid campaign ID');
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    test('should delete campaign', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ status: 'draft' }] }) // Check status
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Delete

      const response = await request(app)
        .delete('/api/campaigns/1')
        .expect(200);

      expect(response.body.message).toBe('Campaign deleted successfully');
      expect(response.body.campaign_id).toBe(1);
    });

    test('should not delete campaign that is sending', async () => {
      db.query.mockResolvedValue({ rows: [{ status: 'sending' }] });

      const response = await request(app)
        .delete('/api/campaigns/1')
        .expect(400);

      expect(response.body.error).toBe('Cannot delete campaign');
    });

    test('should return 404 for non-existent campaign', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .delete('/api/campaigns/999')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
    });
  });

  describe('POST /api/campaigns/:id/send', () => {
    test('should start sending campaign', async () => {
      const mockCampaign = {
        id: 1,
        status: 'draft',
        recipient_count: 10
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Get campaign
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Check SMTP config
        .mockResolvedValueOnce({ rows: [] }); // Update status to queued

      sendCampaign.mockResolvedValue({ success: true, sent: 10, failed: 0 });

      const response = await request(app)
        .post('/api/campaigns/1/send')
        .expect(200);

      expect(response.body.message).toBe('Campaign sending started');
      expect(response.body.campaign.status).toBe('queued');
    });

    test('should reject if campaign is not draft', async () => {
      db.query.mockResolvedValue({ rows: [{ status: 'completed' }] });

      const response = await request(app)
        .post('/api/campaigns/1/send')
        .expect(400);

      expect(response.body.error).toBe('Cannot send campaign');
    });

    test('should reject if SMTP not configured', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft' }] }) // Get campaign
        .mockResolvedValueOnce({ rows: [] }); // No SMTP config

      const response = await request(app)
        .post('/api/campaigns/1/send')
        .expect(400);

      expect(response.body.error).toBe('No SMTP configuration');
    });
  });

  describe('GET /api/campaigns/:id/progress', () => {
    test('should get campaign progress', async () => {
      const { getCampaignProgress } = require('../../services/progressTracker');
      getCampaignProgress.mockResolvedValue({
        campaign_id: 1,
        status: 'sending',
        progress: 50,
        sent: 5,
        failed: 0,
        pending: 5
      });

      const response = await request(app)
        .get('/api/campaigns/1/progress')
        .expect(200);

      expect(response.body.progress).toBe(50);
      expect(getCampaignProgress).toHaveBeenCalledWith(1, mockUser.id);
    });

    test('should handle campaign not found error', async () => {
      const { getCampaignProgress } = require('../../services/progressTracker');
      getCampaignProgress.mockRejectedValue(new Error('Campaign not found'));

      const response = await request(app)
        .get('/api/campaigns/1/progress')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
    });
  });

  describe('GET /api/campaigns/:id/logs', () => {
    test('should get email logs for campaign', async () => {
      const { getEmailLogsByCampaign } = require('../../services/emailLogger');
      getEmailLogsByCampaign.mockResolvedValue({
        logs: [
          { id: 1, recipient_email: 'test@example.com', status: 'sent' }
        ],
        pagination: { page: 1, total: 1 }
      });

      const response = await request(app)
        .get('/api/campaigns/1/logs')
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
      expect(getEmailLogsByCampaign).toHaveBeenCalledWith(1, mockUser.id, expect.any(Object));
    });
  });

  describe('GET /api/campaigns/:id/logs/export', () => {
    test('should export logs as CSV', async () => {
      const { exportEmailLogsCSV } = require('../../services/emailLogger');
      const mockCSV = 'email,status\ntest@example.com,sent';
      exportEmailLogsCSV.mockResolvedValue(mockCSV);

      const response = await request(app)
        .get('/api/campaigns/1/logs/export')
        .expect(200);

      expect(response.text).toBe(mockCSV);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('campaign-1-logs.csv');
    });

    test('should reject unsupported format', async () => {
      const response = await request(app)
        .get('/api/campaigns/1/logs/export?format=json')
        .expect(400);

      expect(response.body.error).toBe('Invalid format');
    });
  });
});
