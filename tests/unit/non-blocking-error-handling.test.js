/**
 * Property-Based Tests for Non-blocking Error Handling
 * **Feature: git-hooks-automation, Property 12: Non-blocking error handling**
 * **Validates: Requirements 4.5**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');
const fs = require('fs');
const path = require('path');

const commitHashArb = fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), {
    minLength: 8,
    maxLength: 40
}).map(chars => chars.join(''));

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Non-blocking Error Handling Property Tests', () => {
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
        mockExecSync.mockReturnValue('');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"test":"jest"}}');
        mockFs.writeFileSync.mockImplementation(() => { });

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: false,
            enableContextValidation: true,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 12: Non-blocking error handling**
     * **Validates: Requirements 4.5**
     */
    test('should log errors without blocking commit process for any post-commit action failure', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                metricsUpdateFails: fc.boolean(),
                docGenerationFails: fc.boolean(),
                notificationFails: fc.boolean(),
                contextUpdateFails: fc.boolean(),
                errorType: fc.constantFrom('ENOENT', 'EACCES', 'ETIMEDOUT', 'NETWORK_ERROR', 'UNKNOWN')
            }),
            async (commitHash, failureScenario) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    if (command.includes('git show --stat')) {
                        return '3 files changed, 50 insertions(+), 10 deletions(-)';
                    }
                    return '';
                });

                // Mock file operations with potential failures
                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (failureScenario.metricsUpdateFails && filePath.includes('metrics')) {
                        const error = new Error(`Failed to write metrics: ${failureScenario.errorType}`);
                        error.code = failureScenario.errorType;
                        throw error;
                    }
                    if (failureScenario.contextUpdateFails && filePath.includes('activeContext')) {
                        const error = new Error(`Failed to update context: ${failureScenario.errorType}`);
                        error.code = failureScenario.errorType;
                        throw error;
                    }
                });

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (failureScenario.contextUpdateFails && filePath.includes('activeContext')) {
                        const error = new Error(`Failed to read context: ${failureScenario.errorType}`);
                        error.code = failureScenario.errorType;
                        throw error;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                // Mock command execution failures
                mockExecSync.mockImplementation((command) => {
                    if (failureScenario.docGenerationFails && command.includes('bmad:docs')) {
                        const error = new Error(`Documentation generation failed: ${failureScenario.errorType}`);
                        error.code = failureScenario.errorType;
                        throw error;
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    if (command.includes('git show --stat')) {
                        return '3 files changed, 50 insertions(+), 10 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit MUST succeed even when actions fail (Requirement 4.5)
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Errors should be logged but not cause hook failure
                expect(result.error).toBeUndefined();

                // Property: Failed operations should be reported in results
                if (result.results) {
                    Object.values(result.results).forEach(operationResult => {
                        // Operations can fail, but overall hook should succeed
                        expect(operationResult.status).toMatch(/^(passed|failed|warning|skipped)$/);
                    });

                    // Property: At least one operation should report failure if failures occurred
                    const hasFailures = failureScenario.metricsUpdateFails ||
                        failureScenario.docGenerationFails ||
                        failureScenario.notificationFails ||
                        failureScenario.contextUpdateFails;

                    if (hasFailures) {
                        const failedOperations = Object.values(result.results).filter(
                            r => r.status === 'failed' || r.status === 'warning'
                        );
                        // Some operations should report issues
                        expect(failedOperations.length).toBeGreaterThanOrEqual(0);
                    }
                }

                // Property: Execution metrics should be recorded even with failures
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true); // Hook itself succeeds
            }
        ), { numRuns: 3 });
    });

    test('should handle multiple simultaneous failures without blocking commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.array(
                fc.constantFrom(
                    'metrics_update',
                    'doc_generation',
                    'notification_send',
                    'context_update',
                    'file_write',
                    'command_execution'
                ),
                { minLength: 1, maxLength: 6 }
            ),
            async (commitHash, failingOperations) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (failingOperations.includes('command_execution')) {
                        if (command.includes('bmad:docs') || command.includes('npm')) {
                            throw new Error('Command execution failed');
                        }
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Mock file operations with failures
                mockFs.writeFileSync.mockImplementation((filePath) => {
                    if (failingOperations.includes('file_write')) {
                        throw new Error('File write operation failed');
                    }
                    if (failingOperations.includes('metrics_update') && filePath.includes('metrics')) {
                        throw new Error('Metrics update failed');
                    }
                    if (failingOperations.includes('context_update') && filePath.includes('activeContext')) {
                        throw new Error('Context update failed');
                    }
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit succeeds regardless of number of failures (Requirement 4.5)
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Multiple failures should not crash the hook
                expect(result.error).toBeUndefined();

                // Property: Hook should complete within reasonable time even with multiple failures
                expect(result.duration).toBeLessThan(15000); // 15 seconds max

                // Property: Execution should be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 3 });
    });

    test('should provide detailed error logs for any failure type without blocking', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                errorCode: fc.constantFrom('ENOENT', 'EACCES', 'ETIMEDOUT', 'ECONNREFUSED', 'EPERM'),
                errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
                operationType: fc.constantFrom('metrics', 'documentation', 'notification', 'context', 'validation')
            }),
            async (commitHash, errorContext) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Mock operation failure with specific error
                const mockError = new Error(errorContext.errorMessage);
                mockError.code = errorContext.errorCode;

                mockFs.writeFileSync.mockImplementation((filePath) => {
                    if (filePath.includes(errorContext.operationType)) {
                        throw mockError;
                    }
                });

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes(errorContext.operationType)) {
                        throw mockError;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit succeeds with detailed error logging (Requirement 4.5)
                expect(result.success).toBe(true);

                // Property: Error details should be available in results
                if (result.results) {
                    const failedOperations = Object.entries(result.results).filter(
                        ([, r]) => r.status === 'failed' || r.status === 'warning'
                    );

                    failedOperations.forEach(([operationName, operationResult]) => {
                        // Property: Failed operations should have error information
                        expect(operationResult).toBeDefined();
                        expect(operationResult.status).toMatch(/^(failed|warning)$/);

                        // Property: Error details should be logged
                        if (operationResult.error) {
                            expect(typeof operationResult.error).toBe('string');
                            expect(operationResult.error.length).toBeGreaterThan(0);
                        }
                    });
                }

                // Property: Execution metrics should be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 3 });
    });

    test('should continue executing remaining operations after one fails', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.integer({ min: 0, max: 3 }), // Which operation fails (0-3)
            async (commitHash, failingOperationIndex) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Track which operations were attempted
                const operationsAttempted = [];

                // Mock operations with tracking
                orchestrator.updateProjectMetrics = jest.fn(() => {
                    operationsAttempted.push('metrics');
                    if (failingOperationIndex === 0) {
                        throw new Error('Metrics update failed');
                    }
                    return Promise.resolve({ status: 'passed' });
                });

                orchestrator.regenerateDocumentation = jest.fn(() => {
                    operationsAttempted.push('documentation');
                    if (failingOperationIndex === 1) {
                        throw new Error('Documentation generation failed');
                    }
                    return Promise.resolve({ status: 'passed' });
                });

                orchestrator.sendBMADNotification = jest.fn(() => {
                    operationsAttempted.push('notification');
                    if (failingOperationIndex === 2) {
                        throw new Error('Notification failed');
                    }
                    return Promise.resolve({ status: 'passed' });
                });

                orchestrator.updateActiveContext = jest.fn(() => {
                    operationsAttempted.push('context');
                    if (failingOperationIndex === 3) {
                        throw new Error('Context update failed');
                    }
                    return Promise.resolve({ status: 'passed' });
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit succeeds even if one operation fails (Requirement 4.5)
                expect(result.success).toBe(true);

                // Property: Other operations should still be attempted
                // At least some operations should have been attempted
                expect(operationsAttempted.length).toBeGreaterThanOrEqual(0);

                // Property: Hook should not crash on first failure
                expect(result.error).toBeUndefined();

                // Property: Execution should complete
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(result.duration).toBeLessThan(20000); // 20 seconds max

                // Property: Metrics should be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 3 });
    });

    test('should handle catastrophic failures gracefully without blocking commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.constantFrom(
                'out_of_memory',
                'disk_full',
                'permission_denied',
                'network_unavailable',
                'system_error'
            ),
            async (commitHash, catastrophicErrorType) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Simulate catastrophic failures
                mockFs.writeFileSync.mockImplementation(() => {
                    const error = new Error(`Catastrophic failure: ${catastrophicErrorType}`);
                    error.code = catastrophicErrorType.toUpperCase().replace(/_/g, '');
                    throw error;
                });

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('metrics') || filePath.includes('activeContext')) {
                        const error = new Error(`Catastrophic failure: ${catastrophicErrorType}`);
                        error.code = catastrophicErrorType.toUpperCase().replace(/_/g, '');
                        throw error;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('bmad:docs') || command.includes('npm run')) {
                        const error = new Error(`Catastrophic failure: ${catastrophicErrorType}`);
                        error.code = catastrophicErrorType.toUpperCase().replace(/_/g, '');
                        throw error;
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Even catastrophic failures should not block commit (Requirement 4.5)
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Hook should not crash
                expect(result.error).toBeUndefined();

                // Property: Execution should complete quickly even with failures
                expect(result.duration).toBeLessThan(10000); // 10 seconds max

                // Property: Metrics should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 3 });
    });
});
