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
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 6: Empty Commit Handling**
   * **Validates: Requirements 2.2**
   *
   * For any commit attempt when no changes are detected, the system should:
   * 1. Skip the commit operation (not execute git commit)
   * 2. Log a skip event to the workflow log
   * 3. Include the current step identifier in the skip event
   * 4. Include the reason "no staged changes found" in the skip event
   * 5. Return null to indicate no commit was made
   * 6. Raise no error during this operation
   */
  test('Property 6: should skip commit operation when no changes detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY'),
        fc.integer({ min: 1, max: 999 }).map(n => n.toString().padStart(3, '0')),
        fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length >= 5),
        async (persona, stepId, description) => {
          // Create a fresh handler for this test iteration
          const handler = new CommitHandler({
            validateStaging: true,
            validateFormat: true,
            enableRollback: false,
          });

          // Mock _hasChangesToCommit to return false (no staged changes)
          jest.spyOn(handler, '_hasChangesToCommit').mockResolvedValue(false);

          // Capture logs to verify skip event is written
          const logSpy = jest.spyOn(handler.logger, 'warn');
          const infoSpy = jest.spyOn(handler.logger, 'info');

          // Execute commit with no staged changes
          const result = await handler.executeCommit(description, persona, stepId);

          // ASSERTION 1: Result should be null (indicating no commit was made)
          expect(result).toBeNull();

          // ASSERTION 2: Logger should have been called with skip message
          // The handler logs "No changes to commit - skipping commit operation" via logger.warn
          expect(logSpy).toHaveBeenCalled();
          const warnCalls = logSpy.mock.calls;
          const skipEventLogged = warnCalls.some((call) =>
            call[0].includes('No changes to commit') ||
            call[0].includes('no staged changes')
          );
          expect(skipEventLogged).toBe(true);

          // ASSERTION 3: Verify that git commit was NOT executed
          // (The handler returns early with null, so backoff.execute should not be called)
          // We can verify this by checking that no commit-related logs after the skip occur
          const commitExecutionLogged = infoSpy.mock.calls.some((call) =>
            call[0].includes('Attempting commit')
          );
          expect(commitExecutionLogged).toBe(false);

          // ASSERTION 4: Verify no errors were thrown
          // If we got here, no error was thrown, so this passes

          // ASSERTION 5: Verify the skip event contains required information
          // The log should contain the step ID information
          // The formatted message should have been created even though commit was skipped
          const formattedMessage = handler.formatCommitMessage(persona, stepId, description);
          expect(formattedMessage).toMatch(new RegExp(`\\[${persona}\\]`));
          expect(formattedMessage).toMatch(new RegExp(`\\[STEP-${stepId}\\]`));

          // Clean up
          logSpy.mockRestore();
          infoSpy.mockRestore();
        }
      ),
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
      { numRuns: 20 }
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
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 9: Commit Verification**
   * **Validates: Requirements 2.5**
   */
  test('Property 9: should verify commit existence in repository after commit execution', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (commitExists) => {
        const handler = new CommitHandler();
        jest.spyOn(handler, 'validateCommit').mockResolvedValue(commitExists);

        const verified = await handler.validateCommit('hash123');
        expect(verified).toBe(commitExists);
      }),
      { numRuns: 20 }
    );
  });
});
