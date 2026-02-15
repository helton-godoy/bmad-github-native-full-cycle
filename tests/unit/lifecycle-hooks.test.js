/**
 * Property-Based Tests for Lifecycle Hooks
 * **Feature: git-hooks-automation, Property 17: Lifecycle hook validation**
 * **Validates: Requirements 6.1, 6.2**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');
const fs = require('fs');
const path = require('path');

// Arbitraries for test data generation
const branchNameArb = fc.oneof(
    fc.constantFrom('main', 'develop', 'feature/auth', 'bugfix/login', 'release/v1.0'),
    fc.string({ minLength: 3, maxLength: 30 }).map(s => `feature/${s.replace(/[^a-z0-9-]/gi, '-')}`)
);

const commitHashArb = fc.array(
    fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
    { minLength: 8, maxLength: 40 }
).map(chars => chars.join(''));

const bmadContextArb = fc.record({
    persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY', 'PM'),
    stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3).toUpperCase()}`),
    currentTask: fc.string({ minLength: 10, maxLength: 100 }),
    lastCommit: commitHashArb
});

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Lifecycle Hooks Property Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        jest.clearAllMocks();

        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');

        // Default mock implementations
        mockExecSync.mockReturnValue('');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"test":"jest"}}');
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
     * **Feature: git-hooks-automation, Property 17: Lifecycle hook validation**
     * **Validates: Requirements 6.1, 6.2**
     * 
     * Pre-rebase hook validation
     */
    test('should validate rebase safety and BMAD compatibility for any rebase operation', async () => {
        await fc.assert(fc.asyncProperty(
            branchNameArb, // source branch
            branchNameArb, // target branch
            fc.integer({ min: 1, max: 50 }), // number of commits to rebase
            fc.boolean(), // has conflicts
            async (sourceBranch, targetBranch, commitCount, hasConflicts) => {
                // Skip if source and target are the same
                fc.pre(sourceBranch !== targetBranch);

                // Mock git commands for rebase validation
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-parse --abbrev-ref HEAD')) {
                        return sourceBranch;
                    }
                    if (command.includes('git rev-list --count')) {
                        return commitCount.toString();
                    }
                    if (command.includes('git merge-base')) {
                        return 'abc123def456';
                    }
                    if (command.includes('git diff --name-only')) {
                        if (hasConflicts) {
                            return 'src/app.js\nsrc/config.js\npackage.json';
                        }
                        return 'src/utils.js';
                    }
                    if (command.includes('git log --oneline')) {
                        return Array.from({ length: Math.min(commitCount, 5) }, (_, i) =>
                            `abc${i} [DEVELOPER] [STEP-${i}] Commit ${i}`
                        ).join('\n');
                    }
                    return '';
                });

                // Mock activeContext.md for BMAD validation
                const contextPath = path.join(process.cwd(), 'activeContext.md');
                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath === contextPath) {
                        return `# Active Context\n\nCurrent branch: ${sourceBranch}\nPersona: DEVELOPER\nLast commit: abc123\n`;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                const result = await orchestrator.executePreRebase(sourceBranch, targetBranch);

                // Property: Pre-rebase should always complete (Requirement 6.1)
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Rebase safety validation should be performed
                expect(result.results).toBeDefined();
                expect(result.results.safetyValidation).toBeDefined();
                expect(result.results.safetyValidation.status).toMatch(/^(passed|warning|failed)$/);

                // Property: BMAD compatibility should be checked
                expect(result.results.bmadCompatibility).toBeDefined();
                expect(result.results.bmadCompatibility.status).toMatch(/^(passed|warning|failed)$/);

                // Property: Conflict detection should be reported
                if (hasConflicts) {
                    expect(result.results.conflictDetection).toBeDefined();
                    expect(result.results.conflictDetection.hasConflicts).toBe(true);
                }

                // Property: Commit count should be validated
                expect(result.results.commitAnalysis).toBeDefined();
                expect(result.results.commitAnalysis.commitCount).toBe(commitCount);

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('pre-rebase');
            }
        ), { numRuns: 5 });
    });

    /**
     * **Feature: git-hooks-automation, Property 17: Lifecycle hook validation**
     * **Validates: Requirements 6.2**
     * 
     * Post-checkout hook context restoration
     */
    test('should restore appropriate BMAD context for any branch checkout', async () => {
        await fc.assert(fc.asyncProperty(
            branchNameArb, // previous branch
            branchNameArb, // new branch
            bmadContextArb, // context for new branch
            fc.boolean(), // is new branch
            async (previousBranch, newBranch, branchContext, isNewBranch) => {
                // Skip if branches are the same
                fc.pre(previousBranch !== newBranch);

                // Mock git commands for checkout
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-parse --abbrev-ref HEAD')) {
                        return newBranch;
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${branchContext.lastCommit} [${branchContext.persona}] [${branchContext.stepId}] ${branchContext.currentTask}`;
                    }
                    if (command.includes('git show-ref')) {
                        return isNewBranch ? '' : `refs/heads/${newBranch}`;
                    }
                    return '';
                });

                // Mock context files
                const contextPath = path.join(process.cwd(), 'activeContext.md');
                const branchContextPath = path.join(process.cwd(), `.github/contexts/${newBranch.replace(/\//g, '-')}.md`);

                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath === contextPath) return true;
                    if (filePath === branchContextPath) return !isNewBranch;
                    if (filePath.includes('.github/contexts')) return true;
                    return true;
                });

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath === contextPath) {
                        return `# Active Context\n\nCurrent branch: ${previousBranch}\nPersona: DEVELOPER\n`;
                    }
                    if (filePath === branchContextPath && !isNewBranch) {
                        return `# Branch Context: ${newBranch}\n\nPersona: ${branchContext.persona}\nStep ID: ${branchContext.stepId}\nTask: ${branchContext.currentTask}\n`;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                let restoredContext = null;
                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (filePath === contextPath) {
                        restoredContext = content;
                    }
                });

                const result = await orchestrator.executePostCheckout(previousBranch, newBranch, isNewBranch);

                // Property: Post-checkout should always complete (Requirement 6.2)
                expect(result).toBeDefined();
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Context restoration should be attempted
                expect(result.results).toBeDefined();
                expect(result.results.contextRestoration).toBeDefined();
                expect(result.results.contextRestoration.status).toMatch(/^(passed|warning|skipped)$/);

                // Property: For existing branches, context should be restored
                if (!isNewBranch) {
                    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                        contextPath,
                        expect.any(String)
                    );

                    if (restoredContext) {
                        // Property: Restored context should contain branch information
                        expect(restoredContext).toContain(newBranch);
                        expect(restoredContext).toContain(branchContext.persona);
                    }
                }

                // Property: For new branches, context should be initialized
                if (isNewBranch) {
                    expect(result.results.contextRestoration.isNewBranch).toBe(true);
                    expect(result.results.contextRestoration.status).toMatch(/^(passed|warning)$/);
                }

                // Property: Branch information should be tracked
                expect(result.results.branchInfo).toBeDefined();
                expect(result.results.branchInfo.previousBranch).toBe(previousBranch);
                expect(result.results.branchInfo.newBranch).toBe(newBranch);
                expect(result.results.branchInfo.isNewBranch).toBe(isNewBranch);

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-checkout');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 5 });
    });

    test('should handle missing context files gracefully during checkout', async () => {
        await fc.assert(fc.asyncProperty(
            branchNameArb,
            branchNameArb,
            fc.record({
                contextExists: fc.boolean(),
                branchContextExists: fc.boolean(),
                contextDirExists: fc.boolean()
            }),
            async (previousBranch, newBranch, fileStates) => {
                fc.pre(previousBranch !== newBranch);

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-parse --abbrev-ref HEAD')) {
                        return newBranch;
                    }
                    return '';
                });

                const contextPath = path.join(process.cwd(), 'activeContext.md');
                const branchContextPath = path.join(process.cwd(), `.github/contexts/${newBranch.replace(/\//g, '-')}.md`);

                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath === contextPath) return fileStates.contextExists;
                    if (filePath === branchContextPath) return fileStates.branchContextExists;
                    if (filePath.includes('.github/contexts')) return fileStates.contextDirExists;
                    return true;
                });

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (!fileStates.contextExists && filePath === contextPath) {
                        throw new Error('ENOENT: no such file or directory');
                    }
                    if (!fileStates.branchContextExists && filePath === branchContextPath) {
                        throw new Error('ENOENT: no such file or directory');
                    }
                    return '# Default Context\n';
                });

                const result = await orchestrator.executePostCheckout(previousBranch, newBranch, false);

                // Property: Post-checkout should handle missing files gracefully
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Missing files should not crash the hook
                expect(result.error).toBeUndefined();

                // Property: Results should indicate what operations were performed
                if (result.results.contextRestoration) {
                    expect(result.results.contextRestoration.status).toMatch(/^(passed|warning|skipped)$/);
                }

                // Property: Execution should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 5 });
    });

    test('should validate BMAD commit patterns during rebase', async () => {
        await fc.assert(fc.asyncProperty(
            branchNameArb,
            branchNameArb,
            fc.array(
                fc.record({
                    hash: commitHashArb,
                    message: fc.oneof(
                        // Valid BMAD format
                        fc.record({
                            persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA'),
                            stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3)}`),
                            description: fc.string({ minLength: 10, maxLength: 50 })
                        }).map(m => `[${m.persona}] [${m.stepId}] ${m.description}`),
                        // Invalid format
                        fc.string({ minLength: 10, maxLength: 50 })
                    )
                }),
                { minLength: 1, maxLength: 10 }
            ),
            async (sourceBranch, targetBranch, commits) => {
                fc.pre(sourceBranch !== targetBranch);

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline')) {
                        return commits.map(c => `${c.hash.substring(0, 8)} ${c.message}`).join('\n');
                    }
                    if (command.includes('git rev-parse --abbrev-ref HEAD')) {
                        return sourceBranch;
                    }
                    if (command.includes('git rev-list --count')) {
                        return commits.length.toString();
                    }
                    return '';
                });

                const result = await orchestrator.executePreRebase(sourceBranch, targetBranch);

                // Property: Pre-rebase should validate commit patterns
                expect(result.success).toBeDefined();
                expect(result.results.bmadCompatibility).toBeDefined();

                // Property: BMAD pattern validation should be performed
                const bmadResult = result.results.bmadCompatibility;
                expect(bmadResult.commitsAnalyzed).toBe(commits.length);

                // Property: Invalid commits should be detected
                const validCommits = commits.filter(c =>
                    c.message.match(/^\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]\s+(.+)$/)
                );
                const invalidCommits = commits.length - validCommits.length;

                if (invalidCommits > 0) {
                    expect(bmadResult.invalidCommits).toBeGreaterThan(0);
                    expect(bmadResult.status).toMatch(/^(warning|failed)$/);
                } else {
                    expect(bmadResult.status).toBe('passed');
                }
            }
        ), { numRuns: 5 });
    });

    test('should maintain performance within acceptable limits for lifecycle hooks', async () => {
        await fc.assert(fc.asyncProperty(
            branchNameArb,
            branchNameArb,
            fc.constantFrom('pre-rebase', 'post-checkout'),
            async (branch1, branch2, hookType) => {
                fc.pre(branch1 !== branch2);

                mockExecSync.mockImplementation(() => {
                    // Simulate some processing time
                    const start = Date.now();
                    while (Date.now() - start < 5) {
                        // Small delay
                    }
                    return 'mock output';
                });

                const startTime = Date.now();
                let result;

                if (hookType === 'pre-rebase') {
                    result = await orchestrator.executePreRebase(branch1, branch2);
                } else {
                    result = await orchestrator.executePostCheckout(branch1, branch2, false);
                }

                const endTime = Date.now();
                const actualDuration = endTime - startTime;

                // Property: Lifecycle hooks should complete successfully
                expect(result.success).toBeDefined();

                // Property: Performance should be within acceptable limits
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(actualDuration).toBeLessThan(5000); // Should complete within 5 seconds

                // Property: Performance metrics should be tracked
                const executionMetrics = orchestrator.getMetrics();
                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];

                expect(lastExecution.duration).toBeGreaterThanOrEqual(0);
                expect(typeof lastExecution.performanceThresholdMet).toBe('boolean');
            }
        ), { numRuns: 5 });
    });
});
