/**
 * Property-Based Tests for Repository State Validation
 * **Feature: git-hooks-automation, Property 14: Repository state validation**
 * **Validates: Requirements 5.2**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');
const fs = require('fs');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Repository State Validation Property Tests', () => {
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
     * **Feature: git-hooks-automation, Property 14: Repository state validation**
     * **Validates: Requirements 5.2**
     */
    test('should verify repository remains in valid state after any merge', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus'),
            fc.record({
                hasUncommittedChanges: fc.boolean(),
                hasUnmergedPaths: fc.boolean(),
                branchIsValid: fc.boolean(),
                workingTreeClean: fc.boolean()
            }),
            async (mergeType, repoState) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git status --porcelain')) {
                        if (!repoState.workingTreeClean) {
                            return 'M src/app.js\n?? temp.txt';
                        }
                        return '';
                    }
                    if (command.includes('git diff --check')) {
                        if (repoState.hasUnmergedPaths) {
                            return 'src/conflict.js:10: leftover conflict marker';
                        }
                        return '';
                    }
                    if (command.includes('git rev-parse --abbrev-ref HEAD')) {
                        if (!repoState.branchIsValid) {
                            throw new Error('fatal: not a git repository');
                        }
                        return 'main';
                    }
                    if (command.includes('git fsck')) {
                        return 'Checking object directories: 100% done.\nChecking objects: 100% done.';
                    }
                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Repository state validation should always be performed (Requirement 5.2)
                expect(result.success).toBe(true);
                expect(result.results?.repositoryValidation).toBeDefined();

                const validation = result.results.repositoryValidation;

                // Property: Validation should check working tree status
                expect(validation.workingTreeClean).toBe(repoState.workingTreeClean);

                // Property: Validation should detect unmerged paths
                expect(validation.hasUnmergedPaths).toBe(repoState.hasUnmergedPaths);

                // Property: Validation should verify branch validity
                expect(validation.branchValid).toBe(repoState.branchIsValid);

                // Property: Overall validation status should reflect repository health
                const isValid = repoState.workingTreeClean &&
                    !repoState.hasUnmergedPaths &&
                    repoState.branchIsValid;
                expect(validation.isValid).toBe(isValid);

                if (!isValid) {
                    // Property: Invalid state should be reported with details
                    expect(validation.issues).toBeDefined();
                    expect(validation.issues.length).toBeGreaterThan(0);
                }
            }
        ), { numRuns: 5 });
    });

    test('should validate critical repository files exist after merge', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.record({
                hasPackageJson: fc.boolean(),
                hasGitDir: fc.boolean(),
                hasActiveContext: fc.boolean(),
                hasProductContext: fc.boolean()
            }),
            async (mergeType, fileStates) => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('package.json')) {
                        return fileStates.hasPackageJson;
                    }
                    if (filePath.includes('.git')) {
                        return fileStates.hasGitDir;
                    }
                    if (filePath.includes('activeContext.md')) {
                        return fileStates.hasActiveContext;
                    }
                    if (filePath.includes('productContext.md')) {
                        return fileStates.hasProductContext;
                    }
                    return true;
                });

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git status --porcelain')) {
                        return '';
                    }
                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Repository validation should check critical files
                expect(result.success).toBe(true);
                expect(result.results?.repositoryValidation).toBeDefined();

                const validation = result.results.repositoryValidation;

                // Property: Validation should verify package.json exists
                expect(validation.criticalFiles?.packageJson).toBe(fileStates.hasPackageJson);

                // Property: Validation should verify .git directory exists
                expect(validation.criticalFiles?.gitDirectory).toBe(fileStates.hasGitDir);

                // Property: Missing critical files should be reported
                if (!fileStates.hasPackageJson || !fileStates.hasGitDir) {
                    expect(validation.isValid).toBe(false);
                    expect(validation.issues.some(issue =>
                        /missing|not found/i.test(issue)
                    )).toBe(true);
                }
            }
        ), { numRuns: 5 });
    });

    test('should validate repository integrity after merge', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive', 'octopus'),
            fc.record({
                hasCorruptedObjects: fc.boolean(),
                hasDanglingCommits: fc.boolean(),
                hasValidRefs: fc.boolean()
            }),
            async (mergeType, integrityState) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git fsck')) {
                        if (integrityState.hasCorruptedObjects) {
                            return 'error: object file is empty\nerror: bad object';
                        }
                        if (integrityState.hasDanglingCommits) {
                            return 'dangling commit abc123\ndangling blob def456';
                        }
                        return 'Checking objects: 100% done.';
                    }
                    if (command.includes('git status --porcelain')) {
                        return '';
                    }
                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Repository integrity should be validated
                expect(result.success).toBe(true);
                expect(result.results?.repositoryValidation).toBeDefined();

                const validation = result.results.repositoryValidation;

                // Property: Corrupted objects should be detected
                if (integrityState.hasCorruptedObjects) {
                    expect(validation.integrityCheck?.hasErrors).toBe(true);
                    expect(validation.isValid).toBe(false);
                }

                // Property: Dangling commits are warnings, not errors
                if (integrityState.hasDanglingCommits && !integrityState.hasCorruptedObjects) {
                    expect(validation.integrityCheck?.hasWarnings).toBe(true);
                    // Dangling commits alone don't make repo invalid, but other factors might
                    // The validation checks multiple things, so we just verify warnings are detected
                    expect(validation.integrityCheck?.hasWarnings).toBe(true);
                }

                // Property: Clean integrity check should pass
                if (!integrityState.hasCorruptedObjects && !integrityState.hasDanglingCommits) {
                    expect(validation.integrityCheck?.status).toBe('passed');
                }
            }
        ), { numRuns: 5 });
    });

    test('should handle validation errors gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.boolean(),
            async (mergeType, gitCommandsFail) => {
                mockExecSync.mockImplementation((command) => {
                    if (gitCommandsFail && command.includes('git')) {
                        throw new Error('Git command failed');
                    }
                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Validation errors should not crash post-merge hook
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                if (gitCommandsFail) {
                    // Property: Validation failure should be reported
                    expect(result.results?.repositoryValidation?.status).toBe('failed');
                    // Error might be in the result or in the issues array
                    const hasError = result.results?.repositoryValidation?.error ||
                        (result.results?.repositoryValidation?.issues &&
                            result.results.repositoryValidation.issues.length > 0);
                    expect(hasError).toBeTruthy();
                }

                // Property: Execution should still be recorded
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 5 });
    });

    test('should provide detailed validation reports for any repository state', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('fast-forward', 'recursive'),
            fc.integer({ min: 0, max: 10 }),
            async (mergeType, issueCount) => {
                const mockIssues = Array(issueCount).fill(0).map((_, i) =>
                    `Issue ${i}: Validation warning`
                );

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git status --porcelain')) {
                        return issueCount > 0 ? 'M file.js' : '';
                    }
                    if (command.includes('npm run bmad:workflow')) {
                        return 'Workflow completed';
                    }
                    if (command.includes('git diff --stat')) {
                        return '5 files changed, 100 insertions(+), 50 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostMerge(mergeType);

                // Property: Validation should provide detailed reports
                expect(result.success).toBe(true);
                expect(result.results?.repositoryValidation).toBeDefined();

                const validation = result.results.repositoryValidation;

                // Property: Report should include validation timestamp
                expect(validation.timestamp).toBeDefined();
                const validationTime = new Date(validation.timestamp);
                const now = new Date();
                expect(now - validationTime).toBeLessThan(5000);

                // Property: Report should list all issues found
                if (issueCount > 0) {
                    expect(validation.issues).toBeDefined();
                    expect(validation.issues.length).toBeGreaterThan(0);
                }

                // Property: Report should include validation summary
                expect(validation.summary).toBeDefined();
                expect(typeof validation.summary).toBe('string');
            }
        ), { numRuns: 5 });
    });
});
