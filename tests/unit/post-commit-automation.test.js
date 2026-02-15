/**
 * Property-Based Tests for Post-commit Automation
 * **Feature: git-hooks-automation, Property 10: Post-commit automation**
 * **Validates: Requirements 4.1, 4.2, 4.4**
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

describe('Post-commit Automation Property Tests', () => {
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
        mockFs.mkdirSync.mockImplementation(() => { });
        mockFs.readdirSync.mockReturnValue([]);

        // Mock path.join to return predictable paths
        jest.spyOn(path, 'join').mockImplementation((...args) => args.join('/'));
        jest.spyOn(path, 'dirname').mockImplementation((p) => p.split('/').slice(0, -1).join('/'));

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: false,
            enableContextValidation: true,
            enableGatekeeper: false
        });
    });

    afterEach(() => {
        // Restore path mocks
        jest.restoreAllMocks();
    });

    /**
     * **Feature: git-hooks-automation, Property 10: Post-commit automation**
     * **Validates: Requirements 4.1, 4.2, 4.4**
     */
    test('should automatically update project metrics for any successful commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                filesChanged: fc.integer({ min: 1, max: 20 }),
                linesAdded: fc.integer({ min: 0, max: 500 }),
                linesDeleted: fc.integer({ min: 0, max: 200 }),
                testsPassed: fc.integer({ min: 0, max: 100 }),
                coverage: fc.float({ min: 0, max: 100 })
            }),
            async (commitHash, commitStats) => {
                // Reset mocks for each property test run
                jest.clearAllMocks();

                // Mock git commands to return commit statistics
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git show --stat')) {
                        return `${commitStats.filesChanged} files changed, ${commitStats.linesAdded} insertions(+), ${commitStats.linesDeleted} deletions(-)`;
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit message`;
                    }
                    if (command.includes('git diff --name-only')) {
                        return 'src/app.js\nREADME.md';
                    }
                    return '';
                });

                // Mock metrics file operations
                const mockMetricsPath = `${process.cwd()}/.github/metrics/project-metrics.json`;
                const existingMetrics = {
                    totalCommits: 10,
                    totalLinesAdded: 1000,
                    totalLinesDeleted: 200,
                    averageFilesPerCommit: 3.5,
                    lastUpdated: new Date(Date.now() - 86400000).toISOString() // 1 day ago
                };

                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('project-metrics.json')) {
                        return true;
                    }
                    if (filePath.includes('.github/metrics')) {
                        return true;
                    }
                    if (filePath.includes('package.json')) {
                        return true;
                    }
                    return true;
                });

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('project-metrics.json')) {
                        return JSON.stringify(existingMetrics);
                    }
                    if (filePath.includes('package.json')) {
                        return '{"scripts":{"test":"jest"}}';
                    }
                    return '{}';
                });

                let updatedMetrics = null;
                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (filePath.includes('project-metrics.json')) {
                        updatedMetrics = JSON.parse(content);
                    }
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should execute successfully for any valid commit hash
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Project metrics should be updated automatically (Requirement 4.1)
                expect(result.results.metricsUpdate).toBeDefined();
                expect(result.results.metricsUpdate.status).toMatch(/^(passed|warning)$/);

                // Verify metrics file was written
                const metricsWriteCalls = mockFs.writeFileSync.mock.calls.filter(call =>
                    call[0].includes('project-metrics.json')
                );

                // If status is 'passed', we expect the file to have been written
                if (result.results.metricsUpdate.status === 'passed') {
                    expect(metricsWriteCalls.length).toBeGreaterThan(0);

                    if (updatedMetrics) {
                        // Property: Metrics should reflect the new commit
                        expect(updatedMetrics.totalCommits).toBe(existingMetrics.totalCommits + 1);
                        expect(updatedMetrics.totalLinesAdded).toBe(existingMetrics.totalLinesAdded + commitStats.linesAdded);
                        expect(updatedMetrics.totalLinesDeleted).toBe(existingMetrics.totalLinesDeleted + commitStats.linesDeleted);

                        // Property: Last updated timestamp should be recent
                        const lastUpdated = new Date(updatedMetrics.lastUpdated);
                        const now = new Date();
                        expect(now - lastUpdated).toBeLessThan(5000); // Within 5 seconds
                    }
                }

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 5 });
    });

    test('should regenerate documentation when needed for any commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.array(fc.constantFrom(
                'src/app.js',
                'src/controllers/auth.controller.js',
                'README.md',
                'docs/architecture/OVERVIEW.md',
                'package.json',
                'scripts/bmad/bmad-workflow.js'
            ), { minLength: 1, maxLength: 5 }),
            async (commitHash, changedFiles) => {
                // Mock package.json to include bmad:docs script
                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath.includes('package.json')) {
                        return '{"scripts":{"test":"jest","bmad:docs":"node scripts/agent-doc.js"}}';
                    }
                    return '{}';
                });

                // Mock documentation generation
                const docGenerationCalled = [];
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm run bmad:docs')) {
                        docGenerationCalled.push('bmad:docs');
                        return 'Documentation generated successfully';
                    }
                    if (command.includes('git diff --name-only')) {
                        return changedFiles.join('\n');
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Update ${changedFiles[0]}`;
                    }
                    if (command.includes('git show --stat')) {
                        return '1 file changed, 10 insertions(+), 5 deletions(-)';
                    }
                    return '';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Documentation should be regenerated when source files change (Requirement 4.2)
                const hasSourceChanges = changedFiles.some(file =>
                    file.match(/\.(js|ts|jsx|tsx|md)$/) &&
                    (file.startsWith('src/') || file.startsWith('scripts/') || file.startsWith('docs/'))
                );

                if (hasSourceChanges) {
                    expect(docGenerationCalled).toContain('bmad:docs');
                } else {
                    // Documentation generation may be skipped for non-source changes
                    expect(result.results?.documentation?.status).toMatch(/^(passed|skipped)$/);
                }

                // Property: Documentation generation should not block commit completion
                expect(result.duration).toBeLessThan(30000); // Should complete within 30 seconds
            }
        ), { numRuns: 5 });
    });

    test('should register commit in active context for any commit with code changes', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS', 'SECURITY'),
                stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3).toUpperCase()}`),
                description: fc.string({ minLength: 10, maxLength: 100 })
            }),
            fc.array(fc.constantFrom(
                'src/app.js',
                'src/controllers/user.controller.js',
                'tests/unit/auth.test.js',
                'scripts/hooks/hook-orchestrator.js'
            ), { minLength: 1, maxLength: 3 }),
            async (commitHash, commitInfo, changedFiles) => {
                const commitMessage = `[${commitInfo.persona}] [${commitInfo.stepId}] ${commitInfo.description}`;

                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} ${commitMessage}`;
                    }
                    if (command.includes('git diff --name-only')) {
                        return changedFiles.join('\n');
                    }
                    if (command.includes('git show --stat')) {
                        return `${changedFiles.length} files changed, 50 insertions(+), 10 deletions(-)`;
                    }
                    return '';
                });

                // Mock activeContext.md operations
                const contextPath = path.join(process.cwd(), 'activeContext.md');
                const existingContext = `# Active Context\n\nCurrent work: Previous task\nPersona: ${commitInfo.persona}\n`;

                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (filePath === contextPath) {
                        return existingContext;
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                let updatedContext = null;
                mockFs.writeFileSync.mockImplementation((filePath, content) => {
                    if (filePath === contextPath) {
                        updatedContext = content;
                    }
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Commit should be registered in active context (Requirement 4.4)
                const hasCodeChanges = changedFiles.some(file =>
                    file.match(/\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|cpp)$/)
                );

                if (hasCodeChanges) {
                    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                        contextPath,
                        expect.any(String)
                    );

                    if (updatedContext) {
                        // Property: Updated context should contain commit information
                        expect(updatedContext).toContain(commitHash.substring(0, 8));
                        expect(updatedContext).toContain(commitInfo.persona);
                        expect(updatedContext).toContain(commitInfo.stepId);

                        // Property: Context should maintain chronological order
                        expect(updatedContext.length).toBeGreaterThan(existingContext.length);
                    }
                }

                // Property: Context updates should not cause post-commit to fail
                expect(result.results?.contextUpdate?.status).not.toBe('failed');
            }
        ), { numRuns: 5 });
    });

    test('should handle missing or corrupted project files gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.record({
                packageJsonExists: fc.boolean(),
                metricsFileExists: fc.boolean(),
                contextFileExists: fc.boolean(),
                gitCommandsWork: fc.boolean()
            }),
            async (commitHash, fileStates) => {
                // Mock file system states
                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath.includes('package.json')) {
                        return fileStates.packageJsonExists;
                    }
                    if (filePath.includes('project-metrics.json')) {
                        return fileStates.metricsFileExists;
                    }
                    if (filePath.includes('activeContext.md')) {
                        return fileStates.contextFileExists;
                    }
                    return true;
                });

                // Mock git command failures
                mockExecSync.mockImplementation((command) => {
                    if (!fileStates.gitCommandsWork && command.includes('git')) {
                        throw new Error('Git command failed');
                    }
                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit`;
                    }
                    return '';
                });

                // Mock file read failures
                mockFs.readFileSync.mockImplementation((filePath) => {
                    if (!fileStates.packageJsonExists && filePath.includes('package.json')) {
                        throw new Error('ENOENT: no such file or directory');
                    }
                    if (!fileStates.metricsFileExists && filePath.includes('project-metrics.json')) {
                        throw new Error('ENOENT: no such file or directory');
                    }
                    if (!fileStates.contextFileExists && filePath.includes('activeContext.md')) {
                        throw new Error('ENOENT: no such file or directory');
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                const result = await orchestrator.executePostCommit(commitHash);

                // Property: Post-commit should handle missing files gracefully
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Missing files should not crash the hook
                expect(result.error).toBeUndefined();

                // Property: Results should indicate what operations were skipped
                if (result.results) {
                    Object.values(result.results).forEach(operationResult => {
                        expect(operationResult.status).toMatch(/^(passed|skipped|warning)$/);
                    });
                }

                // Property: Execution should still be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('post-commit');
                expect(lastExecution.success).toBe(true);
            }
        ), { numRuns: 5 });
    });

    test('should maintain performance within acceptable limits for any commit', async () => {
        await fc.assert(fc.asyncProperty(
            commitHashArb, // commit hash
            fc.integer({ min: 1, max: 50 }), // number of operations to simulate
            async (commitHash, operationCount) => {
                // Mock multiple operations to simulate real workload
                mockExecSync.mockImplementation((command) => {
                    // Simulate some processing time
                    const start = Date.now();
                    while (Date.now() - start < 10) {
                        // Small delay to simulate work
                    }

                    if (command.includes('git log --oneline -1')) {
                        return `${commitHash} Test commit with ${operationCount} operations`;
                    }
                    return 'Operation completed';
                });

                const startTime = Date.now();
                const result = await orchestrator.executePostCommit(commitHash);
                const endTime = Date.now();
                const actualDuration = endTime - startTime;

                // Property: Post-commit should complete successfully
                expect(result.success).toBe(true);

                // Property: Performance should be within acceptable limits
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(actualDuration).toBeLessThan(10000); // Should complete within 10 seconds

                // Property: Performance metrics should be tracked
                const executionMetrics = orchestrator.getMetrics();
                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];

                expect(lastExecution.duration).toBeGreaterThanOrEqual(0);
                expect(typeof lastExecution.performanceThresholdMet).toBe('boolean');

                // Property: Average duration should be reasonable
                if (executionMetrics.executions.length > 1) {
                    expect(executionMetrics.averageDuration).toBeGreaterThanOrEqual(0);
                    expect(executionMetrics.averageDuration).toBeLessThan(30000); // Average under 30 seconds
                }
            }
        ), { numRuns: 5 });
    });
});