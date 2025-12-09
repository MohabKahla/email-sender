const request = require('supertest');
const app = require('../../server');
const db = require('../../models/db');
const { encrypt } = require('../../utils/encryption');

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 999, email: 'test@example.com' };
    next();
  }
}));

// Set encryption key for tests
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('SMTP Routes', () => {
  const testUserId = 999;

  beforeAll(async () => {
    // Setup: Create test user
    try {
      await db.query(
        `INSERT INTO users (id, full_name, email, password_hash)
         VALUES ($1, 'Test User', 'test@example.com', 'hash')
         ON CONFLICT (id) DO NOTHING`,
        [testUserId]
      );
    } catch (error) {
      console.error('Setup error:', error);
    }
  });

  afterEach(async () => {
    // Cleanup: Delete SMTP configs after each test
    try {
      await db.query('DELETE FROM smtp_configs WHERE user_id = $1', [testUserId]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test user
    try {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
      await db.end();
    } catch (error) {
      console.error('Teardown error:', error);
    }
  });

  describe('POST /api/smtp/configure', () => {
    test('should save SMTP configuration', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcd-efgh-ijkl-mnop',
          from_name: 'Test Sender'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('saved successfully');
      expect(response.body.config.gmail_address).toBe('test@gmail.com');
      expect(response.body.config.from_name).toBe('Test Sender');
      expect(response.body.config.has_password).toBe(true);
    });

    test('should update existing configuration (upsert)', async () => {
      // First save
      await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'first@gmail.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'First Name'
        });

      // Update
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'second@gmail.com',
          app_password: 'xyzzxyzzxyzzxyzz',
          from_name: 'Second Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.config.gmail_address).toBe('second@gmail.com');
      expect(response.body.config.from_name).toBe('Second Name');
    });

    test('should reject invalid Gmail address', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'invalid@yahoo.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Gmail');
    });

    test('should reject invalid app password format', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'short',
          from_name: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('app password');
    });

    test('should reject short from_name', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'T'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('from_name');
    });

    test('should reject long from_name', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'a'.repeat(101)
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('from_name');
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should handle app password with hyphens', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcd-efgh-ijkl-mnop',
          from_name: 'Test'
        });

      expect(response.status).toBe(200);
    });

    test('should handle app password without hyphens', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcdefghijklmnop',
          from_name: 'Test'
        });

      expect(response.status).toBe(200);
    });

    test('should normalize gmail address to lowercase', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'Test@Gmail.Com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'Test'
        });

      expect(response.status).toBe(200);
      expect(response.body.config.gmail_address).toBe('test@gmail.com');
    });

    test('should trim from_name', async () => {
      const response = await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: '  Test Name  '
        });

      expect(response.status).toBe(200);
      expect(response.body.config.from_name).toBe('Test Name');
    });
  });

  describe('GET /api/smtp/config', () => {
    test('should return config with masked password', async () => {
      // Save config first
      await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcd-efgh-ijkl-mnop',
          from_name: 'Test Sender'
        });

      // Get config
      const response = await request(app)
        .get('/api/smtp/config');

      expect(response.status).toBe(200);
      expect(response.body.config.gmail_address).toBe('test@gmail.com');
      expect(response.body.config.from_name).toBe('Test Sender');
      expect(response.body.config.app_password_masked).toContain('****');
      expect(response.body.config.app_password_masked).toContain('mnop');
      expect(response.body.config.has_password).toBe(true);
    });

    test('should return 404 when no config exists', async () => {
      const response = await request(app)
        .get('/api/smtp/config');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    test('should include timestamps', async () => {
      await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'Test'
        });

      const response = await request(app)
        .get('/api/smtp/config');

      expect(response.status).toBe(200);
      expect(response.body.config.created_at).toBeDefined();
      expect(response.body.config.updated_at).toBeDefined();
    });
  });

  describe('DELETE /api/smtp/config', () => {
    test('should delete configuration', async () => {
      // Save config first
      await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'abcdabcdabcdabcd',
          from_name: 'Test'
        });

      // Delete config
      const response = await request(app)
        .delete('/api/smtp/config');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify deletion
      const getResponse = await request(app)
        .get('/api/smtp/config');

      expect(getResponse.status).toBe(404);
    });

    test('should return 404 when deleting non-existent config', async () => {
      const response = await request(app)
        .delete('/api/smtp/config');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Security', () => {
    test('should encrypt password before storing', async () => {
      const password = 'testpassword1234';

      await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: password,
          from_name: 'Test'
        });

      // Check database directly
      const result = await db.query(
        'SELECT app_password_encrypted FROM smtp_configs WHERE user_id = $1',
        [testUserId]
      );

      const encrypted = result.rows[0].app_password_encrypted;

      // Should not store plaintext
      expect(encrypted).not.toBe(password);
      // Should be base64 encoded
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    test('should never return unencrypted password', async () => {
      await request(app)
        .post('/api/smtp/configure')
        .send({
          gmail_address: 'test@gmail.com',
          app_password: 'secretpassword123',
          from_name: 'Test'
        });

      const response = await request(app)
        .get('/api/smtp/config');

      // Check that response doesn't contain unencrypted password
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('secretpassword123');
      expect(response.body.config.app_password_masked).toContain('****');
    });
  });
});
