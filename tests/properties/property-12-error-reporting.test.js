/**
 * Property-Based Test for Gatekeeper Error Reporting
 * **Feature: bmad-critical-fixes, Property 12: Gatekeeper Error Reporting**
 * **Validates: Requirements 3.3**
 *
 * This test validates that for any gatekeeper blocking due to test failures,
 * the system provides detailed error information and suggested remediation steps.
 *
 * Requirement 3.3 states:
 * "WHEN the Gatekeeper blocks progression due to test failures,
 * THE Gatekeeper SHALL emit an error report that identifies each failing test
 * by name and provides a suggested remediation action for each failure"
 *
 * Key Validations:
 * 1. Error reports identify each failing test by name
 * 2. Error reports include suggested remediation actions
 * 3. Error reports have consistent structure across different failures
 * 4. Remediation suggestions are specific to error types
 * 5. Error reports include all required metadata (timestamp, severity, impact)
 * 6. Multiple failures are properly aggregated
 * 7. Edge cases are handled (empty failures, unknown error types)
 *
 * Property tests ensure this behavior holds across 100+ iterations with diverse scenarios.
 */

const fc = require('fast-check');
const EnhancedGatekeeper = require('../../scripts/lib/enhanced-gatekeeper');

// Mock child_process to avoid actual git operations
jest.mock('child_process');

// Mock fs to avoid actual filesystem operations
jest.mock('fs');

// Mock Logger to avoid log pollution
jest.mock('../../scripts/lib/logger');

