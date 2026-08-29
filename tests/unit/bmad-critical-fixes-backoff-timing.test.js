/**
 * Property-Based Tests for Exponential Backoff Timing
 * **Feature: bmad-critical-fixes**
 *
 * Property 7: Commit Retry Logic
 * - Tests that failed commit operations use exponential backoff with base delay of 1s
 * - Verifies 2x multiplier per retry attempt (delays: 1s, 2s)
 * - Validates retry timing accuracy and sequence
 * - Tests edge cases: immediate success, all retries fail, timing variations
 *
 * **Validates: Requirements 2.3**
 * WHEN a `git commit` invocation exits with a non-zero status code,
 * THE Commit_Handler SHALL retry the operation up to 2 additional times
 * using exponential backoff with a base delay of 1 second and a 2x multiplier
 * per attempt before declaring the commit failed.
 */

const fc = require('fast-check');
const ExponentialBackoff = require('../../scripts/lib/exponential-backoff');

describe('Exponential Backoff Timing Property Tests', () => {
  /**
   * **Feature: bmad-critical-fixes, Property 7: Commit Retry Logic**
   * **Validates: Requirements 2.3**
   *
   * Core property: For any failed commit operation, the system should retry
   * up to 2 times (3 total attempts) with exponential backoff delays
   * of 1 second, 2 seconds (base=1s, multiplier=2).
   */
  describe('Property 7: Commit Retry Logic', () => {
    /**
     * Test: Delay calculation should follow exponential pattern 1s, 2s, 4s...
     * For any attempt number, verify the calculated delay matches the formula:
     * delay = initialDelay * multiplier^(attempt - 1), capped at maxDelay
     * Note: Test uses jitterFactor: -1 to disable jitter (since 0 is falsy in the implementation)
     */
    test('should calculate delays following exponential pattern with base 1s and 2x multiplier', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (attempt) => {
            // Use exact values from requirements: base delay 1s, 2x multiplier
            // Use -1 to disable jitter (0 is falsy in the implementation)
            const backoff = new ExponentialBackoff({
              initialDelay: 1000, // 1 second base
              multiplier: 2,      // 2x multiplier
              maxDelay: 5000,     // 5 second max
              maxRetries: 2,      // 2 additional retries
              jitterFactor: -1,   // Disable jitter for deterministic testing
            });

            const delay = backoff.calculateDelay(attempt);

            // Expected delay: 1000 * 2^(attempt-1), capped at 5000ms
            const expectedDelay = Math.min(
              1000 * Math.pow(2, Math.max(0, attempt - 1)),
              5000
            );

            expect(delay).toBe(expectedDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Retry attempts should use correct backoff delays
     * For any sequence of failed operations, verify that the delays
     * between retries match the exponential pattern.
     * Uses scaled-down delays (1ms, 2ms instead of 1s, 2s) for faster testing.
     */
    test('should apply exponential backoff delays between retry attempts', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1,      // 1ms instead of 1000ms for fast testing
        multiplier: 2,
        maxDelay: 10,         // 10ms max
        maxRetries: 2,
        jitterFactor: -1,     // Disable jitter for deterministic testing
      });

      let attemptCount = 0;
      const timestamps = [];

      const operation = async (attempt) => {
        timestamps.push(Date.now());
        attemptCount = attempt;
        // Fail on first attempt, succeed on second
        if (attempt === 1) {
          throw new Error('Commit failed');
        }
        return { success: true, attempt };
      };

      const result = await backoff.execute(operation);

      expect(result).toEqual({ success: true, attempt: 2 });
      expect(attemptCount).toBe(2);

      // Verify timing between attempts
      expect(timestamps.length).toBe(2);
      const delay1 = timestamps[1] - timestamps[0];
      // First delay should be ~1ms (allowing for timing variance)
      expect(delay1).toBeGreaterThanOrEqual(0);
      expect(delay1).toBeLessThanOrEqual(10); // Allow timing variance
    }, 10000);

    /**
     * Test: Maximum retries should be 2 (3 total attempts)
     * For any failed operation, verify the system makes exactly 3 attempts
     * (1 initial + 2 retries) before giving up.
     */
    test('should make exactly 3 attempts (1 initial + 2 retries) before failing', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 10,   // Fast for testing
        multiplier: 2,
        maxDelay: 50,
        maxRetries: 2,
        jitterFactor: -1,   // Disable jitter
      });

      let attemptCount = 0;
      const failingOperation = async () => {
        attemptCount++;
        throw new Error('Commit failed');
      };

      await expect(backoff.execute(failingOperation)).rejects.toThrow('Commit failed');

      // Verify exactly 3 attempts (1 initial + 2 retries)
      expect(attemptCount).toBe(3);
    }, 10000);

    /**
     * Test: Max delay should cap exponential growth
     * For any high attempt number, verify delays are capped at maxDelay.
     */
    test('should cap delays at maxDelay regardless of exponential growth', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 4, max: 10 }), // high attempt numbers
          async (attempt) => {
            const backoff = new ExponentialBackoff({
              initialDelay: 1000,
              multiplier: 2,
              maxDelay: 5000,
              maxRetries: 2,
              jitterFactor: -1, // Disable jitter
            });

            const delay = backoff.calculateDelay(attempt);

            // Verify delay doesn't exceed maxDelay
            expect(delay).toBeLessThanOrEqual(5000);

            // For attempts 4+, delay should be capped (1000*2^2 = 4000, still under 5000)
            // For attempts 4+, delay would be 8000, but should be capped at 5000
            if (attempt >= 4) {
              expect(delay).toBe(5000);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Multiple configurations should work correctly
     * For any valid configuration, verify exponential backoff behaves correctly.
     */
    test('should work with various exponential backoff configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialDelay: fc.integer({ min: 100, max: 2000, step: 100 }),
            multiplier: fc.constantFrom(1.5, 2, 2.5),
            maxDelay: fc.integer({ min: 5000, max: 10000, step: 500 }),
            maxRetries: fc.integer({ min: 1, max: 3 }),
          }),
          async (config) => {
            const backoff = new ExponentialBackoff({
              initialDelay: config.initialDelay,
              multiplier: config.multiplier,
              maxDelay: config.maxDelay,
              maxRetries: config.maxRetries,
              jitterFactor: -1, // Disable jitter
            });

            // Calculate expected delays for each attempt
            const delay1 = backoff.calculateDelay(1);
            const delay2 = backoff.calculateDelay(2);
            const delay3 = backoff.calculateDelay(3);

            // First delay should be initialDelay
            expect(delay1).toBe(config.initialDelay);

            // Second delay should be initialDelay * multiplier (may be fractional before jitter)
            const expectedDelay2 = Math.min(
              config.initialDelay * config.multiplier,
              config.maxDelay
            );
            expect(delay2).toBeCloseTo(expectedDelay2, 1);

            // Verify exponential growth pattern
            if (delay2 < config.maxDelay) {
              expect(delay2).toBeGreaterThan(delay1);
            }

            // Third delay should follow the pattern (may be fractional)
            const expectedDelay3 = Math.min(
              config.initialDelay * Math.pow(config.multiplier, 2),
              config.maxDelay
            );
            expect(delay3).toBeCloseTo(expectedDelay3, 1);

            // Verify delay doesn't exceed maxDelay
            expect(delay1).toBeLessThanOrEqual(config.maxDelay);
            expect(delay2).toBeLessThanOrEqual(config.maxDelay);
            expect(delay3).toBeLessThanOrEqual(config.maxDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Immediate success (no retries needed)
     * For any operation that succeeds on first attempt,
     * verify no retries or backoff delays occur.
     */
    test('should handle immediate success with no retries or delays', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 1,
        multiplier: 2,
        maxDelay: 10,
        maxRetries: 2,
        jitterFactor: -1,
      });

      const startTime = Date.now();
      let attemptCount = 0;

      const immediateSuccessOperation = async (attempt) => {
        attemptCount++;
        return { success: true, attempt, data: 'Immediate success' };
      };

      const result = await backoff.execute(immediateSuccessOperation);

      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ success: true, attempt: 1, data: 'Immediate success' });
      expect(attemptCount).toBe(1);
      // Should complete very quickly (no delay)
      expect(elapsed).toBeLessThan(50);
    });

    /**
     * Test: Retry on second attempt success
     * For any operation that succeeds on the second attempt after one failure,
     * verify exactly one backoff delay occurs between attempts.
     */
    test('should retry successfully after first failure with single backoff delay', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 5,
        multiplier: 2,
        maxDelay: 20,
        maxRetries: 2,
        jitterFactor: -1,
      });

      let attemptCount = 0;
      const timestamps = [];

      const failOnceThenSucceed = async (attempt) => {
        timestamps.push(Date.now());
        attemptCount = attempt;
        if (attempt === 1) {
          throw new Error('First attempt failed');
        }
        return { success: true, attempt, retries: 1 };
      };

      const result = await backoff.execute(failOnceThenSucceed);

      expect(result).toEqual({ success: true, attempt: 2, retries: 1 });
      expect(attemptCount).toBe(2);
      expect(timestamps.length).toBe(2);

      const delayBetweenAttempts = timestamps[1] - timestamps[0];
      // Should be approximately the first backoff delay (~5ms, allowing for variance)
      expect(delayBetweenAttempts).toBeGreaterThanOrEqual(0);
      expect(delayBetweenAttempts).toBeLessThanOrEqual(15); // Allow timing variance
    }, 10000);

    /**
     * Test: All retries fail - complete exhaustion
     * For any operation that fails all 3 attempts,
     * verify exactly 3 attempts and 2 backoff delays occur.
     */
    test('should exhaust all retries and throw error after all attempts fail', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 5,
        multiplier: 2,
        maxDelay: 20,
        maxRetries: 2,
        jitterFactor: -1,
      });

      let attemptCount = 0;
      const timestamps = [];

      const alwaysFailOperation = async (attempt) => {
        timestamps.push(Date.now());
        attemptCount = attempt;
        throw new Error(`Operation failed on attempt ${attempt}`);
      };

      await expect(backoff.execute(alwaysFailOperation)).rejects.toThrow('Operation failed on attempt 3');

      expect(attemptCount).toBe(3);
      expect(timestamps.length).toBe(3);

      // Verify delays between attempts
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];

      // First delay should be ~5ms
      expect(delay1).toBeGreaterThanOrEqual(0);
      expect(delay1).toBeLessThanOrEqual(15);

      // Second delay should be ~10ms (double the first)
      expect(delay2).toBeGreaterThanOrEqual(0);
      expect(delay2).toBeLessThanOrEqual(25);
    }, 15000);

    /**
     * Test: Timing sequence validation
     * For any multi-attempt operation, verify the backoff delays
     * follow the correct exponential sequence.
     */
    test('should follow correct backoff timing sequence across multiple attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            failAttempt: fc.integer({ min: 1, max: 3 }), // which attempt to succeed at
            initialDelay: fc.integer({ min: 2, max: 10 }),
            multiplier: fc.constantFrom(1.5, 2, 2.5),
          }),
          async (config) => {
            const backoff = new ExponentialBackoff({
              initialDelay: config.initialDelay,
              multiplier: config.multiplier,
              maxDelay: 100,
              maxRetries: 2,
              jitterFactor: -1,
            });

            let attemptCount = 0;
            const delays = [];
            const timestamps = [];

            const operation = async (attempt) => {
              timestamps.push(Date.now());
              attemptCount = attempt;

              if (attempt < config.failAttempt) {
                throw new Error('Not ready yet');
              }
              return { success: true, attempt, failedAttempts: config.failAttempt - 1 };
            };

            const result = await backoff.execute(operation);

            expect(result.attempt).toBe(config.failAttempt);

            // Calculate observed delays
            for (let i = 1; i < timestamps.length; i++) {
              delays.push(timestamps[i] - timestamps[i - 1]);
            }

            // Verify each delay corresponds to expected exponential backoff
            for (let i = 0; i < delays.length; i++) {
              const expectedDelay = config.initialDelay * Math.pow(config.multiplier, i);
              // Allow for timing variance (±5ms)
              expect(delays[i]).toBeGreaterThanOrEqual(expectedDelay - 5);
              expect(delays[i]).toBeLessThanOrEqual(expectedDelay + 5);
            }
          }
        ),
        { numRuns: 50 } // Reduced runs due to async timing complexity
      );
    }, 20000);

    /**
     * Test: Timing accuracy with requirement-specific values
     * For the specific requirement (base=1s, multiplier=2x, max 2 retries),
     * verify exact timing behavior.
     */
    test('should maintain exact timing accuracy for requirement-specified delays', async () => {
      const backoff = new ExponentialBackoff({
        initialDelay: 10,     // Use 10ms for reliable testing (scaled from 1s)
        multiplier: 2,        // 2x multiplier per requirement
        maxDelay: 50,
        maxRetries: 2,        // 2 additional retries per requirement
        jitterFactor: -1,     // Disable jitter for accuracy verification
      });

      let attemptCount = 0;
      const timestamps = [];

      const operation = async (attempt) => {
        timestamps.push(Date.now());
        attemptCount = attempt;

        // Fail first 2 attempts, succeed on 3rd
        if (attempt < 3) {
          throw new Error('Not yet');
        }
        return { success: true, totalAttempts: 3 };
      };

      const result = await backoff.execute(operation);

      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(3);
      expect(attemptCount).toBe(3);

      // Verify delay sequence: should be [~10ms, ~20ms] for [attempt1->2, attempt2->3]
      const delay1 = timestamps[1] - timestamps[0]; // Between attempt 1 and 2
      const delay2 = timestamps[2] - timestamps[1]; // Between attempt 2 and 3

      // First delay: ~10ms (initialDelay)
      expect(delay1).toBeGreaterThanOrEqual(5);
      expect(delay1).toBeLessThanOrEqual(20);

      // Second delay: ~20ms (initialDelay * 2^1)
      expect(delay2).toBeGreaterThanOrEqual(10);
      expect(delay2).toBeLessThanOrEqual(30);

      // Verify exponential growth: second delay should be roughly 2x first
      expect(delay2).toBeGreaterThan(delay1);
    }, 15000);
  });
});
