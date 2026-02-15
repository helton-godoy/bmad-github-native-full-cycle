const request = require('supertest');
const app = require('../src/app');

describe('Health Check API', () => {
    let server;
    
    beforeAll(() => {
        server = app.listen(0);
    });
    
    afterAll(() => server.close());

    test('GET /health should return 200 OK', async () => {
        const res = await request(server)
            .get('/health')
            .expect(200);
        
        expect(res.body).toHaveProperty('status', 'ok');
    });

    test('GET /health should return JSON with status, uptime and timestamp', async () => {
        const res = await request(server)
            .get('/health')
            .expect('Content-Type', /json/)
            .expect(200);
        
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.uptime).toBe('number');
        expect(typeof res.body.timestamp).toBe('string');
        expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    test('GET /health should return uptime in seconds', async () => {
        const res = await request(server)
            .get('/health')
            .expect(200);
        
        expect(res.body.uptime).toBeGreaterThan(0);
        expect(res.body.uptime).toBeLessThan(100);
    });

    test('GET /health response time should be less than 100ms', async () => {
        const start = Date.now();
        
        await request(server)
            .get('/health')
            .expect(200);
        
        const responseTime = Date.now() - start;
        expect(responseTime).toBeLessThan(100);
    });

    test('GET /health should not require authentication', async () => {
        const res = await request(server)
            .get('/health')
            .expect(200);
        
        expect(res.body).toHaveProperty('status', 'ok');
    });
});
