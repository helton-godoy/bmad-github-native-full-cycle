jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true)
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('token'),
  verify: jest.fn().mockReturnValue({ userId: '1' })
}), { virtual: true });

jest.mock('joi', () => ({
  object: jest.fn().mockReturnValue({
    keys: jest.fn().mockReturnValue({
      validate: jest.fn().mockReturnValue({ error: null, value: {} })
    })
  }),
  string: jest.fn().mockReturnValue({
    alphanum: function() { return this; },
    min: function() { return this; },
    max: function() { return this; },
    email: function() { return this; },
    required: function() { return this; }
  })
}), { virtual: true });

process.env.JWT_SECRET = 'test-secret';

const authController = require('../src/controllers/auth.controller');
const authService = require('../src/services/auth.service');

describe('Auth Security Fix', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {}, user: {} };
        res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.body = data;
                return this;
            }
        };
        jest.restoreAllMocks();
    });

    test('Register - does not leak internal error message', async () => {
        jest.spyOn(authService, 'register').mockRejectedValue(new Error('DATABASE_ERROR: Secret connection string leaked'));

        await authController.register(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('An internal server error occurred');
        expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('Login - does not leak internal error message', async () => {
        jest.spyOn(authService, 'login').mockRejectedValue(new Error('INTERNAL_ERROR: Sensitive login details leaked'));

        await authController.login(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('An internal server error occurred');
        expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('Me - does not leak internal error message', async () => {
        req.user = { userId: '123' };
        jest.spyOn(authService, 'getUserById').mockRejectedValue(new Error('Something sensitive'));

        await authController.me(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('An internal server error occurred');
        expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('Register - allows validation errors', async () => {
        jest.spyOn(authService, 'register').mockRejectedValue(new Error('VALIDATION_ERROR: Invalid email'));

        await authController.register(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid email');
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});
