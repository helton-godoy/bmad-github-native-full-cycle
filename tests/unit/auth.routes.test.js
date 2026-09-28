process.env.JWT_SECRET = 'test-secret';

const mockRouter = {
  post: jest.fn(),
  get: jest.fn(),
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter),
}), { virtual: true });

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}), { virtual: true });

jest.mock('joi', () => ({
  object: jest.fn(),
}), { virtual: true });

const authController = require('../../src/controllers/auth.controller');
const authMiddleware = require('../../src/middleware/auth.middleware');

describe('auth.routes unit tests', () => {
  beforeAll(() => {
    require('../../src/routes/auth.routes');
  });

  test('should register POST /register route with authController.register', () => {
    expect(mockRouter.post).toHaveBeenCalledWith('/register', authController.register);
  });

  test('should register POST /login route with authController.login', () => {
    expect(mockRouter.post).toHaveBeenCalledWith('/login', authController.login);
  });

  test('should register GET /me route with authMiddleware and handler forwarding to authController.me', () => {
    expect(mockRouter.get).toHaveBeenCalledWith('/me', authMiddleware, expect.any(Function));

    const meCall = mockRouter.get.mock.calls.find(call => call[0] === '/me');
    const handler = meCall[2];

    const req = { user: { userId: '123' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const meSpy = jest.spyOn(authController, 'me').mockImplementation((req, res) => {
      res.status(200).json({ success: true });
    });

    handler(req, res);

    expect(meSpy).toHaveBeenCalledWith(req, res);
    meSpy.mockRestore();
  });
});
