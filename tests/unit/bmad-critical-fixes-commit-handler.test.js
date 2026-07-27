/**
 * Property-Based Tests for Commit Handler
 * **Feature: bmad-critical-fixes**
 * Properties:
 * - Property 5: Commit Staging Validation
 * - Property 6: Empty Commit Handling
 * - Property 7: Commit Retry Logic
 * - Property 8: Commit Message Format
 * - Property 9: Commit Verification
 */

const fc = require('fast-check');
const CommitHandler = require('../../scripts/lib/commit-handler');
const ExponentialBackoff = require('../../scripts/lib/exponential-backoff');

describe('Commit Handler Property Tests', () => {
  let commitHandler;

  beforeEach(() => {
    commitHandler = new CommitHandler({ maxRetries: 2 });
  });

  /**
   * **Feature: bmad-critical-fixes, Property 5: Commit Staging Validation**
   * **Validates: Requirements 2.1**
   */
  test('Property 5: should validate that files are staged before commit', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (hasStagedFiles) => {
        const mockHandler = new CommitHandler();
        jest.spyOn(mockHandler, '_stageAllChanges').mockResolvedValue();
        jest.spyOn(mockHandler, '_stageSpecificFiles').mockResolvedValue();
        jest.spyOn(mockHandler, '_validateStaging').mockResolvedValue(hasStagedFiles);

        const result = await mockHandler.prepareCommit();
        expect(result).toBe(hasStagedFiles);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 6: Empty Commit Handling**
   * **Validates: Requirements 2.2**
   */
  test('Property 6: should skip commit operation when no changes detected', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (hasChanges) => {
        const mockHandler = new CommitHandler();
        jest.spyOn(mockHandler, '_hasChangesToCommit').mockResolvedValue(hasChanges);

        if (hasChanges) {
          jest.spyOn(mockHandler, 'validateCommit').mockResolvedValue({
            verified: true,
            hash: 'abc1234',
          });
          jest.spyOn(mockHandler.backoff, 'execute').mockResolvedValue({
            success: true,
            result: 'abc1234',
            attempts: [1],
          });
        }

        const result = await mockHandler.executeCommit('Implement feature', 'DEVELOPER', '001');

        if (!hasChanges) {
          expect(result).toBeNull();
        } else {
          expect(result).toBe('abc1234');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 7: Commit Retry Logic**
   * **Validates: Requirements 2.3**
   */
  test('Property 7: should retry failed commit with exponential backoff', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
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
              throw new Error('Git lock failed');
            }
            return 'commit-hash-ok';
          };

          if (failCount > 2) {
            await expect(backoff.execute(operation)).rejects.toThrow('Git lock failed');
            expect(attempts).toBe(3); // 1 initial + 2 retries
          } else {
            const result = await backoff.execute(operation);
            expect(result).toBe('commit-hash-ok');
            expect(attempts).toBe(failCount + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 8: Commit Message Format**
   * **Validates: Requirements 2.4**
   */
  test('Property 8: should format commit messages strictly as [PERSONA] [STEP-ID] Description', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA'),
        fc.constantFrom('001', '042', '123'),
        fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length >= 5),
        async (persona, stepId, description) => {
          const handler = new CommitHandler();
          const message = handler.formatCommitMessage(persona, stepId, description);

          const expectedPattern = /^\[[A-Za-z]+\] \[STEP-[0-9A-Z]+\] .+/;
          expect(message).toMatch(expectedPattern);
          expect(message).toContain(`[${persona}]`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 9: Commit Verification**
   * **Validates: Requirements 2.5**
   */
  test('Property 9: should verify commit existence in repository after commit execution', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (commitExists) => {
        const handler = new CommitHandler({ enableRollback: false });
        jest.spyOn(handler, '_getCommitInfo').mockResolvedValue({
          message: '[DEVELOPER] [STEP-001] Verified commit',
          author: 'BMAD',
          timestamp: new Date().toISOString(),
          files: ['src/index.js'],
        });
        jest.spyOn(handler, '_isCommitInCurrentBranch').mockResolvedValue(commitExists);
        if (commitExists) {
          await expect(handler.validateCommit('hash123')).resolves.toEqual(
            expect.objectContaining({ hash: 'hash123', verified: true })
          );
        } else {
          await expect(handler.validateCommit('hash123')).rejects.toThrow(
            'not in the current branch'
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
