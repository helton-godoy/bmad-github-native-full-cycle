const request = require('supertest');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const { generateToken } = require('../src/utils/jwt.util');

jest.mock('../src/services/auth.service');

describe('Auth Security Fix', () => {
    let server;
    beforeAll(() => {
        server = app.listen(0);
    });
    afterAll(() => {
        server.close();
        jest.restoreAllMocks();
    });

    test('Register - does not leak internal error message', async () => {
        authService.register.mockRejectedValue(new Error('DATABASE_ERROR: Secret connection string leaked'));

        const res = await request(server)
            .post('/api/auth/register')
            .send({ username: 'testuser', email: 'test@example.com', password: 'Password123' });

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        // Should NOT leak the message
        expect(res.body.error).toBe('An internal server error occurred');
        expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('Login - does not leak internal error message', async () => {
        authService.login.mockRejectedValue(new Error('INTERNAL_ERROR: Sensitive login details leaked'));

        const res = await request(server)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'Password123' });

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('An internal server error occurred');
        expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('Me - does not leak internal error message', async () => {
        authService.getUserById.mockRejectedValue(new Error('Something sensitive'));
        const token = generateToken({ userId: '123', username: 'test' });

        const res = await request(server)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('An internal server error occurred');
        expect(res.body.code).toBe('INTERNAL_ERROR');
    });

    test('Register - allows validation errors', async () => {
        authService.register.mockRejectedValue(new Error('VALIDATION_ERROR: Invalid email'));

        const res = await request(server)
            .post('/api/auth/register')
            .send({ email: 'invalid' });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid email');
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});
