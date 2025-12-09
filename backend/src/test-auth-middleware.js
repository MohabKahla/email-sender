const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./middleware/auth');

// Mock Express request/response
function createMockReq(token) {
  return {
    headers: {
      authorization: token ? `Bearer ${token}` : undefined
    }
  };
}

function createMockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

async function testMiddleware() {
  console.log('Testing authentication middleware...\n');

  // Test 1: No token
  console.log('Test 1: No token provided');
  const req1 = createMockReq(null);
  const res1 = createMockRes();
  const next1 = () => console.log('❌ Should not call next()');

  await authenticateToken(req1, res1, next1);
  console.log(res1.statusCode === 401 ? '✅ PASS' : '❌ FAIL', 'Status:', res1.statusCode);
  console.log('Response:', res1.body, '\n');

  // Test 2: Invalid token
  console.log('Test 2: Invalid token');
  const req2 = createMockReq('invalid.token.here');
  const res2 = createMockRes();
  const next2 = () => console.log('❌ Should not call next()');

  await authenticateToken(req2, res2, next2);
  console.log(res2.statusCode === 401 ? '✅ PASS' : '❌ FAIL', 'Status:', res2.statusCode);
  console.log('Response:', res2.body, '\n');

  // Test 3: Valid token (create a test user first)
  console.log('Test 3: Valid token (requires test user in database)');
  // This test will be done via API endpoint once auth routes are created
  console.log('⏭️  Skip - will test via API endpoints in Task 2.4\n');

  console.log('🎉 Middleware structure tests completed!');
  process.exit(0);
}

testMiddleware().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
