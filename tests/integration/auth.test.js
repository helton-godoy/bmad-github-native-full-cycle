/**
 * @ai-context Integration Tests for Authentication API
 * @ai-invariant All auth flows must work end-to-end
 * @ai-connection Tests validate the complete authentication workflow
 */
const request = require('supertest');
const app = require('../../src/app');

describe('Authentication API Integration Tests', () => {
  let server;
  let testUser;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // Generate unique test data to avoid conflicts
    const timestamp = Date.now();
    testUser = {
      username: `testuser_${timestamp}`,
      email: `test_${timestamp}@example.com`,
      password: 'TestPassword123'
    };
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('username', testUser.username);
      expect(response.body.data).toHaveProperty('email', testUser.email);
      expect(response.body.data).not.toHaveProperty('passwordHash');
      expect(response.body.data).toHaveProperty('createdAt');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          ...testUser,
          password: 'short'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(server)
        .post('/api/auth/register')
        .send(testUser);

      // Second registration with same email
      const response = await request(server)
        .post('/api/auth/register')
        .send(testUser);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          username: 'onlyusername'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(server)
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data).toHaveProperty('expiresIn', '24h');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('username', testUser.username);
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with invalid email', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with wrong password', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with missing fields', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;

    beforeEach(async () => {
      await request(server)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      authToken = loginResponse.body.data.token;
    });

    it('should return user info with valid token', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('username', testUser.username);
      expect(response.body.data).toHaveProperty('email', testUser.email);
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should reject request without authorization header', async () => {
      const response = await request(server)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('AUTH_HEADER_MISSING');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('TOKEN_INVALID');
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('TOKEN_MISSING');
    });
  });

  describe('Full Authentication Flow', () => {
    it('should complete full registration -> login -> protected route flow', async () => {
      // 1. Register
      const registerResponse = await request(server)
        .post('/api/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);

      // 2. Login
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('token');

      const token = loginResponse.body.data.token;

      // 3. Access protected route
      const meResponse = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data.email).toBe(testUser.email);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(server)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});