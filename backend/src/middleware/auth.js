// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../models/db');

/**
 * Middleware to authenticate JWT token
 * Verifies token and attaches user to req.user
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authentication required. Please provide a valid token.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.'
        });
      }
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication failed. Invalid token.'
      });
    }

    // Query database for user
    const result = await db.query(
      'SELECT id, full_name, email, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        message: 'User associated with this token no longer exists.'
      });
    }

    // Attach user to request (without password_hash)
    req.user = result.rows[0];

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during authentication.'
    });
  }
};

module.exports = {
  authenticateToken
};
