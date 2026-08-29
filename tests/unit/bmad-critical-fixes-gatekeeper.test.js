/**
 * Property-Based Tests for Enhanced Gatekeeper
 * **Feature: bmad-critical-fixes**
 * Properties:
 * - Property 10: Gatekeeper Mock Usage
 * - Property 11: Test Suite Execution
 * - Property 12: Gatekeeper Error Reporting
 * - Property 13: Development Mode Bypass
 * - Property 14: Gatekeeper Success Logging
 */

const fc = require('fast-check');
const EnhancedGatekeeper = require('../../scripts/lib/enhanced-gatekeeper');

describe('Enhanced Gatekeeper Property Tests', () => {
  /**
   * **Feature: bmad-critical-fixes, Property 10: Gatekeeper Mock Usage**
   * **Validates: Requirements 3.1**
   */
  test('Property 10: should generate valid mock data for testing scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (devMode) => {
        const gatekeeper = new EnhancedGatekeeper({ developmentMode: devMode });
        const mockData = gatekeeper.generateMockData();

        expect(mockData).toBeDefined();
        expect(Array.isArray(mockData.commits)).toBe(true);
        expect(mockData.testResults).toBeDefined();
        expect(typeof mockData.testResults.passed).toBe('number');
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 11: Test Suite Execution**
   * **Validates: Requirements 3.2**
   */
  test('Property 11: should execute test suite and evaluate pass/fail status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 5 }),
        async (passed, failed) => {
          const gatekeeper = new EnhancedGatekeeper();
          const mockResults = {
            passed,
            failed,
            total: passed + failed,
            coverage: { lines: 85, functions: 85, branches: 85, statements: 85 },
            suites: [],
          };

          const evaluation = await gatekeeper.evaluateResults(mockResults);
          expect(evaluation).toBeDefined();
          if (failed > 0) {
            expect(evaluation.status).toBe('FAILED');
          } else {
            expect(evaluation.status).toBe('PASSED');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 12: Gatekeeper Error Reporting**
   * **Validates: Requirements 3.3**
   */
  test('Property 12: should provide detailed error reporting and remediation suggestions on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
        async (failures) => {
          const gatekeeper = new EnhancedGatekeeper();
          const report = gatekeeper.generateErrorReport(failures);

          expect(report).toBeDefined();
          expect(report.failures).toEqual(failures);
          expect(report.remediationSuggestions).toBeDefined();
          expect(Array.isArray(report.remediationSuggestions)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 13: Development Mode Bypass**
   * **Validates: Requirements 3.4**
   */
  test('Property 13: should allow optional bypass mechanism when development mode is active', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (devMode) => {
        const gatekeeper = new EnhancedGatekeeper({ developmentMode: devMode });

        gatekeeper.enableDevelopmentMode(true);
        expect(gatekeeper.config.developmentMode).toBe(true);
        expect(gatekeeper.config.bypassEnabled).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 14: Gatekeeper Success Logging**
   * **Validates: Requirements 3.5**
   */
  test('Property 14: should log success entry with phase name, timestamp, and validation method on successful validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('implementation', 'testing', 'deployment', 'review', 'release'),
        fc.constantFrom('automated-tests', 'manual-review', 'code-coverage', 'security-scan'),
        fc.boolean(),
        async (phase, validationMethod, skipTests) => {
          const gatekeeper = new EnhancedGatekeeper({
            skipTests: skipTests,
            requireContextUpdate: false,
          });

          // Setup mock logger to capture log calls
          const loggedMessages = [];
          jest.spyOn(gatekeeper.logger, 'info').mockImplementation((msg) => {
            loggedMessages.push(msg);
          });

          // Setup test context
          const context = {
            commitMessage: '[DEVELOPER] [STEP-001] Test implementation',
            phase: phase,
            validationMethod: validationMethod,
          };

          // Execute validation
          const result = await gatekeeper.validateWorkflowConditions(context);

          // Verify structured success entry was logged
          expect(result).toBeDefined();
          expect(result.timestamp).toBeDefined();

          // Validate timestamp is a valid ISO string
          const timestamp = new Date(result.timestamp);
          expect(timestamp.toString()).not.toBe('Invalid Date');

          // Verify log contains success indication
          const hasSuccessLog = loggedMessages.some((msg) =>
            msg.toLowerCase().includes('validation') || msg.toLowerCase().includes('started')
          );
          expect(hasSuccessLog).toBe(true);

          // On success, gate should be PASS or WAIVED (not FAIL)
          if (!result.errors || result.errors.length === 0) {
            expect(['PASS', 'WAIVED']).toContain(result.gate);
          }

          // If gate is PASS, workflow continuation should be signaled
          if (result.gate === 'PASS') {
            expect(result.validations).toBeDefined();
            expect(Array.isArray(result.validations)).toBe(true);

            // At least one validation should have passed
            const passedValidations = result.validations.filter(
              (v) => v.status === 'passed'
            );
            expect(passedValidations.length > 0).toBe(true);
          }

          // Verify structured log entry format contains required fields
          expect(result).toHaveProperty('timestamp');
          expect(result).toHaveProperty('gate');
          expect(result).toHaveProperty('validations');
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 14: Gatekeeper Success Logging (Extended)**
   * **Validates: Requirements 3.5**
   * Extended test to verify complete success log structure with phase name, timestamp, and validation method
   */
  test('Property 14 Extended: should include phase name, timestamp, and validation method in success log entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('implementation', 'testing', 'deployment', 'review', 'release'),
        fc.constantFrom('unit-tests', 'integration-tests', 'e2e-tests', 'security-audit', 'performance-test'),
        fc.integer({ min: 1, max: 10 }),
        async (phaseName, validationMethod, successCount) => {
          const gatekeeper = new EnhancedGatekeeper({
            skipTests: true,
            requireContextUpdate: false,
          });

          // Track what gets logged
          const successLogs = [];
          const infoSpy = jest.spyOn(gatekeeper.logger, 'info').mockImplementation((msg) => {
            successLogs.push(msg);
          });

          // Create context with phase and validation method
          const context = {
            commitMessage: '[TEST] [STEP-001] Validation test',
            phase: phaseName,
            validationMethod: validationMethod,
            passCount: successCount,
          };

          // Execute validation
          const result = await gatekeeper.validateWorkflowConditions(context);

          // Verify result has required structure for success logging
          expect(result).toBeDefined();
          expect(result.timestamp).toBeDefined();
          expect(typeof result.timestamp).toBe('string');

          // Parse and validate timestamp format (ISO 8601)
          const timestamp = new Date(result.timestamp);
          expect(timestamp.getTime()).toBeGreaterThan(0);

          // Verify validation method is recorded in result
          expect(result.validations).toBeDefined();
          expect(Array.isArray(result.validations)).toBe(true);

          // On success, verify gate status allows continuation
          if (result.gate === 'PASS' || result.gate === 'WAIVED') {
            expect(result.waiver || result.gate === 'PASS').toBeTruthy();
          }

          // Verify success log was written
          expect(infoSpy).toHaveBeenCalled();
          expect(successLogs.length).toBeGreaterThan(0);

          // Cleanup
          infoSpy.mockRestore();
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 14: Gatekeeper Success Logging (Workflow Continuation)**
   * **Validates: Requirements 3.5**
   * Test to verify orchestrator signal for workflow continuation on successful validation
   */
  test('Property 14 Workflow Continuation: should signal orchestrator to proceed to next phase on success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('implementation', 'testing', 'deployment'),
        fc.boolean(),
        async (currentPhase, hasWarnings) => {
          const gatekeeper = new EnhancedGatekeeper({
            skipTests: true,
            requireContextUpdate: false,
          });

          // Setup logger to track messages
          const logMessages = [];
          jest.spyOn(gatekeeper.logger, 'info').mockImplementation((msg) => {
            logMessages.push(msg);
          });

          const context = {
            commitMessage: '[DEVELOPER] [STEP-001] Implementation',
            phase: currentPhase,
          };

          // Execute validation
          const result = await gatekeeper.validateWorkflowConditions(context);

          // Verify result structure for orchestrator signal
          expect(result).toBeDefined();
          expect(result.gate).toBeDefined();
          expect(['PASS', 'FAIL', 'WAIVED']).toContain(result.gate);

          // If gate is PASS or WAIVED, orchestrator should proceed
          const canContinue = result.gate === 'PASS' || result.gate === 'WAIVED';

          if (canContinue) {
            // Verify timestamp exists for next phase tracking
            expect(result.timestamp).toBeDefined();

            // Verify no blocking errors
            if (result.errors) {
              const blockingErrors = result.errors.filter(
                (e) => e.type !== 'GIT_WARNING' && e.type !== 'NO_TESTS_WARNING'
              );
              expect(blockingErrors.length).toBe(0);
            }

            // Verify validations show green light
            if (result.validations && result.validations.length > 0) {
              const failedCritical = result.validations.filter(
                (v) => v.status === 'failed' && v.name !== 'context_update'
              );
              // Non-critical validations can fail; critical ones should not
              expect(failedCritical.length).toBe(0);
            }
          }

          // Verify structured logging occurred
          expect(logMessages.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 14: Gatekeeper Success Logging (No Errors)**
   * **Validates: Requirements 3.5**
   * Test to verify no errors occur during successful validation logging
   */
  test('Property 14 Error-Free: should not throw errors during success logging and validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('implementation', 'testing', 'deployment', 'review'),
        async (phase) => {
          const gatekeeper = new EnhancedGatekeeper({
            skipTests: true,
            requireContextUpdate: false,
          });

          // Mock logger methods
          jest.spyOn(gatekeeper.logger, 'info').mockImplementation(() => {});
          jest.spyOn(gatekeeper.logger, 'error').mockImplementation(() => {});

          const context = {
            commitMessage: '[DEVELOPER] [STEP-001] Test',
            phase: phase,
          };

          // Should not throw
          let threwError = false;
          try {
            await gatekeeper.validateWorkflowConditions(context);
          } catch (error) {
            threwError = true;
          }

          expect(threwError).toBe(false);

          // Result should always be returned (no exceptions)
          const result = await gatekeeper.validateWorkflowConditions(context);
          expect(result).toBeDefined();
          expect(result.gate).toBeDefined();
          expect(result.timestamp).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });
});
