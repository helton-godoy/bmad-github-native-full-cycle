process.env.JWT_SECRET = 'test-secret-key-for-unit-testing';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}), { virtual: true });

jest.mock('joi', () => ({
  object: jest.fn(),
}), { virtual: true });

jest.mock('../../src/services/auth.service');

const authController = require('../../src/controllers/auth.controller');
const authService = require('../../src/services/auth.service');

describe('AuthController Unit Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      user: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    test('should return 201 with registered user on success', async () => {
      const mockUser = { id: '1', username: 'john', email: 'john@example.com' };
      req.body = { username: 'john', email: 'john@example.com', password: 'Password123' };
      authService.register.mockResolvedValue(mockUser);

      await authController.register(req, res);

      expect(authService.register).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: mockUser,
      });
    });

    test('should return 400 when authService throws VALIDATION_ERROR', async () => {
      req.body = { username: 'john' };
      authService.register.mockRejectedValue(new Error('VALIDATION_ERROR: Email is required'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email is required',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    test('should return 400 when authService throws USER_EXISTS', async () => {
      req.body = { username: 'john', email: 'john@example.com', password: 'Password123' };
      authService.register.mockRejectedValue(new Error('USER_EXISTS: Email already registered'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email already registered',
        code: 'USER_EXISTS',
        timestamp: expect.any(String),
      });
    });

    test('should handle VALIDATION_ERROR without colon message fallback', async () => {
      authService.register.mockRejectedValue(new Error('VALIDATION_ERROR'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    test('should return 500 on unexpected service errors', async () => {
      authService.register.mockRejectedValue(new Error('Database connection failed'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });
  });

  describe('login', () => {
    test('should return 200 with token and user on successful login', async () => {
      const mockResult = {
        token: 'mock-jwt-token',
        expiresIn: '24h',
        user: { id: '1', username: 'john', email: 'john@example.com' },
      };
      req.body = { email: 'john@example.com', password: 'Password123' };
      authService.login.mockResolvedValue(mockResult);

      await authController.login(req, res);

      expect(authService.login).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: mockResult,
      });
    });

    test('should return 401 when authService throws INVALID_CREDENTIALS', async () => {
      req.body = { email: 'john@example.com', password: 'wrong' };
      authService.login.mockRejectedValue(new Error('INVALID_CREDENTIALS: Invalid email or password'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    test('should return 400 when authService throws VALIDATION_ERROR', async () => {
      req.body = { email: 'invalid-email' };
      authService.login.mockRejectedValue(new Error('VALIDATION_ERROR: Password is required'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Password is required',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    test('should handle INVALID_CREDENTIALS without colon message fallback', async () => {
      authService.login.mockRejectedValue(new Error('INVALID_CREDENTIALS'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    test('should return 500 on unexpected service errors', async () => {
      authService.login.mockRejectedValue(new Error('Internal database failure'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });
  });

  describe('me', () => {
    test('should return 200 with current user data on success', async () => {
      const mockUser = { id: '123', username: 'john', email: 'john@example.com' };
      req.user = { userId: '123' };
      authService.getUserById.mockResolvedValue(mockUser);

      await authController.me(req, res);

      expect(authService.getUserById).toHaveBeenCalledWith('123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    test('should return 404 when authService throws USER_NOT_FOUND', async () => {
      req.user = { userId: 'nonexistent' };
      authService.getUserById.mockRejectedValue(new Error('USER_NOT_FOUND: User not found'));

      await authController.me(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    test('should handle USER_NOT_FOUND without colon message fallback', async () => {
      req.user = { userId: 'nonexistent' };
      authService.getUserById.mockRejectedValue(new Error('USER_NOT_FOUND'));

      await authController.me(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'USER_NOT_FOUND',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    test('should return 500 on unexpected errors in me endpoint (line 64 error path)', async () => {
      req.user = { userId: '123' };
      authService.getUserById.mockRejectedValue(new Error('Database query failure'));

      await authController.me(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });
  });
});
