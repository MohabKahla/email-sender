// backend/src/utils/csvParser.js
const { parse } = require('csv-parse/sync');

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Configuration
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RECIPIENTS = 10000;
const MAX_CUSTOM_FIELDS = 20;
const MAX_FIELD_LENGTH = 1000;

/**
 * Parse CSV file buffer and validate recipients
 * @param {Buffer} fileBuffer - CSV file buffer
 * @returns {Promise<Object>} Parsed and validated result
 */
async function parseCSV(fileBuffer) {
  try {
    // Check file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return {
        valid: false,
        errors: [{ message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` }],
        recipients: [],
        customFields: []
      };
    }

    // Check if file is empty
    if (fileBuffer.length === 0) {
      return {
        valid: false,
        errors: [{ message: 'CSV file is empty' }],
        recipients: [],
        customFields: []
      };
    }

    // Parse CSV
    let records;
    try {
      records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        cast: false,
        encoding: 'utf8'
      });
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: `CSV parse error: ${error.message}` }],
        recipients: [],
        customFields: []
      };
    }

    // Check if records is empty
    if (!records || records.length === 0) {
      return {
        valid: false,
        errors: [{ message: 'CSV file contains no data rows' }],
        recipients: [],
        customFields: []
      };
    }

    // Check for required 'email' column (case-insensitive)
    const headers = Object.keys(records[0]);
    const emailColumn = headers.find(h => h.toLowerCase() === 'email');

    if (!emailColumn) {
      return {
        valid: false,
        errors: [{ message: 'Required column "email" not found in CSV. Column names are case-insensitive.' }],
        recipients: [],
        customFields: []
      };
    }

    // Normalize column names to lowercase
    const normalizedRecords = records.map(record => {
      const normalized = {};
      for (const [key, value] of Object.entries(record)) {
        normalized[key.toLowerCase()] = value;
      }
      return normalized;
    });

    // Check recipient count
    if (normalizedRecords.length > MAX_RECIPIENTS) {
      return {
        valid: false,
        errors: [{ message: `CSV contains ${normalizedRecords.length} recipients. Maximum allowed is ${MAX_RECIPIENTS}.` }],
        recipients: [],
        customFields: []
      };
    }

    // Validate recipients
    const validation = validateRecipients(normalizedRecords);

    // Extract custom fields
    const customFields = extractCustomFields(normalizedRecords);

    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      recipients: validation.recipients,
      customFields,
      summary: {
        totalRows: normalizedRecords.length,
        validRows: validation.recipients.length,
        errorRows: validation.errors.length,
        duplicates: validation.duplicates
      }
    };
  } catch (error) {
    console.error('CSV parsing error:', error);
    return {
      valid: false,
      errors: [{ message: `Unexpected error: ${error.message}` }],
      recipients: [],
      customFields: []
    };
  }
}

/**
 * Validate recipients array
 * @param {Array} records - Array of recipient objects
 * @returns {Object} Validation result
 */
function validateRecipients(records) {
  const errors = [];
  const warnings = [];
  const validRecipients = [];
  const seenEmails = new Set();
  let duplicateCount = 0;

  records.forEach((record, index) => {
    const rowNumber = index + 2; // +2 because index is 0-based and CSV has header row
    const email = record.email ? record.email.trim() : '';
    const name = record.name ? record.name.trim() : '';

    // Validate email
    if (!email) {
      errors.push({
        row: rowNumber,
        field: 'email',
        message: 'Email is required',
        value: ''
      });
      return;
    }

    if (email.length > 255) {
      errors.push({
        row: rowNumber,
        field: 'email',
        message: 'Email exceeds maximum length of 255 characters',
        value: email.substring(0, 50) + '...'
      });
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      errors.push({
        row: rowNumber,
        field: 'email',
        message: 'Invalid email format',
        value: email
      });
      return;
    }

    // Check for duplicates
    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errors.push({
        row: rowNumber,
        field: 'email',
        message: 'Duplicate email address',
        value: email
      });
      duplicateCount++;
      return;
    }

    seenEmails.add(emailLower);

    // Validate name (optional)
    if (name && name.length > 255) {
      warnings.push({
        row: rowNumber,
        field: 'name',
        message: 'Name exceeds 255 characters and will be truncated',
        value: name.substring(0, 50) + '...'
      });
    }

    // Warn if name is empty
    if (!name) {
      warnings.push({
        row: rowNumber,
        field: 'name',
        message: 'Name field is empty'
      });
    }

    // Validate custom fields
    for (const [key, value] of Object.entries(record)) {
      if (key !== 'email' && key !== 'name' && value && value.length > MAX_FIELD_LENGTH) {
        warnings.push({
          row: rowNumber,
          field: key,
          message: `Field "${key}" exceeds ${MAX_FIELD_LENGTH} characters and will be truncated`,
          value: value.substring(0, 50) + '...'
        });
      }
    }

    // Add valid recipient
    validRecipients.push({
      email: email.toLowerCase(),
      name: name.substring(0, 255),
      customFields: extractRecipientCustomFields(record)
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    recipients: validRecipients,
    duplicates: duplicateCount
  };
}

/**
 * Detect duplicate email addresses
 * @param {Array} recipients - Array of recipient objects
 * @returns {Array} Array of duplicate emails
 */
function detectDuplicates(recipients) {
  const emailCounts = {};
  const duplicates = [];

  recipients.forEach(recipient => {
    const email = recipient.email.toLowerCase();
    emailCounts[email] = (emailCounts[email] || 0) + 1;
  });

  for (const [email, count] of Object.entries(emailCounts)) {
    if (count > 1) {
      duplicates.push({ email, count });
    }
  }

  return duplicates;
}

/**
 * Extract custom field names (columns beyond email and name)
 * @param {Array} records - Array of recipient objects
 * @returns {Array} Array of custom field names
 */
function extractCustomFields(records) {
  if (!records || records.length === 0) {
    return [];
  }

  const allFields = Object.keys(records[0]);
  const customFields = allFields.filter(field =>
    field !== 'email' && field !== 'name'
  );

  return customFields.slice(0, MAX_CUSTOM_FIELDS);
}

/**
 * Extract custom fields for a single recipient
 * @param {Object} record - Recipient record
 * @returns {Object} Custom fields object
 */
function extractRecipientCustomFields(record) {
  const customFields = {};

  for (const [key, value] of Object.entries(record)) {
    if (key !== 'email' && key !== 'name') {
      customFields[key] = value ? value.substring(0, MAX_FIELD_LENGTH) : '';
    }
  }

  return customFields;
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  if (email.length > 255) {
    return false;
  }

  return EMAIL_REGEX.test(email);
}

module.exports = {
  parseCSV,
  validateRecipients,
  detectDuplicates,
  extractCustomFields,
  isValidEmail
};
