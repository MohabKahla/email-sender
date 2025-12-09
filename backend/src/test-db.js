const db = require('./models/db');

async function testConnection() {
  try {
    // Test 1: Simple query
    console.log('Testing database connection...');
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connected successfully!');
    console.log('Current time:', result.rows[0].current_time);
    console.log('PostgreSQL version:', result.rows[0].pg_version);

    // Test 2: Query users table
    const usersResult = await db.query('SELECT COUNT(*) as user_count FROM users');
    console.log('✅ Users table accessible');
    console.log('Current user count:', usersResult.rows[0].user_count);

    // Test 3: Parameterized query
    const paramResult = await db.query('SELECT $1::text as message', ['Hello from parameterized query!']);
    console.log('✅ Parameterized queries working');
    console.log('Message:', paramResult.rows[0].message);

    console.log('\n🎉 All database tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testConnection();
