jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked_jwt_token'),
  verify: jest.fn().mockReturnValue({ userId: '123', username: 'testuser' }),
}), { virtual: true });

jest.mock('joi', () => ({
  object: jest.fn().mockReturnValue({
    validate: jest.fn().mockReturnValue({ error: null }),
  }),
}), { virtual: true });

process.env.JWT_SECRET = 'test-secret-key-123456';

const authController = require('../../src/controllers/auth.controller');
const authService = require('../../src/services/auth.service');

describe('AuthController - Error Handling & Security', () => {
  let mockRes;
  let responseData;
  let statusCode;

  beforeEach(() => {
    responseData = null;
    statusCode = null;
    mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };
    jest.restoreAllMocks();
  });

  describe('login endpoint', () => {
    test('should expose client error message when code is INVALID_CREDENTIALS', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(
        new Error('INVALID_CREDENTIALS: Invalid email or password')
      );

      await authController.login({ body: {} }, mockRes);

      expect(statusCode).toBe(401);
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    test('should expose client error message when code is VALIDATION_ERROR', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(
        new Error('VALIDATION_ERROR: Email is required')
      );

      await authController.login({ body: {} }, mockRes);

      expect(statusCode).toBe(400);
      expect(responseData).toEqual({
        success: false,
        error: 'Email is required',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    test('should mask internal error message on uncaught exception in login', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(
        new Error('DATABASE_ERROR: Failed to connect to postgres://admin:secret@db.prod.internal:5432/main')
      );

      await authController.login({ body: {} }, mockRes);

      expect(statusCode).toBe(500);
      expect(responseData).toEqual({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
      expect(responseData.error).not.toContain('postgres');
      expect(responseData.error).not.toContain('secret');
    });
  });

  describe('register endpoint', () => {
    test('should expose client error message when code is USER_EXISTS', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(
        new Error('USER_EXISTS: Email already registered')
      );

      await authController.register({ body: {} }, mockRes);

      expect(statusCode).toBe(400);
      expect(responseData).toEqual({
        success: false,
        error: 'Email already registered',
        code: 'USER_EXISTS',
        timestamp: expect.any(String),
      });
    });

    test('should mask internal error message on uncaught exception in register', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(
        new Error('INTERNAL_ERROR: Redis cluster connection failed')
      );

      await authController.register({ body: {} }, mockRes);

      expect(statusCode).toBe(500);
      expect(responseData).toEqual({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
      expect(responseData.error).not.toContain('Redis');
    });
  });

  describe('me endpoint', () => {
    test('should expose 404 message when code is USER_NOT_FOUND', async () => {
      jest.spyOn(authService, 'getUserById').mockRejectedValue(
        new Error('USER_NOT_FOUND: User not found')
      );

      await authController.me({ user: { userId: '1' } }, mockRes);

      expect(statusCode).toBe(404);
      expect(responseData).toEqual({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    test('should mask internal error message on unexpected exception in me', async () => {
      jest.spyOn(authService, 'getUserById').mockRejectedValue(
        new Error('UNEXPECTED_EXCEPTION: Memory limit exceeded')
      );

      await authController.me({ user: { userId: '1' } }, mockRes);

      expect(statusCode).toBe(500);
      expect(responseData).toEqual({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
      expect(responseData.error).not.toContain('Memory limit');
    });
  });
});
