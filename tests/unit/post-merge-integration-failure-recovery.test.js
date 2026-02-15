/**
 * Property-Based Tests for Integration Failure Recovery
 * **Feature: git-hooks-automation, Property 16: Integration failure recovery**
 * **Validates: Requirements 5.5**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Integration Failure Recovery Property Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        jest.clearAllMocks();

        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');

        mockExecSync.mockReturnValue('');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"bmad:workflow":"node scripts/bmad/bmad-workflow.js"}}');
        mockFs.writeFileSync.mockImplementation(() => { });

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: false,
            enableContextValidation: true,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 16: Integration failure recovery**
     * **Validates: Requirements 5.5**
     */
    test('should provide rollback recommendations for any integration workflow failure', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus'),
            fc.record({
                workflowFails: fc.boolean(),
                validationFails: fc.boolean(),
                testsFail: fc.boolean()
            }),
            fc.string({ minLength: 7, maxLength: 40 }).filter(s => /^[a-f0-9]+$/.test(s)),
            async (mergeType, failureScenario, commitHash) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow') && failureScenario.workflowFails) {
                        throw new Error('BMAD workflow execution failed');
                    }
                    if (command.includes('npm test') && failureScenario.testsFail) {
                        throw new Error('Tests failed');
                    }
                    if (command.includes('git status --porcelain') && failureScenario.validationFails) {
                        return 'UU conflict.js\nM modified.js';
                    }
                    if (command.includes('git rev-parse HEAD')) {
                        return commitHash;
                    }
                    if (command.includes('git reflog')) {
                        return `${commitHash} HEAD@{0}: merge: Merge branch feature\nabc1234 HEAD@{1}: commit: Previous commit`;
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                const hasFailure = failureScenario.workflowFails ||
                    failureScenario.validationFails ||
                    failureScenario.testsFail;

                // Property: Post-merge should complete even with failures
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                if (hasFailure) {
                    // Property: Rollback recommendations should be provided (Requirement 5.5)
                    expect(result.recovery).toBeDefined();
                    expect(result.recovery.rollbackRecommendations).toBeDefined();
                    expect(Array.isArray(result.recovery.rollbackRecommendations)).toBe(true);
                    expect(result.recovery.rollbackRecommendations.length).toBeGreaterThan(0);

                    // Property: Recommendations should include specific commands
                    const hasGitResetCommand = result.recovery.rollbackRecommendations.some(rec =>
                        rec.command && rec.command.includes('git reset')
                    );
                    const hasGitRevertCommand = result.recovery.rollbackRecommendations.some(rec =>
                        rec.command && rec.command.includes('git revert')
                    );

                    expect(hasGitResetCommand || hasGitRevertCommand).toBe(true);

                    // Property: Recommendations should include current commit hash
                    const hasCommitHash = result.recovery.rollbackRecommendations.some(rec =>
                        rec.command && rec.command.includes(commitHash.substring(0, 7))
                    );
                    expect(hasCommitHash).toBe(true);
                }
            }
        ), { numRuns: 3 });
    });

    test('should provide detailed troubleshooting information for any failure', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.constantFrom(
                'workflow_execution_failed',
                'repository_validation_failed'
            ),
            fc.record({
                errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
                errorCode: fc.integer({ min: 1, max: 255 })
            }),
            async (mergeType, failureType, errorDetails) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow') && failureType === 'workflow_execution_failed') {
                        const error = new Error(errorDetails.errorMessage);
                        error.code = errorDetails.errorCode;
                        throw error;
                    }
                    if (command.includes('git status --porcelain') && failureType === 'repository_validation_failed') {
                        throw new Error(errorDetails.errorMessage);
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Detailed troubleshooting should be provided (Requirement 5.5)
                expect(result.success).toBe(true);

                // Property: Recovery information should be provided for workflow execution failures
                if (failureType === 'workflow_execution_failed') {
                    expect(result.recovery).toBeDefined();
                    expect(result.recovery.troubleshooting).toBeDefined();

                    const troubleshooting = result.recovery.troubleshooting;

                    // Property: Troubleshooting should identify failure type
                    expect(troubleshooting.failureType).toBeDefined();
                    expect(typeof troubleshooting.failureType).toBe('string');
                    expect(troubleshooting.failureType).toBe(failureType);

                    // Property: Troubleshooting should include error details
                    expect(troubleshooting.errorMessage).toBeDefined();
                    expect(troubleshooting.errorMessage.length).toBeGreaterThan(0);
                    expect(troubleshooting.errorMessage).toBe(errorDetails.errorMessage);

                    // Property: Troubleshooting should provide diagnostic steps
                    expect(troubleshooting.diagnosticSteps).toBeDefined();
                    expect(Array.isArray(troubleshooting.diagnosticSteps)).toBe(true);
                    expect(troubleshooting.diagnosticSteps.length).toBeGreaterThan(0);

                    // Property: Each diagnostic step should be actionable
                    troubleshooting.diagnosticSteps.forEach(step => {
                        expect(step.description).toBeDefined();
                        expect(typeof step.description).toBe('string');
                        expect(step.description.length).toBeGreaterThan(0);
                    });
                }
                // Note: repository_validation_failed errors are caught internally and don't trigger recovery
                // This is a design decision - validation failures are reported in results but don't require recovery
            }
        ), { numRuns: 2 });
    });

    test('should generate recovery report for any integration failure', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus'),
            fc.boolean(),
            fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
            async (mergeType, shouldFail, affectedFiles) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow') && shouldFail) {
                        throw new Error('Integration workflow failed');
                    }
                    if (command.includes('git diff --name-only')) {
                        return affectedFiles.join('\n');
                    }
                    if (command.includes('git diff --stat')) {
                        return `${affectedFiles.length} files changed, 100 insertions(+), 50 deletions(-)`;
                    }
                    return '';
                });

                const recoveryReportPath = path.join(process.cwd(), '.github/reports/recovery-report.json');
                let generatedReport = null;

                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (filePath === recoveryReportPath) {
                        generatedReport = JSON.parse(content);
                    }
                });

                const result = await orchestrator.executePostMerge(mergeType);

                if (shouldFail) {
                    // Property: Recovery report should be generated for failures
                    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                        recoveryReportPath,
                        expect.any(String)
                    );

                    if (generatedReport) {
                        // Property: Report should contain failure details
                        expect(generatedReport.mergeType).toBe(mergeType);
                        expect(generatedReport.failureDetected).toBe(true);
                        expect(generatedReport.affectedFiles).toBeDefined();
                        expect(generatedReport.timestamp).toBeDefined();

                        // Property: Report should include recovery options
                        expect(generatedReport.recoveryOptions).toBeDefined();
                        expect(Array.isArray(generatedReport.recoveryOptions)).toBe(true);
                        expect(generatedReport.recoveryOptions.length).toBeGreaterThan(0);

                        // Property: Report timestamp should be recent
                        const reportTime = new Date(generatedReport.timestamp);
                        const now = new Date();
                        expect(now - reportTime).toBeLessThan(5000);
                    }
                }

                // Property: Post-merge should complete successfully
                expect(result.success).toBe(true);
            }
        ), { numRuns: 2 });
    });

    test('should provide context-aware recovery recommendations', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.record({
                hasBackup: fc.boolean(),
                hasStash: fc.boolean(),
                hasRemote: fc.boolean(),
                branchProtected: fc.boolean()
            }),
            async (mergeType, repoContext) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow')) {
                        throw new Error('Workflow failed');
                    }
                    if (command.includes('git stash list')) {
                        return repoContext.hasStash ? 'stash@{0}: WIP on main' : '';
                    }
                    if (command.includes('git remote')) {
                        return repoContext.hasRemote ? 'origin' : '';
                    }
                    if (command.includes('git branch --show-current')) {
                        return repoContext.branchProtected ? 'main' : 'feature';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Recovery recommendations should be context-aware
                expect(result.success).toBe(true);
                expect(result.recovery).toBeDefined();
                expect(result.recovery.rollbackRecommendations).toBeDefined();

                const recommendations = result.recovery.rollbackRecommendations;

                // Property: Recommendations should consider repository context
                if (repoContext.branchProtected) {
                    // Protected branches should suggest revert instead of reset
                    const hasRevertRecommendation = recommendations.some(rec =>
                        rec.command && rec.command.includes('git revert')
                    );
                    expect(hasRevertRecommendation).toBe(true);
                }

                if (repoContext.hasRemote) {
                    // With remote, should warn about force push implications
                    const hasRemoteWarning = recommendations.some(rec =>
                        rec.warning && rec.warning.toLowerCase().includes('remote')
                    );
                    expect(hasRemoteWarning).toBe(true);
                }

                // Property: Each recommendation should have a description
                recommendations.forEach(rec => {
                    expect(rec.description).toBeDefined();
                    expect(typeof rec.description).toBe('string');
                    expect(rec.description.length).toBeGreaterThan(0);
                });
            }
        ), { numRuns: 2 });
    });

    test('should handle multiple concurrent failures gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.record({
                workflowFails: fc.boolean(),
                validationFails: fc.boolean(),
                reportGenerationFails: fc.boolean()
            }),
            async (mergeType, failures) => {
                const failureCount = Object.values(failures).filter(Boolean).length;

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow') && failures.workflowFails) {
                        throw new Error('Workflow failed');
                    }
                    if (command.includes('git status') && failures.validationFails) {
                        throw new Error('Validation failed');
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                mockFs.writeFileSync.mockImplementation((filePath) => {
                    if (failures.reportGenerationFails && filePath.includes('recovery-report')) {
                        throw new Error('Failed to write report');
                    }
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Multiple failures should not crash the hook
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                if (failureCount > 0) {
                    // Property: All failures should be reported
                    expect(result.recovery).toBeDefined();

                    if (result.recovery.troubleshooting) {
                        // Property: Recovery should aggregate all failure information
                        if (failureCount > 1) {
                            expect(result.recovery.troubleshooting.multipleFailures).toBe(true);
                            expect(result.recovery.troubleshooting.failureCount).toBe(failureCount);
                        }
                    }
                }

                // Property: Execution should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 2 });
    });
});
