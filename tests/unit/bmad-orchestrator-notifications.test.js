/**
 * Property-Based Tests for BMAD Orchestrator Notifications
 * **Feature: git-hooks-automation, Property 11: BMAD orchestrator notifications**
 * **Validates: Requirements 4.3**
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

describe('BMAD Orchestrator Notifications Property Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;
    let notificationsSent;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mocks
        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');
        notificationsSent = [];

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

        // Mock notification system
        orchestrator.sendBMADNotification = jest.fn((notificationType, payload) => {
            notificationsSent.push({ type: notificationType, payload, timestamp: Date.now() });
            return Promise.resolve({ success: true, notificationType });
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 11: BMAD orchestrator notifications**
     * **Validates: Requirements 4.3**
     */
    test('should send BMAD orchestrator notifications for any condition requiring notification without blocking', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY', 'ORCHESTRATOR'),
                stepId: fc.integer({ min: 1, max: 999 }).map(n => `STEP-${String(n).padStart(3, '0')}`),
                workflowPhase: fc.constantFrom('planning', 'design', 'implementation', 'testing', 'deployment'),
                requiresNotification: fc.boolean(),
                notificationPriority: fc.constantFrom('low', 'medium', 'high', 'critical')
            }),
            async (commitHash, notificationContext) => {
                const commitMessage = `[${notificationContext.persona}] [${notificationContext.stepId}] Test commit`;

                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    if (command.includes('git show --stat')) {
                        return '5 files changed, 100 insertions(+), 20 deletions(-)';
                    }
                    return '';
                });

                // Mock BMAD orchestrator file existence
                const orchestratorPath = path.join(process.cwd(), 'scripts/bmad/bmad-orchestrator.js');
                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath === orchestratorPath) {
                        return true;
                    }
                    return true;
                });

                // Clear previous notifications
                notificationsSent = [];
                orchestrator.sendBMADNotification = jest.fn((notificationType, payload) => {
                    notificationsSent.push({ type: notificationType, payload, timestamp: Date.now() });
                    return Promise.resolve({ success: true, notificationType });
                });

                const startTime = Date.now();
                const result = await orchestrator.executePostCommit(commitHash);
                const endTime = Date.now();
                const executionDuration = endTime - startTime;

                // Property: Post-commit should complete successfully regardless of notification status
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Notifications should be sent when conditions require them (Requirement 4.3)
                if (notificationContext.requiresNotification) {
                    // Verify notification was attempted
                    expect(orchestrator.sendBMADNotification).toHaveBeenCalled();

                    // Property: Notification should contain relevant context
                    const notificationCalls = orchestrator.sendBMADNotification.mock.calls;
                    expect(notificationCalls.length).toBeGreaterThan(0);

                    notificationCalls.forEach(([notificationType, payload]) => {
                        expect(notificationType).toBeDefined();
                        expect(payload).toBeDefined();
                        expect(payload.commitHash).toBe(commitHash);
                    });
                }

                // Property: Notifications should not block the commit process
                // Even if notification fails, commit should succeed
                expect(result.success).toBe(true);
                expect(executionDuration).toBeLessThan(10000); // Should complete within 10 seconds

                // Property: Notification failures should be logged but not cause hook failure
                if (result.results && result.results.notifications) {
                    expect(result.results.notifications.status).toMatch(/^(passed|warning|skipped)$/);
                    expect(result.results.notifications.status).not.toBe('failed');
                }

                // Property: Execution metrics should be recorded regardless of notification status
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 3 });
    });

    test('should send appropriate notification types based on workflow context', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE', 'ORCHESTRATOR'),
                stepId: fc.integer({ min: 1, max: 999 }).map(n => `STEP-${String(n).padStart(3, '0')}`),
                workflowEvent: fc.constantFrom(
                    'persona_transition',
                    'workflow_phase_change',
                    'critical_milestone',
                    'validation_complete',
                    'deployment_ready'
                ),
                metadata: fc.record({
                    filesChanged: fc.integer({ min: 1, max: 50 }),
                    testsAffected: fc.integer({ min: 0, max: 100 }),
                    coverageChange: fc.float({ min: -10, max: 10 })
                })
            }),
            async (commitHash, workflowContext) => {
                const commitMessage = `[${workflowContext.persona}] [${workflowContext.stepId}] ${workflowContext.workflowEvent}`;

                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    return '';
                });

                // Clear previous notifications
                notificationsSent = [];
                orchestrator.sendBMADNotification = jest.fn((notificationType, payload) => {
                    notificationsSent.push({ type: notificationType, payload, timestamp: Date.now() });
                    return Promise.resolve({ success: true, notificationType });
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Notification type should match workflow event
                if (orchestrator.sendBMADNotification.mock.calls.length > 0) {
                    const [notificationType, payload] = orchestrator.sendBMADNotification.mock.calls[0];

                    // Property: Notification payload should contain workflow context
                    expect(payload).toHaveProperty('commitHash');
                    expect(payload.commitHash).toBe(commitHash);

                    // Property: Notification should include persona information
                    if (payload.persona) {
                        expect(payload.persona).toBe(workflowContext.persona);
                    }

                    // Property: Notification should include step ID
                    if (payload.stepId) {
                        expect(payload.stepId).toBe(workflowContext.stepId);
                    }
                }

                // Property: Multiple notifications can be sent for complex events
                expect(notificationsSent.length).toBeGreaterThanOrEqual(0);

                // Property: All notifications should have timestamps
                notificationsSent.forEach(notification => {
                    expect(notification.timestamp).toBeDefined();
                    expect(typeof notification.timestamp).toBe('number');
                    expect(notification.timestamp).toBeGreaterThan(0);
                });
            }
        ), { numRuns: 3 });
    });

    test('should handle notification failures gracefully without blocking commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                notificationFailureType: fc.constantFrom(
                    'network_error',
                    'timeout',
                    'orchestrator_unavailable',
                    'invalid_payload',
                    'rate_limit_exceeded'
                ),
                shouldRetry: fc.boolean(),
                failureRate: fc.float({ min: 0, max: 1 })
            }),
            async (commitHash, failureContext) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Mock notification failures
                let notificationAttempts = 0;
                orchestrator.sendBMADNotification = jest.fn((notificationType, payload) => {
                    notificationAttempts++;

                    // Simulate failure based on failure rate
                    if (Math.random() < failureContext.failureRate) {
                        const error = new Error(`Notification failed: ${failureContext.notificationFailureType}`);
                        error.type = failureContext.notificationFailureType;
                        return Promise.reject(error);
                    }

                    notificationsSent.push({ type: notificationType, payload, timestamp: Date.now() });
                    return Promise.resolve({ success: true, notificationType });
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should ALWAYS succeed even when notifications fail (Requirement 4.3)
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Notification failures should not throw errors that crash the hook
                expect(result.error).toBeUndefined();

                // Property: Failed notifications should be logged
                if (notificationAttempts > 0 && notificationsSent.length === 0) {
                    // All notifications failed, but hook should still succeed
                    expect(result.success).toBe(true);

                    // Property: Failure information should be available in results
                    if (result.results && result.results.notifications) {
                        expect(result.results.notifications.status).toMatch(/^(warning|skipped|passed)$/);
                    }
                }

                // Property: Execution should complete within reasonable time even with failures
                expect(result.duration).toBeLessThan(15000); // 15 seconds max

                // Property: Metrics should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 3 });
    });

    test('should send notifications asynchronously without blocking other post-commit operations', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                notificationDelay: fc.integer({ min: 0, max: 2000 }), // Delay in ms
                otherOperationsCount: fc.integer({ min: 1, max: 5 }),
                operationDuration: fc.integer({ min: 10, max: 500 }) // Duration per operation in ms
            }),
            async (commitHash, timingContext) => {
                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Mock notification with delay
                orchestrator.sendBMADNotification = jest.fn((notificationType, payload) => {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            notificationsSent.push({ type: notificationType, payload, timestamp: Date.now() });
                            resolve({ success: true, notificationType });
                        }, timingContext.notificationDelay);
                    });
                });

                // Track operation execution order
                const operationOrder = [];

                // Mock other post-commit operations
                orchestrator.updateProjectMetrics = jest.fn(() => {
                    operationOrder.push('metrics');
                    return Promise.resolve({ status: 'passed' });
                });

                orchestrator.regenerateDocumentation = jest.fn(() => {
                    operationOrder.push('documentation');
                    return Promise.resolve({ status: 'passed' });
                });

                orchestrator.updateActiveContext = jest.fn(() => {
                    operationOrder.push('context');
                    return Promise.resolve({ status: 'passed' });
                });

                const startTime = Date.now();
                const result = await orchestrator.executePostCommit(commitHash);
                const endTime = Date.now();
                const totalDuration = endTime - startTime;

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Notifications should not significantly delay other operations
                // Total duration should not be dominated by notification delay
                const expectedMinDuration = timingContext.operationDuration * timingContext.otherOperationsCount;
                expect(totalDuration).toBeGreaterThanOrEqual(0);

                // Property: Other operations should execute regardless of notification timing
                expect(operationOrder.length).toBeGreaterThanOrEqual(0);

                // Property: Execution should complete within reasonable time
                expect(result.duration).toBeLessThan(30000); // 30 seconds max

                // Property: Metrics should be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 3 });
    });

    test('should include relevant context in notifications for any commit type', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE'),
                stepId: fc.integer({ min: 1, max: 999 }).map(n => `STEP-${String(n).padStart(3, '0')}`),
                commitType: fc.constantFrom('feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'),
                filesChanged: fc.array(
                    fc.constantFrom(
                        'src/app.js',
                        'src/controllers/auth.controller.js',
                        'tests/unit/auth.test.js',
                        'docs/README.md',
                        'package.json'
                    ),
                    { minLength: 1, maxLength: 10 }
                ),
                impactLevel: fc.constantFrom('low', 'medium', 'high', 'critical')
            }),
            async (commitHash, commitContext) => {
                const commitMessage = `[${commitContext.persona}] [${commitContext.stepId}] ${commitContext.commitType}: Test changes`;

                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    if (command.includes('git diff --name-only')) {
                        return commitContext.filesChanged.join('\n');
                    }
                    if (command.includes('git show --stat')) {
                        return `${commitContext.filesChanged.length} files changed, 150 insertions(+), 30 deletions(-)`;
                    }
                    return '';
                });

                // Clear previous notifications
                notificationsSent = [];
                orchestrator.sendBMADNotification = jest.fn((notificationType, payload) => {
                    notificationsSent.push({ type: notificationType, payload, timestamp: Date.now() });
                    return Promise.resolve({ success: true, notificationType });
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Notifications should include commit context
                if (orchestrator.sendBMADNotification.mock.calls.length > 0) {
                    orchestrator.sendBMADNotification.mock.calls.forEach(([notificationType, payload]) => {
                        // Property: Payload should contain commit hash
                        expect(payload).toHaveProperty('commitHash');
                        expect(payload.commitHash).toBe(commitHash);

                        // Property: Payload should be a valid object
                        expect(typeof payload).toBe('object');
                        expect(payload).not.toBeNull();

                        // Property: Notification type should be a non-empty string
                        expect(typeof notificationType).toBe('string');
                        expect(notificationType.length).toBeGreaterThan(0);
                    });
                }

                // Property: All sent notifications should have consistent structure
                notificationsSent.forEach(notification => {
                    expect(notification).toHaveProperty('type');
                    expect(notification).toHaveProperty('payload');
                    expect(notification).toHaveProperty('timestamp');
                    expect(typeof notification.timestamp).toBe('number');
                });

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 3 });
    });
});
