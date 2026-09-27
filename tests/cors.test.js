const request = require('supertest');
const app = require('../src/app');

describe('CORS Configuration', () => {
    test('should allow specific origins if configured', async () => {
        process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-site.com';
        const res = await request(app)
            .get('/health')
            .set('Origin', 'http://trusted-site.com');

        expect(res.headers['access-control-allow-origin']).toBe('http://trusted-site.com');
    });

    test('should reject malicious origins', async () => {
        process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-site.com';
        const res = await request(app)
            .get('/health')
            .set('Origin', 'http://malicious-site.com');

        // When origin is not allowed, the CORS middleware usually doesn't set the header
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should allow requests with no origin in development', async () => {
        process.env.NODE_ENV = 'development';
        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(200);
    });

    test('should reject requests with no origin in production', async () => {
        process.env.NODE_ENV = 'production';
        const res = await request(app)
            .get('/health');

        // Note: Supertest might fail the request if the middleware calls callback(err)
        // because express treats it as an error.
        expect(res.status).not.toBe(200);
    });
});
