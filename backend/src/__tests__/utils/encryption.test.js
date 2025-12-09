const { encrypt, decrypt } = require('../../utils/encryption');

// Set test encryption key
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Encryption Utility', () => {
  describe('encrypt and decrypt', () => {
    test('should encrypt and decrypt successfully', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    test('should generate different IVs for same plaintext', () => {
      const plaintext = 'same-password';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    test('should handle special characters', () => {
      const plaintext = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(1000);
    });

    test('should produce base64 encoded output', () => {
      const plaintext = 'test-password';
      const encrypted = encrypt(plaintext);

      // Base64 regex
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      expect(base64Regex.test(encrypted)).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should throw error for invalid encrypted data', () => {
      expect(() => decrypt('invalid-data')).toThrow();
    });

    test('should throw error for empty plaintext', () => {
      expect(() => encrypt('')).toThrow('non-empty string');
    });

    test('should throw error for non-string plaintext', () => {
      expect(() => encrypt(123)).toThrow('non-empty string');
    });

    test('should throw error for null plaintext', () => {
      expect(() => encrypt(null)).toThrow('non-empty string');
    });

    test('should throw error for undefined plaintext', () => {
      expect(() => encrypt(undefined)).toThrow('non-empty string');
    });

    test('should throw error when encryption key missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');

      process.env.ENCRYPTION_KEY = originalKey;
    });

    test('should throw error for invalid key length', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'tooshort';

      expect(() => encrypt('test')).toThrow('64 characters');

      process.env.ENCRYPTION_KEY = originalKey;
    });

    test('should throw error for empty encrypted data', () => {
      expect(() => decrypt('')).toThrow('non-empty string');
    });

    test('should throw error for non-string encrypted data', () => {
      expect(() => decrypt(123)).toThrow('non-empty string');
    });
  });

  describe('encryption integrity', () => {
    test('should fail decryption if data is tampered', () => {
      const plaintext = 'secure-password';
      const encrypted = encrypt(plaintext);

      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      expect(() => decrypt(tampered)).toThrow();
    });

    test('should maintain data integrity for various lengths', () => {
      const testCases = ['a', 'ab', 'abc', 'a'.repeat(100), 'a'.repeat(500)];

      testCases.forEach(plaintext => {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });
  });
});
