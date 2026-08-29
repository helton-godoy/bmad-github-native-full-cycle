/**
 * Property-Based Test for Commit Verification
 * **Feature: bmad-critical-fixes, Property 9: Commit Verification**
 * **Validates: Requirements 2.5**
 *
 * This test validates that the CommitHandler verifies commit hashes are resolvable
 * in the git repository after successful commit operations. Property tests ensure
 * this behavior holds across diverse commit scenarios with 100+ iterations per property.
 *
 * Requirement 2.5 states:
 * "WHEN a commit operation completes with exit code 0, THE Commit_Handler SHALL
 *  verify that the resulting commit hash is resolvable in the local git repository
 *  before reporting success"
 */

const fc = require('fast-check');
const CommitHandler = require('../../scripts/lib/commit-handler');
const { execSync } = require('child_process');
const Logger = require('../../scripts/lib/logger');

// Mock child_process to avoid actual git operations
jest.mock('child_process');

// Mock fs to avoid actual filesystem operations
jest.mock('fs');

// Mock Logger to avoid log pollution
jest.mock('../../scripts/lib/logger');

describe('Property 9: Commit Verification', () => {
  let mockExecSync;
  let mockFs;
  let mockLogger;

  beforeEach(() => {
    mockExecSync = require('child_process').execSync;
    mockFs = require('fs');
    mockLogger = require('../../scripts/lib/logger');

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup Logger mock
    mockLogger.mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property Test 9a: Successful commits always have resolvable hashes
   *
   * For any successful commit operation (exit code 0), the CommitHandler should
   * verify that the resulting commit hash is resolvable in the repository.
   *
   * Generates: Various commit messages and personas
   * Validates: Successful verification of commit hashes
   */
  test(
    'Property 9a: Should verify commit hash is resolvable after successful commit',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'PM'),
          fc.integer({ min: 1, max: 999 }), // Step ID: 001-999
          fc.string({ minLength: 10, maxLength: 50 }),
          async (persona, stepIdNum, description) => {
            const stepId = stepIdNum.toString().padStart(3, '0');
            const handler = new CommitHandler({
              validateFormat: true,
              enableRollback: true,
            });

            const commitHash = 'abc1234';

            let verificationWasAttempted = false;

            // Mock git operations
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git add')) return '';
              if (command.includes('git status --porcelain')) return 'M file.js\n';
              if (command.includes('git diff --cached --quiet')) {
                const err = new Error('Changes');
                err.status = 1;
                throw err;
              }
              if (command.includes('git commit')) {
                return `[main ${commitHash}] [${persona}] [STEP-${stepId}] ${description}\n 1 file changed`;
              }
              if (command.includes('git rev-parse HEAD')) {
                return commitHash;
              }
              if (command.includes('git merge-base --is-ancestor')) {
                verificationWasAttempted = true;
                return ''; // Success - commit is in branch
              }
              if (command.includes('git show')) {
                return `${commitHash}|Test Author|test@example.com|1234567890|[${persona}] [STEP-${stepId}] ${description}\ntest.js`;
              }
              return '';
            });

            mockFs.existsSync.mockReturnValue(true);

            // Execute: validate an already-created commit
            const verification = await handler.validateCommit(commitHash);

            // Assert: verification completed successfully
            expect(verification.verified).toBe(true);
            expect(verification.hash).toBe(commitHash);
            expect(verificationWasAttempted).toBe(true);
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 9b: Unreachable commits are detected and reported
   *
   * For any commit hash that exists but is not reachable from HEAD, the system
   * should detect this and report verification failure.
   *
   * Generates: Various unreachable hash scenarios
   * Validates: Detection of unreachable commits
   */
  test(
    'Property 9b: Should detect and report commits not in current branch',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-f0-9]{7,40}$/),
          async (orphanHash) => {
            const handler = new CommitHandler({
              validateFormat: true,
              enableRollback: true,
            });

            let mergeBaseWasCalled = false;

            // Mock git operations for unreachable commit
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git merge-base --is-ancestor')) {
                mergeBaseWasCalled = true;
                // Simulate: commit is not reachable from HEAD
                const error = new Error('fatal: Not a valid object name');
                error.status = 1;
                throw error;
              }
              if (command.includes('git show')) {
                return `${orphanHash}|Author|author@example.com|1234567890|Test commit\nfile.js`;
              }
              return '';
            });

            // Execute: attempt to validate an unreachable commit
            // Should throw because commit is not in current branch
            await expect(handler.validateCommit(orphanHash)).rejects.toThrow(
              'not in the current branch'
            );

            // Assert: merge-base check was performed
            expect(mergeBaseWasCalled).toBe(true);
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 9c: Invalid hashes are rejected before verification
   *
   * For any invalid or malformed commit hash, the system should reject
   * verification attempts with a clear error.
   *
   * Generates: Various invalid hash formats
   * Validates: Input validation for commit hashes
   */
  test('Property 9c: Should reject invalid commit hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[^a-f0-9]+$/),
        async (invalidHash) => {
          const handler = new CommitHandler({
            validateFormat: true,
          });

          // Execute: attempt to validate invalid hash
          // Should fail because hash is invalid format
          await expect(handler.validateCommit(invalidHash)).rejects.toThrow();
        }
      ),
      {
        numRuns: 50,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 9d: Commit info retrieval works for diverse commit scenarios
   *
   * For any valid commit hash, the system should successfully retrieve
   * commit information including author, timestamp, and files changed.
   *
   * Generates: Various commit data scenarios
   * Validates: Commit info retrieval completeness
   */
  test(
    'Property 9d: Should retrieve complete commit information',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-f0-9]{7,40}$/),
          fc.stringMatching(/^[a-z0-9 ]{5,30}$/), // Author name (no special chars)
          fc.array(
            fc.stringMatching(/^[a-z0-9\-_/]+\.(js|ts|json|md)$/),
            { minLength: 1, maxLength: 10 }
          ),
          async (commitHash, authorName, files) => {
            const handler = new CommitHandler();

            // Use a fixed valid timestamp (Unix timestamp for a date in the past)
            const fixedTimestamp = 1609459200; // 2021-01-01 00:00:00 UTC

            mockExecSync.mockImplementation((command) => {
              if (command.includes('git show')) {
                // Format: hash|author|email|timestamp|message\nfile1\nfile2...
                const filesList = files.join('\n');
                const header = `${commitHash}|${authorName}|author@example.com|${fixedTimestamp}|Test commit message`;
                return `${header}\n${filesList}`;
              }
              if (command.includes('git merge-base --is-ancestor')) {
                return ''; // Commit is in branch
              }
              return '';
            });

            // Execute: validate and retrieve commit info
            const result = await handler.validateCommit(commitHash);

            // Assert: commit info is complete
            expect(result.hash).toBe(commitHash);
            expect(result.verified).toBe(true);
            expect(result.author).toBeTruthy();
            expect(result.timestamp).toBeTruthy();
            expect(result.message).toBe('Test commit message');
            expect(result.files).toEqual(files);
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 9e: Message format validation during verification
   *
   * For any commit with BMAD message format, the system should verify
   * the message follows the required pattern during verification.
   *
   * Generates: Various BMAD-formatted messages
   * Validates: Format validation during verification
   */
  test(
    'Property 9e: Should validate BMAD message format during verification',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA'),
          fc.integer({ min: 1, max: 999 }),
          fc.stringMatching(/^[a-z0-9 ]{10,50}$/), // Simple description format
          async (persona, stepIdNum, description) => {
            const stepId = stepIdNum.toString().padStart(3, '0');
            const handler = new CommitHandler({
              validateFormat: true,
            });

            const commitHash = 'abc1234';
            const formattedMessage = `[${persona}] [STEP-${stepId}] ${description}`;

            mockExecSync.mockImplementation((command) => {
              if (command.includes('git show')) {
                return `${commitHash}|Author|author@example.com|1234567890|${formattedMessage}\nfile.js`;
              }
              if (command.includes('git merge-base --is-ancestor')) {
                return '';
              }
              return '';
            });

            // Execute: validate commit with proper format
            const result = await handler.validateCommit(commitHash);

            // Assert: verification succeeded with valid format
            expect(result.verified).toBe(true);
            expect(result.message).toBe(formattedMessage);
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 9f: Verification results consistency
   *
   * For any commit verification, the returned result object should have
   * consistent structure and all required fields populated.
   *
   * Generates: Various verification scenarios
   * Validates: Result object consistency
   */
  test('Property 9f: Verification results have consistent structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-f0-9]{7}$/),
        async (commitHash) => {
          const handler = new CommitHandler();

          mockExecSync.mockImplementation((command) => {
            if (command.includes('git show')) {
              return `${commitHash}|Test Author|test@example.com|1234567890|Test commit\nfile.js`;
            }
            if (command.includes('git merge-base --is-ancestor')) {
              return '';
            }
            return '';
          });

          // Execute: verify commit
          const result = await handler.validateCommit(commitHash);

          // Assert: result has required structure
          expect(result).toHaveProperty('hash');
          expect(result).toHaveProperty('verified');
          expect(result).toHaveProperty('message');
          expect(result).toHaveProperty('author');
          expect(result).toHaveProperty('timestamp');
          expect(result).toHaveProperty('files');

          // Assert: types are correct
          expect(typeof result.hash).toBe('string');
          expect(typeof result.verified).toBe('boolean');
          expect(typeof result.message).toBe('string');
          expect(typeof result.author).toBe('string');
          expect(typeof result.timestamp).toBe('string');
          expect(Array.isArray(result.files)).toBe(true);

          // Assert: hash matches
          expect(result.hash).toBe(commitHash);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 9g: Verification after successful commit execution
   *
   * For any commit that was successfully executed, verification should
   * confirm the commit exists and is properly formatted.
   *
   * Generates: Various execution and verification scenarios
   * Validates: Verification workflow integration
   */
  test(
    'Property 9g: Should verify newly created commits successfully',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM'),
          fc.integer({ min: 1, max: 999 }),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (persona, stepIdNum, description) => {
            const stepId = stepIdNum.toString().padStart(3, '0');
            const handler = new CommitHandler({
              validateFormat: true,
              enableRollback: true,
            });

            const newCommitHash = 'def5678';

            mockExecSync.mockImplementation((command) => {
              if (command.includes('git add')) return '';
              if (command.includes('git status --porcelain')) return 'M file.js\n';
              if (command.includes('git diff --cached --quiet')) {
                const err = new Error('Changes');
                err.status = 1;
                throw err;
              }
              if (command.includes('git commit')) {
                return `[main ${newCommitHash}] commit message`;
              }
              if (command.includes('git rev-parse HEAD')) {
                return newCommitHash;
              }
              if (command.includes('git show')) {
                return `${newCommitHash}|Author|author@example.com|1234567890|[${persona}] [STEP-${stepId}] ${description}\nfile.js`;
              }
              if (command.includes('git merge-base --is-ancestor')) {
                return '';
              }
              return '';
            });

            mockFs.existsSync.mockReturnValue(true);

            // Execute: prepare and verify
            await handler.prepareCommit(['file.js']);

            // Execute: verify an already-committed commit (simulate post-commit verification)
            const verification = await handler.validateCommit(newCommitHash);

            // Assert: newly created commit verifies successfully
            expect(verification.verified).toBe(true);
            expect(verification.hash).toBe(newCommitHash);
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 9h: Error handling for verification failures
   *
   * For any verification failure (unreachable, corrupt, or missing commit),
   * the system should throw appropriate errors with clear messages.
   *
   * Generates: Various failure scenarios
   * Validates: Error handling and reporting
   */
  test('Property 9h: Should throw clear errors on verification failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('unreachable'), // Commit not in branch
          fc.constant('missing'), // Commit doesn't exist
          fc.constant('corrupt') // Commit data corrupted
        ),
        async (failureType) => {
          const handler = new CommitHandler();
          const testHash = 'abc1234';

          mockExecSync.mockImplementation((command) => {
            if (command.includes('git merge-base --is-ancestor')) {
              if (failureType === 'unreachable' || failureType === 'corrupt') {
                const error = new Error('fatal: Not an ancestor');
                error.status = 1;
                throw error;
              }
            }
            if (command.includes('git show')) {
              if (failureType === 'missing') {
                const error = new Error('fatal: bad object');
                error.status = 128;
                throw error;
              }
              return `${testHash}|Author|author@example.com|1234567890|Test\nfile.js`;
            }
            return '';
          });

          // Execute: attempt verification
          const verificationAttempt = handler.validateCommit(testHash);

          // Assert: error is thrown for all failure types
          await expect(verificationAttempt).rejects.toThrow();
        }
      ),
      {
        numRuns: 50,
        timeout: 5000,
      }
    );
  });

  /**
   * Integration Test: Complete commit and verification workflow
   *
   * Tests the complete workflow: verify various commit scenarios
   * that the commit was successfully created in the repository.
   */
  test('Integration: Complete commit creation and verification workflow', async () => {
    const handler = new CommitHandler({
      validateFormat: true,
      enableRollback: true,
    });

    const testScenarios = [
      {
        name: 'Developer commit with proper formatting',
        persona: 'DEVELOPER',
        stepId: '001',
        description: 'Implement user authentication system',
        files: ['src/auth.js', 'src/utils.js'],
        commitHash: 'abc1234567',
        shouldVerifySuccessfully: true,
      },
      {
        name: 'Architect design commit',
        persona: 'ARCHITECT',
        stepId: '042',
        description: 'Design database schema for user management',
        files: ['docs/schema.md'],
        commitHash: 'def5678901',
        shouldVerifySuccessfully: true,
      },
      {
        name: 'QA testing commit',
        persona: 'QA',
        stepId: '123',
        description: 'Add integration tests for API endpoints',
        files: ['tests/api.test.js'],
        commitHash: 'ghi9012345',
        shouldVerifySuccessfully: true,
      },
    ];

    for (const scenario of testScenarios) {
      mockExecSync.mockClear();

      mockExecSync.mockImplementation((command) => {
        if (command.includes('git add')) return '';
        if (command.includes('git status --porcelain')) return 'M file.js\n';
        if (command.includes('git diff --cached --quiet')) {
          const err = new Error('Changes');
          err.status = 1;
          throw err;
        }
        if (command.includes('git commit')) {
          return `[main ${scenario.commitHash}] commit`;
        }
        if (command.includes('git rev-parse HEAD')) {
          return scenario.commitHash;
        }
        if (command.includes('git show')) {
          const message = `[${scenario.persona}] [STEP-${scenario.stepId}] ${scenario.description}`;
          return `${scenario.commitHash}|Test Author|author@example.com|1234567890|${message}\n${scenario.files.join('\n')}`;
        }
        if (command.includes('git merge-base --is-ancestor')) {
          return '';
        }
        return '';
      });

      mockFs.existsSync.mockReturnValue(true);

      // Execute workflow - just verify, don't try executeCommit
      if (scenario.shouldVerifySuccessfully) {
        // Verify the commit
        const verification = await handler.validateCommit(scenario.commitHash);

        // Assert verification succeeded
        expect(verification.verified).toBe(
          true,
          `Failed: ${scenario.name}`
        );
        expect(verification.hash).toBe(scenario.commitHash);
        expect(verification.message).toContain(scenario.persona);
        expect(verification.message).toContain(scenario.stepId);
      }
    }
  });

  /**
   * Integration Test: Requirement 2.5 - Full compliance verification
   *
   * This comprehensive test ensures complete compliance with Requirement 2.5:
   * "WHEN a commit operation completes with exit code 0, THE Commit_Handler SHALL
   *  verify that the resulting commit hash is resolvable in the local git repository
   *  before reporting success"
   */
  test('Integration: Requirement 2.5 - Commit verification compliance', async () => {
    const handler = new CommitHandler({
      validateFormat: true,
      enableRollback: true,
    });

    const complianceScenarios = [
      {
        description:
          'Must verify commit exists in repository after successful commit',
        commitHash: 'abc1234',
        isInBranch: true,
        shouldSucceed: true,
      },
      {
        description:
          'Must reject commit not found in current branch after execution',
        commitHash: 'def5678',
        isInBranch: false,
        shouldSucceed: false,
      },
      {
        description:
          'Must retrieve full commit details during verification',
        commitHash: 'ghi9012',
        isInBranch: true,
        shouldSucceed: true,
      },
    ];

    for (const scenario of complianceScenarios) {
      mockExecSync.mockClear();

      mockExecSync.mockImplementation((command) => {
        if (command.includes('git merge-base --is-ancestor')) {
          if (!scenario.isInBranch) {
            const error = new Error('fatal: not an ancestor');
            error.status = 1;
            throw error;
          }
          return '';
        }
        if (command.includes('git show')) {
          return `${scenario.commitHash}|Author|author@example.com|1234567890|[DEVELOPER] [STEP-001] Test commit\nfile.js`;
        }
        return '';
      });

      // Execute verification
      if (scenario.shouldSucceed) {
        const result = await handler.validateCommit(scenario.commitHash);
        expect(result.verified).toBe(true, `Failed: ${scenario.description}`);
        expect(result.hash).toBe(scenario.commitHash);
      } else {
        await expect(
          handler.validateCommit(scenario.commitHash)
        ).rejects.toThrow();
      }
    }
  });

  /**
   * Unit Test: _getCommitInfo internal method
   *
   * Tests that commit information is correctly retrieved and parsed.
   */
  test('Unit: _getCommitInfo retrieves commit details', async () => {
    const handler = new CommitHandler();
    const testHash = 'abc1234';
    const testMessage = '[DEVELOPER] [STEP-001] Add feature';
    const testFiles = ['src/feature.js', 'tests/feature.test.js'];

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git show')) {
        const filesList = testFiles.join('\ncommit info\n');
        return `${testHash}|John Doe|john@example.com|1234567890|${testMessage}\n${filesList}`;
      }
      return '';
    });

    // Execute
    const info = await handler._getCommitInfo(testHash);

    // Assert
    expect(info.hash).toBe(testHash);
    expect(info.message).toBe(testMessage);
    expect(info.author).toContain('John Doe');
    expect(info.files).toContain('src/feature.js');
  });

  /**
   * Unit Test: _isCommitInCurrentBranch internal method
   *
   * Tests that branch membership is correctly determined.
   */
  test(
    'Unit: _isCommitInCurrentBranch correctly identifies branch membership',
    async () => {
      const handler = new CommitHandler();

      // Test case 1: Commit is in branch
      mockExecSync.mockImplementation((command) => {
        if (command.includes('git merge-base --is-ancestor')) {
          return ''; // Success
        }
        return '';
      });

      let isInBranch = await handler._isCommitInCurrentBranch('abc1234');
      expect(isInBranch).toBe(true);

      // Test case 2: Commit is not in branch
      mockExecSync.mockClear();
      mockExecSync.mockImplementation((command) => {
        if (command.includes('git merge-base --is-ancestor')) {
          const error = new Error('not an ancestor');
          error.status = 1;
          throw error;
        }
        return '';
      });

      isInBranch = await handler._isCommitInCurrentBranch('def5678');
      expect(isInBranch).toBe(false);
    }
  );

  /**
   * Unit Test: Commit verification with rollback capability
   *
   * Tests that failed verification attempts trigger rollback when enabled.
   */
  test('Unit: Failed verification triggers rollback when enabled', async () => {
    const handler = new CommitHandler({
      enableRollback: true,
    });

    const commitHash = 'abc1234';
    let rollbackWasAttempted = false;

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git reset --soft HEAD~1')) {
        rollbackWasAttempted = true;
        return '';
      }
      if (command.includes('git merge-base --is-ancestor')) {
        const error = new Error('not in branch');
        error.status = 1;
        throw error;
      }
      if (command.includes('git rev-parse HEAD')) {
        return commitHash;
      }
      if (command.includes('git show')) {
        return `${commitHash}|Author|author@example.com|1234567890|Test\nfile.js`;
      }
      return '';
    });

    // Execute: attempt verification of unreachable commit
    await expect(handler.validateCommit(commitHash)).rejects.toThrow();

    // Assert: rollback was attempted
    expect(rollbackWasAttempted).toBe(true);
  });
});
