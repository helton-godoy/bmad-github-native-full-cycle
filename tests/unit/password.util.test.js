
const bcrypt = require('bcrypt');

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}), { virtual: true });

const { hashPassword, comparePassword } = require('../../src/utils/password.util');

describe('Password Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('hashPassword', () => {
    test('should hash password using default salt rounds (12) when BCRYPT_ROUNDS is not set', async () => {
      delete process.env.BCRYPT_ROUNDS;
      bcrypt.hash.mockResolvedValue('hashed_password_123');

      const result = await hashPassword('myPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('myPassword123', 12);
      expect(result).toBe('hashed_password_123');
    });

    test('should hash password using custom salt rounds from BCRYPT_ROUNDS env var', async () => {
      jest.isolateModules(async () => {
        process.env.BCRYPT_ROUNDS = '10';
        const bcryptIsolated = require('bcrypt');
        bcryptIsolated.hash.mockResolvedValue('hashed_password_custom');
        const { hashPassword: isolatedHash } = require('../../src/utils/password.util');

        const result = await isolatedHash('myPassword123');

        expect(bcryptIsolated.hash).toHaveBeenCalledWith('myPassword123', 10);
        expect(result).toBe('hashed_password_custom');
      });
    });

    test('should propagate errors thrown by bcrypt.hash', async () => {
      bcrypt.hash.mockRejectedValue(new Error('Hashing failed'));

      await expect(hashPassword('myPassword123')).rejects.toThrow('Hashing failed');
    });
  });

  describe('comparePassword', () => {
    test('should return true when passwords match', async () => {
      bcrypt.compare.mockResolvedValue(true);

      const result = await comparePassword('myPassword123', 'hashed_password_123');

      expect(bcrypt.compare).toHaveBeenCalledWith('myPassword123', 'hashed_password_123');
      expect(result).toBe(true);
    });

    test('should return false when passwords do not match', async () => {
      bcrypt.compare.mockResolvedValue(false);

      const result = await comparePassword('wrongPassword', 'hashed_password_123');

      expect(bcrypt.compare).toHaveBeenCalledWith('wrongPassword', 'hashed_password_123');
      expect(result).toBe(false);
    });

    test('should propagate errors thrown by bcrypt.compare', async () => {
      bcrypt.compare.mockRejectedValue(new Error('Comparison failed'));

      await expect(comparePassword('myPassword123', 'hashed_password_123')).rejects.toThrow('Comparison failed');
    });
  });
});
