/**
 * Property-Based Tests for Server-Side Validation
 * **Feature: git-hooks-automation, Property 18: Server-side validation capability**
 * **Validates: Requirements 6.3**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');
const fs = require('fs');
const path = require('path');

// Arbitraries for test data generation
const refNameArb = fc.oneof(
    fc.constantFrom('refs/heads/main', 'refs/heads/develop', 'refs/heads/feature/auth'),
    fc.string({ minLength: 3, maxLength: 30 }).map(s => `refs/heads/${s.replace(/[^a-z0-9-]/gi, '-')}`)
);

const commitHashArb = fc.array(
    fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
    { minLength: 40, maxLength: 40 }
).map(chars => chars.join(''));

const pushInfoArb = fc.record({
    oldCommit: commitHashArb,
    newCommit: commitHashArb,
    refName: refNameArb
});

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Server-Side Validation Property Tests', () => {
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
            enableGatekeeper: true
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 18: Server-side validation capability**
     * **Validates: Requirements 6.3**
     */
    test('should provide pre-receive validation for any push operation', async () => {
        await fc.assert(fc.asyncProperty(
            pushInfoArb,
            fc.array(
                fc.record({
                    hash: commitHashArb,
                    message: fc.oneof(
                        // Valid BMAD format
                        fc.record({
                            persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA', 'DEVOPS'),
                            stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3)}`),
                            description: fc.string({ minLength: 10, maxLength: 50 })
                        }).map(m => `[${m.persona}] [${m.stepId}] ${m.description}`),
                        // Invalid format
                        fc.string({ minLength: 10, maxLength: 50 })
                    ),
                    author: fc.string({ minLength: 5, maxLength: 30 })
                }),
                { minLength: 1, maxLength: 20 }
            ),
            async (pushInfo, commits) => {
                // Mock git commands for pre-receive validation
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-list')) {
                        return commits.map(c => c.hash).join('\n');
                    }
                    if (command.includes('git log --format')) {
                        return commits.map(c => `${c.hash}\n${c.author}\n${c.message}`).join('\n---\n');
                    }
                    if (command.includes('git show -s --format=%B')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        return commit ? commit.message : '';
                    }
                    if (command.includes('git cat-file -t')) {
                        return 'commit';
                    }
                    return '';
                });

                const result = await orchestrator.executePreReceive(
                    pushInfo.oldCommit,
                    pushInfo.newCommit,
                    pushInfo.refName
                );

                // Property: Pre-receive should always complete (Requirement 6.3)
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Server-side validation should be performed
                expect(result.results).toBeDefined();
                expect(result.results.commitValidation).toBeDefined();
                expect(result.results.commitValidation.status).toMatch(/^(passed|warning|failed)$/);

                // Property: All commits should be validated
                expect(result.results.commitValidation.commitsAnalyzed).toBe(commits.length);

                // Property: BMAD pattern validation should be performed
                const validCommits = commits.filter(c =>
                    c.message.match(/^\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]\s+(.+)$/)
                );
                const invalidCommits = commits.length - validCommits.length;

                if (invalidCommits > 0) {
                    expect(result.results.commitValidation.invalidCommits).toBeGreaterThan(0);
                }

                // Property: Branch protection should be checked
                expect(result.results.branchProtection).toBeDefined();
                expect(result.results.branchProtection.status).toMatch(/^(passed|warning|failed)$/);

                // Property: Execution should be recorded in metrics
                const executionMetrics = orchestrator.getMetrics();
                expect(executionMetrics.executions.length).toBeGreaterThan(0);

                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('pre-receive');
            }
        ), { numRuns: 5 });
    });

    test('should reject pushes to protected branches without proper validation', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('refs/heads/main', 'refs/heads/master', 'refs/heads/production'),
            commitHashArb,
            commitHashArb,
            fc.array(
                fc.record({
                    hash: commitHashArb,
                    message: fc.string({ minLength: 10, maxLength: 50 }), // Invalid format
                    author: fc.string({ minLength: 5, maxLength: 30 })
                }),
                { minLength: 1, maxLength: 5 }
            ),
            async (protectedRef, oldCommit, newCommit, commits) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-list')) {
                        return commits.map(c => c.hash).join('\n');
                    }
                    if (command.includes('git show -s --format=%B')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        return commit ? commit.message : '';
                    }
                    return '';
                });

                const result = await orchestrator.executePreReceive(oldCommit, newCommit, protectedRef);

                // Property: Protected branches should have stricter validation
                expect(result.results.branchProtection).toBeDefined();
                expect(result.results.branchProtection.isProtected).toBe(true);

                // Property: Invalid commits to protected branches should fail
                const hasInvalidCommits = commits.some(c =>
                    !c.message.match(/^\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]\s+(.+)$/)
                );

                if (hasInvalidCommits) {
                    expect(result.success).toBe(false);
                    expect(result.results.commitValidation.status).toBe('failed');
                }
            }
        ), { numRuns: 5 });
    });

    test('should validate commit signatures and author information', async () => {
        await fc.assert(fc.asyncProperty(
            pushInfoArb,
            fc.array(
                fc.record({
                    hash: commitHashArb,
                    message: fc.record({
                        persona: fc.constantFrom('DEVELOPER', 'ARCHITECT'),
                        stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3)}`),
                        description: fc.string({ minLength: 10, maxLength: 50 })
                    }).map(m => `[${m.persona}] [${m.stepId}] ${m.description}`),
                    author: fc.string({ minLength: 5, maxLength: 30 }),
                    email: fc.emailAddress(),
                    signed: fc.boolean()
                }),
                { minLength: 1, maxLength: 10 }
            ),
            async (pushInfo, commits) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-list')) {
                        return commits.map(c => c.hash).join('\n');
                    }
                    if (command.includes('git show -s --format=%B')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        return commit ? commit.message : '';
                    }
                    if (command.includes('git show -s --format=%an')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        return commit ? commit.author : '';
                    }
                    if (command.includes('git show -s --format=%ae')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        return commit ? commit.email : '';
                    }
                    if (command.includes('git verify-commit')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        if (commit && !commit.signed) {
                            throw new Error('No signature found');
                        }
                        return 'Good signature';
                    }
                    return '';
                });

                const result = await orchestrator.executePreReceive(
                    pushInfo.oldCommit,
                    pushInfo.newCommit,
                    pushInfo.refName
                );

                // Property: Author information should be validated
                expect(result.results.authorValidation).toBeDefined();
                expect(result.results.authorValidation.status).toMatch(/^(passed|warning|failed)$/);

                // Property: All commits should have author information checked
                expect(result.results.authorValidation.commitsChecked).toBe(commits.length);
            }
        ), { numRuns: 5 });
    });

    test('should enforce size limits on push operations', async () => {
        await fc.assert(fc.asyncProperty(
            pushInfoArb,
            fc.integer({ min: 1, max: 100 }), // number of commits
            fc.integer({ min: 1, max: 10000 }), // total size in KB
            async (pushInfo, commitCount, totalSizeKB) => {
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git rev-list --count')) {
                        return commitCount.toString();
                    }
                    if (command.includes('git rev-list')) {
                        return Array.from({ length: commitCount }, (_, i) =>
                            `${'a'.repeat(40)}${i.toString().padStart(2, '0')}`
                        ).join('\n');
                    }
                    if (command.includes('git cat-file -s')) {
                        return Math.floor(totalSizeKB * 1024 / commitCount).toString();
                    }
                    return '';
                });

                const result = await orchestrator.executePreReceive(
                    pushInfo.oldCommit,
                    pushInfo.newCommit,
                    pushInfo.refName
                );

                // Property: Size limits should be checked
                expect(result.results.sizeValidation).toBeDefined();
                expect(result.results.sizeValidation.status).toMatch(/^(passed|warning|failed)$/);

                // Property: Commit count should be validated
                expect(result.results.sizeValidation.commitCount).toBe(commitCount);

                // Property: Large pushes should trigger warnings
                if (commitCount > 50) {
                    expect(result.results.sizeValidation.status).toBe('failed');
                } else if (commitCount > 20) {
                    expect(result.results.sizeValidation.status).toBe('warning');
                }
            }
        ), { numRuns: 5 });
    });

    test('should handle force pushes with additional validation', async () => {
        await fc.assert(fc.asyncProperty(
            pushInfoArb,
            fc.boolean(), // is force push
            fc.boolean(), // is protected branch
            async (pushInfo, isForcePush, isProtectedBranch) => {
                const refName = isProtectedBranch ? 'refs/heads/main' : pushInfo.refName;

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git merge-base --is-ancestor')) {
                        if (isForcePush) {
                            throw new Error('Not an ancestor');
                        }
                        return '';
                    }
                    if (command.includes('git rev-list')) {
                        return 'abc123\ndef456';
                    }
                    return '';
                });

                const result = await orchestrator.executePreReceive(
                    pushInfo.oldCommit,
                    pushInfo.newCommit,
                    refName
                );

                // Property: Force push detection should work
                expect(result.results.forcePushDetection).toBeDefined();
                expect(result.results.forcePushDetection.isForcePush).toBe(isForcePush);

                // Property: Force pushes to protected branches should be rejected
                if (isForcePush && isProtectedBranch) {
                    expect(result.success).toBe(false);
                    expect(result.results.forcePushDetection.status).toBe('failed');
                }

                // Property: Force pushes should be logged
                if (isForcePush) {
                    expect(result.results.forcePushDetection.auditTrail).toBeDefined();
                    expect(result.results.forcePushDetection.auditTrail.timestamp).toBeDefined();
                }
            }
        ), { numRuns: 5 });
    });

    test('should maintain performance within acceptable limits for server-side validation', async () => {
        await fc.assert(fc.asyncProperty(
            pushInfoArb,
            fc.integer({ min: 1, max: 30 }), // number of commits to validate
            async (pushInfo, commitCount) => {
                const commits = Array.from({ length: commitCount }, (_, i) => ({
                    hash: `${'a'.repeat(40)}${i.toString().padStart(2, '0')}`,
                    message: `[DEVELOPER] [STEP-${i}] Test commit ${i}`
                }));

                mockExecSync.mockImplementation((command) => {
                    // Simulate some processing time
                    const start = Date.now();
                    while (Date.now() - start < 5) {
                        // Small delay
                    }

                    if (command.includes('git rev-list')) {
                        return commits.map(c => c.hash).join('\n');
                    }
                    if (command.includes('git show -s --format=%B')) {
                        const hash = command.match(/([a-f0-9]{40})/)?.[1];
                        const commit = commits.find(c => c.hash === hash);
                        return commit ? commit.message : '';
                    }
                    return '';
                });

                const startTime = Date.now();
                const result = await orchestrator.executePreReceive(
                    pushInfo.oldCommit,
                    pushInfo.newCommit,
                    pushInfo.refName
                );
                const endTime = Date.now();
                const actualDuration = endTime - startTime;

                // Property: Pre-receive should complete successfully
                expect(result.success).toBeDefined();

                // Property: Performance should be within acceptable limits
                expect(result.duration).toBeGreaterThanOrEqual(0);
                expect(actualDuration).toBeLessThan(10000); // Should complete within 10 seconds

                // Property: Performance metrics should be tracked
                const executionMetrics = orchestrator.getMetrics();
                const lastExecution = executionMetrics.executions[executionMetrics.executions.length - 1];

                expect(lastExecution.duration).toBeGreaterThanOrEqual(0);
                expect(typeof lastExecution.performanceThresholdMet).toBe('boolean');
            }
        ), { numRuns: 5 });
    });
});
