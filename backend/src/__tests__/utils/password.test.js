const { hashPassword, comparePassword } = require('../../utils/password');

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    test('should hash password successfully', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(60);
      expect(hash.startsWith('$2')).toBe(true);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'SecurePass123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test('should reject password shorter than 8 characters', async () => {
      await expect(hashPassword('short')).rejects.toThrow('at least 8 characters');
    });

    test('should reject empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow();
    });
  });

  describe('comparePassword', () => {
    test('should return true for matching password', async () => {
      const password = 'SecurePass123!';
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(password, hash);

      expect(isMatch).toBe(true);
    });

    test('should return false for non-matching password', async () => {
      const password = 'SecurePass123!';
      const wrongPassword = 'WrongPass123!';
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(wrongPassword, hash);

      expect(isMatch).toBe(false);
    });

    test('should return false for invalid hash', async () => {
      const password = 'SecurePass123!';
      const isMatch = await comparePassword(password, 'invalid-hash');

      expect(isMatch).toBe(false);
    });
  });
});
