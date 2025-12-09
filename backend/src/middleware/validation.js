// backend/src/middleware/validation.js

/**
 * Email validation regex
 * Matches standard email formats
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation rules
 */
const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialCharRegex: /[!@#$%^&*(),.?":{}|<>]/
};

/**
 * Full name validation regex
 * Allows letters, spaces, hyphens, and apostrophes
 */
const FULLNAME_REGEX = /^[a-zA-Z\s'-]{2,255}$/;

/**
 * Validate email format
 * @param {string} email
 * @returns {object} { valid: boolean, error?: string }
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (trimmedEmail.length > 255) {
    return { valid: false, error: 'Email must not exceed 255 characters' };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
};

/**
 * Validate password strength
 * @param {string} password
 * @returns {object} { valid: boolean, errors?: string[] }
 */
const validatePassword = (password) => {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_RULES.maxLength} characters`);
  }

  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_RULES.requireSpecial && !PASSWORD_RULES.specialCharRegex.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};

/**
 * Validate full name
 * @param {string} fullName
 * @returns {object} { valid: boolean, error?: string }
 */
const validateFullName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') {
    return { valid: false, error: 'Full name is required' };
  }

  const trimmedName = fullName.trim();

  if (trimmedName.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters long' };
  }

  if (trimmedName.length > 255) {
    return { valid: false, error: 'Full name must not exceed 255 characters' };
  }

  if (!FULLNAME_REGEX.test(trimmedName)) {
    return { valid: false, error: 'Full name can only contain letters, spaces, hyphens, and apostrophes' };
  }

  return { valid: true };
};

/**
 * Middleware: Validate registration input
 */
const validateRegistration = (req, res, next) => {
  const errors = [];
  const { full_name, email, password } = req.body;

  // Validate full name
  const nameValidation = validateFullName(full_name);
  if (!nameValidation.valid) {
    errors.push({ field: 'full_name', message: nameValidation.error });
  }

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    errors.push({ field: 'email', message: emailValidation.error });
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    passwordValidation.errors.forEach(error => {
      errors.push({ field: 'password', message: error });
    });
  }

  // Return errors if any
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize inputs
  req.body.full_name = full_name.trim();
  req.body.email = email.trim().toLowerCase();

  next();
};

/**
 * Middleware: Validate login input
 */
const validateLogin = (req, res, next) => {
  const errors = [];
  const { email, password } = req.body;

  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    errors.push({ field: 'email', message: emailValidation.error });
  }

  // Validate password exists
  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  // Return errors if any
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  // Sanitize inputs
  req.body.email = email.trim().toLowerCase();

  next();
};

/**
 * Generic sanitization middleware
 * Trims all string values in req.body
 */
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateFullName,
  validateRegistration,
  validateLogin,
  sanitizeInput
};
