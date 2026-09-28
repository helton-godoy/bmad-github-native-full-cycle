process.env.JWT_SECRET = 'test-secret';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}), { virtual: true });

jest.mock('joi', () => ({
  object: jest.fn()
}), { virtual: true });

const authController = require('../../src/controllers/auth.controller');
const authService = require('../../src/services/auth.service');

describe('AuthController Unit Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('should return 201 on successful registration', async () => {
      const mockUser = { id: '123', username: 'testuser', email: 'test@example.com' };
      mockReq.body = { username: 'testuser', email: 'test@example.com', password: 'Password123' };
      jest.spyOn(authService, 'register').mockResolvedValue(mockUser);

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: mockUser,
      });
    });

    it('should return 400 for VALIDATION_ERROR', async () => {
      mockReq.body = { email: 'invalid' };
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('VALIDATION_ERROR: Invalid email address'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email address',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should return 400 for USER_EXISTS error', async () => {
      mockReq.body = { email: 'exists@example.com' };
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('USER_EXISTS: Email already registered'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email already registered',
        code: 'USER_EXISTS',
        timestamp: expect.any(String),
      });
    });

    it('should fallback to error.message if no message after colon for client error', async () => {
      mockReq.body = {};
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('VALIDATION_ERROR'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should return 500 for unexpected server/database errors', async () => {
      mockReq.body = { username: 'testuser', email: 'test@example.com', password: 'Password123' };
      jest.spyOn(authService, 'register').mockRejectedValue(new Error('DATABASE_ERROR: Connection failed'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });
  });

  describe('login', () => {
    it('should return 200 on successful login', async () => {
      const mockResult = {
        token: 'fake-jwt-token',
        expiresIn: '24h',
        user: { id: '123', email: 'test@example.com' }
      };
      mockReq.body = { email: 'test@example.com', password: 'Password123' };
      jest.spyOn(authService, 'login').mockResolvedValue(mockResult);

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: mockResult,
      });
    });

    it('should return 401 for INVALID_CREDENTIALS', async () => {
      mockReq.body = { email: 'test@example.com', password: 'Wrong' };
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('INVALID_CREDENTIALS: Invalid email or password'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    it('should return 400 for VALIDATION_ERROR during login', async () => {
      mockReq.body = { password: 'Password123' };
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('VALIDATION_ERROR: Email is required'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email is required',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should fallback to error.message if no message after colon for INVALID_CREDENTIALS', async () => {
      mockReq.body = { email: 'test@example.com', password: 'Wrong' };
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('INVALID_CREDENTIALS'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_CREDENTIALS',
        code: 'INVALID_CREDENTIALS',
        timestamp: expect.any(String),
      });
    });

    it('should return 500 for unexpected server errors', async () => {
      mockReq.body = { email: 'test@example.com', password: 'Password123' };
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('UNEXPECTED_FAILURE: Secret key missing'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });
  });

  describe('me', () => {
    it('should return 200 with current user data', async () => {
      const mockUser = { id: '123', username: 'testuser', email: 'test@example.com' };
      mockReq.user = { userId: '123' };
      jest.spyOn(authService, 'getUserById').mockResolvedValue(mockUser);

      await authController.me(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should return 404 for USER_NOT_FOUND', async () => {
      mockReq.user = { userId: 'nonexistent-id' };
      jest.spyOn(authService, 'getUserById').mockRejectedValue(new Error('USER_NOT_FOUND: User not found'));

      await authController.me(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    it('should fallback to error.message if no message after colon for USER_NOT_FOUND', async () => {
      mockReq.user = { userId: 'nonexistent-id' };
      jest.spyOn(authService, 'getUserById').mockRejectedValue(new Error('USER_NOT_FOUND'));

      await authController.me(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'USER_NOT_FOUND',
        code: 'USER_NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    it('should return 500 for unexpected server errors', async () => {
      mockReq.user = { userId: '123' };
      jest.spyOn(authService, 'getUserById').mockRejectedValue(new Error('DB_DOWN: Timeout'));

      await authController.me(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'An internal server error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });
  });
});