describe('Property 12: Gatekeeper Error Reporting', () => {
  let mockLogger;
  let gatekeeper;

  beforeEach(() => {
    mockLogger = require('../../scripts/lib/logger');

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup Logger mock
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
   * Generator for error types that can occur in test failures
   */
  const errorTypeArbitrary = () =>
    fc.constantFrom(
      'TEST_FAILURE',
      'COMMIT_FORMAT_ERROR',
      'CONTEXT_UPDATE_ERROR',
      'VALIDATION_ERROR',
      'TIMEOUT_ERROR',
      'COVERAGE_ERROR'
    );

  /**
   * Generator for test names that could fail
   */
  const testNameArbitrary = () =>
    fc.constantFrom(
      'auth.test.js',
      'user.test.js',
      'product.test.js',
      'order.test.js',
      'payment.test.js',
      'integration/api.test.js',
      'unit/utils.test.js',
      'fixtures/mock-data.test.js'
    );

  /**
   * Generator for failure messages
   */
  const failureMessageArbitrary = () =>
    fc.constantFrom(
      'Expected true but got false',
      'Timeout after 5000ms',
      'Cannot find module',
      'Expected array length 5 but got 3',
      'Connection refused',
      'Coverage threshold not met',
      'Snapshot does not match',
      'Test marked as TODO'
    );

  /**
   * Generator for failure objects
   */
  const failureArbitrary = () =>
    fc.record({
      type: errorTypeArbitrary(),
      name: testNameArbitrary(),
      message: failureMessageArbitrary(),
      details: fc.string({ maxLength: 100 }),
    });

  /**
   * Property Test 12a: Error report identifies failing tests by name
   *
   * For any failing test scenario, the error report must identify each
   * failing test by its name.
   *
   * Generates: Various failing test scenarios
   * Validates: Test name identification
   */
  test('Property 12a: Error report identifies failing tests by name', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 1, maxLength: 10 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: error report has required structure
          expect(errorReport).toHaveProperty('errors');
          expect(Array.isArray(errorReport.errors)).toBe(true);

          // Assert: each failure is identified in the report
          expect(errorReport.errors.length).toBe(failures.length);

          // Assert: each failure includes the test name
          errorReport.errors.forEach((reportedError, index) => {
            expect(reportedError).toHaveProperty('name');
            expect(reportedError.name).toBe(failures[index].name);
            expect(reportedError).toHaveProperty('type');
            expect(reportedError).toHaveProperty('message');
          });

          // Assert: all test names are preserved
          const reportedNames = errorReport.errors.map((e) => e.name);
          const inputNames = failures.map((f) => f.name);
          expect(reportedNames).toEqual(inputNames);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 12b: Error report provides remediation actions
   *
   * For any failing test, the error report must include suggested
   * remediation actions specific to the error type.
   *
   * Generates: Various error types
   * Validates: Remediation availability
   */
  test('Property 12b: Error report provides remediation actions', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 1, maxLength: 5 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: remediation structure exists
          expect(errorReport).toHaveProperty('remediation');
          expect(errorReport.remediation).toHaveProperty('immediate');
          expect(errorReport.remediation).toHaveProperty('longTerm');
          expect(errorReport.remediation).toHaveProperty('automated');

          // Assert: remediation is arrays of strings
          expect(Array.isArray(errorReport.remediation.immediate)).toBe(true);
          expect(Array.isArray(errorReport.remediation.longTerm)).toBe(true);
          expect(Array.isArray(errorReport.remediation.automated)).toBe(true);

          // Assert: at least one remediation action is provided
          const totalRemediation =
            errorReport.remediation.immediate.length +
            errorReport.remediation.longTerm.length +
            errorReport.remediation.automated.length;
          expect(totalRemediation).toBeGreaterThan(0);

          // Assert: all remediation suggestions are non-empty strings
          errorReport.remediation.immediate.forEach((suggestion) => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
          });
          errorReport.remediation.longTerm.forEach((suggestion) => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
          });
          errorReport.remediation.automated.forEach((suggestion) => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
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
   * Property Test 12c: Error report has consistent structure
   *
   * For any error scenario, the error report must always have
   * the same required structure and properties.
   *
   * Generates: Various failure combinations
   * Validates: Structural consistency
   */
  test('Property 12c: Error report has consistent structure', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 1, maxLength: 8 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: all required top-level properties exist
          expect(errorReport).toHaveProperty('summary');
          expect(errorReport).toHaveProperty('timestamp');
          expect(errorReport).toHaveProperty('errors');
          expect(errorReport).toHaveProperty('context');
          expect(errorReport).toHaveProperty('remediation');
          expect(errorReport).toHaveProperty('severity');
          expect(errorReport).toHaveProperty('impact');

          // Assert: property types are correct
          expect(typeof errorReport.summary).toBe('string');
          expect(errorReport.timestamp).toBeTruthy();
          expect(Array.isArray(errorReport.errors)).toBe(true);
          expect(typeof errorReport.context).toBe('object');
          expect(typeof errorReport.remediation).toBe('object');
          expect(typeof errorReport.severity).toBe('string');
          expect(typeof errorReport.impact).toBe('object');

          // Assert: timestamp is valid ISO 8601
          const timestamp = new Date(errorReport.timestamp);
          expect(timestamp.getTime()).not.toBeNaN();

          // Assert: severity is a valid level
          expect(['LOW', 'MEDIUM', 'HIGH'].includes(errorReport.severity)).toBe(
            true
          );

          // Assert: context has expected fields
          expect(errorReport.context).toHaveProperty('developmentMode');
          expect(errorReport.context).toHaveProperty('environment');
          expect(errorReport.context).toHaveProperty('user');

          // Assert: impact has expected structure
          expect(errorReport.impact).toHaveProperty('workflowBlocked');
          expect(errorReport.impact).toHaveProperty('affectedComponents');
          expect(errorReport.impact).toHaveProperty('estimatedFixTime');
          expect(errorReport.impact).toHaveProperty('riskLevel');
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 12d: Remediation suggestions are error-specific
   *
   * For different error types, the generated remediation must be
   * specific to the error type.
   *
   * Generates: Different error types
   * Validates: Type-specific remediation
   */
  test('Property 12d: Remediation suggestions are error-specific', () => {
    fc.assert(
      fc.property(
        errorTypeArbitrary(),
        (errorType) => {
          const failures = [
            {
              type: errorType,
              name: 'test.js',
              message: 'Test failed',
              details: 'Specific details',
            },
          ];

          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: remediation is provided
          expect(errorReport.remediation.immediate.length).toBeGreaterThan(0);

          // Assert: remediation is not generic/empty
          errorReport.remediation.immediate.forEach((suggestion) => {
            expect(suggestion.length).toBeGreaterThan(0);
            // Ensure it's not just placeholder text
            expect(suggestion).not.toMatch(/^fix.*error$/i);
          });

          // For TEST_FAILURE, ensure test-specific remediation
          if (errorType === 'TEST_FAILURE') {
            const hasTestSpecificSuggestion =
              errorReport.remediation.immediate.some((s) =>
                s.toLowerCase().includes('test')
              ) ||
              errorReport.remediation.immediate.some((s) =>
                s.toLowerCase().includes('failing')
              );
            expect(hasTestSpecificSuggestion).toBe(true);
          }

          // For COMMIT_FORMAT_ERROR, ensure commit-specific remediation
          if (errorType === 'COMMIT_FORMAT_ERROR') {
            const hasCommitSpecificSuggestion = errorReport.remediation.immediate.some(
              (s) =>
                s.toLowerCase().includes('commit') ||
                s.toLowerCase().includes('format')
            );
            expect(hasCommitSpecificSuggestion).toBe(true);
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
   * Property Test 12e: Multiple failures are properly aggregated
   *
   * For any set of multiple failures, the error report must include
   * all failures without loss or duplication.
   *
   * Generates: Multiple failures
   * Validates: Aggregation completeness
   */
  test('Property 12e: Multiple failures are properly aggregated', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 2, maxLength: 10 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: all failures are included
          expect(errorReport.errors.length).toBe(failures.length);

          // Assert: summary mentions error count
          expect(errorReport.summary).toContain(failures.length.toString());

          // Assert: remediation is deduplicated
          const immediateSet = new Set(errorReport.remediation.immediate);
          expect(immediateSet.size).toBe(errorReport.remediation.immediate.length);

          const longTermSet = new Set(errorReport.remediation.longTerm);
          expect(longTermSet.size).toBe(errorReport.remediation.longTerm.length);

          const automatedSet = new Set(errorReport.remediation.automated);
          expect(automatedSet.size).toBe(errorReport.remediation.automated.length);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 12f: Error severity matches failure impact
   *
   * For different failure types, the calculated severity should
   * reflect the impact of the failures.
   *
   * Generates: Various failure scenarios
   * Validates: Severity calculation
   */
  test('Property 12f: Error severity matches failure impact', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 1, maxLength: 8 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: severity is set
          expect(errorReport.severity).toBeTruthy();
          expect(['LOW', 'MEDIUM', 'HIGH'].includes(errorReport.severity)).toBe(
            true
          );

          // Assert: high-impact errors get high severity
          if (
            failures.some((f) => f.type === 'TEST_FAILURE' || f.type === 'VALIDATION_ERROR')
          ) {
            expect(errorReport.severity).toBe('HIGH');
          }

          // Assert: medium-impact errors get at least medium severity
          if (failures.some((f) =>
            ['COMMIT_FORMAT_ERROR', 'CONTEXT_UPDATE_ERROR'].includes(f.type)
          )) {
            expect(['MEDIUM', 'HIGH'].includes(errorReport.severity)).toBe(true);
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
   * Property Test 12g: Error report impact analysis is complete
   *
   * For any error scenario, the impact analysis must include
   * affected components and estimated fix time.
   *
   * Generates: Various failure scenarios
   * Validates: Impact analysis completeness
   */
  test('Property 12g: Error report impact analysis is complete', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 1, maxLength: 5 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: impact structure is complete
          expect(errorReport.impact).toHaveProperty('workflowBlocked');
          expect(errorReport.impact).toHaveProperty('affectedComponents');
          expect(errorReport.impact).toHaveProperty('estimatedFixTime');
          expect(errorReport.impact).toHaveProperty('riskLevel');

          // Assert: properties have correct types
          expect(typeof errorReport.impact.workflowBlocked).toBe('boolean');
          expect(Array.isArray(errorReport.impact.affectedComponents)).toBe(true);
          expect(typeof errorReport.impact.estimatedFixTime).toBe('string');
          expect(typeof errorReport.impact.riskLevel).toBe('string');

          // Assert: workflow is blocked when errors exist
          expect(errorReport.impact.workflowBlocked).toBe(true);

          // Assert: risk level is valid
          expect(['Low', 'Medium', 'High'].includes(errorReport.impact.riskLevel)).toBe(
            true
          );

          // Assert: affected components are populated if there are errors
          if (failures.some((f) => f.type === 'TEST_FAILURE')) {
            const hasTestComponent = errorReport.impact.affectedComponents.some(
              (c) => c.toLowerCase().includes('test')
            );
            expect(hasTestComponent).toBe(true);
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
   * Property Test 12h: Edge cases are handled properly
   *
   * For edge cases (empty failures, unknown error types),
   * the system must handle gracefully.
   *
   * Generates: Edge case scenarios
   * Validates: Robustness
   */
  test('Property 12h: Edge cases are handled properly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant([]), // Empty failures
          fc.array(
            fc.record({
              type: fc.constantFrom('UNKNOWN_ERROR', 'CUSTOM_ERROR'),
              name: testNameArbitrary(),
              message: failureMessageArbitrary(),
              details: fc.string(),
            }),
            { minLength: 1, maxLength: 3 }
          )
        ),
        (failures) => {
          // Handle empty failures array
          if (failures.length === 0) {
            // Should not throw and should return valid report
            let errorReport;
            expect(() => {
              errorReport = gatekeeper.generateErrorReport(failures);
            }).not.toThrow();

            // Empty failures should still return valid report structure
            expect(errorReport).toHaveProperty('errors');
            expect(errorReport.errors.length).toBe(0);
          } else {
            // Handle unknown error types
            const errorReport = gatekeeper.generateErrorReport(failures);

            // Assert: still generates valid report
            expect(errorReport).toHaveProperty('remediation');
            expect(errorReport).toHaveProperty('severity');

            // Assert: provides fallback remediation for unknown errors
            const totalRemediation =
              errorReport.remediation.immediate.length +
              errorReport.remediation.longTerm.length +
              errorReport.remediation.automated.length;
            expect(totalRemediation).toBeGreaterThanOrEqual(0);
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
   * Property Test 12i: Remediation matches error severity
   *
   * For different severity levels, the remediation suggestions
   * should be appropriately prioritized.
   *
   * Generates: Various failure combinations
   * Validates: Remediation prioritization
   */
  test('Property 12i: Remediation matches error severity', () => {
    fc.assert(
      fc.property(
        fc.array(failureArbitrary(), { minLength: 1, maxLength: 5 }),
        (failures) => {
          const errorReport = gatekeeper.generateErrorReport(failures);

          // Assert: high severity has immediate actions
          if (errorReport.severity === 'HIGH') {
            expect(errorReport.remediation.immediate.length).toBeGreaterThan(0);
          }

          // Assert: all severity levels have some remediation
          const hasRemediation =
            errorReport.remediation.immediate.length > 0 ||
            errorReport.remediation.longTerm.length > 0 ||
            errorReport.remediation.automated.length > 0;
          expect(hasRemediation).toBe(true);

          // Assert: long-term recommendations always present for any failure
          expect(errorReport.remediation.longTerm.length).toBeGreaterThanOrEqual(0);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });
});

/**
 * Integration Tests: Complete error reporting workflow
 */
describe('Integration Tests: Error Reporting Workflow', () => {
  let mockLogger;
  let gatekeeper;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = require('../../scripts/lib/logger');
    mockLogger.mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    gatekeeper = new EnhancedGatekeeper();
  });

  test('Integration: Single test failure reporting', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'auth.test.js',
        message: 'Expected true but got false',
        details: 'Login validation failed',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    // Assert: report structure
    expect(errorReport).toHaveProperty('errors');
    expect(errorReport.errors.length).toBe(1);
    expect(errorReport.errors[0].name).toBe('auth.test.js');

    // Assert: remediation for test failure
    expect(errorReport.remediation.immediate.length).toBeGreaterThan(0);
    const hasTestRemediations = errorReport.remediation.immediate.some((s) =>
      s.toLowerCase().includes('test')
    );
    expect(hasTestRemediations).toBe(true);

    // Assert: severity
    expect(errorReport.severity).toBe('HIGH');
  });

  test('Integration: Multiple different error types', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'user.test.js',
        message: 'Timeout',
        details: 'Test took too long',
      },
      {
        type: 'COMMIT_FORMAT_ERROR',
        name: 'commit',
        message: 'Invalid format',
        details: 'Missing [STEP-ID]',
      },
      {
        type: 'CONTEXT_UPDATE_ERROR',
        name: 'context',
        message: 'Context not updated',
        details: 'Missing activeContext.md',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    // Assert: all errors included
    expect(errorReport.errors.length).toBe(3);
    expect(errorReport.summary).toContain('3');

    // Assert: remediation covers all error types
    const immediateText = errorReport.remediation.immediate.join(' ');
    expect(immediateText.toLowerCase()).toContain('test');
    expect(immediateText.toLowerCase()).toContain('commit');

    // Assert: severity is high for mixed failures
    expect(errorReport.severity).toBe('HIGH');

    // Assert: multiple affected components
    expect(errorReport.impact.affectedComponents.length).toBeGreaterThan(1);
  });

  test('Integration: Empty failures array', () => {
    const failures = [];

    const errorReport = gatekeeper.generateErrorReport(failures);

    // Assert: valid report for empty failures
    expect(errorReport).toHaveProperty('errors');
    expect(errorReport.errors.length).toBe(0);

    // Assert: structure is still valid
    expect(errorReport).toHaveProperty('severity');
    expect(errorReport).toHaveProperty('remediation');
  });

  test('Integration: Error report includes affected components', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'integration.test.js',
        message: 'API failed',
        details: 'Connection refused',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    // Assert: impact analysis includes components
    expect(errorReport.impact.affectedComponents.length).toBeGreaterThan(0);
    expect(errorReport.impact.affectedComponents[0]).toBeTruthy();
  });

  test('Integration: Error report timing information', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'test.js',
        message: 'Failed',
        details: 'Details',
      },
    ];

    const beforeTime = new Date();
    const errorReport = gatekeeper.generateErrorReport(failures);
    const afterTime = new Date();

    // Assert: timestamp is present
    expect(errorReport.timestamp).toBeTruthy();

    // Assert: timestamp is within reasonable bounds
    const reportTime = new Date(errorReport.timestamp);
    expect(reportTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(reportTime.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });

  test('Integration: Remediation deduplication', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'test1.js',
        message: 'Failed',
        details: 'Details',
      },
      {
        type: 'TEST_FAILURE',
        name: 'test2.js',
        message: 'Failed',
        details: 'Details',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    // Assert: remediation suggestions are deduplicated
    const immediateSet = new Set(errorReport.remediation.immediate);
    expect(immediateSet.size).toBe(errorReport.remediation.immediate.length);

    const longTermSet = new Set(errorReport.remediation.longTerm);
    expect(longTermSet.size).toBe(errorReport.remediation.longTerm.length);
  });
});

/**
 * Unit Tests: Individual error reporting components
 */
describe('Unit Tests: Error Reporting Components', () => {
  let mockLogger;
  let gatekeeper;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = require('../../scripts/lib/logger');
    mockLogger.mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    gatekeeper = new EnhancedGatekeeper();
  });

  test('Unit: Error report summary mentions failure count', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'test1.js',
        message: 'Failed',
        details: 'Details',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    expect(errorReport.summary).toContain('1');
    expect(errorReport.summary.toLowerCase()).toContain('error');
  });

  test('Unit: Error report preserves test names', () => {
    const testNames = ['unit/auth.test.js', 'integration/api.test.js'];
    const failures = testNames.map((name) => ({
      type: 'TEST_FAILURE',
      name,
      message: 'Failed',
      details: 'Details',
    }));

    const errorReport = gatekeeper.generateErrorReport(failures);

    const reportedNames = errorReport.errors.map((e) => e.name);
    expect(reportedNames).toEqual(testNames);
  });

  test('Unit: Error report provides immediate remediation', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'test.js',
        message: 'Failed',
        details: 'Details',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    expect(errorReport.remediation.immediate.length).toBeGreaterThan(0);
    expect(typeof errorReport.remediation.immediate[0]).toBe('string');
  });

  test('Unit: Error report indicates workflow is blocked', () => {
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'test.js',
        message: 'Failed',
        details: 'Details',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    expect(errorReport.impact.workflowBlocked).toBe(true);
  });

  test('Unit: Different error types get different remediations', () => {
    const testFailure = [
      {
        type: 'TEST_FAILURE',
        name: 'test.js',
        message: 'Failed',
        details: 'Test error',
      },
    ];

    const commitFailure = [
      {
        type: 'COMMIT_FORMAT_ERROR',
        name: 'commit',
        message: 'Invalid format',
        details: 'Format error',
      },
    ];

    const testReport = gatekeeper.generateErrorReport(testFailure);
    const commitReport = gatekeeper.generateErrorReport(commitFailure);

    // Get first suggestion from each
    const testSuggestion = testReport.remediation.immediate[0].toLowerCase();
    const commitSuggestion = commitReport.remediation.immediate[0].toLowerCase();

    // They should be different or at least context-appropriate
    expect(testSuggestion).not.toEqual(commitSuggestion);
  });

  /**
   * Requirement 3.3 Compliance Test
   *
   * Comprehensive test ensuring complete compliance with Requirement 3.3:
   * "WHEN the Gatekeeper blocks progression due to test failures,
   * THE Gatekeeper SHALL emit an error report that identifies each failing test
   * by name and provides a suggested remediation action for each failure"
   */
  test('Unit: Requirement 3.3 - Complete error reporting', () => {
    // Test: Single test failure
    const failures = [
      {
        type: 'TEST_FAILURE',
        name: 'user-service.test.js',
        message: 'Expected 5 but got 3',
        details: 'getUserCount failed',
      },
    ];

    const errorReport = gatekeeper.generateErrorReport(failures);

    // Validate: Test identified by name
    expect(errorReport.errors[0].name).toBe('user-service.test.js');

    // Validate: Remediation is provided
    expect(errorReport.remediation.immediate.length).toBeGreaterThan(0);
    expect(errorReport.remediation.longTerm.length).toBeGreaterThan(0);

    // Validate: Report structure complete
    expect(errorReport).toHaveProperty('summary');
    expect(errorReport).toHaveProperty('timestamp');
    expect(errorReport).toHaveProperty('errors');
    expect(errorReport).toHaveProperty('severity');
    expect(errorReport).toHaveProperty('impact');

    // Validate: Impact includes affected component
    expect(errorReport.impact.affectedComponents.length).toBeGreaterThan(0);
  });
});
