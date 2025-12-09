// backend/src/models/db.js
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Disable SSL for local Docker development
  ssl: false
});

// Log pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Log successful connection (in development)
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔗 New database connection established');
  }
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log query in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool (for transactions)
 * @returns {Promise<PoolClient>}
 */
const getClient = () => {
  return pool.connect();
};

/**
 * Close the connection pool
 */
const end = () => {
  return pool.end();
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connection pool...');
  await end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connection pool...');
  await end();
  process.exit(0);
});

module.exports = {
  query,
  getClient,
  end,
  pool // Export pool for advanced use cases
};
