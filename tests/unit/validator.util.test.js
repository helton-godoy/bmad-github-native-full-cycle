const { validateRegistration, validateLogin } = require('../../src/utils/validator.util');

describe('Validator Utility', () => {
  describe('validateRegistration', () => {
    test('should validate a correct registration payload', () => {
      const data = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(true);
      expect(result.value).toMatchObject(data);
    });

    test('should reject username shorter than 3 characters', () => {
      const data = {
        username: 'jo',
        email: 'john@example.com',
        password: 'password123'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" length must be at least 3 characters long');
    });

    test('should reject username longer than 30 characters', () => {
      const data = {
        username: 'a'.repeat(31),
        email: 'john@example.com',
        password: 'password123'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" length must be less than or equal to 30 characters long');
    });

    test('should reject non-alphanumeric username', () => {
      const data = {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" must only contain alpha-numeric characters');
    });

    test('should reject invalid email format', () => {
      const data = {
        username: 'johndoe',
        email: 'not-an-email',
        password: 'password123'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" must be a valid email');
    });

    test('should reject password shorter than 8 characters', () => {
      const data = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'short'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"password" length must be at least 8 characters long');
    });

    test('should reject missing required fields', () => {
      const data = {
        username: 'johndoe'
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" is required');
      expect(result.errors).toContain('"password" is required');
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
        password: 'password123'
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(true);
      expect(result.value).toMatchObject(data);
    });

    test('should reject invalid email format', () => {
      const data = {
        email: 'not-an-email',
        password: 'password123'
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" must be a valid email');
    });

    test('should reject missing fields', () => {
      const data = {
        email: 'john@example.com'
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"password" is required');
    });

    test('should handle null or undefined input', () => {
      expect(validateLogin(null).valid).toBe(false);
      expect(validateLogin(undefined).valid).toBe(false);
    });
  });
});
