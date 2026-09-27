const { validateRegistration, validateLogin } = require('../../src/utils/validator.util');

describe('Validator Utility', () => {
  describe('validateRegistration', () => {
    test('should validate a correct registration payload', () => {
      const data = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(data);
    });

    test('should return errors for missing required fields', () => {
      const data = {};
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" is required');
      expect(result.errors).toContain('"email" is required');
      expect(result.errors).toContain('"password" is required');
    });

    test('should return errors for invalid username (not alphanumeric)', () => {
      const data = {
        username: 'john_doe!',
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" must only contain alpha-numeric characters');
    });

    test('should return errors for username too short', () => {
      const data = {
        username: 'jo',
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" length must be at least 3 characters long');
    });

    test('should return errors for username too long', () => {
      const data = {
        username: 'a'.repeat(31),
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" length must be less than or equal to 30 characters long');
    });

    test('should return errors for invalid email', () => {
      const data = {
        username: 'johndoe',
        email: 'not-an-email',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" must be a valid email');
    });

    test('should return errors for password too short', () => {
      const data = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'short',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"password" length must be at least 8 characters long');
    });

    test('should reject unknown fields', () => {
      const data = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
        extra: 'field'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"extra" is not allowed');
    });

    test('should handle null or undefined input', () => {
      expect(validateRegistration(null).valid).toBe(false);
      expect(validateRegistration(undefined).valid).toBe(false);
    });
  });

  describe('validateLogin', () => {
    test('should validate a correct login payload', () => {
      const data = {
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(data);
    });

    test('should return errors for missing fields', () => {
      const data = {};
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" is required');
      expect(result.errors).toContain('"password" is required');
    });

    test('should return errors for invalid email', () => {
      const data = {
        email: 'not-an-email',
        password: 'password123',
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" must be a valid email');
    });

    test('should reject unknown fields', () => {
      const data = {
        email: 'john@example.com',
        password: 'password123',
        extra: 'field'
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"extra" is not allowed');
    });

    test('should handle null or undefined input', () => {
      expect(validateLogin(null).valid).toBe(false);
      expect(validateLogin(undefined).valid).toBe(false);
    });
  });
});
