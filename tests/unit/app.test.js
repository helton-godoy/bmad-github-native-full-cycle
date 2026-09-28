const request = require('supertest');

describe('App Module (src/app.js)', () => {
  let app;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Health Check Route', () => {
    beforeEach(() => {
      app = require('../../src/app');
    });

    test('GET /health returns 200 OK and expected payload structure', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.uptime).toBe('number');
      expect(typeof response.body.timestamp).toBe('string');
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('Mounted Routes Integration', () => {
    beforeEach(() => {
      app = require('../../src/app');
    });

    test('mounts /api/auth routes properly', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('mounts /api orchestration routes properly', async () => {
      const response = await request(app).get('/api/tasks');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('parses JSON bodies correctly', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({ username: 'invalid user!' });

      expect(response.status).toBe(400);
    });
  });

  describe('CORS Configuration', () => {
    test('allows requests with no origin in non-production environment', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.CORS_ALLOWED_ORIGINS;
      app = require('../../src/app');

      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    test('rejects requests with no origin in production environment', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ALLOWED_ORIGINS;
      app = require('../../src/app');

      const response = await request(app).get('/health');
      expect(response.status).not.toBe(200);
    });

    test('allows allowed default origin (http://localhost:3000) when CORS_ALLOWED_ORIGINS is unset', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ALLOWED_ORIGINS;
      app = require('../../src/app');

      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('rejects unallowed origin when CORS_ALLOWED_ORIGINS is unset', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ALLOWED_ORIGINS;
      app = require('../../src/app');

      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://unallowed-origin.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('allows origin matching custom CORS_ALLOWED_ORIGINS', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ALLOWED_ORIGINS = 'http://app.example.com, https://dashboard.example.com';
      app = require('../../src/app');

      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://dashboard.example.com');

      expect(response.headers['access-control-allow-origin']).toBe('https://dashboard.example.com');
    });

    test('rejects origin not matching custom CORS_ALLOWED_ORIGINS in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ALLOWED_ORIGINS = 'http://app.example.com';
      app = require('../../src/app');

      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://unauthorized.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
