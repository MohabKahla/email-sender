// backend/src/middleware/optionalAuth.js
const jwt = require('jsonwebtoken');
const db = require('../models/db');

/**
 * Optional authentication middleware
 * Attaches user to req.user if valid token provided, but doesn't block request
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const result = await db.query(
        'SELECT id, full_name, email, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );

      req.user = result.rows.length > 0 ? result.rows[0] : null;
    } catch (err) {
      // Invalid/expired token - continue without user
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  optionalAuth
};
