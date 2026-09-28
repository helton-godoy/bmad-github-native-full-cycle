const { getAllowedOrigins, validateOrigin } = require('../../src/utils/cors.util');

describe('CORS Logic Unit Tests', () => {
  describe('getAllowedOrigins', () => {
    test('returns parsed origins when CORS_ALLOWED_ORIGINS is provided', () => {
      const origins = getAllowedOrigins('http://example.com, https://app.example.com ', 'production');
      expect(origins).toEqual(['http://example.com', 'https://app.example.com']);
    });

    test('returns empty array in production when CORS_ALLOWED_ORIGINS is not set', () => {
      const origins = getAllowedOrigins(undefined, 'production');
      expect(origins).toEqual([]);
    });

    test('returns default localhost origin in development when CORS_ALLOWED_ORIGINS is not set', () => {
      const origins = getAllowedOrigins(undefined, 'development');
      expect(origins).toEqual(['http://localhost:3000']);
    });
  });

  describe('validateOrigin', () => {
    test('rejects missing origin in production', (done) => {
      validateOrigin(
        undefined,
        (err, allowed) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('Origin required in production');
          expect(allowed).toBeUndefined();
          done();
        },
        { nodeEnv: 'production', envOrigins: '' }
      );
    });

    test('allows missing origin in development', (done) => {
      validateOrigin(
        undefined,
        (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        },
        { nodeEnv: 'development', envOrigins: '' }
      );
    });

    test('allows allowed origins in production', (done) => {
      validateOrigin(
        'https://app.example.com',
        (err, allowed) => {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          done();
        },
        { nodeEnv: 'production', envOrigins: 'https://app.example.com, http://example.com' }
      );
    });

    test('rejects unallowed origins', (done) => {
      validateOrigin(
        'https://malicious.com',
        (err, allowed) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('Not allowed by CORS');
          expect(allowed).toBeUndefined();
          done();
        },
        { nodeEnv: 'production', envOrigins: 'https://app.example.com' }
      );
    });
  });
});
