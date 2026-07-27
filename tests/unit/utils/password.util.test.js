/**
 * @ai-context Unit Tests for Password Utilities
 * @ai-invariant Password hashing must be secure and consistent
 * @ai-connection Password utilities are used by auth.service.js
 */
const { hashPassword, comparePassword } = require('../../src/utils/password.util');

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are 60 chars
    });

    it('should generate different hashes for the same password (salt)', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Different salts should produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should hash empty string', async () => {
      const password = '';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });

    it('should hash very long password', async () => {
      const password = 'a'.repeat(1000);
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const result = await comparePassword('WrongPassword', hash);

      expect(result).toBe(false);
    });

    it('should return false for empty password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const result = await comparePassword('', hash);

      expect(result).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const result = await comparePassword('TestPassword123!', 'invalid-hash');

      expect(result).toBe(false);
    });
  });

  describe('Password Security', () => {
    it('should use bcrypt with appropriate salt rounds', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      // bcrypt hash format: $2a$10$...
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('should not expose plaintext password in hash', async () => {
      const password = 'SecretPassword456!';
      const hash = await hashPassword(password);

      expect(hash).not.toContain(password);
    });
  });
});