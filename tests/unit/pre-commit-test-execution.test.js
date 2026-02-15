/**
 * Property-Based Tests for Pre-commit Test Execution
 * **Feature: git-hooks-automation, Property 3: Pre-commit test execution**
 * **Validates: Requirements 1.3**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Pre-commit Test Execution Property Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mocks
        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');

        // Default mock implementations
        mockExecSync.mockReturnValue('Tests: 5 passed, 0 failed\nTime: 2.5s');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"test":"jest"}}');

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: true,
            enableContextValidation: false,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 3: Pre-commit test execution**
     * **Validates: Requirements 1.3**
     */
    test('should execute fast unit test suite and report results for any commit attempt', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 10 }),
            fc.integer({ min: 0, max: 50 }),
            fc.integer({ min: 0, max: 10 }),
            fc.float({ min: Math.fround(0.1), max: Math.fround(30.0) }),
            async (stagedFiles, passedTests, failedTests, duration) => {
                // Mock test output based on generated values
                const testOutput = `Tests: ${passedTests} passed, ${failedTests} failed\nTime: ${duration}s`;

                if (failedTests > 0) {
                    // Mock failing tests
                    const error = new Error('Tests failed');
                    error.stdout = testOutput;
                    mockExecSync.mockImplementationOnce(() => {
                        throw error;
                    });
                } else {
                    // Mock passing tests
                    mockExecSync.mockReturnValueOnce(testOutput);
                }

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: When pre-commit validation runs, system should execute fast unit test suite
                expect(result.results.testing).toBeDefined();
                expect(result.results.testing.status).toMatch(/^(passed|failed|warning|skipped)$/);

                // Property: Test execution should be attempted when testing is enabled
                if (orchestrator.config.enableTesting) {
                    expect(mockExecSync).toHaveBeenCalledWith(
                        expect.stringContaining('npm test'),
                        expect.objectContaining({
                            encoding: 'utf8',
                            stdio: 'pipe',
                            timeout: 30000
                        })
                    );

                    // Property: Test results should be reported
                    if (result.results.testing.status !== 'warning') {
                        expect(result.results.testing.testsRun).toBeDefined();
                        expect(typeof result.results.testing.testsRun).toBe('number');
                        expect(result.results.testing.testsRun).toBeGreaterThanOrEqual(0);
                    }

                    // Property: Test status should reflect actual test results
                    if (failedTests > 0) {
                        expect(result.results.testing.status).toBe('failed');
                        expect(result.results.testing.error).toBeDefined();
                    } else if (passedTests > 0) {
                        expect(result.results.testing.status).toBe('passed');
                        expect(result.results.testing.passed).toBe(passedTests);
                        expect(result.results.testing.failed).toBe(failedTests);
                    }

                    // Property: Duration should be captured
                    if (result.results.testing.duration !== undefined) {
                        expect(result.results.testing.duration).toBeGreaterThanOrEqual(0);
                    }
                }
            }
        ), { numRuns: 100 });
    });

    test('should handle missing test configuration gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 5 }),
            fc.constantFrom(
                null, // No package.json
                '{}', // Empty package.json
                '{"scripts":{}}', // No test script
                '{"scripts":{"test":"echo no tests"}}' // Different test command
            ),
            async (stagedFiles, packageJsonContent) => {
                // Mock different package.json scenarios
                if (packageJsonContent === null) {
                    mockFs.existsSync.mockReturnValue(false);
                } else {
                    mockFs.existsSync.mockReturnValue(true);
                    mockFs.readFileSync.mockReturnValue(packageJsonContent);
                }

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Missing test configuration should not crash the hook
                expect(result.results.testing).toBeDefined();

                // Property: Should handle missing configuration gracefully
                if (packageJsonContent === null || !JSON.parse(packageJsonContent || '{}').scripts?.test) {
                    expect(result.results.testing.status).toBe('warning');
                    expect(result.results.testing.testsRun).toBe(0);
                } else {
                    // Should attempt to run tests if configuration exists
                    expect(mockExecSync).toHaveBeenCalled();
                }
            }
        ), { numRuns: 50 });
    });

    test('should enforce timeout for fast test execution', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 3 }),
            async (stagedFiles) => {
                // Mock timeout scenario
                const timeoutError = new Error('Command timed out');
                timeoutError.code = 'ETIMEDOUT';
                mockExecSync.mockImplementationOnce(() => {
                    throw timeoutError;
                });

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Timeout should be enforced for fast execution
                expect(mockExecSync).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        timeout: 30000 // 30 second timeout
                    })
                );

                // Property: Timeout failures should be handled gracefully
                expect(result.results.testing.status).toBe('failed');
                expect(result.results.testing.error).toContain('timed out');
            }
        ), { numRuns: 20 });
    });

    test('should parse test output correctly for various formats', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 3 }),
            fc.record({
                passed: fc.integer({ min: 0, max: 100 }),
                failed: fc.integer({ min: 0, max: 20 }),
                duration: fc.float({ min: Math.fround(0.1), max: Math.fround(60.0) })
            }),
            async (stagedFiles, testMetrics) => {
                // Generate various Jest output formats
                const outputs = [
                    `Tests: ${testMetrics.passed} passed, ${testMetrics.failed} failed\nTime: ${testMetrics.duration}s`,
                    `Test Suites: 1 passed, 0 failed\nTests: ${testMetrics.passed} passed, ${testMetrics.failed} failed\nTime: ${testMetrics.duration}s`,
                    `✓ ${testMetrics.passed} tests passed\n✗ ${testMetrics.failed} tests failed\nDuration: ${testMetrics.duration}s`
                ];

                const testOutput = fc.sample(fc.constantFrom(...outputs), 1)[0];

                if (testMetrics.failed > 0) {
                    const error = new Error('Tests failed');
                    error.stdout = testOutput;
                    mockExecSync.mockImplementationOnce(() => {
                        throw error;
                    });
                } else {
                    mockExecSync.mockReturnValueOnce(testOutput);
                }

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Test output should be parsed correctly regardless of format
                if (result.results.testing.status === 'passed' || result.results.testing.status === 'failed') {
                    expect(result.results.testing.testsRun).toBeGreaterThanOrEqual(0);

                    // Property: Parsed metrics should be reasonable
                    if (result.results.testing.passed !== undefined) {
                        expect(result.results.testing.passed).toBeGreaterThanOrEqual(0);
                        expect(result.results.testing.passed).toBeLessThanOrEqual(result.results.testing.testsRun);
                    }

                    if (result.results.testing.failed !== undefined) {
                        expect(result.results.testing.failed).toBeGreaterThanOrEqual(0);
                        expect(result.results.testing.failed).toBeLessThanOrEqual(result.results.testing.testsRun);
                    }
                }
            }
        ), { numRuns: 75 });
    });

    test('should maintain performance metrics for test execution', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 5 }),
            fc.integer({ min: 1, max: 20 }),
            async (stagedFiles, testCount) => {
                // Mock successful test execution
                mockExecSync.mockReturnValue(`Tests: ${testCount} passed, 0 failed\nTime: 1.5s`);

                const initialMetrics = orchestrator.getMetrics();
                const initialExecutionCount = initialMetrics.executions.length;

                const result = await orchestrator.executePreCommit(stagedFiles);

                const finalMetrics = orchestrator.getMetrics();

                // Property: Execution metrics should be recorded
                expect(finalMetrics.executions.length).toBe(initialExecutionCount + 1);

                const lastExecution = finalMetrics.executions[finalMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('pre-commit');
                expect(lastExecution.duration).toBeGreaterThanOrEqual(0);
                expect(typeof lastExecution.success).toBe('boolean');
                expect(lastExecution.timestamp).toBeDefined();

                // Property: Performance threshold should be tracked
                expect(typeof lastExecution.performanceThresholdMet).toBe('boolean');

                // Property: Aggregate metrics should be updated
                expect(finalMetrics.averageDuration).toBeGreaterThanOrEqual(0);
                expect(finalMetrics.successRate).toBeGreaterThanOrEqual(0);
                expect(finalMetrics.successRate).toBeLessThanOrEqual(1);
            }
        ), { numRuns: 30 });
    });
});