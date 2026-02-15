/**
 * Property-Based Tests for Post-merge Workflow Execution
 * **Feature: git-hooks-automation, Property 13: Post-merge workflow execution**
 * **Validates: Requirements 5.1, 5.3**
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

describe('Post-merge Workflow Execution Property Tests', () => {
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
        mockFs.mkdirSync.mockImplementation(() => { });

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: false,
            enableContextValidation: true,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 13: Post-merge workflow execution**
     * **Validates: Requirements 5.1, 5.3**
     */
    test('should execute complete bmad:workflow process for any completed merge', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus', 'ours', 'subtree'),
            fc.record({
                sourceBranch: fc.constantFrom('feature/auth', 'bugfix/validation', 'hotfix/security', 'develop'),
                targetBranch: fc.constantFrom('main', 'develop', 'staging'),
                filesChanged: fc.integer({ min: 1, max: 50 }),
                commits: fc.integer({ min: 1, max: 20 })
            }),
            async (mergeType, mergeInfo) => {
                const workflowExecuted = [];

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow')) {
                        workflowExecuted.push('bmad:workflow');
                        return 'BMAD workflow completed successfully';
                    }
                    if (command.includes('git log --oneline')) {
                        return Array(mergeInfo.commits).fill(0).map((_, i) =>
                            `abc${i.toString().padStart(4, '0')} [DEVELOPER] [STEP-${i}] Commit ${i}`
                        ).join('\n');
                    }
                    if (command.includes('git diff --stat')) {
                        return `${mergeInfo.filesChanged} files changed, 500 insertions(+), 200 deletions(-)`;
                    }
                    if (command.includes('git rev-parse --abbrev-ref HEAD')) {
                        return mergeInfo.targetBranch;
                    }
                    if (command.includes('git reflog')) {
                        return `merge ${mergeInfo.sourceBranch}: ${mergeType}`;
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Post-merge should execute successfully for any merge type
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Complete bmad:workflow process should be executed (Requirement 5.1)
                expect(workflowExecuted).toContain('bmad:workflow');
                expect(result.results?.workflow?.status).toBe('passed');

                // Property: Merge analysis report should be generated (Requirement 5.3)
                expect(result.results?.mergeAnalysis).toBeDefined();
                expect(result.results.mergeAnalysis.mergeType).toBe(mergeType);
                // filesChanged is an array of file paths, not a count
                expect(Array.isArray(result.results.mergeAnalysis.filesChanged)).toBe(true);
                expect(result.results.mergeAnalysis.statistics).toBeDefined();
                expect(result.results.mergeAnalysis.statistics.filesCount).toBeGreaterThanOrEqual(0);

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-merge');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 5 });
    });

    test('should generate comprehensive merge analysis reports for any merge', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus'),
            fc.array(fc.constantFrom(
                'src/app.js',
                'src/controllers/auth.controller.js',
                'tests/unit/auth.test.js',
                'README.md',
                'package.json'
            ), { minLength: 1, maxLength: 10 }),
            fc.record({
                conflicts: fc.integer({ min: 0, max: 5 }),
                linesAdded: fc.integer({ min: 10, max: 1000 }),
                linesDeleted: fc.integer({ min: 5, max: 500 })
            }),
            async (mergeType, changedFiles, mergeStats) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git diff --stat')) {
                        return `${changedFiles.length} files changed, ${mergeStats.linesAdded} insertions(+), ${mergeStats.linesDeleted} deletions(-)`;
                    }
                    if (command.includes('git diff --name-only')) {
                        return changedFiles.join('\n');
                    }
                    if (command.includes('git log --merges')) {
                        return 'abc1234 Merge branch feature into main';
                    }
                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    return '';
                });

                const reportPath = path.join(process.cwd(), '.github/reports/merge-analysis.json');
                let generatedReport = null;

                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (filePath === reportPath) {
                        generatedReport = JSON.parse(content);
                    }
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Merge analysis report should be generated (Requirement 5.3)
                expect(result.success).toBe(true);
                expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                    reportPath,
                    expect.any(String)
                );

                if (generatedReport) {
                    // Property: Report should contain comprehensive merge information
                    expect(generatedReport.mergeType).toBe(mergeType);
                    expect(generatedReport.filesChanged).toEqual(changedFiles);
                    expect(generatedReport.statistics).toBeDefined();
                    expect(generatedReport.statistics.linesAdded).toBe(mergeStats.linesAdded);
                    expect(generatedReport.statistics.linesDeleted).toBe(mergeStats.linesDeleted);
                    expect(generatedReport.timestamp).toBeDefined();

                    // Property: Report timestamp should be recent
                    const reportTime = new Date(generatedReport.timestamp);
                    const now = new Date();
                    expect(now - reportTime).toBeLessThan(5000);
                }
            }
        ), { numRuns: 5 });
    });

    test('should handle workflow execution failures gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.boolean(),
            async (mergeType, workflowShouldFail) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:workflow')) {
                        if (workflowShouldFail) {
                            throw new Error('BMAD workflow failed');
                        }
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Post-merge should not crash on workflow failures
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                if (workflowShouldFail) {
                    // Property: Workflow failure should be reported but not block merge
                    expect(result.results?.workflow?.status).toBe('failed');
                    expect(result.results?.workflow?.error).toBeDefined();
                } else {
                    expect(result.results?.workflow?.status).toBe('passed');
                }

                // Property: Execution should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 5 });
    });

    test('should maintain performance within acceptable limits for any merge', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus'),
            fc.integer({ min: 1, max: 100 }),
            async (mergeType, filesCount) => {
                mockExecSync.mockImplementation((command) => {
                    const start = Date.now();
                    while (Date.now() - start < 5) {
                        // Simulate work
                    }

                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return `${filesCount} files changed, 1000 insertions(+), 500 deletions(-)`;
                    }
                    return '';
                });

                const startTime = Date.now();
                const result = await orchestrator.executePostMerge(mergeType);
                const endTime = Date.now();
                const actualDuration = endTime - startTime;

                // Property: Post-merge should complete successfully
                expect(result.success).toBe(true);

                // Property: Performance should be within acceptable limits
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(actualDuration).toBeLessThan(30000); // Should complete within 30 seconds

                // Property: Performance metrics should be tracked
                const executionMetrics = orchestrator.getMetrics();
                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];

                expect(lastExecution.duration).toBeGreaterThanOrEqual(0);
                expect(typeof lastExecution.performanceThresholdMet).toBe('boolean');
            }
        ), { numRuns: 5 });
    });
});
