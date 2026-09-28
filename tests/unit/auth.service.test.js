process.env.JWT_SECRET = 'test-secret-key-12345';

jest.mock('../../src/utils/password.util', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock('../../src/utils/jwt.util', () => ({
  generateToken: jest.fn(),
}));
jest.mock('../../src/repositories/user.repository');

const authService = require('../../src/services/auth.service');
const userRepository = require('../../src/repositories/user.repository');
const { hashPassword, comparePassword } = require('../../src/utils/password.util');
const { generateToken } = require('../../src/utils/jwt.util');

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'Password123!',
    };

    test('should throw VALIDATION_ERROR if payload is invalid', async () => {
      const invalidData = { username: 'usr', email: 'not-an-email', password: '123' };

      await expect(authService.register(invalidData)).rejects.toThrow(
        /^VALIDATION_ERROR:/
      );
    });

    test('should throw USER_EXISTS if email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: '1', email: validRegisterData.email });

      await expect(authService.register(validRegisterData)).rejects.toThrow(
        'USER_EXISTS: Email already registered'
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(validRegisterData.email);
      expect(userRepository.findByUsername).not.toHaveBeenCalled();
    });

    test('should throw USER_EXISTS if username already taken', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue({ id: '2', username: validRegisterData.username });

      await expect(authService.register(validRegisterData)).rejects.toThrow(
        'USER_EXISTS: Username already taken'
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(validRegisterData.email);
      expect(userRepository.findByUsername).toHaveBeenCalledWith(validRegisterData.username);
    });

    test('should successfully register new user and return sanitized user object', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      hashPassword.mockResolvedValue('hashed_password_123');

      const createdUserInRepo = {
        id: 'user-123',
        username: validRegisterData.username,
        email: validRegisterData.email,
        passwordHash: 'hashed_password_123',
        createdAt: new Date(),
      };
      userRepository.create.mockResolvedValue(createdUserInRepo);

      const result = await authService.register(validRegisterData);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(validRegisterData.email);
      expect(userRepository.findByUsername).toHaveBeenCalledWith(validRegisterData.username);
      expect(hashPassword).toHaveBeenCalledWith(validRegisterData.password);
      expect(userRepository.create).toHaveBeenCalledWith({
        username: validRegisterData.username,
        email: validRegisterData.email,
        passwordHash: 'hashed_password_123',
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe('user-123');
      expect(result.username).toBe(validRegisterData.username);
      expect(result.email).toBe(validRegisterData.email);
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'user@example.com',
      password: 'Password123!',
    };

    test('should throw VALIDATION_ERROR if payload is invalid', async () => {
      const invalidData = { email: 'invalid-email' };

      await expect(authService.login(invalidData)).rejects.toThrow(
        /^VALIDATION_ERROR:/
      );
    });

    test('should throw INVALID_CREDENTIALS if user is not found by email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginData)).rejects.toThrow(
        'INVALID_CREDENTIALS: Invalid email or password'
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(validLoginData.email);
    });

    test('should throw INVALID_CREDENTIALS if password comparison fails', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: validLoginData.email,
        passwordHash: 'hashed_password',
      };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);

      await expect(authService.login(validLoginData)).rejects.toThrow(
        'INVALID_CREDENTIALS: Invalid email or password'
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(comparePassword).toHaveBeenCalledWith(validLoginData.password, mockUser.passwordHash);
    });

    test('should return token and sanitized user on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: validLoginData.email,
        passwordHash: 'hashed_password',
      };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      generateToken.mockReturnValue('mocked-jwt-token');

      const result = await authService.login(validLoginData);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(comparePassword).toHaveBeenCalledWith(validLoginData.password, mockUser.passwordHash);
      expect(generateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        username: mockUser.username,
      });

      expect(result).toEqual({
        token: 'mocked-jwt-token',
        expiresIn: '24h',
        user: {
          id: 'user-123',
          username: 'testuser',
          email: validLoginData.email,
        },
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('getUserById', () => {
    test('should throw USER_NOT_FOUND if user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(authService.getUserById('non-existent-id')).rejects.toThrow(
        'USER_NOT_FOUND: User not found'
      );
      expect(userRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });

    test('should return sanitized user when user exists', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'testuser@example.com',
        passwordHash: 'hashed_password',
      };
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getUserById('user-123');

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'testuser@example.com',
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
