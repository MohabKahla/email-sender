const { encrypt, decrypt } = require('./utils/encryption');

async function testEncryption() {
  try {
    console.log('Testing encryption utility...\n');

    // Test 1: Basic encryption and decryption
    const originalPassword = 'myGmailAppPassword123';
    console.log('Original password:', originalPassword);

    const encrypted = encrypt(originalPassword);
    console.log('Encrypted:', encrypted);
    console.log('Encrypted length:', encrypted.length, 'characters');

    const decrypted = decrypt(encrypted);
    console.log('Decrypted:', decrypted);

    if (decrypted === originalPassword) {
      console.log('✅ Test 1 passed: Encryption and decryption match\n');
    } else {
      throw new Error('Decrypted value does not match original');
    }

    // Test 2: Different IVs for same data
    const encrypted1 = encrypt(originalPassword);
    const encrypted2 = encrypt(originalPassword);

    if (encrypted1 !== encrypted2) {
      console.log('✅ Test 2 passed: Different IVs generated for each encryption\n');
    } else {
      throw new Error('Same encrypted output (IV not random)');
    }

    // Test 3: Both decrypt to same value
    const decrypted1 = decrypt(encrypted1);
    const decrypted2 = decrypt(encrypted2);

    if (decrypted1 === originalPassword && decrypted2 === originalPassword) {
      console.log('✅ Test 3 passed: Both decrypt correctly\n');
    } else {
      throw new Error('Decryption failed for one of the values');
    }

    // Test 4: Special characters
    const specialPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const encryptedSpecial = encrypt(specialPassword);
    const decryptedSpecial = decrypt(encryptedSpecial);

    if (decryptedSpecial === specialPassword) {
      console.log('✅ Test 4 passed: Special characters handled correctly\n');
    } else {
      throw new Error('Special characters not handled correctly');
    }

    // Test 5: Long data
    const longPassword = 'a'.repeat(1000);
    const encryptedLong = encrypt(longPassword);
    const decryptedLong = decrypt(encryptedLong);

    if (decryptedLong === longPassword) {
      console.log('✅ Test 5 passed: Long data encrypted correctly\n');
    } else {
      throw new Error('Long data encryption failed');
    }

    // Test 6: Error handling - Invalid encrypted data
    try {
      decrypt('invalid-encrypted-data');
      throw new Error('Should have thrown error for invalid data');
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('decrypt')) {
        console.log('✅ Test 6 passed: Invalid data error handling works\n');
      } else {
        throw error;
      }
    }

    console.log('🎉 All encryption tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Encryption test failed:', error.message);
    process.exit(1);
  }
}

testEncryption();
