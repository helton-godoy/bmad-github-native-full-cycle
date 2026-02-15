const userRepository = require('../repositories/user.repository');
const { hashPassword, comparePassword } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');
const {
  validateRegistration,
  validateLogin,
} = require('../utils/validator.util');

class AuthService {
  /**
   * Register a new user
   */
  async register(data) {
    // Validate input
    const validation = validateRegistration(data);
    if (!validation.valid) {
      throw new Error(`VALIDATION_ERROR: ${validation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingEmail = await userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new Error('USER_EXISTS: Email already registered');
    }

    const existingUsername = await userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('USER_EXISTS: Username already taken');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await userRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
    });

    // Return user without password
    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Login user
   */
  async login(data) {
    // Validate input
    const validation = validateLogin(data);
    if (!validation.valid) {
      throw new Error(`VALIDATION_ERROR: ${validation.errors.join(', ')}`);
    }

    // Find user
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS: Invalid email or password');
    }

    // Verify password
    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS: Invalid email or password');
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      username: user.username,
    });

    // Return token and user
    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
    return {
      token,
      expiresIn: '24h',
      user: userWithoutPassword,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND: User not found');
    }

    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

module.exports = new AuthService();
