/**
 * @ai-context Unit tests for AuthService
 * @ai-invariant Tests cover registration, login, and user retrieval
 * @ai-connection Tests AuthService methods directly with mocked dependencies
 */

process.env.JWT_SECRET = 'test-secret-key';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-123', username: 'testuser' }),
}), { virtual: true });

jest.mock('../../src/utils/validator.util', () => ({
  validateRegistration: jest.fn((data) => {
    if (!data || !data.username || !data.email || !data.password || data.email.includes('not-an-email') || data.password === 'short' || data.username === 'usr') {
      return { valid: false, errors: ['"email" must be a valid email'] };
    }
    return { valid: true, value: data };
  }),
  validateLogin: jest.fn((data) => {
    if (!data || !data.email || !data.password || data.email.includes('bad-email')) {
      return { valid: false, errors: ['"email" must be a valid email'] };
    }
    return { valid: true, value: data };
  }),
}));

jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/utils/password.util');
jest.mock('../../src/utils/jwt.util');

const authService = require('../../src/services/auth.service');
const userRepository = require('../../src/repositories/user.repository');
const passwordUtil = require('../../src/utils/password.util');
const jwtUtil = require('../../src/utils/jwt.util');
const validatorUtil = require('../../src/utils/validator.util');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validData = {
      username: 'validuser',
      email: 'valid@example.com',
      password: 'ValidPassword123',
    };

    it('should register a new user successfully and return sanitized user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      passwordUtil.hashPassword.mockResolvedValue('hashed_password');

      const createdUser = {
        id: 'user-123',
        username: validData.username,
        email: validData.email,
        passwordHash: 'hashed_password',
        createdAt: new Date().toISOString(),
      };
      userRepository.create.mockResolvedValue(createdUser);

      const result = await authService.register(validData);

      expect(validatorUtil.validateRegistration).toHaveBeenCalledWith(validData);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(validData.email);
      expect(userRepository.findByUsername).toHaveBeenCalledWith(validData.username);
      expect(passwordUtil.hashPassword).toHaveBeenCalledWith(validData.password);
      expect(userRepository.create).toHaveBeenCalledWith({
        username: validData.username,
        email: validData.email,
        passwordHash: 'hashed_password',
      });
      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('username', validData.username);
      expect(result).toHaveProperty('email', validData.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw validation error if payload is invalid', async () => {
      const invalidData = {
        username: 'usr',
        email: 'not-an-email',
        password: 'short',
      };

      await expect(authService.register(invalidData)).rejects.toThrow(
        /VALIDATION_ERROR/
      );
    });

    it('should throw USER_EXISTS error if email is already registered', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'existing-1', email: validData.email });

      await expect(authService.register(validData)).rejects.toThrow(
        'USER_EXISTS: Email already registered'
      );
      expect(userRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should throw USER_EXISTS error if username is already taken', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue({ id: 'existing-2', username: validData.username });

      await expect(authService.register(validData)).rejects.toThrow(
        'USER_EXISTS: Username already taken'
      );
      expect(passwordUtil.hashPassword).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'user@example.com',
      password: 'ValidPassword123',
    };

    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: validLoginData.email,
      passwordHash: 'hashed_password',
    };

    it('should login successfully and return token and user', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordUtil.comparePassword.mockResolvedValue(true);
      jwtUtil.generateToken.mockReturnValue('mocked-jwt-token');

      const result = await authService.login(validLoginData);

      expect(validatorUtil.validateLogin).toHaveBeenCalledWith(validLoginData);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(passwordUtil.comparePassword).toHaveBeenCalledWith(
        validLoginData.password,
        mockUser.passwordHash
      );
      expect(jwtUtil.generateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        username: mockUser.username,
      });

      expect(result).toEqual({
        token: 'mocked-jwt-token',
        expiresIn: '24h',
        user: {
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
        },
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw validation error if login payload is invalid', async () => {
      const invalidData = { email: 'bad-email@test.com' };

      await expect(authService.login(invalidData)).rejects.toThrow(
        /VALIDATION_ERROR/
      );
    });

    it('should throw INVALID_CREDENTIALS if user is not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginData)).rejects.toThrow(
        'INVALID_CREDENTIALS: Invalid email or password'
      );
    });

    it('should throw INVALID_CREDENTIALS if password check fails', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordUtil.comparePassword.mockResolvedValue(false);

      await expect(authService.login(validLoginData)).rejects.toThrow(
        'INVALID_CREDENTIALS: Invalid email or password'
      );
    });
  });

  describe('getUserById', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
    };

    it('should return sanitized user when user exists', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUserById('user-123');

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw USER_NOT_FOUND error if user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(authService.getUserById('non-existent')).rejects.toThrow(
        'USER_NOT_FOUND: User not found'
      );
    });
  });
});
