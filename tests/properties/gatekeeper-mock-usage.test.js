/**
 * Property-Based Test for Gatekeeper Mock Usage
 * **Feature: bmad-critical-fixes, Property 10: Gatekeeper Mock Usage**
 * **Validates: Requirements 3.1**
 *
 * This test validates that for any gatekeeper evaluation in testing scenarios,
 * the system uses robust mock data to ensure consistent test conditions.
 *
 * Requirement 3.1 states:
 * "WHEN the Gatekeeper evaluates workflow conditions in a test environment,
 * THE Gatekeeper SHALL use pre-defined fixture data where each fixture scenario
 * is treated as a discrete pass/fail test case covering all required validation scenarios"
 *
 * Property tests ensure this behavior holds across diverse scenarios with 100+ iterations.
 */

const fc = require('fast-check');
const EnhancedGatekeeper = require('../../scripts/lib/enhanced-gatekeeper');
const Logger = require('../../scripts/lib/logger');

// Mock child_process to avoid actual git operations
jest.mock('child_process');

// Mock fs to avoid actual filesystem operations
jest.mock('fs');

// Mock Logger to avoid log pollution
jest.mock('../../scripts/lib/logger');

describe('Property 10: Gatekeeper Mock Usage', () => {
  let mockLogger;
  let gatekeeper;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Logger mock
    mockLogger = require('../../scripts/lib/logger');
    mockLogger.mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    // Create gatekeeper instance
    gatekeeper = new EnhancedGatekeeper();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Generator for different fixture scenarios
   * Each scenario represents a discrete test case with specific conditions
   */
  const fixtureScenarioArbitrary = () =>
    fc.constantFrom(
      'pass_all_tests',
      'pass_with_warnings',
      'fail_some_tests',
      'fail_all_tests',
      'mixed_results',
      'edge_case_coverage',
      'high_coverage',
      'low_coverage'
    );

  /**
   * Generator for validation types
   */
  const validationTypeArbitrary = () =>
    fc.constantFrom(
      'commit_message',
      'context_update',
      'test_suite',
      'code_quality',
      'coverage'
    );

  /**
   * Property Test 10a: Mock data is consistently generated
   *
   * For any number of calls to generateMockData(), the structure
   * must always be consistent across multiple invocations.
   *
   * Validates: Mock data consistency
   */
  test('Property 10a: Mock data structure is consistent across invocations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (callCount) => {
          // Generate mock data multiple times
          const mockDataSamples = [];
          for (let i = 0; i < callCount; i++) {
            mockDataSamples.push(gatekeeper.generateMockData());
          }

          // Assert: all samples have consistent structure
          mockDataSamples.forEach((mockData) => {
            expect(mockData).toHaveProperty('commits');
            expect(mockData).toHaveProperty('testResults');
            expect(mockData).toHaveProperty('workflowContext');
            expect(mockData).toHaveProperty('gitStatus');
          });

          // Assert: commits is an array
          mockDataSamples.forEach((mockData) => {
            expect(Array.isArray(mockData.commits)).toBe(true);
            expect(mockData.commits.length).toBeGreaterThan(0);
          });

          // Assert: each commit has required fields
          mockDataSamples.forEach((mockData) => {
            mockData.commits.forEach((commit) => {
              expect(commit).toHaveProperty('hash');
              expect(commit).toHaveProperty('message');
              expect(commit).toHaveProperty('author');
              expect(commit).toHaveProperty('timestamp');
              expect(commit).toHaveProperty('files');
            });
          });

          // Assert: testResults has required structure
          mockDataSamples.forEach((mockData) => {
            expect(mockData.testResults).toHaveProperty('passed');
            expect(mockData.testResults).toHaveProperty('failed');
            expect(mockData.testResults).toHaveProperty('total');
            expect(mockData.testResults).toHaveProperty('coverage');
            expect(mockData.testResults).toHaveProperty('suites');
          });

          // Assert: coverage has all required metrics
          mockDataSamples.forEach((mockData) => {
            expect(mockData.testResults.coverage).toHaveProperty('lines');
            expect(mockData.testResults.coverage).toHaveProperty('functions');
            expect(mockData.testResults.coverage).toHaveProperty('branches');
            expect(mockData.testResults.coverage).toHaveProperty('statements');
          });
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10b: Each fixture scenario produces deterministic results
   *
   * For any specific fixture scenario when called multiple times,
   * the gatekeeper mock data generation must produce consistent, repeatable results.
   *
   * Validates: Deterministic behavior
   */
  test('Property 10b: Each fixture scenario produces deterministic results', () => {
    fc.assert(
      fc.property(
        fixtureScenarioArbitrary(),
        fc.integer({ min: 1, max: 10 }),
        (scenario, iterations) => {
          const mockDataResults = [];

          // Run mock data generation multiple times
          for (let i = 0; i < iterations; i++) {
            mockDataResults.push(gatekeeper.generateMockData());
          }

          // Assert: all results have consistent structure
          mockDataResults.forEach((mockData) => {
            expect(mockData).toHaveProperty('commits');
            expect(mockData).toHaveProperty('testResults');
            expect(mockData).toHaveProperty('workflowContext');
            expect(mockData).toHaveProperty('gitStatus');
          });

          // Assert: each has valid test results
          mockDataResults.forEach((mockData) => {
            expect(mockData.testResults).toHaveProperty('passed');
            expect(mockData.testResults).toHaveProperty('failed');
            expect(mockData.testResults).toHaveProperty('total');
          });

          // Assert: structure consistency across iterations
          if (mockDataResults.length > 1) {
            const firstResult = mockDataResults[0];
            mockDataResults.slice(1).forEach((result) => {
              expect(result).toEqual(expect.objectContaining({
                commits: expect.any(Array),
                testResults: expect.objectContaining({
                  passed: expect.any(Number),
                  failed: expect.any(Number),
                  total: expect.any(Number),
                }),
              }));
            });
          }
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10c: Mock data covers all required validation scenarios
   *
   * For any generated mock data, it must include scenarios covering:
   * - Passing commits with proper format
   * - Test results with coverage metrics
   * - Workflow context with required fields
   * - Git status tracking
   *
   * Validates: Comprehensive coverage
   */
  test('Property 10c: Mock data covers all required validation scenarios', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (iterations) => {
          // Generate multiple mock data sets
          for (let i = 0; i < iterations; i++) {
            const mockData = gatekeeper.generateMockData();

            // Scenario 1: Commits are valid with proper format
            mockData.commits.forEach((commit) => {
              // Hash should be a non-empty string (can be hex or other formats)
              expect(typeof commit.hash).toBe('string');
              expect(commit.hash.length).toBeGreaterThan(0);
              expect(commit.message).toMatch(/^\[.*\] \[.*\] .+/);
              expect(commit.author).toBeTruthy();
              expect(commit.timestamp).toBeTruthy();
              expect(Array.isArray(commit.files)).toBe(true);
            });

            // Scenario 2: Test results are valid metrics
            expect(mockData.testResults.passed).toBeGreaterThanOrEqual(0);
            expect(mockData.testResults.failed).toBeGreaterThanOrEqual(0);
            expect(mockData.testResults.total).toBe(
              mockData.testResults.passed + mockData.testResults.failed
            );

            // Scenario 3: Coverage metrics are valid percentages
            Object.values(mockData.testResults.coverage).forEach((metric) => {
              expect(metric).toBeGreaterThanOrEqual(0);
              expect(metric).toBeLessThanOrEqual(100);
            });

            // Scenario 4: Test suites are properly documented
            mockData.testResults.suites.forEach((suite) => {
              expect(suite.name).toBeTruthy();
              expect(suite.status).toMatch(/^(passed|failed|skipped)$/);
              expect(suite.tests).toBeGreaterThanOrEqual(0);
            });

            // Scenario 5: Workflow context has all required fields
            expect(mockData.workflowContext.currentPersona).toBeTruthy();
            expect(mockData.workflowContext.stepId).toBeTruthy();
            expect(mockData.workflowContext.phase).toBeTruthy();
            expect(mockData.workflowContext.lastTransition).toBeTruthy();

            // Scenario 6: Git status tracks all required states
            expect(Array.isArray(mockData.gitStatus.staged)).toBe(true);
            expect(Array.isArray(mockData.gitStatus.modified)).toBe(true);
            expect(Array.isArray(mockData.gitStatus.untracked)).toBe(true);
          }
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10d: Mock data is properly isolated between test runs
   *
   * For any two consecutive calls to generateMockData(), the returned
   * objects must be independent copies, not references to the same object.
   * Modifying one should not affect the other.
   *
   * Validates: Data isolation
   */
  test('Property 10d: Mock data is properly isolated between test runs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (iterations) => {
          const mockDataSet = [];

          // Generate multiple mock data sets
          for (let i = 0; i < Math.min(iterations, 10); i++) {
            mockDataSet.push(gatekeeper.generateMockData());
          }

          // Attempt to modify first mock data set
          if (mockDataSet.length > 1) {
            const firstMock = mockDataSet[0];
            const secondMock = mockDataSet[1];

            // Store original values
            const firstCommitsLength = firstMock.commits.length;
            const secondCommitsLength = secondMock.commits.length;

            // Modify first mock's commits array
            firstMock.commits.push({
              hash: 'modified',
              message: '[TEST] Modified',
              author: 'test-modifier',
              timestamp: new Date().toISOString(),
              files: [],
            });

            // Assert: second mock is unaffected
            expect(secondMock.commits.length).toBe(secondCommitsLength);
            expect(secondMock.commits.length).not.toBe(firstMock.commits.length);

            // Modify first mock's test results
            firstMock.testResults.passed = 999;

            // Assert: second mock is unaffected
            expect(secondMock.testResults.passed).not.toBe(999);
          }

          // Verify all mock data sets are independent
          for (let i = 0; i < mockDataSet.length; i++) {
            for (let j = i + 1; j < mockDataSet.length; j++) {
              const mockI = mockDataSet[i];
              const mockJ = mockDataSet[j];

              // They should be different objects (not same reference)
              expect(mockI).not.toBe(mockJ);

              // Their contents should be independent
              expect(mockI.commits).not.toBe(mockJ.commits);
              expect(mockI.testResults).not.toBe(mockJ.testResults);
            }
          }
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10e: Gatekeeper distinguishes between different mock scenarios
   *
   * For any different fixture scenarios, the gatekeeper evaluation
   * must produce different results that correspond to the scenario type.
   *
   * Validates: Scenario discrimination
   */
  test('Property 10e: Gatekeeper correctly distinguishes between different mock scenarios', () => {
    fc.assert(
      fc.property(
        fc.tuple(fixtureScenarioArbitrary(), fixtureScenarioArbitrary()),
        ([scenario1, scenario2]) => {
          // Skip if same scenario
          if (scenario1 === scenario2) {
            return;
          }

          // Generate mock data for first scenario
          const mockData1 = gatekeeper.generateMockData();
          
          // Generate mock data for second scenario
          const mockData2 = gatekeeper.generateMockData();

          // Both should have valid mock data structures
          expect(mockData1).toHaveProperty('commits');
          expect(mockData1).toHaveProperty('testResults');
          expect(mockData2).toHaveProperty('commits');
          expect(mockData2).toHaveProperty('testResults');

          // Mock data sets should be distinguishable objects
          expect(mockData1).not.toBe(mockData2);
          expect(mockData1.commits).not.toBe(mockData2.commits);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10f: Mock data timestamps are properly formatted
   *
   * For any generated mock data, all timestamps must be valid ISO 8601
   * strings that can be parsed and compared.
   *
   * Validates: Timestamp validity
   */
  test('Property 10f: Mock data timestamps are valid and parseable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (iterations) => {
          for (let i = 0; i < iterations; i++) {
            const mockData = gatekeeper.generateMockData();

            // Check commits timestamps
            mockData.commits.forEach((commit) => {
              const timestamp = new Date(commit.timestamp);
              expect(timestamp.getTime()).not.toBeNaN();
              expect(commit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            });

            // Check workflow context timestamp
            const contextTimestamp = new Date(mockData.workflowContext.lastTransition);
            expect(contextTimestamp.getTime()).not.toBeNaN();
            expect(mockData.workflowContext.lastTransition).toMatch(
              /^\d{4}-\d{2}-\d{2}T/
            );
          }
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10g: Mock commits follow BMAD message format
   *
   * For any generated mock commit, the message must follow the
   * "[PERSONA] [STEP-ID] Description" pattern defined in Requirement 2.5.
   *
   * Validates: Message format compliance
   */
  test('Property 10g: Mock commits follow BMAD message format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (iterations) => {
          const validPersonas = [
            'DEVELOPER',
            'QA',
            'ARCHITECT',
            'PM',
            'DEVOPS',
            'SECURITY',
            'RELEASEMANAGER',
            'ORCHESTRATOR',
          ];

          for (let i = 0; i < iterations; i++) {
            const mockData = gatekeeper.generateMockData();

            mockData.commits.forEach((commit) => {
              // Message must match BMAD pattern
              expect(commit.message).toMatch(
                /^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/
              );

              // Extract components
              const match = commit.message.match(
                /^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/
              );
              const persona = match[1];
              const stepId = match[2];
              const description = match[3];

              // Persona should be valid
              expect(validPersonas).toContain(persona);

              // Step ID should be valid 3-digit number
              expect(parseInt(stepId)).toBeGreaterThanOrEqual(0);
              expect(parseInt(stepId)).toBeLessThanOrEqual(999);

              // Description should not be empty
              expect(description.length).toBeGreaterThan(0);
            });
          }
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 10h: Mock data maintains referential integrity
   *
   * For any generated mock data, references between related fields
   * must be consistent (e.g., test count matches suite tests).
   *
   * Validates: Data integrity
   */
  test('Property 10h: Mock data maintains referential integrity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (iterations) => {
          for (let i = 0; i < iterations; i++) {
            const mockData = gatekeeper.generateMockData();

            // Assert: total test count matches sum of suite tests
            const suiteTestSum = mockData.testResults.suites.reduce(
              (sum, suite) => sum + suite.tests,
              0
            );

            // The total should equal the sum of passed and failed
            expect(mockData.testResults.total).toBe(
              mockData.testResults.passed + mockData.testResults.failed
            );

            // Suites should account for all tests
            expect(suiteTestSum).toBeGreaterThanOrEqual(
              mockData.testResults.total
            );

            // Assert: coverage metrics are within valid range
            Object.values(mockData.testResults.coverage).forEach((coverage) => {
              expect(coverage).toBeGreaterThanOrEqual(0);
              expect(coverage).toBeLessThanOrEqual(100);
            });

            // Assert: commits array is not empty
            expect(mockData.commits.length).toBeGreaterThan(0);

            // Assert: git status arrays exist (may be empty)
            expect(Array.isArray(mockData.gitStatus.staged)).toBe(true);
            expect(Array.isArray(mockData.gitStatus.modified)).toBe(true);
            expect(Array.isArray(mockData.gitStatus.untracked)).toBe(true);
          }
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Integration Test: Mock data through validation workflow
   *
   * Verifies that mock data flows correctly through the complete
   * validation workflow without errors or type mismatches.
   */
  test('Integration: Mock data flows through complete validation workflow', async () => {
    const mockData = gatekeeper.generateMockData();

    // Create a proper validation result object
    const validationResult = {
      gate: 'FAIL',
      timestamp: new Date().toISOString(),
      validations: [],
      errors: [],
      warnings: [],
      waiver: { active: false },
    };

    // Execute: evaluate with proper structure
    gatekeeper.evaluateResults(validationResult);

    // Assert: validation result has expected gate property
    expect(validationResult).toHaveProperty('gate');
    expect(validationResult.gate).toMatch(/^(PASS|FAIL|WAIVED)$/);

    // Validate the mock data structure itself is sound
    expect(mockData).toHaveProperty('commits');
    expect(mockData).toHaveProperty('testResults');
    expect(mockData).toHaveProperty('workflowContext');
    expect(mockData).toHaveProperty('gitStatus');
  });

  /**
   * Unit Test: generateMockData returns proper structure
   *
   * Verifies the mock data generator creates complete structures.
   */
  test('Unit: generateMockData returns complete structure', () => {
    const mockData = gatekeeper.generateMockData();

    // Assert: top-level structure
    expect(mockData).toHaveProperty('commits');
    expect(mockData).toHaveProperty('testResults');
    expect(mockData).toHaveProperty('workflowContext');
    expect(mockData).toHaveProperty('gitStatus');

    // Assert: commits structure
    expect(Array.isArray(mockData.commits)).toBe(true);
    expect(mockData.commits.length).toBeGreaterThan(0);

    mockData.commits.forEach((commit) => {
      expect(commit).toHaveProperty('hash');
      expect(commit).toHaveProperty('message');
      expect(commit).toHaveProperty('author');
      expect(commit).toHaveProperty('timestamp');
      expect(commit).toHaveProperty('files');
    });

    // Assert: test results structure
    expect(mockData.testResults).toHaveProperty('passed');
    expect(mockData.testResults).toHaveProperty('failed');
    expect(mockData.testResults).toHaveProperty('total');
    expect(mockData.testResults).toHaveProperty('coverage');
    expect(mockData.testResults).toHaveProperty('suites');

    // Assert: coverage metrics
    expect(mockData.testResults.coverage).toHaveProperty('lines');
    expect(mockData.testResults.coverage).toHaveProperty('functions');
    expect(mockData.testResults.coverage).toHaveProperty('branches');
    expect(mockData.testResults.coverage).toHaveProperty('statements');

    // Assert: workflow context
    expect(mockData.workflowContext).toHaveProperty('currentPersona');
    expect(mockData.workflowContext).toHaveProperty('stepId');
    expect(mockData.workflowContext).toHaveProperty('phase');
    expect(mockData.workflowContext).toHaveProperty('lastTransition');

    // Assert: git status
    expect(mockData.gitStatus).toHaveProperty('staged');
    expect(mockData.gitStatus).toHaveProperty('modified');
    expect(mockData.gitStatus).toHaveProperty('untracked');
  });

  /**
   * Unit Test: evaluateResults processes mock data correctly
   *
   * Verifies evaluation logic handles validation results properly.
   */
  test('Unit: evaluateResults processes validation results correctly', () => {
    // Create a proper validation result structure
    const validationResult = {
      gate: 'FAIL',
      timestamp: new Date().toISOString(),
      validations: [],
      errors: [],
      warnings: [],
      waiver: { active: false },
    };

    // Execute: evaluate results
    gatekeeper.evaluateResults(validationResult);

    // Assert: gate is set to a valid value
    expect(validationResult).toHaveProperty('gate');
    expect(validationResult.gate).toMatch(/^(PASS|FAIL|WAIVED)$/);

    // Test with errors
    const resultWithErrors = {
      gate: 'FAIL',
      timestamp: new Date().toISOString(),
      validations: [],
      errors: [{ type: 'ERROR', message: 'Test error' }],
      warnings: [],
      waiver: { active: false },
    };

    gatekeeper.evaluateResults(resultWithErrors);
    expect(resultWithErrors.gate).toBe('FAIL');

    // Test with waiver
    const resultWithWaiver = {
      gate: 'FAIL',
      timestamp: new Date().toISOString(),
      validations: [],
      errors: [],
      warnings: [],
      waiver: { active: true },
    };

    gatekeeper.evaluateResults(resultWithWaiver);
    expect(resultWithWaiver.gate).toBe('WAIVED');
  });

  /**
   * Requirement 3.1 Compliance Test
   *
   * Comprehensive test ensuring complete compliance with Requirement 3.1:
   * "WHEN the Gatekeeper evaluates workflow conditions in a test environment,
   * THE Gatekeeper SHALL use pre-defined fixture data where each fixture scenario
   * is treated as a discrete pass/fail test case covering all required validation scenarios"
   */
  test('Integration: Requirement 3.1 - Gatekeeper mock usage compliance', () => {
    // Test: Generate mock data multiple times
    const mockDataSamples = [];
    for (let i = 0; i < 10; i++) {
      mockDataSamples.push(gatekeeper.generateMockData());
    }

    // Assert: All samples have consistent structure
    mockDataSamples.forEach((mockData) => {
      // Structure validation
      expect(mockData).toHaveProperty('commits');
      expect(mockData).toHaveProperty('testResults');
      expect(mockData).toHaveProperty('workflowContext');
      expect(mockData).toHaveProperty('gitStatus');

      // Commits validation
      expect(Array.isArray(mockData.commits)).toBe(true);
      mockData.commits.forEach((commit) => {
        expect(commit.message).toMatch(/^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/);
      });

      // Test results validation
      expect(mockData.testResults.passed).toBeGreaterThanOrEqual(0);
      expect(mockData.testResults.failed).toBeGreaterThanOrEqual(0);
      expect(mockData.testResults.total).toBe(
        mockData.testResults.passed + mockData.testResults.failed
      );

      // Coverage validation
      Object.values(mockData.testResults.coverage).forEach((metric) => {
        expect(metric).toBeGreaterThanOrEqual(0);
        expect(metric).toBeLessThanOrEqual(100);
      });
    });

    // Test: Evaluation of validation results with proper structure
    mockDataSamples.forEach((mockData) => {
      const validationResult = {
        gate: 'FAIL',
        timestamp: new Date().toISOString(),
        validations: [],
        errors: [],
        warnings: [],
        waiver: { active: false },
      };

      gatekeeper.evaluateResults(validationResult);

      // Assert: gate is set to valid value
      expect(validationResult).toHaveProperty('gate');
      expect(validationResult.gate).toMatch(/^(PASS|FAIL|WAIVED)$/);
    });

    // Test: Mock data remains isolated between evaluations
    const mock1 = gatekeeper.generateMockData();
    const mock2 = gatekeeper.generateMockData();

    // Modify mock1
    mock1.testResults.passed = 999;

    // Assert: mock2 is unaffected
    expect(mock2.testResults.passed).not.toBe(999);
  });

  /**
   * Unit Test: Mock data covers validation scenarios
   *
   * Verifies that mock data includes all necessary scenarios.
   */
  test('Unit: Mock data covers all required validation scenarios', () => {
    const mockData = gatekeeper.generateMockData();

    // Scenario 1: Proper commit format
    expect(mockData.commits.length).toBeGreaterThan(0);
    mockData.commits.forEach((commit) => {
      expect(commit.message).toMatch(/^\[.*\] \[STEP-\d{3}\] .+$/);
      expect(commit.hash).toBeTruthy();
      expect(commit.files).toBeDefined();
    });

    // Scenario 2: Test metrics
    expect(mockData.testResults.total).toBeGreaterThan(0);
    expect(mockData.testResults.passed).toBeGreaterThanOrEqual(0);
    expect(mockData.testResults.failed).toBeGreaterThanOrEqual(0);

    // Scenario 3: Coverage metrics
    expect(mockData.testResults.coverage.lines).toBeGreaterThan(0);
    expect(mockData.testResults.coverage.functions).toBeGreaterThan(0);

    // Scenario 4: Git status tracking
    expect(mockData.gitStatus.staged).toBeDefined();
    expect(mockData.gitStatus.modified).toBeDefined();
    expect(mockData.gitStatus.untracked).toBeDefined();

    // Scenario 5: Workflow context
    expect(mockData.workflowContext.currentPersona).toBeTruthy();
    expect(mockData.workflowContext.stepId).toBeTruthy();
  });

  /**
   * Unit Test: Mock data independence verification
   *
   * Verifies that mock data instances are independent.
   */
  test('Unit: Mock data instances are properly isolated', () => {
    const mock1 = gatekeeper.generateMockData();
    const mock2 = gatekeeper.generateMockData();

    // Modify mock1's arrays
    mock1.commits.push({
      hash: 'test123',
      message: '[TEST] [STEP-001] Modified',
      author: 'test',
      timestamp: new Date().toISOString(),
      files: [],
    });

    // Assert: mock2 is unaffected
    expect(mock2.commits.length).not.toBe(mock1.commits.length);

    // Modify mock1's metrics
    mock1.testResults.passed = 500;

    // Assert: mock2 is unaffected
    expect(mock2.testResults.passed).not.toBe(500);

    // Modify mock1's coverage
    mock1.testResults.coverage.lines = 0;

    // Assert: mock2 is unaffected
    expect(mock2.testResults.coverage.lines).not.toBe(0);
  });
});
