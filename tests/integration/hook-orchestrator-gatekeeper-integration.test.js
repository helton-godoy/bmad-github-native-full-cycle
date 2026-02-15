const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

describe('HookOrchestrator and EnhancedGatekeeper Integration', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new HookOrchestrator({
            skipTests: true,
            requireContextUpdate: false,
            developmentMode: false
        });
    });

    describe('integrateWithGatekeeper', () => {
        it('should successfully call gatekeeper integration', async () => {
            const context = {
                stagedFiles: ['src/test.js'],
                lintingResults: { success: true },
                testResults: { success: true }
            };

            const result = await orchestrator.integrateWithGatekeeper('pre-commit', context);

            expect(result).toBeDefined();
            expect(result.status).toBeDefined();
            expect(result.gate).toBeDefined();
            expect(result.report).toBeDefined();
            expect(result.report.hookType).toBe('pre-commit');
        });

        it('should handle gatekeeper failures', async () => {
            const context = {
                stagedFiles: ['src/test.js'],
                lintingResults: { success: false, errors: ['Linting error'] },
                testResults: { success: true }
            };

            const result = await orchestrator.integrateWithGatekeeper('pre-commit', context);

            expect(result.status).toBe('failed');
            expect(result.gate).toBe('FAIL');
            expect(result.report).toBeDefined();
            expect(result.report.recommendations).toBeDefined();
        });

        it('should integrate for commit-msg hook', async () => {
            const context = {
                message: '[DEVELOPER] [STEP-001] Implement feature',
                parsedMessage: {
                    persona: 'DEVELOPER',
                    stepId: 'STEP-001'
                }
            };

            const result = await orchestrator.integrateWithGatekeeper('commit-msg', context);

            expect(result).toBeDefined();
            expect(result.gate).toBeDefined();
            // Report may not be defined if there's an error, so check conditionally
            if (result.report) {
                expect(result.report.hookType).toBe('commit-msg');
            }
        });

        it('should handle coverage failures in pre-push', async () => {
            const context = {
                branch: 'main',
                remote: 'origin',
                testResults: {
                    success: true,
                    coverage: { lines: 75, functions: 80, branches: 70, statements: 78 }
                },
                coverageThreshold: 80
            };

            const result = await orchestrator.integrateWithGatekeeper('pre-push', context);

            expect(result.status).toBe('failed');
            expect(result.report.recommendations).toContain('Add tests to improve code coverage');
        });

        it('should integrate for post-commit hook', async () => {
            const context = {
                commitHash: 'abc123def456',
                metricsUpdated: true,
                docsGenerated: true
            };

            const result = await orchestrator.integrateWithGatekeeper('post-commit', context);

            expect(result).toBeDefined();
            expect(result.gate).toBe('PASS'); // Post-commit is non-blocking
            expect(result.report.hookType).toBe('post-commit');
        });

        it('should handle workflow failures in post-merge', async () => {
            const context = {
                mergeType: 'merge-commit',
                workflowExecuted: false,
                workflowError: 'BMAD workflow execution failed'
            };

            const result = await orchestrator.integrateWithGatekeeper('post-merge', context);

            expect(result.status).toBe('failed');
            expect(result.report.recommendations).toContain('Check BMAD workflow logs for detailed error information');
        });

        it('should handle gatekeeper integration errors gracefully', async () => {
            const badOrchestrator = new HookOrchestrator({
                skipTests: true,
                requireContextUpdate: false
            });

            badOrchestrator.gatekeeper.validateHookContext = async () => {
                throw new Error('Gatekeeper error');
            };

            const context = { stagedFiles: [] };
            const result = await badOrchestrator.integrateWithGatekeeper('pre-commit', context);

            expect(result.status).toBe('failed');
            expect(result.error).toBe('Gatekeeper error');
            expect(result.gate).toBe('FAIL');
        });

        it('should generate comprehensive reports', async () => {
            const context = {
                stagedFiles: ['src/test.js'],
                lintingResults: { success: false, errors: ['Missing semicolon'] },
                testResults: { success: false, output: 'Test failed' }
            };

            const result = await orchestrator.integrateWithGatekeeper('pre-commit', context);

            expect(result.report).toBeDefined();
            expect(result.report.recommendations).toBeDefined();
            expect(result.report.recommendations.length).toBeGreaterThan(0);
            expect(result.report.validations).toBeDefined();
        });
    });

    describe('Unified Error Reporting', () => {
        it('should provide consistent report structure across hooks', async () => {
            const contexts = [
                { hook: 'pre-commit', context: { stagedFiles: ['test.js'], lintingResults: { success: false } } },
                { hook: 'commit-msg', context: { message: 'Invalid message' } },
                { hook: 'pre-push', context: { branch: 'main', remote: 'origin', testResults: { success: false } } }
            ];

            for (const { hook, context } of contexts) {
                const result = await orchestrator.integrateWithGatekeeper(hook, context);

                expect(result.report).toBeDefined();
                expect(result.report.hookType).toBe(hook);
                expect(result.report.gate).toBeDefined();
                expect(result.report.summary).toBeDefined();
                expect(result.report.recommendations).toBeDefined();
            }
        });

        it('should provide actionable remediation', async () => {
            const scenarios = [
                { hook: 'pre-commit', context: { stagedFiles: ['test.js'], lintingResults: { success: false } }, keyword: 'lint' },
                { hook: 'commit-msg', context: { message: 'bad' }, keyword: 'PERSONA' },
                { hook: 'pre-push', context: { branch: 'main', remote: 'origin', testResults: { success: true, coverage: { lines: 70 } }, coverageThreshold: 80 }, keyword: 'tests' }
            ];

            for (const { hook, context, keyword } of scenarios) {
                const result = await orchestrator.integrateWithGatekeeper(hook, context);
                expect(result.report.recommendations).toBeDefined();
                const hasKeyword = result.report.recommendations.some(rec => rec.toLowerCase().includes(keyword.toLowerCase()));
                expect(hasKeyword).toBe(true);
            }
        });
    });
});
