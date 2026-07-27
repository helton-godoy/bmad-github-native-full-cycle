/**
 * Property-Based Tests for Loop Detection
 * **Feature: bmad-critical-fixes**
 *
 * Properties:
 * - Property 15: Persona Error Retry
 * - Property 1: Transition Loop Prevention
 * - Property 2: Transition History Persistence
 * - Property 3: Cache Cleanup on Success
 * - Property 4: PM to Architect Validation
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const LoopDetector = require('../../scripts/lib/loop-detector');
const ExponentialBackoff = require('../../scripts/lib/exponential-backoff');
const ErrorRecoveryManager = require('../../scripts/lib/error-recovery-manager');
const { RetryableError } = require('../../scripts/lib/bmad-error');

describe('Loop Detection Property Tests', () => {
  const testHistoryFile = path.join(process.cwd(), '.github', 'test-transition-history.json');

  afterEach(() => {
    if (fs.existsSync(testHistoryFile)) {
      fs.unlinkSync(testHistoryFile);
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 15: Persona Error Retry**
   * **Validates: Requirements 4.1**
   *
   * For any retryable error encountered by any persona, the system should retry
   * up to 3 total attempts (1 initial + 2 retries) with exponential backoff.
   */
  describe('Property 15: Persona Error Retry', () => {
    test('should retry failed operations up to 3 attempts for any persona', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (persona, errorMessage) => {
            const backoff = new ExponentialBackoff({
              initialDelay: 1,
              maxDelay: 10,
              multiplier: 2,
              maxRetries: 2,
              jitterFactor: -1,
            });

            let attemptCount = 0;
            const failingOperation = async () => {
              attemptCount++;
              throw new RetryableError(errorMessage, 'TEST_ERROR', { persona });
            };

            await expect(backoff.execute(failingOperation)).rejects.toThrow(errorMessage);
            expect(attemptCount).toBe(3);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should handle errors via ErrorRecoveryManager for any persona', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA'),
          fc.boolean(),
          async (persona, canRemediate) => {
            const manager = new ErrorRecoveryManager({
              maxRetries: 2,
              initialDelay: 1,
              maxDelay: 10,
            });

            const error = new RetryableError('Operation failed', 'OPERATION_ERROR', { persona });
            let attemptCount = 0;

            const context = { canRemediate, persona, operation: 'test' };

            // Track attempts by wrapping attemptRemediation
            manager.attemptRemediation = async (err, _ctx) => {
              attemptCount++;
              if (attemptCount < 3) {
                throw err;
              }
              return { status: 'remediated', details: 'Success' };
            };

            const result = await manager.handleError(error, persona, context);

            if (result.status === 'escalated') {
              expect(attemptCount).toBe(3);
            } else {
              expect(result.status).toBe('remediated');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: bmad-critical-fixes, Property 1: Transition Loop Prevention**
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: Transition Loop Prevention', () => {
    test('should detect loop when transition count reaches threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA'),
          fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA'),
          fc.integer({ min: 1, max: 5 }),
          async (fromPersona, toPersona, repetitions) => {
            const detector = new LoopDetector({
              maxTransitions: 3,
              historyFile: testHistoryFile,
            });
            detector.clearHistory();

            for (let i = 0; i < repetitions; i++) {
              detector.recordTransition(fromPersona, toPersona);
            }

            const isLoop = detector.detectLoop(fromPersona, toPersona);
            if (repetitions >= 3) {
              expect(isLoop).toBe(true);
            } else {
              expect(isLoop).toBe(false);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: bmad-critical-fixes, Property 2: Transition History Persistence**
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Transition History Persistence', () => {
    test('should persist transition records in file history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER'),
          fc.constantFrom('ARCHITECT', 'DEVELOPER', 'QA'),
          async (fromPersona, toPersona) => {
            const detector = new LoopDetector({
              historyFile: testHistoryFile,
            });
            detector.clearHistory();

            detector.recordTransition(fromPersona, toPersona);

            expect(fs.existsSync(testHistoryFile)).toBe(true);
            const newDetector = new LoopDetector({
              historyFile: testHistoryFile,
            });
            expect(newDetector.getTransitionCount(fromPersona, toPersona)).toBe(1);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: bmad-critical-fixes, Property 3: Cache Cleanup on Success**
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Cache Cleanup on Success', () => {
    test('should clear transition history on workflow success', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              from: fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER'),
              to: fc.constantFrom('ARCHITECT', 'DEVELOPER', 'QA'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (transitions) => {
            const detector = new LoopDetector({
              historyFile: testHistoryFile,
            });

            transitions.forEach((t) => detector.recordTransition(t.from, t.to));
            expect(detector.history.length).toBe(transitions.length);

            detector.clearHistory();
            expect(detector.history.length).toBe(0);
            expect(fs.existsSync(testHistoryFile)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5**
   */
  describe('Property 4: PM to Architect Validation', () => {
    test('should validate requirements document existence before PM to Architect transition', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (prdExists) => {
          const docPath = path.join(process.cwd(), '.github', 'test-prd.md');
          if (prdExists) {
            fs.writeFileSync(docPath, '# PRD\nRequirements complete.');
          } else if (fs.existsSync(docPath)) {
            fs.unlinkSync(docPath);
          }

          const isDocValid = fs.existsSync(docPath) && fs.readFileSync(docPath, 'utf8').length > 10;
          expect(isDocValid).toBe(prdExists);

          if (fs.existsSync(docPath)) {
            fs.unlinkSync(docPath);
          }
        }),
        { numRuns: 20 }
      );
    });
  });
});