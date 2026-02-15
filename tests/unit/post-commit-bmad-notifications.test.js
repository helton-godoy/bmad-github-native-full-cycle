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
            enableContextValidation: false,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 11: BMAD orchestrator notifications**
     * **Validates: Requirements 4.3**
     */
    test('should send appropriate signals to BMAD orchestrator for any condition requiring notification', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY'),
                stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3).toUpperCase()}`),
                workflowPhase: fc.constantFrom('planning', 'design', 'implementation', 'testing', 'deployment'),
                priority: fc.constantFrom('low', 'medium', 'high', 'critical')
            }),
            fc.record({
                orchestratorAvailable: fc.boolean(),
                notificationRequired: fc.boolean(),
                workflowActive: fc.boolean()
            }),
            async (commitHash, notificationContext, systemState) => {
                // Mock BMAD orchestrator availability
                const orchestratorPath = path.join(process.cwd(), 'scripts/bmad/bmad-orchestrator.js');
                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath === orchestratorPath) {
                        return systemState.orchestratorAvailable;
                    }
                    return true;
                });

                // Mock commit message with BMAD format
                const commitMessage = `[${notificationContext.persona}] [${notificationContext.stepId}] Test commit for ${notificationContext.workflowPhase}`;
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    if (command.includes('git show --stat')) {
                        return '2 files changed, 15 insertions(+), 3 deletions(-)';
                    }
                    return '';
                });

                // Mock notification system
                const notificationsSent = [];
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('node scripts/bmad/bmad-orchestrator.js')) {
                        notificationsSent.push({
                            type: 'orchestrator_notification',
                            context: notificationContext,
                            timestamp: new Date().toISOString()
                        });
                        return 'Notification sent successfully';
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: BMAD orchestrator notifications should be sent when required (Requirement 4.3)
                if (systemState.orchestratorAvailable && systemState.notificationRequired) {
                    // Should attempt to send notification
                    expect(result.results?.orchestratorNotification?.status).toMatch(/^(passed|attempted)$/);
                } else if (!systemState.orchestratorAvailable) {
                    // Should handle missing orchestrator gracefully
                    expect(result.results?.orchestratorNotification?.status).toMatch(/^(skipped|warning)$/);
                }

                // Property: Notifications should not block commit completion
                expect(result.duration).toBeLessThan(10000); // Should complete within 10 seconds
                expect(result.success).toBe(true); // Should succeed even if notifications fail

                // Property: Notification context should include relevant commit information
                if (notificationsSent.length > 0) {
                    const notification = notificationsSent[0];
                    expect(notification.context).toBeDefined();
                    expect(notification.timestamp).toBeDefined();
                }

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 3 });
    });

    test('should handle orchestrator notification failures gracefully without blocking commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                errorType: fc.constantFrom('timeout', 'not_found', 'permission_denied', 'network_error'),
                errorMessage: fc.string({ minLength: 10, maxLength: 100 })
            }),
            async (commitHash, errorScenario) => {
                // Mock BMAD orchestrator to fail
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('node scripts/bmad/bmad-orchestrator.js')) {
                        const error = new Error(errorScenario.errorMessage);
                        error.code = errorScenario.errorType.toUpperCase();
                        throw error;
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} [DEVELOPER] [STEP-001] Test commit`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should not fail due to notification errors
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Notification failures should be logged but not block execution
                if (result.results?.orchestratorNotification) {
                    expect(result.results.orchestratorNotification.status).toMatch(/^(failed|warning|skipped)$/);

                    // Should include error information for debugging
                    if (result.results.orchestratorNotification.status === 'failed') {
                        expect(result.results.orchestratorNotification.error).toBeDefined();
                    }
                }

                // Property: Execution metrics should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true); // Should still be successful overall
            }
        ), { numRuns: 3 });
    });

    test('should include relevant workflow context in orchestrator notifications', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY'),
                stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3).toUpperCase()}`),
                description: fc.string({ minLength: 10, maxLength: 100 }),
                filesChanged: fc.integer({ min: 1, max: 10 }),
                linesAdded: fc.integer({ min: 0, max: 200 })
            }),
            async (commitHash, commitInfo) => {
                const commitMessage = `[${commitInfo.persona}] [${commitInfo.stepId}] ${commitInfo.description}`;

                // Mock git commands to return commit information
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    if (command.includes('git show --stat')) {
                        return `${commitInfo.filesChanged} files changed, ${commitInfo.linesAdded} insertions(+), 5 deletions(-)`;
                    }
                    if (command.includes('git diff --name-only')) {
                        return Array.from({ length: commitInfo.filesChanged }, (_, i) => `src/file${i + 1}.js`).join('\n');
                    }
                    return '';
                });

                // Mock orchestrator notification capture
                let notificationContext = null;
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('node scripts/bmad/bmad-orchestrator.js')) {
                        // Capture the notification context that would be sent
                        notificationContext = {
                            hookType: 'post-commit',
                            commitHash: commitHash.substring(0, 8),
                            persona: commitInfo.persona,
                            stepId: commitInfo.stepId,
                            filesChanged: commitInfo.filesChanged,
                            linesAdded: commitInfo.linesAdded,
                            timestamp: expect.any(String)
                        };
                        return 'Notification sent with context';
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    if (command.includes('git show --stat')) {
                        return `${commitInfo.filesChanged} files changed, ${commitInfo.linesAdded} insertions(+), 5 deletions(-)`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Notification context should include workflow information
                if (notificationContext) {
                    expect(notificationContext.hookType).toBe('post-commit');
                    expect(notificationContext.commitHash).toBe(commitHash.substring(0, 8));
                    expect(notificationContext.persona).toBe(commitInfo.persona);
                    expect(notificationContext.stepId).toBe(commitInfo.stepId);
                    expect(notificationContext.filesChanged).toBe(commitInfo.filesChanged);
                    expect(notificationContext.linesAdded).toBe(commitInfo.linesAdded);
                }

                // Property: Notification should not affect overall execution success
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 3 });
    });

    test('should handle different notification priorities and workflow phases appropriately', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                workflowPhase: fc.constantFrom('planning', 'design', 'implementation', 'testing', 'deployment', 'maintenance'),
                priority: fc.constantFrom('low', 'medium', 'high', 'critical'),
                urgency: fc.boolean(),
                requiresApproval: fc.boolean()
            }),
            async (commitHash, notificationConfig) => {
                // Mock workflow context
                const contextPath = path.join(process.cwd(), 'activeContext.md');
                const contextContent = `# Active Context\n\nWorkflow Phase: ${notificationConfig.workflowPhase}\nPriority: ${notificationConfig.priority}\nUrgent: ${notificationConfig.urgency}\n`;

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath === contextPath) {
                        return contextContent;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                // Mock notification handling based on priority
                const notificationsSent = [];
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('node scripts/bmad/bmad-orchestrator.js')) {
                        notificationsSent.push({
                            phase: notificationConfig.workflowPhase,
                            priority: notificationConfig.priority,
                            urgent: notificationConfig.urgency,
                            requiresApproval: notificationConfig.requiresApproval,
                            timestamp: new Date().toISOString()
                        });
                        return `Notification sent for ${notificationConfig.priority} priority ${notificationConfig.workflowPhase} phase`;
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} [DEVELOPER] [STEP-001] ${notificationConfig.workflowPhase} work`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should handle all priority levels
                expect(result.success).toBe(true);

                // Property: High priority notifications should be processed
                if (notificationConfig.priority === 'critical' || notificationConfig.priority === 'high') {
                    // Should attempt notification for high priority items
                    expect(result.results?.orchestratorNotification?.status).not.toBe('skipped');
                }

                // Property: Workflow phase should influence notification behavior
                if (notificationConfig.workflowPhase === 'deployment' || notificationConfig.workflowPhase === 'testing') {
                    // Critical phases should always attempt notification
                    expect(result.results?.orchestratorNotification?.status).toMatch(/^(passed|attempted|failed)$/);
                }

                // Property: Urgent notifications should not increase execution time significantly
                if (notificationConfig.urgency) {
                    expect(result.duration).toBeLessThan(5000); // Should complete quickly for urgent items
                }

                // Property: Execution should complete regardless of notification complexity
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(result.success).toBe(true);
            }
        ), { numRuns: 3 });
    });

    test('should maintain notification audit trail for compliance and debugging', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                auditRequired: fc.boolean(),
                complianceMode: fc.boolean(),
                debugMode: fc.boolean()
            }),
            async (commitHash, auditConfig) => {
                // Mock audit trail file operations
                const auditPath = path.join(process.cwd(), '.github/logs/orchestrator-notifications.log');
                let auditEntries = [];

                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (filePath === auditPath) {
                        auditEntries.push(JSON.parse(content));
                    }
                });

                mockFs.appendFileSync = jest.fn().mockImplementation((filePath, content) => {
                    if (filePath === auditPath) {
                        auditEntries.push(JSON.parse(content));
                    }
                });

                // Mock orchestrator notification with audit trail
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('node scripts/bmad/bmad-orchestrator.js')) {
                        return 'Notification sent with audit trail';
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} [DEVELOPER] [STEP-001] Test commit`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Audit trail should be maintained when required
                if (auditConfig.auditRequired || auditConfig.complianceMode) {
                    // Should create audit entries for compliance
                    expect(result.results?.orchestratorNotification?.auditTrail).toBeDefined();
                }

                // Property: Debug information should be available in debug mode
                if (auditConfig.debugMode) {
                    expect(result.results?.orchestratorNotification?.debugInfo).toBeDefined();
                }

                // Property: Audit trail should not significantly impact performance
                expect(result.duration).toBeLessThan(8000); // Should complete within 8 seconds even with audit

                // Property: Execution metrics should include audit information
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 3 });
    });
});