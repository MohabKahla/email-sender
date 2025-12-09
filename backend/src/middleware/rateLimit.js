// backend/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// Disable rate limiting in development
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Rate limiter for login endpoint
 * 5 attempts per 15 minutes per IP
 * DISABLED in development mode
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per window
  message: {
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
  skip: () => isDevelopment // Skip in development
});

/**
 * Rate limiter for registration endpoint
 * 3 attempts per 15 minutes per IP
 * DISABLED in development mode
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 requests per window
  message: {
    error: 'Too many registration attempts',
    message: 'Too many registration attempts from this IP. Please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment // Skip in development
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 * DISABLED in development mode
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP. Please slow down.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check or development mode
    return req.path === '/api/health' || isDevelopment;
  }
});

module.exports = {
  loginLimiter,
  registerLimiter,
  apiLimiter
};
