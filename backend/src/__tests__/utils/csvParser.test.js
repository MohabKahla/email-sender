// backend/src/__tests__/utils/csvParser.test.js
const { parseCSV, validateRecipients, detectDuplicates, extractCustomFields, isValidEmail } = require('../../utils/csvParser');

describe('csvParser', () => {
  describe('parseCSV', () => {
    test('should parse valid CSV with email and name', async () => {
      const csvContent = 'email,name\ntest@example.com,Test User\njohn@example.com,John Doe';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients).toHaveLength(2);
      expect(result.recipients[0]).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        customFields: {}
      });
      expect(result.summary.totalRows).toBe(2);
      expect(result.summary.validRows).toBe(2);
      expect(result.summary.errorRows).toBe(0);
    });

    test('should parse CSV with custom fields', async () => {
      const csvContent = 'email,name,company,position\ntest@example.com,Test User,Acme Inc,Developer';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients[0].customFields).toEqual({
        company: 'Acme Inc',
        position: 'Developer'
      });
      expect(result.customFields).toEqual(['company', 'position']);
    });

    test('should parse CSV with quoted values containing commas', async () => {
      const csvContent = 'email,name,address\ntest@example.com,"Doe, John","123 Main St, Apt 4"';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients[0].name).toBe('Doe, John');
      expect(result.recipients[0].customFields.address).toBe('123 Main St, Apt 4');
    });

    test('should handle case-insensitive email column', async () => {
      const csvContent = 'EMAIL,Name\ntest@example.com,Test User';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients[0].email).toBe('test@example.com');
    });

    test('should fail if email column is missing', async () => {
      const csvContent = 'name,company\nTest User,Acme Inc';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Required column "email" not found');
    });

    test('should fail if CSV is empty', async () => {
      const buffer = Buffer.from('');

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('CSV file is empty');
    });

    test('should fail if file size exceeds maximum', async () => {
      const largeContent = 'email,name\n' + 'test@example.com,Test User\n'.repeat(200000);
      const buffer = Buffer.from(largeContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('File size exceeds maximum');
    });

    test('should detect invalid email addresses', async () => {
      const csvContent = 'email,name\ninvalid-email,Test User\ntest@example.com,Valid User';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Invalid email format');
      expect(result.recipients).toHaveLength(1);
      expect(result.recipients[0].email).toBe('test@example.com');
    });

    test('should detect duplicate emails', async () => {
      const csvContent = 'email,name\ntest@example.com,User 1\ntest@example.com,User 2\njohn@example.com,John';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Duplicate email address');
      expect(result.summary.duplicates).toBe(1);
      expect(result.recipients).toHaveLength(2); // Only unique emails
    });

    test('should warn if name is missing', async () => {
      const csvContent = 'email,name\ntest@example.com,';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Name field is empty');
    });

    test('should handle CSV with only headers', async () => {
      const csvContent = 'email,name';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('CSV file contains no data rows');
    });

    test('should reject CSV with too many recipients', async () => {
      const headers = 'email,name\n';
      const rows = Array.from({ length: 10001 }, (_, i) => `user${i}@example.com,User ${i}`).join('\n');
      const buffer = Buffer.from(headers + rows);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Maximum allowed is 10000');
    });

    test('should handle malformed CSV', async () => {
      const csvContent = 'email,name\ntest@example.com';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients[0].name).toBe('');
    });

    test('should trim whitespace from values', async () => {
      const csvContent = 'email,name\n  test@example.com  ,  Test User  ';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients[0].email).toBe('test@example.com');
      expect(result.recipients[0].name).toBe('Test User');
    });

    test('should handle empty rows', async () => {
      const csvContent = 'email,name\ntest@example.com,Test User\n\njohn@example.com,John Doe';
      const buffer = Buffer.from(csvContent);

      const result = await parseCSV(buffer);

      expect(result.valid).toBe(true);
      expect(result.recipients).toHaveLength(2);
    });
  });

  describe('validateRecipients', () => {
    test('should validate recipients with valid emails', () => {
      const records = [
        { email: 'test@example.com', name: 'Test User' },
        { email: 'john@example.com', name: 'John Doe' }
      ];

      const result = validateRecipients(records);

      expect(result.valid).toBe(true);
      expect(result.recipients).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject missing email', () => {
      const records = [
        { email: '', name: 'Test User' }
      ];

      const result = validateRecipients(records);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Email is required');
    });

    test('should reject email exceeding 255 characters', () => {
      const longEmail = 'a'.repeat(256) + '@example.com';
      const records = [
        { email: longEmail, name: 'Test User' }
      ];

      const result = validateRecipients(records);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum length');
    });

    test('should warn if name exceeds 255 characters', () => {
      const longName = 'a'.repeat(256);
      const records = [
        { email: 'test@example.com', name: longName }
      ];

      const result = validateRecipients(records);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Name exceeds 255 characters');
    });

    test('should lowercase emails', () => {
      const records = [
        { email: 'TEST@EXAMPLE.COM', name: 'Test User' }
      ];

      const result = validateRecipients(records);

      expect(result.recipients[0].email).toBe('test@example.com');
    });
  });

  describe('detectDuplicates', () => {
    test('should detect duplicate emails', () => {
      const recipients = [
        { email: 'test@example.com', name: 'User 1' },
        { email: 'test@example.com', name: 'User 2' },
        { email: 'john@example.com', name: 'John' }
      ];

      const duplicates = detectDuplicates(recipients);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toEqual({ email: 'test@example.com', count: 2 });
    });

    test('should handle no duplicates', () => {
      const recipients = [
        { email: 'test@example.com', name: 'User 1' },
        { email: 'john@example.com', name: 'John' }
      ];

      const duplicates = detectDuplicates(recipients);

      expect(duplicates).toHaveLength(0);
    });

    test('should be case-insensitive', () => {
      const recipients = [
        { email: 'Test@Example.com', name: 'User 1' },
        { email: 'test@example.com', name: 'User 2' }
      ];

      const duplicates = detectDuplicates(recipients);

      expect(duplicates).toHaveLength(1);
    });
  });

  describe('extractCustomFields', () => {
    test('should extract custom fields', () => {
      const records = [
        { email: 'test@example.com', name: 'Test', company: 'Acme', position: 'Dev' }
      ];

      const customFields = extractCustomFields(records);

      expect(customFields).toEqual(['company', 'position']);
    });

    test('should exclude email and name', () => {
      const records = [
        { email: 'test@example.com', name: 'Test' }
      ];

      const customFields = extractCustomFields(records);

      expect(customFields).toHaveLength(0);
    });

    test('should limit to 20 custom fields', () => {
      const record = { email: 'test@example.com', name: 'Test' };
      for (let i = 1; i <= 25; i++) {
        record[`field${i}`] = `value${i}`;
      }

      const customFields = extractCustomFields([record]);

      expect(customFields).toHaveLength(20);
    });

    test('should return empty array for empty records', () => {
      const customFields = extractCustomFields([]);

      expect(customFields).toHaveLength(0);
    });
  });

  describe('isValidEmail', () => {
    test('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('user_name@example-domain.com')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('invalid@.com')).toBe(false);
      expect(isValidEmail('invalid@domain')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });

    test('should reject email exceeding 255 characters', () => {
      const longEmail = 'a'.repeat(256) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });

    test('should handle non-string input', () => {
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
      expect(isValidEmail([])).toBe(false);
    });
  });
});
