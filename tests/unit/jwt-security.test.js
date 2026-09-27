describe('JWT Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should throw error if JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => {
      require('../../src/utils/jwt.util');
    }).toThrow('JWT_SECRET environment variable is required');
  });

  test('should not throw error if JWT_SECRET is present', () => {
    process.env.JWT_SECRET = 'test-secret';
    expect(() => {
      require('../../src/utils/jwt.util');
    }).not.toThrow();
  });

  test('should correctly sign and verify tokens when secret is present', () => {
    process.env.JWT_SECRET = 'test-secret';
    const { generateToken, verifyToken } = require('../../src/utils/jwt.util');
    const payload = { userId: 1, username: 'test' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject(payload);
  });
});
