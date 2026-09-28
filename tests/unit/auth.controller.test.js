/**
 * @ai-context Unit Tests for Auth Controller
 * @ai-invariant Controller responses must follow standardized JSON structure and status codes
 * @ai-connection Auth Controller uses Auth Service and handles HTTP request/response
 */

const authController = require('../../src/controllers/auth.controller');
const authService = require('../../src/services/auth.service');

jest.mock('../../src/services/auth.service');

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
    it('should register a user successfully and return status 201', async () => {
      const mockUser = { id: 'user-123', username: 'john_doe', email: 'john@example.com' };
      req.body = { username: 'john_doe', email: 'john@example.com', password: 'Password123' };
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

    it('should handle VALIDATION_ERROR and return status 400', async () => {
      req.body = { email: 'invalid-email' };
      authService.register.mockRejectedValue(new Error('VALIDATION_ERROR: Email is invalid'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email is invalid',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should handle USER_EXISTS error and return status 400', async () => {
      req.body = { email: 'existing@example.com' };
      authService.register.mockRejectedValue(new Error('USER_EXISTS: User already registered'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User already registered',
        code: 'USER_EXISTS',
        timestamp: expect.any(String),
      });
    });

    it('should fallback to safe generic message if code split results in empty message for client error', async () => {
      authService.register.mockRejectedValue(new Error('VALIDATION_ERROR'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'A validation error occurred',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should sanitize internal server errors and return status 500', async () => {
      authService.register.mockRejectedValue(new Error('DATABASE_ERROR: Connection failed'));

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
    it('should login successfully and return status 200 with data', async () => {
      const mockResult = {
        user: { id: 'user-123', email: 'john@example.com' },
        token: 'mock-jwt-token',
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

    it('should handle INVALID_CREDENTIALS error and return status 401', async () => {
      authService.login.mockRejectedValue(new Error('INVALID_CREDENTIALS: Incorrect email or password'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Incorrect email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    it('should handle VALIDATION_ERROR and return status 400', async () => {
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

    it('should fallback to safe generic message if INVALID_CREDENTIALS message part is missing', async () => {
      authService.login.mockRejectedValue(new Error('INVALID_CREDENTIALS'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication failed',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    it('should sanitize internal server errors and return status 500', async () => {
      authService.login.mockRejectedValue(new Error('REDIS_ERROR: Timeout'));

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
    it('should return user details successfully and return status 200', async () => {
      const mockUser = { id: 'user-123', username: 'john_doe', email: 'john@example.com' };
      req.user = { userId: 'user-123' };
      authService.getUserById.mockResolvedValue(mockUser);

      await authController.me(req, res);

      expect(authService.getUserById).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should handle USER_NOT_FOUND error and return status 404', async () => {
      req.user = { userId: 'user-999' };
      authService.getUserById.mockRejectedValue(new Error('USER_NOT_FOUND: User does not exist'));

      await authController.me(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User does not exist',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    it('should fallback to safe generic message if USER_NOT_FOUND message part is missing', async () => {
      req.user = { userId: 'user-999' };
      authService.getUserById.mockRejectedValue(new Error('USER_NOT_FOUND'));

      await authController.me(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource not found',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    it('should sanitize internal server errors and return status 500', async () => {
      req.user = { userId: 'user-123' };
      authService.getUserById.mockRejectedValue(new Error('UNKNOWN_ERROR: Database crash'));

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
