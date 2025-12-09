// backend/src/utils/password.js
const bcrypt = require('bcrypt');

// Configuration
const SALT_ROUNDS = 12; // 2^12 iterations
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128; // bcrypt limitation

/**
 * Hash a plain text password
 * @param {string} plainPassword - The plain text password
 * @returns {Promise<string>} The bcrypt hash
 * @throws {Error} If password validation fails
 */
const hashPassword = async (plainPassword) => {
  // Validate input
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (plainPassword.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  if (plainPassword.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  try {
    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
};

/**
 * Compare a plain text password with a hash
 * @param {string} plainPassword - The plain text password
 * @param {string} hashedPassword - The bcrypt hash to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  // Validate inputs
  if (!plainPassword || typeof plainPassword !== 'string') {
    return false;
  }

  if (!hashedPassword || typeof hashedPassword !== 'string') {
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('Error comparing password:', error);
    return false; // Don't throw on comparison errors, just return false
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  MIN_PASSWORD_LENGTH, // Export for validation in routes
  MAX_PASSWORD_LENGTH
};
