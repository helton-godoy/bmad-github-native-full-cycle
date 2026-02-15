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
      res
        .status(
          code === 'VALIDATION_ERROR' || code === 'USER_EXISTS' ? 400 : 500
        )
        .json({
          success: false,
          error: message || error.message,
          code: code || 'INTERNAL_ERROR',
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
      res
        .status(
          code === 'INVALID_CREDENTIALS'
            ? 401
            : code === 'VALIDATION_ERROR'
              ? 400
              : 500
        )
        .json({
          success: false,
          error: message || error.message,
          code: code || 'INTERNAL_ERROR',
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
      res.status(404).json({
        success: false,
        error: error.message,
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = new AuthController();
