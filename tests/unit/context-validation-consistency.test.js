/**
 * Property-Based Tests for Context Validation Consistency
 * **Feature: git-hooks-automation, Property 4: Context validation consistency**
 * **Validates: Requirements 1.4, 2.4**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Context Validation Consistency Property Tests', () => {
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

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: false,
            enableContextValidation: true,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 4: Context validation consistency**
     * **Validates: Requirements 1.4, 2.4**
     */
    test('should verify context updates and reject commits lacking proper context updates for any commit with code changes', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.constantFrom('test.js', 'app.ts', 'component.jsx', 'style.css'), { maxLength: 3 }),
            fc.boolean(), // contextExists
            fc.boolean(), // contextStaged
            async (codeFiles, contextExists, contextStaged) => {
                // Mock git diff to return code files and optionally activeContext.md
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git diff --cached --name-only')) {
                        const files = [...codeFiles];
                        if (contextStaged) {
                            files.push('activeContext.md');
                        }
                        return files.join('\n');
                    }
                    return '';
                });

                // Mock file system for activeContext.md
                mockFs.existsSync.mockImplementation((path) => {
                    if (path.includes('activeContext.md')) {
                        return contextExists;
                    }
                    return true; // package.json exists
                });

                mockFs.readFileSync.mockImplementation((path) => {
                    if (path.includes('activeContext.md')) {
                        return 'Date: 2024-01-01\nCurrently working on implementing new features.';
                    }
                    return '{"scripts":{"test":"jest"}}'; // package.json content
                });

                const result = await orchestrator.executePreCommit(codeFiles);

                // Property: Context validation should be performed when enabled
                expect(result.results.contextValidation).toBeDefined();
                expect(result.results.contextValidation.status).toMatch(/^(passed|failed|warning|skipped)$/);

                const hasCodeChanges = codeFiles.length > 0;

                // Property: No code changes should pass context validation
                if (!hasCodeChanges) {
                    expect(result.results.contextValidation.status).toBe('passed');
                    expect(result.results.contextValidation.message).toContain('No code changes detected');
                }

                // Property: Code changes without context updates should fail
                if (hasCodeChanges && !contextStaged) {
                    expect(result.results.contextValidation.status).toBe('failed');
                    expect(result.results.contextValidation.message).toContain('Code changes detected but activeContext.md not updated');
                    expect(result.results.contextValidation.remediation).toBeDefined();
                }

                // Property: Code changes with context updates should pass or warn
                if (hasCodeChanges && contextStaged && contextExists) {
                    expect(result.results.contextValidation.status).toMatch(/^(passed|warning)$/);
                    expect(result.results.contextValidation.contextExists).toBe(true);
                    expect(result.results.contextValidation.contextStaged).toBe(true);
                }

                // Property: Context validation metadata should be consistent
                expect(result.results.contextValidation.contextExists).toBe(contextExists);
                // Note: contextStaged in result depends on git diff output
                if (hasCodeChanges) {
                    expect(result.results.contextValidation.contextStaged).toBe(contextStaged);
                }
            }
        ), { numRuns: 20 });
    });

    test('should handle git command failures gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.constantFrom('test.js', 'app.ts'), { maxLength: 2 }),
            fc.string().filter(s => s.length > 0),
            async (stagedFiles, errorMessage) => {
                // Mock git command failure
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git diff --cached --name-only')) {
                        const error = new Error(errorMessage);
                        error.code = 'ENOENT';
                        throw error;
                    }
                    return '';
                });

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Git command failures should not crash context validation
                expect(result.results.contextValidation).toBeDefined();

                // Property: Should handle git failures gracefully
                if (result.results.contextValidation.status === 'failed') {
                    expect(result.results.contextValidation.error).toBeDefined();
                } else {
                    // Should fall back to using provided staged files
                    expect(result.results.contextValidation.status).toMatch(/^(passed|warning|skipped)$/);
                }
            }
        ), { numRuns: 10 });
    });

    test('should differentiate between code and non-code file changes', async () => {
        await fc.assert(fc.asyncProperty(
            fc.record({
                codeFiles: fc.array(fc.constantFrom('test', 'app', 'component'), { maxLength: 2 }),
                nonCodeFiles: fc.array(fc.constantFrom('readme', 'config', 'docs'), { maxLength: 2 }),
                contextStaged: fc.boolean()
            }),
            async ({ codeFiles, nonCodeFiles, contextStaged }) => {
                // Add appropriate extensions
                const codeFilesWithExt = codeFiles.map(f => `${f}.js`);
                const nonCodeFilesWithExt = nonCodeFiles.map(f => `${f}.md`);
                const allFiles = [...codeFilesWithExt, ...nonCodeFilesWithExt];

                // Mock git diff
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git diff --cached --name-only')) {
                        const filesToReturn = [...allFiles];
                        if (contextStaged) {
                            filesToReturn.push('activeContext.md');
                        }
                        return filesToReturn.join('\n');
                    }
                    return '';
                });

                mockFs.existsSync.mockReturnValue(true);
                mockFs.readFileSync.mockImplementation((path) => {
                    if (path.includes('activeContext.md')) {
                        return 'Current work: 2024-01-01 - Working on implementing new features';
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                const result = await orchestrator.executePreCommit(allFiles);

                // Property: Should correctly identify code vs non-code changes
                const hasCodeChanges = codeFilesWithExt.length > 0;

                if (!hasCodeChanges) {
                    // Only non-code files changed
                    expect(result.results.contextValidation.status).toBe('passed');
                    expect(result.results.contextValidation.message).toContain('No code changes detected');
                } else {
                    // Code files changed
                    if (contextStaged) {
                        expect(result.results.contextValidation.status).toMatch(/^(passed|warning)$/);
                    } else {
                        expect(result.results.contextValidation.status).toBe('failed');
                        expect(result.results.contextValidation.message).toContain('Code changes detected but activeContext.md not updated');
                    }
                }
            }
        ), { numRuns: 10 });
    });

    test('should maintain consistent validation across multiple executions', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.constantFrom('test', 'app', 'component'), { minLength: 1, maxLength: 2 }),
            fc.boolean(),
            fc.boolean(),
            async (baseFiles, contextExists, contextStaged) => {
                const codeFiles = baseFiles.map(f => `${f}.js`);

                // Setup consistent mocks
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git diff --cached --name-only')) {
                        const files = [...codeFiles];
                        if (contextStaged) files.push('activeContext.md');
                        return files.join('\n');
                    }
                    return '';
                });

                mockFs.existsSync.mockImplementation((path) => {
                    if (path.includes('activeContext.md')) return contextExists;
                    return true;
                });

                mockFs.readFileSync.mockImplementation((path) => {
                    if (path.includes('activeContext.md')) {
                        return 'Date: 2024-01-01\nCurrently implementing new features for the project.';
                    }
                    return '{"scripts":{"test":"jest"}}';
                });

                // Run validation multiple times
                const results = [];
                for (let i = 0; i < 2; i++) {
                    const result = await orchestrator.executePreCommit(codeFiles);
                    results.push(result.results.contextValidation);
                }

                // Property: Multiple executions with same input should produce consistent results
                const firstResult = results[0];
                results.forEach((result, index) => {
                    expect(result.status).toBe(firstResult.status);
                    expect(result.contextExists).toBe(firstResult.contextExists);
                    expect(result.contextStaged).toBe(firstResult.contextStaged);

                    // Message should be consistent for same conditions
                    if (firstResult.message) {
                        expect(result.message).toBe(firstResult.message);
                    }
                });
            }
        ), { numRuns: 5 });
    });
});