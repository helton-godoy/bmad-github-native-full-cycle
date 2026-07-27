/**
 * Property-Based Tests for Exponential Backoff Timing
 * **Feature: bmad-critical-fixes**
 *
 * Property 7: Commit Retry Logic (Timing Validation)
 * - Tests that exponential backoff timing calculations are correct
 * - Validates delay pattern: base delay * (multiplier ^ (attempt - 1))
 * - Tests with base delay of 1 second and 2x multiplier
 *
 * **Validates: Requirements 2.3**
 * WHEN a `git commit` invocation exits with a non-zero status code,
 * THE Commit_Handler SHALL retry the operation up to 2 additional times
 * using exponential backoff with a base delay of 1 second and a 2x
 * multiplier per attempt before declaring the commit failed.
 */

const fc = require('fast-check');
const ExponentialBackoff = require('../../scripts/lib/exponential-backoff');

describe('Exponential Backoff Timing Property Tests', () => {
  /**
   * **Feature: bmad-critical-fixes, Property 7: Commit Retry Logic**
   * **Validates: Requirements 2.3**
   *
   * Test: Delay calculations should follow exponential backoff formula
   * For any valid attempt number (1, 2, or 3), verify the delay follows:
   * delay = initialDelay * (multiplier ^ (attempt - 1))
   * With default: initialDelay=1000ms, multiplier=2
   * Expected: attempt 1 = 1000ms, attempt 2 = 2000ms, attempt 3 = 4000ms (capped)
   */
  describe('Property 7: Delay Calculation Formula', () => {
    test('should calculate delays using exponential backoff formula', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          async (attempt, multiplier, baseDelay) => {
            const backoff = new ExponentialBackoff({
              initialDelay: baseDelay * 100, // Scale to reasonable range
              multiplier: multiplier,
              maxDelay: 10000, // High max to avoid capping in tests
              maxRetries: 5,
              jitterFactor: 0, // Disable jitter for predictable testing
            });

            const calculatedDelay = backoff.calculateDelay(attempt);
            const expectedDelay = baseDelay * 100 * Math.pow(multiplier, Math.max(0, attempt - 1));

            expect(calculatedDelay).toBeGreaterThanOrEqual(expectedDelay);
            expect(calculatedDelay).toBeLessThanOrEqual(expectedDelay * 1.1);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should cap delays at maxDelay', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (attempt) => {
            const backoff = new ExponentialBackoff({
              initialDelay: 1000,
              multiplier: 4,
              maxDelay: 2000,
              maxRetries: 5,
              jitterFactor: 0,
            });

            const calculatedDelay = backoff.calculateDelay(attempt);
            expect(calculatedDelay).toBeLessThanOrEqual(2000);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Test: With base delay of 1 second and 2x multiplier,
   * verify the specific delay sequence: 1s, 2s, 4s (capped), etc.
   */
  describe('Property 7: Default Backoff Pattern', () => {
    test('should use 1 second base delay with 2x multiplier', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1000, // 1 second
        multiplier: 2,
        maxDelay: 10000,
        maxRetries: 2,
        jitterFactor: 0,
      });

      // Verify delay calculation
      expect(backoff.calculateDelay(1)).toBe(1000); // 1000 * 2^0 = 1000
      expect(backoff.calculateDelay(2)).toBe(2000); // 1000 * 2^1 = 2000
      expect(backoff.calculateDelay(3)).toBe(4000); // 1000 * 2^2 = 4000
    });

    test('should respect maxDelay cap with default parameters', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1000,
        multiplier: 2,
        maxDelay: 2500, // Capped between 2s and 4s
        maxRetries: 5,
        jitterFactor: 0,
      });

      expect(backoff.calculateDelay(1)).toBe(1000); // 1s
      expect(backoff.calculateDelay(2)).toBe(2000); // 2s
      expect(backoff.calculateDelay(3)).toBe(2500); // Capped at 2.5s
      expect(backoff.calculateDelay(4)).toBe(2500); // Still capped
    });
  });

  /**
   * Test: Jitter should add randomness within expected bounds
   */
  describe('Property 7: Jitter Behavior', () => {
    test('should add jitter within configured bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.float({ min: 0.01, max: 0.5 }),
          async (baseDelay, jitterFactor) => {
            const backoff = new ExponentialBackoff({
              initialDelay: baseDelay * 100,
              multiplier: 2,
              maxDelay: 10000,
              maxRetries: 2,
              jitterFactor: jitterFactor,
            });

            const delayWithoutJitter = backoff.calculateDelay(1);
            // Run multiple times to get jitter variation
            const delays = [];
            for (let i = 0; i < 10; i++) {
              delays.push(backoff.calculateDelay(1));
            }

            // All delays should be within jitter bounds of base calculation
            const maxJitter = delayWithoutJitter * jitterFactor;
            for (const delay of delays) {
              expect(delay).toBeGreaterThanOrEqual(delayWithoutJitter - maxJitter);
              expect(delay).toBeLessThanOrEqual(delayWithoutJitter + maxJitter);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should handle zero jitter factor', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1000,
        multiplier: 2,
        maxDelay: 5000,
        maxRetries: 2,
        jitterFactor: 0,
      });

      // With zero jitter, all calls should return same value
      const delay1 = backoff.calculateDelay(1);
      const delay2 = backoff.calculateDelay(1);
      expect(delay1).toBe(delay2);
    });
  });

  /**
   * Test: Integration - Verify the execute method respects timing
   */
  describe('Property 7: Execute Method Timing', () => {
    test('should wait correct delay between retry attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2 }),
          async (failCount) => {
            const backoff = new ExponentialBackoff({
              initialDelay: 10,
              maxDelay: 100,
              multiplier: 2,
              maxRetries: 2,
              jitterFactor: 0,
            });

            let attempts = 0;
            const operation = async () => {
              attempts++;
              if (attempts <= failCount) {
                throw new Error('Operation failed');
              }
              return 'success';
            };

            const startTime = Date.now();
            await backoff.execute(operation);
            const endTime = Date.now();
            const elapsed = endTime - startTime;

            // Calculate expected minimum delay
            // If failed once: 1 delay of 10ms
            // If failed twice: 2 delays of 10ms + 20ms
            let expectedMinDelay;
            if (failCount === 1) {
              expectedMinDelay = 10;
            } else {
              expectedMinDelay = 10 + 20; // First retry delay + second retry delay
            }

            expect(elapsed).toBeGreaterThanOrEqual(expectedMinDelay);
            expect(attempts).toBe(failCount + 1);
          }
        ),
        { numRuns: 20, timeout: 5000 }
      );
    });
  });

  /**
   * Test: Edge cases for delay calculations
   */
  describe('Property 7: Edge Cases', () => {
    test('should handle minimum attempt (attempt 0 or 1)', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1000,
        multiplier: 2,
        maxDelay: 5000,
        maxRetries: 2,
        jitterFactor: 0,
      });

      // Attempt 0 or 1 should give same result (using Math.max(0, attempt - 1))
      expect(backoff.calculateDelay(0)).toBe(1000);
      expect(backoff.calculateDelay(1)).toBe(1000);
    });

    test('should handle zero multiplier', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1000,
        multiplier: 0,
        maxDelay: 5000,
        maxRetries: 2,
        jitterFactor: 0,
      });

      // With multiplier 0: all delays after first should be 0
      expect(backoff.calculateDelay(1)).toBe(1000);
      expect(backoff.calculateDelay(2)).toBe(0);
      expect(backoff.calculateDelay(3)).toBe(0);
    });

    test('should handle very large multipliers without overflow', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 100,
        multiplier: 1000000,
        maxDelay: 10000,
        maxRetries: 2,
        jitterFactor: 0,
      });

      // Should be capped at maxDelay
      expect(backoff.calculateDelay(1)).toBe(100);
      expect(backoff.calculateDelay(2)).toBe(10000); // Capped
    });
  });

  /**
   * Test: Verify the exact retry sequence matches requirements
   * Requirements 2.3: retry up to 2 additional times with exponential backoff
   * Default: base delay of 1 second, 2x multiplier
   */
  describe('Property 7: Requirements 2.3 Compliance', () => {
    test('should implement exact retry pattern: 1s, 2s delays', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1000, // 1 second base delay
        multiplier: 2,      // 2x multiplier
        maxDelay: 10000,
        maxRetries: 2,      // 2 additional retries
        jitterFactor: 0,
      });

      // Verify the exact pattern required by Requirements 2.3
      // Attempt 1 (initial): no delay yet
      // Attempt 2 (first retry): 1s delay after attempt 1 fails
      // Attempt 3 (second retry): 2s delay after attempt 2 fails
      expect(backoff.calculateDelay(1)).toBe(1000); // 1000 * 2^0 = 1000 (1 second)
      expect(backoff.calculateDelay(2)).toBe(2000); // 1000 * 2^1 = 2000 (2 seconds)
      expect(backoff.calculateDelay(3)).toBe(4000); // 1000 * 2^2 = 4000 (4 seconds, if no maxDelay)
    });

    test('should fail after exactly 3 attempts (1 initial + 2 retries)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          async (errorMessage) => {
            const backoff = new ExponentialBackoff({
              initialDelay: 1,
              maxDelay: 10,
              multiplier: 2,
              maxRetries: 2,
              jitterFactor: 0,
            });

            let attempts = 0;
            const operation = async () => {
              attempts++;
              throw new Error(errorMessage);
            };

            try {
              await backoff.execute(operation);
              fail('Should have thrown error after max retries');
            } catch (error) {
              expect(error.message).toBe(errorMessage);
              expect(attempts).toBe(3); // 1 initial + 2 retries
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
