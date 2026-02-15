const EnhancedGatekeeper = require('../../scripts/lib/enhanced-gatekeeper');

describe('EnhancedGatekeeper Hook Integration', () => {
    let gatekeeper;

    beforeEach(() => {
        gatekeeper = new EnhancedGatekeeper({
            requireContextUpdate: false,
            skipTests: true,
            developmentMode: false
        });
    });

    describe('validateHookContext', () => {
        it('should validate pre-commit hook context successfully', async () => {
            const context = {
                stagedFiles: ['src/test.js', 'src/utils.js'],
                lintingResults: { success: true },
                testResults: { success: true }
            };

            const result = await gatekeeper.validateHookContext('pre-commit', context);

            expect(result.hookType).toBe('pre-commit');
            expect(result.gate).toBe('PASS');
            expect(result.validations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'staged_files',
                        status: 'passed'
                    })
                ])
            );
        });

        it('should fail pre-commit validation when linting fails', async () => {
            const context = {
                stagedFiles: ['src/test.js'],
                lintingResults: { success: false, errors: ['Missing semicolon'] },
                testResults: { success: true }
            };

            const result = await gatekeeper.validateHookContext('pre-commit', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'LINTING_ERROR'
                    })
                ])
            );
        });

        it('should validate commit-msg hook context successfully', async () => {
            const context = {
                message: '[DEVELOPER] [STEP-001] Implement feature',
                parsedMessage: {
                    persona: 'DEVELOPER',
                    stepId: 'STEP-001'
                }
            };

            const result = await gatekeeper.validateHookContext('commit-msg', context);

            expect(result.hookType).toBe('commit-msg');
            expect(result.gate).toBe('PASS');
            expect(result.hookSpecific.persona).toBe('DEVELOPER');
            expect(result.hookSpecific.stepId).toBe('STEP-001');
        });

        it('should fail commit-msg validation with invalid format', async () => {
            const context = {
                message: 'Invalid commit message'
            };

            const result = await gatekeeper.validateHookContext('commit-msg', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'COMMIT_FORMAT_ERROR'
                    })
                ])
            );
        });

        it('should validate pre-push hook context with coverage', async () => {
            const context = {
                branch: 'main',
                remote: 'origin',
                testResults: {
                    success: true,
                    coverage: { lines: 85, functions: 90, branches: 82, statements: 87 }
                },
                buildResults: { success: true },
                securityResults: { vulnerabilities: 0 },
                coverageThreshold: 80
            };

            const result = await gatekeeper.validateHookContext('pre-push', context);

            expect(result.gate).toBe('PASS');
            expect(result.validations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'coverage',
                        status: 'passed'
                    })
                ])
            );
        });

        it('should fail pre-push validation when coverage is below threshold', async () => {
            const context = {
                branch: 'main',
                remote: 'origin',
                testResults: {
                    success: true,
                    coverage: { lines: 75, functions: 80, branches: 70, statements: 78 }
                },
                coverageThreshold: 80
            };

            const result = await gatekeeper.validateHookContext('pre-push', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'COVERAGE_ERROR'
                    })
                ])
            );
        });

        it('should handle security vulnerabilities in pre-push', async () => {
            const context = {
                branch: 'main',
                remote: 'origin',
                securityResults: {
                    vulnerabilities: 3,
                    severity: 'high',
                    details: 'High severity vulnerabilities found'
                }
            };

            const result = await gatekeeper.validateHookContext('pre-push', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'SECURITY_ERROR'
                    })
                ])
            );
        });

        it('should validate post-commit hook context (non-blocking)', async () => {
            const context = {
                commitHash: 'abc123def456',
                metricsUpdated: true,
                docsGenerated: true
            };

            const result = await gatekeeper.validateHookContext('post-commit', context);

            expect(result.hookType).toBe('post-commit');
            expect(result.gate).toBe('PASS');
            expect(result.validations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'commit_hash',
                        status: 'passed'
                    })
                ])
            );
        });

        it('should handle post-commit failures as warnings', async () => {
            const context = {
                commitHash: 'abc123def456',
                metricsUpdated: false,
                docsGenerated: false
            };

            const result = await gatekeeper.validateHookContext('post-commit', context);

            expect(result.gate).toBe('PASS'); // Non-blocking
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should validate post-merge hook context', async () => {
            const context = {
                mergeType: 'fast-forward',
                workflowExecuted: true,
                repositoryStateValid: true
            };

            const result = await gatekeeper.validateHookContext('post-merge', context);

            expect(result.hookType).toBe('post-merge');
            expect(result.gate).toBe('PASS');
        });

        it('should fail post-merge validation when workflow fails', async () => {
            const context = {
                mergeType: 'merge-commit',
                workflowExecuted: false,
                workflowError: 'BMAD workflow execution failed'
            };

            const result = await gatekeeper.validateHookContext('post-merge', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'WORKFLOW_ERROR'
                    })
                ])
            );
        });

        it('should validate pre-rebase hook context', async () => {
            const context = {
                sourceBranch: 'feature-branch',
                targetBranch: 'main',
                safetyCheck: { safe: true }
            };

            const result = await gatekeeper.validateHookContext('pre-rebase', context);

            expect(result.gate).toBe('PASS');
        });

        it('should fail pre-rebase validation when unsafe', async () => {
            const context = {
                sourceBranch: 'feature-branch',
                targetBranch: 'main',
                safetyCheck: { safe: false, reason: 'Conflicts detected' }
            };

            const result = await gatekeeper.validateHookContext('pre-rebase', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'REBASE_SAFETY_ERROR'
                    })
                ])
            );
        });

        it('should validate post-checkout hook context (non-blocking)', async () => {
            const context = {
                newBranch: 'feature-branch',
                contextRestored: true
            };

            const result = await gatekeeper.validateHookContext('post-checkout', context);

            expect(result.gate).toBe('PASS');
        });

        it('should validate pre-receive hook context', async () => {
            const context = {
                oldCommit: 'abc123',
                newCommit: 'def456',
                refName: 'refs/heads/main',
                commitsValid: true,
                branchProtected: false
            };

            const result = await gatekeeper.validateHookContext('pre-receive', context);

            expect(result.gate).toBe('PASS');
        });

        it('should fail pre-receive validation for protected branch', async () => {
            const context = {
                oldCommit: 'abc123',
                newCommit: 'def456',
                refName: 'refs/heads/main',
                branchProtected: true,
                protectionRules: 'Direct pushes not allowed'
            };

            const result = await gatekeeper.validateHookContext('pre-receive', context);

            expect(result.gate).toBe('FAIL');
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'BRANCH_PROTECTION_ERROR'
                    })
                ])
            );
        });

        it('should handle unknown hook types gracefully', async () => {
            const context = {};

            const result = await gatekeeper.validateHookContext('unknown-hook', context);

            expect(result.warnings).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'UNKNOWN_HOOK_TYPE'
                    })
                ])
            );
        });

        it('should apply development bypass when enabled', async () => {
            // Create gatekeeper in development mode
            const devGatekeeper = new EnhancedGatekeeper({
                requireContextUpdate: false,
                skipTests: true,
                developmentMode: true
            });

            devGatekeeper.enableDevelopmentMode(true, 'Testing bypass');

            const context = {
                stagedFiles: [],
                lintingResults: { success: false }
            };

            const result = await devGatekeeper.validateHookContext('pre-commit', context);

            expect(result.gate).toBe('WAIVED');
            expect(result.waiver.active).toBe(true);
        });
    });

    describe('generateHookReport', () => {
        it('should generate comprehensive hook report', () => {
            const validationResult = {
                hookType: 'pre-commit',
                gate: 'PASS',
                timestamp: new Date().toISOString(),
                validations: [
                    { name: 'linting', status: 'passed', message: 'Linting passed' },
                    { name: 'tests', status: 'passed', message: 'Tests passed' }
                ],
                errors: [],
                warnings: [],
                waiver: { active: false },
                hookSpecific: {}
            };

            const report = gatekeeper.generateHookReport(validationResult);

            expect(report.hookType).toBe('pre-commit');
            expect(report.gate).toBe('PASS');
            expect(report.summary).toContain('passed');
            expect(report.validations.passed).toHaveLength(2);
            expect(report.recommendations).toBeDefined();
        });

        it('should include recommendations for failed validations', () => {
            const validationResult = {
                hookType: 'pre-commit',
                gate: 'FAIL',
                timestamp: new Date().toISOString(),
                validations: [
                    { name: 'linting', status: 'failed', message: 'Linting failed' }
                ],
                errors: [
                    { type: 'LINTING_ERROR', message: 'Code linting failed' }
                ],
                warnings: [],
                waiver: { active: false },
                hookSpecific: {}
            };

            const report = gatekeeper.generateHookReport(validationResult);

            expect(report.gate).toBe('FAIL');
            expect(report.recommendations).toContain('Run npm run lint:fix to automatically fix linting issues');
        });

        it('should generate hook-specific recommendations for commit-msg', () => {
            const validationResult = {
                hookType: 'commit-msg',
                gate: 'FAIL',
                timestamp: new Date().toISOString(),
                validations: [],
                errors: [
                    { type: 'COMMIT_FORMAT_ERROR', message: 'Invalid format' }
                ],
                warnings: [],
                waiver: { active: false },
                hookSpecific: {}
            };

            const report = gatekeeper.generateHookReport(validationResult);

            expect(report.recommendations).toContain('Use format: [PERSONA] [STEP-ID] Description');
        });

        it('should generate hook-specific recommendations for pre-push', () => {
            const validationResult = {
                hookType: 'pre-push',
                gate: 'FAIL',
                timestamp: new Date().toISOString(),
                validations: [],
                errors: [
                    { type: 'COVERAGE_ERROR', message: 'Coverage below threshold' },
                    { type: 'SECURITY_ERROR', message: 'Vulnerabilities detected' }
                ],
                warnings: [],
                waiver: { active: false },
                hookSpecific: {}
            };

            const report = gatekeeper.generateHookReport(validationResult);

            expect(report.recommendations).toContain('Add tests to improve code coverage');
            expect(report.recommendations).toContain('Run npm audit fix to resolve security vulnerabilities');
        });
    });

    describe('generateHookSummary', () => {
        it('should generate summary for passed validation', () => {
            const validationResult = {
                hookType: 'pre-commit',
                gate: 'PASS',
                validations: [
                    { status: 'passed' },
                    { status: 'passed' }
                ],
                errors: [],
                warnings: []
            };

            const summary = gatekeeper.generateHookSummary(validationResult);

            expect(summary).toContain('pre-commit');
            expect(summary).toContain('passed');
            expect(summary).toContain('2 checks passed');
        });

        it('should generate summary for failed validation', () => {
            const validationResult = {
                hookType: 'pre-push',
                gate: 'FAIL',
                validations: [
                    { status: 'passed' },
                    { status: 'failed' }
                ],
                errors: [],
                warnings: [{ type: 'WARNING' }]
            };

            const summary = gatekeeper.generateHookSummary(validationResult);

            expect(summary).toContain('pre-push');
            expect(summary).toContain('failed');
            expect(summary).toContain('1 failed');
            expect(summary).toContain('1 warning');
        });
    });
});
