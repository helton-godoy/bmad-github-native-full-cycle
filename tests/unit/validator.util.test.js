const { validateRegistration, validateLogin } = require('../../src/utils/validator.util');

describe('Validator Utility', () => {
  describe('validateRegistration', () => {
    test('should validate a valid registration payload', () => {
      const validData = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(validData);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(validData);
    });

    test('should fail if username is too short', () => {
      const data = {
        username: 'jo',
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" length must be at least 3 characters long');
    });

    test('should fail if username is too long', () => {
      const data = {
        username: 'a'.repeat(31),
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" length must be less than or equal to 30 characters long');
    });

    test('should fail if username is not alphanumeric', () => {
      const data = {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" must only contain alpha-numeric characters');
    });

    test('should fail if email is invalid', () => {
      const data = {
        username: 'johndoe',
        email: 'not-an-email',
        password: 'password123',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" must be a valid email');
    });

    test('should fail if password is too short', () => {
      const data = {
        username: 'johndoe',
        email: 'john@example.com',
        password: 'pass',
      };
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"password" length must be at least 8 characters long');
    });

    test('should fail if required fields are missing', () => {
      const result = validateRegistration({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"username" is required');
      expect(result.errors).toContain('"email" is required');
      expect(result.errors).toContain('"password" is required');
    });
  });

  describe('validateLogin', () => {
    test('should validate a valid login payload', () => {
      const validData = {
        email: 'john@example.com',
        password: 'password123',
      };
      const result = validateLogin(validData);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(validData);
    });

    test('should fail if email is invalid', () => {
      const data = {
        email: 'not-an-email',
        password: 'password123',
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"email" must be a valid email');
    });

    test('should fail if password is missing', () => {
      const data = {
        email: 'john@example.com',
      };
      const result = validateLogin(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"password" is required');
    });
  });
});
