const request = require('supertest');
const app = require('../src/app');

describe('Auth API', () => {
    let server;
    beforeAll(() => {
        server = app.listen(0);
    });
    afterAll(() => server.close());

    test('Register - success', async () => {
        const res = await request(server)
            .post('/api/auth/register')
            .send({ username: 'testuser', email: 'test@example.com', password: 'Password123' });
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('id');
    });

    test('Login - success', async () => {
        const res = await request(server)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'Password123' });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('token');
    });
});
