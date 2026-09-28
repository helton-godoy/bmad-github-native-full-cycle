process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

jest.mock('../../src/utils/jwt.util', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
}));

const authMiddleware = require('../../src/middleware/auth.middleware');
const jwtUtil = require('../../src/utils/jwt.util');

describe('Auth Middleware - authMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('should return 401 AUTH_HEADER_MISSING if Authorization header is not present', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'AUTH_HEADER_MISSING' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 TOKEN_MISSING if Authorization header format is invalid (not 2 parts)', () => {
    req.headers['authorization'] = 'BearerToken123';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_MISSING' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 TOKEN_MISSING if scheme is not Bearer', () => {
    req.headers['authorization'] = 'Basic validtoken123';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_MISSING' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 TOKEN_MISSING if token part is empty string', () => {
    req.headers['authorization'] = 'Bearer ';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_MISSING' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should attach user payload to req and call next() if token is valid', () => {
    const mockPayload = { userId: 'user-123', email: 'user@example.com' };
    req.headers['authorization'] = 'Bearer valid-jwt-token';
    jwtUtil.verifyToken.mockReturnValue(mockPayload);

    authMiddleware(req, res, next);

    expect(jwtUtil.verifyToken).toHaveBeenCalledWith('valid-jwt-token');
    expect(req.user).toEqual(mockPayload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('should return 401 with TOKEN_EXPIRED error message when verifyToken throws TOKEN_EXPIRED', () => {
    req.headers['authorization'] = 'Bearer expired-jwt-token';
    jwtUtil.verifyToken.mockImplementation(() => {
      throw new Error('TOKEN_EXPIRED');
    });

    authMiddleware(req, res, next);

    expect(jwtUtil.verifyToken).toHaveBeenCalledWith('expired-jwt-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_EXPIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with error message when verifyToken throws TOKEN_INVALID', () => {
    req.headers['authorization'] = 'Bearer invalid-jwt-token';
    jwtUtil.verifyToken.mockImplementation(() => {
      throw new Error('TOKEN_INVALID');
    });

    authMiddleware(req, res, next);

    expect(jwtUtil.verifyToken).toHaveBeenCalledWith('invalid-jwt-token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_INVALID' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 for any other non-expired verification error', () => {
    req.headers['authorization'] = 'Bearer bad-jwt-token';
    jwtUtil.verifyToken.mockImplementation(() => {
      throw new Error('JsonWebTokenError');
    });

    authMiddleware(req, res, next);

    expect(jwtUtil.verifyToken).toHaveBeenCalledWith('bad-jwt-token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'JsonWebTokenError' });
    expect(next).not.toHaveBeenCalled();
  });
});
