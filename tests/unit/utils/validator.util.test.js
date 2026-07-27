/**
 * @ai-context Unit Tests for Validation Utilities
 * @ai-invariant Input validation must be strict and consistent
 * @ai-connection Validation utilities are used by auth.service.js
 */
const { validateRegistration, validateLogin } = require('../../src/utils/validator.util');

describe('Validation Utilities', () => {
  describe('validateRegistration', () => {
    it('should validate correct registration data', () => {
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.username).toBe(data.username);
      expect(result.value.email).toBe(data.email);
      expect(result.value.password).toBe(data.password);
    });

    it('should reject invalid email format', () => {
      const data = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.includes('email'))).toBe(true);
    });

    it('should reject short password', () => {
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'short'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.includes('password'))).toBe(true);
    });

    it('should reject short username', () => {
      const data = {
        username: 'ab',
        email: 'test@example.com',
        password: 'Password123'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject long username', () => {
      const data = {
        username: 'a'.repeat(31),
        email: 'test@example.com',
        password: 'Password123'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject missing fields', () => {
      const result = validateRegistration({});

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept username with underscores', () => {
      const data = {
        username: 'test_user_123',
        email: 'test@example.com',
        password: 'Password123'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(true);
    });

    it('should return all validation errors at once', () => {
      const data = {
        username: 'ab',
        email: 'invalid',
        password: 'short'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateLogin', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'Password123'
      };

      const result = validateLogin(data);

      expect(result.valid).toBe(true);
      expect(result.value.email).toBe(data.email);
      expect(result.value.password).toBe(data.password);
    });

    it('should reject invalid email format', () => {
      const data = {
        email: 'invalid-email',
        password: 'Password123'
      };

      const result = validateLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('email'))).toBe(true);
    });

    it('should reject missing password', () => {
      const data = {
        email: 'test@example.com'
      };

      const result = validateLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('password'))).toBe(true);
    });

    it('should reject missing email', () => {
      const data = {
        password: 'Password123'
      };

      const result = validateLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('email'))).toBe(true);
    });

    it('should accept email with plus sign (Gmail convention)', () => {
      const data = {
        email: 'test+user@example.com',
        password: 'Password123'
      };

      const result = validateLogin(data);

      expect(result.valid).toBe(true);
    });

    it('should accept email with subdomains', () => {
      const data = {
        email: 'test@sub.example.com',
        password: 'Password123'
      };

      const result = validateLogin(data);

      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const result = validateRegistration(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle undefined values', () => {
      const result = validateRegistration(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle extra fields (should be ignored)', () => {
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        extraField: 'should be ignored'
      };

      const result = validateRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.value).not.toHaveProperty('extraField');
    });
  });
});