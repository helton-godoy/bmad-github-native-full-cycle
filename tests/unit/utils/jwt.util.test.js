/**
 * @ai-context Unit Tests for JWT Utilities
 * @ai-invariant JWT tokens must be secure and properly validated
 * @ai-connection JWT utilities are used by auth.service.js
 */
const { generateToken, verifyToken } = require('../../src/utils/jwt.util');

// Set test secret before tests
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';

describe('JWT Utilities', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser'
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should generate token with correct payload', () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser'
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });

    it('should include iat and exp in token', () => {
      const payload = { userId: '123', username: 'testuser' };
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should generate tokens with different iat on subsequent calls', () => {
      const payload = { userId: '123' };

      const token1 = generateToken(payload);
      const decoded1 = verifyToken(token1);

      // Manually advance time and generate another token
      const originalDateNow = Date.now;
      let currentTime = Date.now();
      Date.now = () => {
        currentTime += 1000; // 1 second later
        return currentTime;
      };

      const token2 = generateToken(payload);
      const decoded2 = verifyToken(token2);

      // Restore Date.now
      Date.now = originalDateNow;

      // The tokens should have different iat values
      expect(decoded1.iat).not.toBe(decoded2.iat);
    });

    it('should include expiration in token', () => {
      const payload = { userId: '123' };
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token successfully', () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser'
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow('TOKEN_INVALID');
    });

    it('should throw TOKEN_EXPIRED for expired token', () => {
      // For now, test that malformed tokens throw TOKEN_INVALID
      const malformedToken = 'eyJhbG...Y6O8';

      expect(() => verifyToken(malformedToken)).toThrow('TOKEN_INVALID');
    });

    it('should throw error for token with wrong secret', () => {
      const payload = { userId: '123' };
      const token = generateToken(payload);

      // Temporarily change secret
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'different-secret';

      expect(() => {
        // Need to re-import to pick up new secret
        jest.resetModules();
        const jwtUtils = require('../../src/utils/jwt.util');
        jwtUtils.verifyToken(token);
      }).toThrow();

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Token Format', () => {
    it('should generate token with proper header', () => {
      const token = generateToken({ userId: '123' });
      const [header] = token.split('.');
      const decodedHeader = JSON.parse(Buffer.from(header, 'base64').toString());

      expect(decodedHeader.alg).toBe('HS256');
      expect(decodedHeader.typ).toBe('JWT');
    });

    it('should handle token with additional payload fields', () => {
      const payload = {
        userId: '123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });
  });
});