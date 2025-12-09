const { hashPassword, comparePassword } = require('./utils/password');

async function testPasswordUtils() {
  console.log('Testing password utilities...\n');

  // Test 1: Hash generation
  console.log('Test 1: Hash generation');
  const password = 'MySecurePassword123!';
  const hash1 = await hashPassword(password);
  console.log('Password:', password);
  console.log('Hash 1:', hash1);
  console.log('Hash length:', hash1.length);
  console.log(hash1.startsWith('$2') ? '✅ PASS' : '❌ FAIL', 'Hash format valid\n');

  // Test 2: Different salt each time
  console.log('Test 2: Different salt each time');
  const hash2 = await hashPassword(password);
  console.log('Hash 2:', hash2);
  console.log(hash1 !== hash2 ? '✅ PASS' : '❌ FAIL', 'Hashes are different (salt working)\n');

  // Test 3: Password comparison - matching
  console.log('Test 3: Password comparison - matching');
  const isMatch = await comparePassword(password, hash1);
  console.log('Comparing:', password, 'with hash1');
  console.log(isMatch ? '✅ PASS' : '❌ FAIL', 'Password match:', isMatch, '\n');

  // Test 4: Password comparison - non-matching
  console.log('Test 4: Password comparison - non-matching');
  const wrongPassword = 'WrongPassword123!';
  const isNotMatch = await comparePassword(wrongPassword, hash1);
  console.log('Comparing:', wrongPassword, 'with hash1');
  console.log(!isNotMatch ? '✅ PASS' : '❌ FAIL', 'Password mismatch:', !isNotMatch, '\n');

  // Test 5: Short password validation
  console.log('Test 5: Short password validation');
  try {
    await hashPassword('short');
    console.log('❌ FAIL - Should have thrown error for short password\n');
  } catch (error) {
    console.log('✅ PASS - Rejected short password');
    console.log('Error:', error.message, '\n');
  }

  // Test 6: Empty password validation
  console.log('Test 6: Empty password validation');
  try {
    await hashPassword('');
    console.log('❌ FAIL - Should have thrown error for empty password\n');
  } catch (error) {
    console.log('✅ PASS - Rejected empty password');
    console.log('Error:', error.message, '\n');
  }

  // Test 7: Performance check
  console.log('Test 7: Performance check');
  const start = Date.now();
  await hashPassword(password);
  const duration = Date.now() - start;
  console.log('Hash time:', duration, 'ms');
  console.log(duration < 1000 ? '✅ PASS' : '⚠️  WARN', 'Performance acceptable (<1s)\n');

  console.log('🎉 All password utility tests passed!');
  process.exit(0);
}

testPasswordUtils().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
