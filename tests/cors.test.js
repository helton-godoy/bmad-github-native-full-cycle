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

    test('should reject requests without an Origin header', async () => {
        const res = await request(app)
            .get('/health');

        // The middleware now returns an error for missing origin
        expect(res.status).not.toBe(200);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});
