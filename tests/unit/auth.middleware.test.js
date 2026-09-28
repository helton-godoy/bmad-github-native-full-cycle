const authMiddleware = require('../../src/middleware/auth.middleware');
const { verifyToken } = require('../../src/utils/jwt.util');

jest.mock('../../src/utils/jwt.util', () => ({
  verifyToken: jest.fn(),
}));

describe('Auth Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should return 401 AUTH_HEADER_MISSING if authorization header is missing', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'AUTH_HEADER_MISSING' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 TOKEN_MISSING if authorization header is not Bearer format', () => {
    req.headers['authorization'] = 'Basic dXNlcjpwYXNz';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_MISSING' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 TOKEN_MISSING if authorization header has parts length != 2', () => {
    req.headers['authorization'] = 'Bearer token extra_part';

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

  test('should attach user payload to request and call next() if token is valid', () => {
    req.headers['authorization'] = 'Bearer valid.jwt.token';
    const mockPayload = { id: '123', username: 'testuser' };
    verifyToken.mockReturnValue(mockPayload);

    authMiddleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('valid.jwt.token');
    expect(req.user).toEqual(mockPayload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 401 with error message when verifyToken throws TOKEN_EXPIRED', () => {
    req.headers['authorization'] = 'Bearer expired.jwt.token';
    verifyToken.mockImplementation(() => {
      throw new Error('TOKEN_EXPIRED');
    });

    authMiddleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('expired.jwt.token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_EXPIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with error message when verifyToken throws TOKEN_INVALID', () => {
    req.headers['authorization'] = 'Bearer invalid.jwt.token';
    verifyToken.mockImplementation(() => {
      throw new Error('TOKEN_INVALID');
    });

    authMiddleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('invalid.jwt.token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_INVALID' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 with generic error message when verifyToken throws arbitrary error', () => {
    req.headers['authorization'] = 'Bearer malformed.jwt.token';
    verifyToken.mockImplementation(() => {
      throw new Error('UNEXPECTED_VERIFICATION_ERROR');
    });

    authMiddleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('malformed.jwt.token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'UNEXPECTED_VERIFICATION_ERROR' });
    expect(next).not.toHaveBeenCalled();
  });
});
