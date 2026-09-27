const authService = require('../services/auth.service');

class AuthController {
  /**
   * Register endpoint
   */
  async register(req, res) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: user,
      });
    } catch (error) {
      const [code, message] = error.message.split(': ');
      const isClientError = code === 'VALIDATION_ERROR' || code === 'USER_EXISTS';
      const statusCode = isClientError ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: isClientError ? message || error.message : 'An internal server error occurred',
        code: isClientError ? code : 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Login endpoint
   */
  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      const [code, message] = error.message.split(': ');
      const isClientError =
        code === 'INVALID_CREDENTIALS' || code === 'VALIDATION_ERROR';
      const statusCode =
        code === 'INVALID_CREDENTIALS'
          ? 401
          : code === 'VALIDATION_ERROR'
            ? 400
            : 500;

      res.status(statusCode).json({
        success: false,
        error: isClientError ? message || error.message : 'An internal server error occurred',
        code: isClientError ? code : 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current user endpoint
   */
  async me(req, res) {
    try {
      const user = await authService.getUserById(req.user.userId);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      const [code, message] = error.message.split(': ');
      const isNotFound = code === 'USER_NOT_FOUND';

      res.status(isNotFound ? 404 : 500).json({
        success: false,
        error: isNotFound ? message || error.message : 'An internal server error occurred',
        code: isNotFound ? code : 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = new AuthController();
