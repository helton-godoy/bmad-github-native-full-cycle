jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true)
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('token'),
  verify: jest.fn().mockReturnValue({ userId: '1' })
}), { virtual: true });

jest.mock('joi', () => ({
  object: jest.fn().mockReturnValue({
    keys: jest.fn().mockReturnValue({
      validate: jest.fn().mockReturnValue({ error: null, value: {} })
    })
  }),
  string: jest.fn().mockReturnValue({
    alphanum: function() { return this; },
    min: function() { return this; },
    max: function() { return this; },
    email: function() { return this; },
    required: function() { return this; }
  })
}), { virtual: true });

process.env.JWT_SECRET = 'test-secret';

const authController = require('../../src/controllers/auth.controller');
const authService = require('../../src/services/auth.service');

describe('AuthController Security Tests', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
  });

  describe('register handler', () => {
    test('sanitizes internal errors and returns generic message', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('DATABASE_ERROR: Connection failed at 10.0.0.1:5432'));

      await authController.register(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('An internal server error occurred');
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('preserves user-facing validation errors', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('VALIDATION_ERROR: Invalid email format'));

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid email format');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('handles non-standard thrown errors gracefully', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue('Uncaught string error');

      await authController.register(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('An internal server error occurred');
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('login handler', () => {
    test('sanitizes internal errors during login', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('REDIS_ERROR: Connection refused'));

      await authController.login(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('An internal server error occurred');
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('preserves INVALID_CREDENTIALS error for client', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('INVALID_CREDENTIALS: Invalid email or password'));

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid email or password');
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('me handler', () => {
    test('sanitizes internal errors in me handler', async () => {
      req.user = { userId: '123' };
      jest.spyOn(authService, 'getUserById').mockRejectedValue(new Error('FATAL: Out of memory'));

      await authController.me(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('An internal server error occurred');
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('preserves USER_NOT_FOUND error in me handler', async () => {
      req.user = { userId: '123' };
      jest.spyOn(authService, 'getUserById').mockRejectedValue(new Error('USER_NOT_FOUND: User not found'));

      await authController.me(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('User not found');
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });
  });
});
