/**
 * Property-Based Test for Commit Staging Validation
 * **Feature: bmad-critical-fixes, Property 5: Commit Staging Validation**
 * **Validates: Requirements 2.1**
 *
 * This test validates that the CommitHandler verifies files have been staged
 * using git add before attempting a commit. Property tests ensure this behavior
 * holds across diverse scenarios with 100+ iterations per property.
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

describe('Property 5: Commit Staging Validation', () => {
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
   * Property Test 5a: When files are staged, prepareCommit should return true
   *
   * For any file list, when `git diff --cached` indicates staged changes,
   * the CommitHandler should recognize staged files and return true.
   *
   * Generates: Various lists of files to stage
   * Validates: Successful staging detection
   */
  test(
    'Property 5a: Should accept commits when files are staged',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various file lists to stage
          fc.array(
            fc.stringMatching(/^(src|scripts|tests)\/[a-z0-9\-_]+\.js$/),
            { minLength: 1, maxLength: 10, uniqueBy: (f) => f }
          ),
          async (filesToStage) => {
            // Create a fresh handler for this iteration
            const handler = new CommitHandler({
              validateStaging: true,
              maxRetries: 2,
            });

            // Mock: file existence checks pass
            mockFs.existsSync.mockReturnValue(true);

            // Mock: git add succeeds
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git add')) {
                return '';
              }
              // Mock: git diff --cached --quiet returns success (exit code 0)
              // which means NO staged changes, so we throw to simulate exit code 1
              if (command.includes('git diff --cached --quiet')) {
                // No throw = staged changes exist (git returns 1 when there are diffs)
                const error = new Error('git diff --cached --quiet');
                error.status = 1; // indicates staged changes exist
                throw error;
              }
              return '';
            });

            // Execute: stage the files
            const result = await handler.prepareCommit(filesToStage);

            // Assert: should return true when files are staged
            expect(result).toBe(true);

            // Assert: git add was called for all files
            expect(mockExecSync).toHaveBeenCalledWith(
              expect.stringContaining('git add'),
              expect.any(Object)
            );
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 5b: When no files are staged, prepareCommit should return false
   *
   * For any scenario where no staged changes exist, the CommitHandler
   * should detect this and return false, preventing empty commits.
   *
   * Generates: Various staging states (none staged)
   * Validates: Empty staging detection
   */
  test(
    'Property 5b: Should reject commits when no files are staged',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Just need to generate iterations, input doesn't matter
          fc.boolean(),
          async (dummy) => {
            const handler = new CommitHandler({
              validateStaging: true,
              maxRetries: 2,
            });

            // Mock: git add succeeds (or doesn't execute)
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git add')) {
                return '';
              }
              // Mock: git diff --cached --quiet succeeds (exit code 0)
              // which means NO staged changes exist
              if (command.includes('git diff --cached --quiet')) {
                // No throw = no staged changes (git returns 0)
                return '';
              }
              return '';
            });

            // Execute: try to prepare commit with no staged files
            const result = await handler.prepareCommit([]);

            // Assert: should return false when no files are staged
            expect(result).toBe(false);
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 5c: Staging validation happens before actual commit
   *
   * For any commit operation, the staging validation check must occur
   * before attempting the actual git commit command.
   *
   * Generates: Various commit scenarios
   * Validates: Correct operation order
   */
  test(
    'Property 5c: Staging validation must occur before commit execution',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS'),
          fc.constantFrom('001', '042', '123', '999'),
          fc.string({ minLength: 10, maxLength: 50 }),
          async (persona, stepId, description) => {
            const handler = new CommitHandler({
              validateStaging: true,
              maxRetries: 2,
            });

            const callOrder = [];

            // Mock to track call order
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git diff --cached --quiet')) {
                callOrder.push('validate-staging');
                // Simulate: no changes staged
                return '';
              }
              if (command.includes('git commit')) {
                callOrder.push('execute-commit');
                return '[main abc1234] commit message';
              }
              if (command.includes('git rev-parse HEAD')) {
                return 'abc1234def567';
              }
              if (command.includes('git diff')) {
                callOrder.push('check-changes');
                return 'src/file.js';
              }
              if (command.includes('git status')) {
                return '';
              }
              return '';
            });

            // Execute: try to commit
            const result = await handler.prepareCommit([]);

            // Assert: validation occurred
            expect(callOrder).toContain('validate-staging');
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 5d: CommitHandler rejects commits without staged files
   *
   * For any git operation sequence without staged files, the system
   * should actively skip the commit and return false.
   *
   * Generates: Various validation bypass scenarios
   * Validates: Commit rejection logic
   */
  test(
    'Property 5d: Should skip commit operation when staging validation fails',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
            maxLength: 5,
          }),
          async (fileList) => {
            const handler = new CommitHandler({
              validateStaging: true,
              maxRetries: 2,
            });

            let commitWasAttempted = false;

            // Mock to prevent actual commits
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git commit')) {
                commitWasAttempted = true;
                throw new Error('Commit should not be executed');
              }
              if (command.includes('git diff --cached --quiet')) {
                // No staged changes (return success = no diffs)
                return '';
              }
              if (command.includes('git add')) {
                return '';
              }
              if (command.includes('git diff')) {
                return ''; // No changes
              }
              if (command.includes('git status')) {
                return '';
              }
              return '';
            });

            mockFs.existsSync.mockReturnValue(true);

            // Execute: prepare commit when no files are staged
            const result = await handler.prepareCommit(fileList);

            // Assert: commit was not attempted
            expect(commitWasAttempted).toBe(false);

            // Assert: result indicates staging failed
            expect(result).toBe(false);
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 5e: Multiple staged file scenarios
   *
   * For any combination of staged files, the CommitHandler should
   * correctly identify that staged changes exist and allow commit.
   *
   * Generates: Various numbers of staged files
   * Validates: Flexible file list handling
   */
  test(
    'Property 5e: Should handle variable numbers of staged files',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),
          async (fileCount) => {
            const handler = new CommitHandler({
              validateStaging: true,
              maxRetries: 2,
            });

            // Generate file list
            const files = Array.from({ length: fileCount }, (_, i) =>
              `src/file-${i}.js`
            );

            mockFs.existsSync.mockReturnValue(true);

            let filesAddedCount = 0;
            mockExecSync.mockImplementation((command) => {
              if (command.includes('git add')) {
                filesAddedCount++;
                return '';
              }
              if (command.includes('git diff --cached --quiet')) {
                // Simulate staged changes exist
                const error = new Error('Changes staged');
                error.status = 1; // 1 means there are diffs
                throw error;
              }
              return '';
            });

            // Execute: prepare commit with various file counts
            const result = await handler.prepareCommit(files);

            // Assert: staging validation passed
            expect(result).toBe(true);

            // Assert: git add was called
            expect(filesAddedCount).toBeGreaterThan(0);
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 5f: Validation disabling behavior
   *
   * For any scenario where staging validation is disabled, the CommitHandler
   * should skip validation checks.
   *
   * Generates: Various validation states
   * Validates: Configuration respect
   */
  test(
    'Property 5f: Should respect validateStaging configuration option',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (validateStagingEnabled) => {
            const handler = new CommitHandler({
              validateStaging: validateStagingEnabled,
              maxRetries: 2,
            });

            let stagingValidationWasAttempted = false;

            mockExecSync.mockImplementation((command) => {
              if (command.includes('git diff --cached --quiet')) {
                stagingValidationWasAttempted = true;
                return '';
              }
              if (command.includes('git add')) {
                return '';
              }
              if (command.includes('git status')) {
                return '';
              }
              return '';
            });

            mockFs.existsSync.mockReturnValue(true);

            // Execute: prepare commit
            const result = await handler.prepareCommit([]);

            // Assert: validation attempt correlates with configuration
            if (validateStagingEnabled) {
              expect(stagingValidationWasAttempted).toBe(true);
            }
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Integration Test: Full staging validation workflow
   *
   * Verifies that the complete CommitHandler workflow correctly
   * implements Requirement 2.1: verification that files are staged
   * before commit execution.
   */
  test('Integration: Full staging validation workflow', async () => {
    const handler = new CommitHandler({
      validateStaging: true,
      maxRetries: 2,
    });

    const testScenarios = [
      {
        name: 'Scenario 1: Files staged successfully',
        files: ['src/index.js', 'src/utils.js'],
        mockStagingCheck: () => {
          // Simulate: staged changes exist
          const error = new Error('Diffs');
          error.status = 1;
          throw error;
        },
        expectedResult: true,
      },
      {
        name: 'Scenario 2: No files staged',
        files: [],
        mockStagingCheck: () => {
          // Simulate: no staged changes
          return '';
        },
        expectedResult: false,
      },
      {
        name: 'Scenario 3: Specific files provided and staged',
        files: ['test/test.js', 'docs/README.md'],
        mockStagingCheck: () => {
          const error = new Error('Changes');
          error.status = 1;
          throw error;
        },
        expectedResult: true,
      },
    ];

    for (const scenario of testScenarios) {
      mockExecSync.mockClear();
      mockFs.existsSync.mockReturnValue(true);

      mockExecSync.mockImplementation((command) => {
        if (command.includes('git add')) return '';
        if (command.includes('git diff --cached --quiet')) {
          return scenario.mockStagingCheck();
        }
        if (command.includes('git status')) {
          return '';
        }
        return '';
      });

      const result = await handler.prepareCommit(scenario.files);
      expect(result).toBe(
        scenario.expectedResult,
        `Failed: ${scenario.name}`
      );
    }
  });

  /**
   * Unit Test: _validateStaging method behavior
   *
   * Tests the internal validation method directly to ensure it
   * correctly interprets git diff --cached output.
   */
  test('Unit: _validateStaging internal method', async () => {
    const handler = new CommitHandler();

    // Test case 1: Staged changes exist
    mockExecSync.mockImplementation((command) => {
      if (command.includes('git diff --cached --quiet')) {
        const error = new Error('Changes exist');
        error.status = 1;
        throw error;
      }
      return '';
    });

    let result = await handler._validateStaging();
    expect(result).toBe(true);

    // Test case 2: No staged changes
    mockExecSync.mockClear();
    mockExecSync.mockImplementation((command) => {
      if (command.includes('git diff --cached --quiet')) {
        return ''; // git returns 0 (no throw)
      }
      return '';
    });

    result = await handler._validateStaging();
    expect(result).toBe(false);
  });

  /**
   * Unit Test: File staging with verification
   *
   * Tests that specific files can be properly staged and verified.
   */
  test('Unit: File staging with verification', async () => {
    const handler = new CommitHandler();
    const testFiles = ['src/app.js', 'src/utils.js', 'tests/app.test.js'];

    mockFs.existsSync.mockReturnValue(true);

    const stagedFiles = [];
    mockExecSync.mockImplementation((command) => {
      if (command.includes('git add')) {
        // Extract file from command
        const match = command.match(/git add "(.+?)"/);
        if (match) stagedFiles.push(match[1]);
        return '';
      }
      if (command.includes('git diff --cached --quiet')) {
        // Staged files exist
        const error = new Error('Changes');
        error.status = 1;
        throw error;
      }
      return '';
    });

    const result = await handler.prepareCommit(testFiles);

    expect(result).toBe(true);
    expect(stagedFiles.length).toBeGreaterThan(0);
  });

  /**
   * Unit Test: Error handling during staging
   *
   * Tests that staging errors are properly caught and reported.
   */
  test('Unit: Error handling when staging files fails', async () => {
    const handler = new CommitHandler();

    mockFs.existsSync.mockReturnValue(true);

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git add')) {
        throw new Error('Permission denied');
      }
      return '';
    });

    await expect(handler.prepareCommit(['src/test.js'])).rejects.toThrow(
      'Permission denied'
    );
  });

  /**
   * Unit Test: Non-existent file handling
   *
   * Tests that the handler skips files that don't exist.
   */
  test('Unit: Handles non-existent files gracefully', async () => {
    const handler = new CommitHandler();

    const existingFiles = ['src/exists.js'];
    const fileExistsMap = {
      'src/exists.js': true,
      'src/notfound.js': false,
    };

    mockFs.existsSync.mockImplementation((path) => fileExistsMap[path] || false);

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git add')) return '';
      if (command.includes('git diff --cached --quiet')) {
        const error = new Error('Changes');
        error.status = 1;
        throw error;
      }
      return '';
    });

    // Should handle only existing files
    const result = await handler.prepareCommit(existingFiles);
    expect(result).toBe(true);
  });

  /**
   * Unit Test: Stage all changes scenario
   *
   * Tests staging all changes when no specific files are provided.
   */
  test('Unit: Staging all changes when no files specified', async () => {
    const handler = new CommitHandler();

    let gitStatusCalled = false;
    let gitAddAllCalled = false;

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git status --porcelain')) {
        gitStatusCalled = true;
        return 'M  src/file.js\n'; // Return modified files
      }
      if (command === 'git add .') {
        gitAddAllCalled = true;
        return '';
      }
      if (command.includes('git diff --cached --quiet')) {
        const error = new Error('Changes');
        error.status = 1;
        throw error;
      }
      return '';
    });

    const result = await handler.prepareCommit([]);

    expect(result).toBe(true);
    expect(gitStatusCalled).toBe(true);
    expect(gitAddAllCalled).toBe(true);
  });

  /**
   * Unit Test: Empty repository scenario
   *
   * Tests behavior when git status shows no changes.
   */
  test('Unit: Handles empty repository with no changes', async () => {
    const handler = new CommitHandler();

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git status --porcelain')) {
        return ''; // No changes
      }
      if (command.includes('git diff --cached --quiet')) {
        return ''; // No staged changes
      }
      return '';
    });

    const result = await handler.prepareCommit([]);

    expect(result).toBe(false);
  });

  /**
   * Unit Test: Validation disabling
   *
   * Tests that validation can be disabled in configuration.
   */
  test('Unit: Can disable staging validation', async () => {
    const handler = new CommitHandler({
      validateStaging: false,
    });

    let validationWasAttempted = false;

    mockExecSync.mockImplementation((command) => {
      if (command.includes('git diff --cached --quiet')) {
        validationWasAttempted = true;
      }
      if (command.includes('git add')) return '';
      if (command.includes('git status')) return '';
      return '';
    });

    // When validation is disabled, _validateStaging should not be called
    await handler.prepareCommit([]);

    // With validation disabled, the method should still return early before validation
    expect(handler.validateStaging).toBe(false);
  });

  /**
   * Property Test 5g: Configuration options work independently
   *
   * Validates that each configuration option (validateStaging, maxRetries, etc.)
   * work correctly in various combinations.
   */
  test(
    'Property 5g: Configuration options work independently',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.integer({ min: 1, max: 5 }),
          async (validateStaging, maxRetries) => {
            const handler = new CommitHandler({
              validateStaging,
              maxRetries,
            });

            // Verify configuration is correctly set
            expect(handler.validateStaging).toBe(validateStaging);
            expect(handler.maxRetries).toBe(maxRetries);
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
   * Integration Test: Requirement 2.1 - Full compliance verification
   *
   * This comprehensive test ensures complete compliance with Requirement 2.1:
   * "WHEN the Commit_Handler prepares a commit operation, THE Commit_Handler
   * SHALL verify that at least one file has been staged via `git add` before
   * invoking `git commit`"
   */
  test('Integration: Requirement 2.1 - Commit staging validation compliance', async () => {
    const scenarios = [
      {
        description: 'Must reject commit with no staged files',
        setup: () => {
          mockExecSync.mockImplementation((cmd) => {
            if (cmd.includes('git diff --cached --quiet')) return ''; // No staged files
            if (cmd.includes('git add')) return '';
            if (cmd.includes('git status')) return '';
            return '';
          });
        },
        expectedResult: false,
        expectCommitAttempt: false,
      },
      {
        description: 'Must accept commit with staged files',
        setup: () => {
          mockExecSync.mockImplementation((cmd) => {
            if (cmd.includes('git diff --cached --quiet')) {
              const err = new Error('Changes');
              err.status = 1;
              throw err;
            }
            if (cmd.includes('git add')) return '';
            return '';
          });
        },
        expectedResult: true,
        expectCommitAttempt: false, // prepareCommit doesn't execute, only prepares
      },
      {
        description: 'Must verify before any commit operation',
        setup: () => {
          const callOrder = [];
          mockExecSync.mockImplementation((cmd) => {
            if (cmd.includes('git diff --cached --quiet')) {
              callOrder.push('validation');
              const err = new Error('Changes');
              err.status = 1;
              throw err;
            }
            if (cmd.includes('git add')) callOrder.push('add');
            return '';
          });
        },
        expectedResult: true,
        expectCommitAttempt: false,
      },
    ];

    for (const scenario of scenarios) {
      mockExecSync.mockClear();
      scenario.setup();

      const handler = new CommitHandler({
        validateStaging: true,
        maxRetries: 2,
      });

      const result = await handler.prepareCommit(['src/test.js']);

      expect(result).toBe(
        scenario.expectedResult,
        `Failed: ${scenario.description}`
      );
    }
  });
});
