const HookErrorHandler = require('../../scripts/hooks/hook-error-handler');
const fs = require('fs');
const { execSync } = require('child_process');

jest.mock('fs');
jest.mock('child_process');

describe('HookErrorHandler', () => {
    let errorHandler;

    beforeEach(() => {
        errorHandler = new HookErrorHandler({
            auditLogPath: '.git/hooks/test-audit.log',
            maxRecoveryAttempts: 3,
        });
        jest.clearAllMocks();
    });

    describe('Error Classification', () => {
        test('should classify test failure as blocking', () => {
            const error = new Error('Test suite failed with 3 failures');
            const classification = errorHandler.classifyError(error, 'pre-commit');

            expect(classification.severity).toBe('blocking');
            expect(classification.category).toBe('TEST_FAILURE');
            expect(classification.blockingType).toBe('hard');
        });

        test('should classify build failure as blocking', () => {
            const error = new Error('Build failed: compilation error');
            const classification = errorHandler.classifyError(error, 'pre-push');

            expect(classification.severity).toBe('blocking');
            expect(classification.category).toBe('BUILD_FAILURE');
        });

        test('should classify security vulnerability as blocking', () => {
            const error = new Error('Security vulnerability detected in dependencies');
            const classification = errorHandler.classifyError(error, 'pre-push');

            expect(classification.severity).toBe('blocking');
            expect(classification.category).toBe('SECURITY_VULNERABILITY');
        });

        test('should classify invalid commit message as blocking', () => {
            const error = new Error('Invalid commit message format');
            const classification = errorHandler.classifyError(error, 'commit-msg');

            expect(classification.severity).toBe('blocking');
            expect(classification.category).toBe('INVALID_COMMIT_MESSAGE');
        });

        test('should classify lint error as blocking but recoverable', () => {
            const error = new Error('Lint error: missing semicolon');
            const classification = errorHandler.classifyError(error, 'pre-commit');

            expect(classification.severity).toBe('blocking');
            expect(classification.category).toBe('LINT_ERROR');
            expect(classification.recoverable).toBe(true);
        });

        test('should classify missing context update as warning', () => {
            const error = new Error('Context not updated for current session');
            const classification = errorHandler.classifyError(error, 'pre-commit');

            expect(classification.severity).toBe('warning');
            expect(classification.category).toBe('MISSING_CONTEXT_UPDATE');
            expect(classification.bypassable).toBe(true);
        });

        test('should classify performance threshold as warning', () => {
            const error = new Error('Performance threshold exceeded');
            const classification = errorHandler.classifyError(error, 'pre-commit');

            expect(classification.severity).toBe('warning');
            expect(classification.category).toBe('PERFORMANCE_THRESHOLD');
        });

        test('should classify notification failure as non-blocking', () => {
            const error = new Error('Notification failed to send');
            const classification = errorHandler.classifyError(error, 'post-commit');

            expect(classification.severity).toBe('non-blocking');
            expect(classification.category).toBe('NOTIFICATION_FAILURE');
        });

        test('should classify documentation generation failure as non-blocking', () => {
            const error = new Error('Documentation generation failed');
            const classification = errorHandler.classifyError(error, 'post-commit');

            expect(classification.severity).toBe('non-blocking');
            expect(classification.category).toBe('DOCUMENTATION_FAILURE');
        });

        test('should classify metrics update failure as non-blocking', () => {
            const error = new Error('Metrics update failed');
            const classification = errorHandler.classifyError(error, 'post-commit');

            expect(classification.severity).toBe('non-blocking');
            expect(classification.category).toBe('METRICS_FAILURE');
        });

        test('should default to non-blocking for post-commit unknown errors', () => {
            const error = new Error('Unknown error occurred');
            const classification = errorHandler.classifyError(error, 'post-commit');

            expect(classification.severity).toBe('non-blocking');
            expect(classification.category).toBe('UNKNOWN_POST_HOOK_ERROR');
        });

        test('should default to blocking for pre-commit unknown errors', () => {
            const error = new Error('Unknown error occurred');
            const classification = errorHandler.classifyError(error, 'pre-commit');

            expect(classification.severity).toBe('blocking');
            expect(classification.category).toBe('UNKNOWN_ERROR');
        });
    });

    describe('Automatic Recovery', () => {
        test('should not attempt recovery when disabled', async () => {
            const handler = new HookErrorHandler({ enableAutoRecovery: false });
            const error = new Error('Lint error');
            const result = await handler.attemptRecovery(error, { hookType: 'pre-commit' });

            expect(result.successful).toBe(false);
            expect(result.reason).toBe('Auto-recovery disabled');
        });

        test('should not attempt recovery for non-recoverable errors', async () => {
            const error = new Error('Test suite failed');
            const result = await errorHandler.attemptRecovery(error, { hookType: 'pre-commit' });

            expect(result.successful).toBe(false);
            expect(result.reason).toBe('Error not recoverable');
        });

        test('should limit recovery attempts', async () => {
            const error = new Error('Lint error');
            const context = { hookType: 'pre-commit', stagedFiles: [] };

            // Attempt recovery multiple times
            await errorHandler.attemptRecovery(error, context);
            await errorHandler.attemptRecovery(error, context);
            await errorHandler.attemptRecovery(error, context);
            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(false);
            expect(result.reason).toBe('Max recovery attempts exceeded');
            expect(result.attempts).toBe(3);
        });

        test('should recover from lint errors with auto-fix', async () => {
            const error = new Error('Lint error: missing semicolon');
            const context = {
                hookType: 'pre-commit',
                stagedFiles: ['file1.js', 'file2.js'],
            };

            execSync.mockReturnValue('');

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(true);
            expect(result.action).toBe('auto-fix');
            expect(result.filesFixed).toEqual(['file1.js', 'file2.js']);
            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('eslint --fix'),
                expect.any(Object)
            );
            expect(execSync).toHaveBeenCalledWith(
                expect.stringContaining('prettier --write'),
                expect.any(Object)
            );
        });

        test('should handle lint recovery failure gracefully', async () => {
            const error = new Error('Lint error');
            const context = {
                hookType: 'pre-commit',
                stagedFiles: ['file1.js'],
            };

            execSync.mockImplementation(() => {
                throw new Error('Fix failed');
            });

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(false);
            expect(result.reason).toBe('Auto-fix failed');
        });

        test('should recover from missing context by generating entry', async () => {
            const error = new Error('Context not updated');
            const context = {
                hookType: 'pre-commit',
                commitMessage: 'Add feature',
                persona: 'DEVELOPER',
            };

            fs.existsSync.mockReturnValue(true);
            fs.appendFileSync.mockReturnValue(undefined);

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(true);
            expect(result.action).toBe('auto-generate-context');
            expect(fs.appendFileSync).toHaveBeenCalledWith(
                'activeContext.md',
                expect.stringContaining('DEVELOPER')
            );
        });

        test('should handle missing context file', async () => {
            const error = new Error('Context not updated');
            const context = { hookType: 'pre-commit' };

            fs.existsSync.mockReturnValue(false);

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(false);
            expect(result.reason).toBe('Context file does not exist');
        });

        test('should recover from performance issues by enabling optimizations', async () => {
            const error = new Error('Performance threshold exceeded');
            const context = { hookType: 'pre-commit' };

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(true);
            expect(result.action).toBe('enable-optimizations');
            expect(result.optimizations).toBeDefined();
        });

        test('should provide coverage improvement guidance', async () => {
            const error = new Error('Coverage below threshold');
            const context = {
                hookType: 'pre-push',
                coverage: { branches: 70, functions: 75, lines: 78, statements: 76 },
                threshold: 80,
            };

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(true);
            expect(result.action).toBe('coverage-guidance');
            expect(result.gaps).toContain('branches');
            expect(result.recommendations).toBeDefined();
            expect(result.recommendations.length).toBeGreaterThan(0);
        });

        test('should recover from cache errors by rebuilding', async () => {
            const error = new Error('Cache error occurred');
            const context = { hookType: 'pre-commit' };

            fs.existsSync.mockReturnValue(true);
            fs.rmSync.mockReturnValue(undefined);
            fs.mkdirSync.mockReturnValue(undefined);

            const result = await errorHandler.attemptRecovery(error, context);

            expect(result.successful).toBe(true);
            expect(result.action).toBe('cache-rebuild');
            expect(fs.rmSync).toHaveBeenCalled();
            expect(fs.mkdirSync).toHaveBeenCalled();
        });
    });

    describe('Error Reporting', () => {
        test('should generate comprehensive error report', () => {
            const error = new Error('Test failure');
            const classification = {
                message: 'Test failure',
                code: 1,
                category: 'TEST_FAILURE',
                severity: 'blocking',
                blockingType: 'hard',
            };
            const recoveryResult = { successful: false, reason: 'Not recoverable' };

            const report = errorHandler.generateErrorReport(
                'pre-commit',
                error,
                classification,
                recoveryResult
            );

            expect(report.hookType).toBe('pre-commit');
            expect(report.error.category).toBe('TEST_FAILURE');
            expect(report.error.severity).toBe('blocking');
            expect(report.recovery).toEqual(recoveryResult);
            expect(report.remediation).toBeDefined();
            expect(report.remediation.steps).toBeDefined();
            expect(report.bypassOptions).toBeDefined();
            expect(report.impact).toBeDefined();
        });

        test('should include recovery information in remediation', () => {
            const error = new Error('Lint error');
            const classification = {
                message: 'Lint error',
                category: 'LINT_ERROR',
                severity: 'blocking',
            };
            const recoveryResult = {
                successful: true,
                action: 'auto-fix',
                details: 'Fixed 2 files',
            };

            const report = errorHandler.generateErrorReport(
                'pre-commit',
                error,
                classification,
                recoveryResult
            );

            expect(report.remediation.autoRecovery).toBeDefined();
            expect(report.remediation.autoRecovery.status).toBe('successful');
            expect(report.remediation.autoRecovery.action).toBe('auto-fix');
        });

        test('should provide remediation steps for test failures', () => {
            const classification = {
                category: 'TEST_FAILURE',
                severity: 'blocking',
            };

            const remediation = errorHandler.generateRemediation(classification, null);

            expect(remediation.steps).toContain('Review test output for specific failures');
            expect(remediation.commands).toContain('npm test');
        });

        test('should provide remediation steps for build failures', () => {
            const classification = {
                category: 'BUILD_FAILURE',
                severity: 'blocking',
            };

            const remediation = errorHandler.generateRemediation(classification, null);

            expect(remediation.steps).toContain('Check build logs for compilation errors');
            expect(remediation.commands).toContain('npm run build');
        });

        test('should provide remediation steps for security vulnerabilities', () => {
            const classification = {
                category: 'SECURITY_VULNERABILITY',
                severity: 'blocking',
            };

            const remediation = errorHandler.generateRemediation(classification, null);

            expect(remediation.steps).toContain('Review npm audit output for vulnerabilities');
            expect(remediation.commands).toContain('npm audit fix');
        });

        test('should provide remediation steps for invalid commit messages', () => {
            const classification = {
                category: 'INVALID_COMMIT_MESSAGE',
                severity: 'blocking',
            };

            const remediation = errorHandler.generateRemediation(classification, null);

            expect(remediation.steps).toContain('Use BMAD pattern: [PERSONA] [STEP-ID] Description');
            expect(remediation.commands.length).toBeGreaterThan(0);
        });
    });

    describe('Bypass Mechanisms', () => {
        test('should not provide bypass for non-blocking errors', () => {
            const classification = {
                severity: 'non-blocking',
                category: 'NOTIFICATION_FAILURE',
            };

            const options = errorHandler.getBypassOptions(classification);

            expect(options.available).toBe(false);
            expect(options.reason).toBe('Non-blocking errors do not require bypass');
        });

        test('should not provide bypass for critical blocking errors', () => {
            const classification = {
                severity: 'blocking',
                category: 'TEST_FAILURE',
                bypassable: false,
            };

            const options = errorHandler.getBypassOptions(classification);

            expect(options.available).toBe(false);
            expect(options.reason).toBe('Critical blocking errors cannot be bypassed');
        });

        test('should provide bypass options for bypassable errors', () => {
            const classification = {
                severity: 'warning',
                category: 'MISSING_CONTEXT_UPDATE',
                bypassable: true,
            };

            const options = errorHandler.getBypassOptions(classification);

            expect(options.available).toBe(true);
            expect(options.methods).toBeDefined();
            expect(options.methods.length).toBeGreaterThan(0);
            expect(options.methods[0].name).toBe('development-mode');
        });

        test('should record bypass in audit trail', () => {
            const classification = {
                category: 'MISSING_CONTEXT_UPDATE',
                severity: 'warning',
            };

            fs.existsSync.mockReturnValue(false);
            fs.mkdirSync.mockReturnValue(undefined);
            fs.appendFileSync.mockReturnValue(undefined);

            const record = errorHandler.recordBypass(
                'pre-commit',
                classification,
                'development-mode',
                'Testing feature'
            );

            expect(record.hookType).toBe('pre-commit');
            expect(record.errorCategory).toBe('MISSING_CONTEXT_UPDATE');
            expect(record.bypassMethod).toBe('development-mode');
            expect(record.reason).toBe('Testing feature');
            expect(fs.appendFileSync).toHaveBeenCalled();
        });

        test('should retrieve bypass audit trail', () => {
            const mockAuditLog = [
                JSON.stringify({
                    timestamp: '2024-01-01T00:00:00Z',
                    hookType: 'pre-commit',
                    errorCategory: 'MISSING_CONTEXT_UPDATE',
                    bypassMethod: 'development-mode',
                }),
                JSON.stringify({
                    timestamp: '2024-01-02T00:00:00Z',
                    hookType: 'commit-msg',
                    errorCategory: 'INVALID_COMMIT_MESSAGE',
                    bypassMethod: 'emergency-override',
                }),
            ].join('\n');

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(mockAuditLog);

            const trail = errorHandler.getBypassAuditTrail();

            expect(trail.length).toBe(2);
            expect(trail[0].hookType).toBe('pre-commit');
            expect(trail[1].hookType).toBe('commit-msg');
        });

        test('should handle missing audit log gracefully', () => {
            fs.existsSync.mockReturnValue(false);

            const trail = errorHandler.getBypassAuditTrail();

            expect(trail).toEqual([]);
        });
    });

    describe('Main Error Handling', () => {
        test('should handle hook error with classification and recovery', async () => {
            const error = new Error('Lint error');
            const context = {
                hookType: 'pre-commit',
                stagedFiles: ['file1.js'],
            };

            execSync.mockReturnValue('');

            const result = await errorHandler.handleHookError('pre-commit', error, context);

            expect(result.classification).toBeDefined();
            expect(result.recovery).toBeDefined();
            expect(result.report).toBeDefined();
            expect(result.shouldBlock).toBeDefined();
        });

        test('should block on unrecoverable blocking errors', async () => {
            const error = new Error('Test suite failed');
            const context = { hookType: 'pre-commit' };

            const result = await errorHandler.handleHookError('pre-commit', error, context);

            expect(result.shouldBlock).toBe(true);
            expect(result.classification.severity).toBe('blocking');
            expect(result.recovery.successful).toBe(false);
        });

        test('should not block on successful recovery', async () => {
            const error = new Error('Lint error');
            const context = {
                hookType: 'pre-commit',
                stagedFiles: ['file1.js'],
            };

            execSync.mockReturnValue('');

            const result = await errorHandler.handleHookError('pre-commit', error, context);

            expect(result.shouldBlock).toBe(false);
            expect(result.recovery.successful).toBe(true);
        });

        test('should not block on non-blocking errors', async () => {
            const error = new Error('Notification failed');
            const context = { hookType: 'post-commit' };

            const result = await errorHandler.handleHookError('post-commit', error, context);

            expect(result.shouldBlock).toBe(false);
            expect(result.classification.severity).toBe('non-blocking');
        });
    });

    describe('Helper Methods', () => {
        test('should assess impact for blocking errors', () => {
            const classification = { severity: 'blocking', category: 'TEST_FAILURE' };
            const impact = errorHandler.assessErrorImpact(classification, 'pre-commit');

            expect(impact.workflow).toBe('Blocks current operation');
            expect(impact.team).toBe('Prevents commit/push from completing');
        });

        test('should assess impact for warning errors', () => {
            const classification = { severity: 'warning', category: 'MISSING_CONTEXT_UPDATE' };
            const impact = errorHandler.assessErrorImpact(classification, 'pre-commit');

            expect(impact.workflow).toBe('Allows operation with warnings');
            expect(impact.team).toBe('May require follow-up action');
        });

        test('should assess impact for non-blocking errors', () => {
            const classification = { severity: 'non-blocking', category: 'NOTIFICATION_FAILURE' };
            const impact = errorHandler.assessErrorImpact(classification, 'post-commit');

            expect(impact.workflow).toBe('Does not block operation');
            expect(impact.team).toBe('No immediate action required');
        });

        test('should check if lint-staged is enabled', () => {
            fs.readFileSync.mockReturnValue(
                JSON.stringify({
                    'lint-staged': {
                        '*.js': ['eslint --fix', 'prettier --write'],
                    },
                })
            );

            const isEnabled = errorHandler.isLintStagedEnabled();
            expect(isEnabled).toBe(true);
        });

        test('should generate coverage recommendations', () => {
            const gaps = ['branches', 'functions'];
            const coverage = { branches: 70, functions: 75, lines: 85, statements: 82 };
            const threshold = 80;

            const recommendations = errorHandler.generateCoverageRecommendations(
                gaps,
                coverage,
                threshold
            );

            expect(recommendations.length).toBe(2);
            expect(recommendations[0].metric).toBe('branches');
            expect(recommendations[0].current).toBe('70.00%');
            expect(recommendations[0].threshold).toBe('80%');
            expect(recommendations[1].metric).toBe('functions');
        });
    });
});
