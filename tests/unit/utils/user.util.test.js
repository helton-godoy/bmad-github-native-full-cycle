const { sanitizeUser } = require('../../../src/utils/user.util');

describe('User Utility - sanitizeUser', () => {
  test('should return null if user is null', () => {
    expect(sanitizeUser(null)).toBeNull();
  });

  test('should return null if user is undefined', () => {
    expect(sanitizeUser(undefined)).toBeNull();
  });

  test('should remove passwordHash from user object', () => {
    const user = {
      id: '1',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      email: 'test@example.com'
    };
    const sanitized = sanitizeUser(user);
    expect(sanitized).not.toHaveProperty('passwordHash');
  });

  test('should remove password from user object', () => {
    const user = {
      id: '1',
      username: 'testuser',
      password: 'plainpassword',
      email: 'test@example.com'
    };
    const sanitized = sanitizeUser(user);
    expect(sanitized).not.toHaveProperty('password');
  });

  test('should remove both password and passwordHash if present', () => {
    const user = {
      id: '1',
      password: 'plainpassword',
      passwordHash: 'hashedpassword'
    };
    const sanitized = sanitizeUser(user);
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized).not.toHaveProperty('passwordHash');
  });

  test('should preserve other user fields', () => {
    const user = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      createdAt: '2023-01-01'
    };
    const sanitized = sanitizeUser(user);
    expect(sanitized).toEqual(user);
  });

  test('should return empty object if input is empty object', () => {
    expect(sanitizeUser({})).toEqual({});
  });

  test('should not modify the original user object', () => {
    const user = {
      id: '1',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      password: 'plainpassword'
    };
    const userCopy = { ...user };
    sanitizeUser(user);
    expect(user).toEqual(userCopy);
  });
});
