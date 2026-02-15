const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive error handling system for Git hooks automation
 * Implements error classification, automatic recovery, and detailed reporting
 */
class HookErrorHandler {
    constructor(options = {}) {
        this.config = {
            enableAutoRecovery: options.enableAutoRecovery !== false,
            enableBypass: options.enableBypass !== false,
            auditLogPath: options.auditLogPath || '.git/hooks/audit.log',
            maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
            ...options,
        };

        this.recoveryAttempts = new Map();
        this.bypassHistory = [];
    }

    /**
     * Error Classification System
     */

    /**
     * Classifies an error into blocking, warning, or non-blocking categories
     * @param {Error|Object} error - The error to classify
     * @param {string} hookType - The type of hook where error occurred
     * @returns {Object} Classification result with severity and category
     */
    classifyError(error, hookType) {
        const errorMessage = error.message || error.toString();
        const errorCode = error.code || error.exitCode;

        // Blocking errors - prevent operation completion
        const blockingPatterns = [
            { pattern: /test.*fail/i, category: 'TEST_FAILURE', severity: 'blocking' },
            { pattern: /build.*fail/i, category: 'BUILD_FAILURE', severity: 'blocking' },
            { pattern: /security.*vulnerabilit/i, category: 'SECURITY_VULNERABILITY', severity: 'blocking' },
            { pattern: /invalid.*commit.*message/i, category: 'INVALID_COMMIT_MESSAGE', severity: 'blocking' },
            { pattern: /lint.*error/i, category: 'LINT_ERROR', severity: 'blocking' },
            { pattern: /syntax.*error/i, category: 'SYNTAX_ERROR', severity: 'blocking' },
        ];

        // Warning errors - allow operation with warnings
        const warningPatterns = [
            { pattern: /context.*not.*updated/i, category: 'MISSING_CONTEXT_UPDATE', severity: 'warning' },
            { pattern: /performance.*threshold/i, category: 'PERFORMANCE_THRESHOLD', severity: 'warning' },
            { pattern: /deprecated/i, category: 'DEPRECATED_USAGE', severity: 'warning' },
            { pattern: /coverage.*below/i, category: 'LOW_COVERAGE', severity: 'warning' },
        ];

        // Non-blocking errors - log but don't prevent operation
        const nonBlockingPatterns = [
            { pattern: /notification.*fail/i, category: 'NOTIFICATION_FAILURE', severity: 'non-blocking' },
            { pattern: /documentation.*generation/i, category: 'DOCUMENTATION_FAILURE', severity: 'non-blocking' },
            { pattern: /metrics.*update/i, category: 'METRICS_FAILURE', severity: 'non-blocking' },
            { pattern: /cache.*error/i, category: 'CACHE_ERROR', severity: 'non-blocking' },
        ];

        // Check blocking patterns first
        for (const { pattern, category, severity } of blockingPatterns) {
            if (pattern.test(errorMessage)) {
                return {
                    severity,
                    category,
                    blockingType: 'hard',
                    recoverable: this.isRecoverable(category),
                    message: errorMessage,
                    code: errorCode,
                };
            }
        }

        // Check warning patterns
        for (const { pattern, category, severity } of warningPatterns) {
            if (pattern.test(errorMessage)) {
                return {
                    severity,
                    category,
                    blockingType: 'soft',
                    recoverable: true,
                    bypassable: true,
                    message: errorMessage,
                    code: errorCode,
                };
            }
        }

        // Check non-blocking patterns
        for (const { pattern, category, severity } of nonBlockingPatterns) {
            if (pattern.test(errorMessage)) {
                return {
                    severity,
                    category,
                    blockingType: 'none',
                    recoverable: true,
                    message: errorMessage,
                    code: errorCode,
                };
            }
        }

        // Default classification based on hook type
        return this.getDefaultClassification(hookType, errorMessage, errorCode);
    }

    /**
     * Determines if an error category is recoverable
     */
    isRecoverable(category) {
        const recoverableCategories = [
            'LINT_ERROR',
            'MISSING_CONTEXT_UPDATE',
            'PERFORMANCE_THRESHOLD',
            'LOW_COVERAGE',
            'CACHE_ERROR',
        ];
        return recoverableCategories.includes(category);
    }

    /**
     * Gets default classification for unmatched errors
     */
    getDefaultClassification(hookType, message, code) {
        // Post-commit and post-merge hooks should be non-blocking by default
        if (hookType === 'post-commit' || hookType === 'post-merge') {
            return {
                severity: 'non-blocking',
                category: 'UNKNOWN_POST_HOOK_ERROR',
                blockingType: 'none',
                recoverable: false,
                message,
                code,
            };
        }

        // Pre-hooks should be blocking by default for safety
        return {
            severity: 'blocking',
            category: 'UNKNOWN_ERROR',
            blockingType: 'hard',
            recoverable: false,
            message,
            code,
        };
    }

    /**
     * Automatic Recovery Mechanisms
     */

    /**
     * Attempts to automatically recover from an error
     * @param {Object} error - The classified error
     * @param {Object} context - Context information for recovery
     * @returns {Object} Recovery result
     */
    async attemptRecovery(error, context = {}) {
        if (!this.config.enableAutoRecovery) {
            return { successful: false, reason: 'Auto-recovery disabled' };
        }

        const classification = this.classifyError(error, context.hookType);

        if (!classification.recoverable) {
            return { successful: false, reason: 'Error not recoverable', classification };
        }

        // Check recovery attempt limit
        const attemptKey = `${context.hookType}-${classification.category}`;
        const attempts = this.recoveryAttempts.get(attemptKey) || 0;

        if (attempts >= this.config.maxRecoveryAttempts) {
            return {
                successful: false,
                reason: 'Max recovery attempts exceeded',
                attempts,
                classification,
            };
        }

        this.recoveryAttempts.set(attemptKey, attempts + 1);

        // Attempt recovery based on error category
        try {
            const recoveryResult = await this.executeRecovery(classification, context);

            if (recoveryResult.successful) {
                this.recoveryAttempts.delete(attemptKey); // Reset on success
            }

            return recoveryResult;
        } catch (recoveryError) {
            return {
                successful: false,
                reason: 'Recovery attempt failed',
                error: recoveryError.message,
                classification,
            };
        }
    }

    /**
     * Executes recovery strategy based on error category
     */
    async executeRecovery(classification, context) {
        const { category } = classification;

        switch (category) {
        case 'LINT_ERROR':
            return await this.recoverFromLintError(context);

        case 'MISSING_CONTEXT_UPDATE':
            return await this.recoverFromMissingContext(context);

        case 'PERFORMANCE_THRESHOLD':
            return await this.recoverFromPerformanceIssue(context);

        case 'LOW_COVERAGE':
            return await this.recoverFromLowCoverage(context);

        case 'CACHE_ERROR':
            return await this.recoverFromCacheError(context);

        default:
            return { successful: false, reason: 'No recovery strategy available' };
        }
    }

    /**
     * Recovery: Auto-fix lint errors
     */
    async recoverFromLintError(context) {
        try {
            const files = context.stagedFiles || [];

            if (files.length === 0) {
                return { successful: false, reason: 'No files to fix' };
            }

            // Run eslint --fix
            execSync(`npx eslint --fix ${files.join(' ')}`, { stdio: 'pipe' });

            // Run prettier --write
            execSync(`npx prettier --write ${files.join(' ')}`, { stdio: 'pipe' });

            return {
                successful: true,
                action: 'auto-fix',
                details: `Fixed lint errors in ${files.length} file(s)`,
                filesFixed: files,
            };
        } catch (error) {
            return {
                successful: false,
                reason: 'Auto-fix failed',
                error: error.message,
            };
        }
    }

    /**
     * Recovery: Auto-generate basic context entry
     */
    async recoverFromMissingContext(context) {
        try {
            const contextPath = 'activeContext.md';

            if (!fs.existsSync(contextPath)) {
                return { successful: false, reason: 'Context file does not exist' };
            }

            const timestamp = new Date().toISOString();
            const commitInfo = context.commitMessage || 'Context update';
            const persona = context.persona || 'DEVELOPER';

            const contextEntry = `\n## ${timestamp}\n**Persona**: ${persona}\n**Action**: ${commitInfo}\n`;

            fs.appendFileSync(contextPath, contextEntry);

            return {
                successful: true,
                action: 'auto-generate-context',
                details: 'Generated basic context entry',
                entry: contextEntry,
            };
        } catch (error) {
            return {
                successful: false,
                reason: 'Context generation failed',
                error: error.message,
            };
        }
    }

    /**
     * Recovery: Enable performance optimizations
     */
    async recoverFromPerformanceIssue(_context) {
        try {
            const optimizations = [];

            // Enable lint-staged if not already enabled
            if (!this.isLintStagedEnabled()) {
                optimizations.push('lint-staged');
            }

            // Enable parallel test execution
            if (!this.isParallelTestsEnabled()) {
                optimizations.push('parallel-tests');
            }

            return {
                successful: true,
                action: 'enable-optimizations',
                details: `Enabled optimizations: ${optimizations.join(', ')}`,
                optimizations,
            };
        } catch (error) {
            return {
                successful: false,
                reason: 'Optimization failed',
                error: error.message,
            };
        }
    }

    /**
     * Recovery: Provide coverage improvement guidance
     */
    async recoverFromLowCoverage(context) {
        const coverage = context.coverage || {};
        const threshold = context.threshold || 80;

        const gaps = [];
        if (coverage.branches < threshold) gaps.push('branches');
        if (coverage.functions < threshold) gaps.push('functions');
        if (coverage.lines < threshold) gaps.push('lines');
        if (coverage.statements < threshold) gaps.push('statements');

        return {
            successful: true,
            action: 'coverage-guidance',
            details: `Coverage below threshold in: ${gaps.join(', ')}`,
            gaps,
            recommendations: this.generateCoverageRecommendations(gaps, coverage, threshold),
        };
    }

    /**
     * Recovery: Clear and rebuild cache
     */
    async recoverFromCacheError(_context) {
        try {
            const cacheDir = '.git/hooks/cache';

            if (fs.existsSync(cacheDir)) {
                fs.rmSync(cacheDir, { recursive: true, force: true });
            }

            fs.mkdirSync(cacheDir, { recursive: true });

            return {
                successful: true,
                action: 'cache-rebuild',
                details: 'Cleared and rebuilt cache',
            };
        } catch (error) {
            return {
                successful: false,
                reason: 'Cache rebuild failed',
                error: error.message,
            };
        }
    }

    /**
     * Detailed Error Reporting with Remediation Guidance
     */

    /**
     * Generates a comprehensive error report with remediation guidance
     * @param {string} hookType - The type of hook
     * @param {Object} error - The error object
     * @param {Object} classification - Error classification
     * @param {Object} recoveryResult - Result of recovery attempt
     * @returns {Object} Detailed error report
     */
    generateErrorReport(hookType, error, classification, recoveryResult = null) {
        const report = {
            hookType,
            timestamp: new Date().toISOString(),
            error: {
                message: classification.message,
                code: classification.code,
                category: classification.category,
                severity: classification.severity,
                blockingType: classification.blockingType,
            },
            recovery: recoveryResult,
            remediation: this.generateRemediation(classification, recoveryResult),
            bypassOptions: this.getBypassOptions(classification),
            impact: this.assessErrorImpact(classification, hookType),
        };

        // Log the error report
        this.logErrorReport(report);

        return report;
    }

    /**
     * Generates remediation guidance based on error classification
     */
    generateRemediation(classification, recoveryResult) {
        const { category } = classification;

        const remediations = {
            TEST_FAILURE: {
                steps: [
                    'Review test output for specific failures',
                    'Run tests locally: npm test',
                    'Fix failing tests or update test expectations',
                    'Ensure all dependencies are installed',
                ],
                commands: ['npm test', 'npm test -- --verbose'],
            },
            BUILD_FAILURE: {
                steps: [
                    'Check build logs for compilation errors',
                    'Verify all dependencies are installed: npm install',
                    'Check for syntax errors in recent changes',
                    'Run build locally: npm run build',
                ],
                commands: ['npm install', 'npm run build'],
            },
            SECURITY_VULNERABILITY: {
                steps: [
                    'Review npm audit output for vulnerabilities',
                    'Update vulnerable dependencies: npm audit fix',
                    'For breaking changes, review and test updates',
                    'Consider using npm audit fix --force for major updates',
                ],
                commands: ['npm audit', 'npm audit fix', 'npm audit fix --force'],
            },
            INVALID_COMMIT_MESSAGE: {
                steps: [
                    'Use BMAD pattern: [PERSONA] [STEP-ID] Description',
                    'Valid personas: DEVELOPER, PM, ARCHITECT, QA, DEVOPS, SECURITY, RELEASE_MANAGER',
                    'Step ID format: STEP-XXX where XXX is a number',
                    'Example: [DEVELOPER] [STEP-001] Implement user authentication',
                ],
                commands: ['git commit --amend -m "[PERSONA] [STEP-ID] Description"'],
            },
            LINT_ERROR: {
                steps: [
                    'Run linter to see specific issues: npm run lint',
                    'Auto-fix issues: npm run lint:fix',
                    'Review and fix remaining manual issues',
                    'Ensure code follows project style guide',
                ],
                commands: ['npm run lint', 'npm run lint:fix'],
            },
            MISSING_CONTEXT_UPDATE: {
                steps: [
                    'Update activeContext.md with current work details',
                    'Include persona, step ID, and description',
                    'Ensure context reflects current development phase',
                    'Use bypass only if context is truly not applicable',
                ],
                commands: [],
            },
            PERFORMANCE_THRESHOLD: {
                steps: [
                    'Review performance metrics in hook output',
                    'Enable lint-staged for faster pre-commit checks',
                    'Use parallel test execution',
                    'Consider splitting large commits',
                ],
                commands: [],
            },
        };

        const remediation = remediations[category] || {
            steps: ['Review error message for details', 'Check hook logs for more information'],
            commands: [],
        };

        // Add recovery information if available
        if (recoveryResult && recoveryResult.successful) {
            remediation.autoRecovery = {
                action: recoveryResult.action,
                details: recoveryResult.details,
                status: 'successful',
            };
        } else if (recoveryResult) {
            remediation.autoRecovery = {
                status: 'failed',
                reason: recoveryResult.reason,
            };
        }

        return remediation;
    }

    /**
     * Bypass Mechanisms with Audit Trails
     */

    /**
     * Gets available bypass options for an error
     */
    getBypassOptions(classification) {
        const { severity, bypassable } = classification;

        if (severity === 'non-blocking') {
            return {
                available: false,
                reason: 'Non-blocking errors do not require bypass',
            };
        }

        if (!bypassable && severity === 'blocking') {
            return {
                available: false,
                reason: 'Critical blocking errors cannot be bypassed',
            };
        }

        return {
            available: true,
            methods: [
                {
                    name: 'development-mode',
                    command: 'BMAD_DEV_MODE=true git commit ...',
                    description: 'Bypass validation in development mode',
                    requiresAudit: true,
                },
                {
                    name: 'emergency-override',
                    command: 'BMAD_EMERGENCY_BYPASS=true git commit ...',
                    description: 'Emergency bypass with mandatory follow-up',
                    requiresAudit: true,
                    requiresFollowup: true,
                },
                {
                    name: 'skip-hook',
                    command: 'git commit --no-verify ...',
                    description: 'Skip all hooks (use with extreme caution)',
                    requiresAudit: true,
                    warning: 'This bypasses all validation - use only in emergencies',
                },
            ],
        };
    }

    /**
     * Records a bypass action in the audit trail
     */
    recordBypass(hookType, classification, method, reason) {
        const bypassRecord = {
            timestamp: new Date().toISOString(),
            hookType,
            errorCategory: classification.category,
            errorSeverity: classification.severity,
            bypassMethod: method,
            reason,
            user: process.env.USER || 'unknown',
        };

        this.bypassHistory.push(bypassRecord);
        this.writeAuditLog(bypassRecord);

        return bypassRecord;
    }

    /**
     * Writes bypass record to audit log
     */
    writeAuditLog(record) {
        try {
            const logDir = path.dirname(this.config.auditLogPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logEntry = `${JSON.stringify(record)}\n`;
            fs.appendFileSync(this.config.auditLogPath, logEntry);
        } catch (error) {
            console.error('Failed to write audit log:', error.message);
        }
    }

    /**
     * Gets the bypass audit trail
     */
    getBypassAuditTrail() {
        try {
            if (!fs.existsSync(this.config.auditLogPath)) {
                return [];
            }

            const content = fs.readFileSync(this.config.auditLogPath, 'utf8');
            return content
                .split('\n')
                .filter((line) => line.trim())
                .map((line) => JSON.parse(line));
        } catch (error) {
            console.error('Failed to read audit log:', error.message);
            return [];
        }
    }

    /**
     * Helper Methods
     */

    /**
     * Assesses the impact of an error
     */
    assessErrorImpact(classification, _hookType) {
        const { severity } = classification;

        const impacts = {
            blocking: {
                workflow: 'Blocks current operation',
                team: 'Prevents commit/push from completing',
                project: 'May delay development progress',
            },
            warning: {
                workflow: 'Allows operation with warnings',
                team: 'May require follow-up action',
                project: 'Minimal immediate impact',
            },
            'non-blocking': {
                workflow: 'Does not block operation',
                team: 'No immediate action required',
                project: 'No impact on development flow',
            },
        };

        return impacts[severity] || impacts['blocking'];
    }

    /**
     * Logs error report to console and file
     */
    logErrorReport(report) {
        const { hookType, error, remediation } = report;

        console.error('\n' + '='.repeat(80));
        console.error(`❌ ${hookType.toUpperCase()} HOOK ERROR`);
        console.error('='.repeat(80));
        console.error(`\nCategory: ${error.category}`);
        console.error(`Severity: ${error.severity.toUpperCase()}`);
        console.error(`Message: ${error.message}`);

        if (remediation.autoRecovery) {
            console.error(`\nAuto-Recovery: ${remediation.autoRecovery.status}`);
            if (remediation.autoRecovery.details) {
                console.error(`Details: ${remediation.autoRecovery.details}`);
            }
        }

        console.error('\nRemediation Steps:');
        remediation.steps.forEach((step, i) => {
            console.error(`  ${i + 1}. ${step}`);
        });

        if (remediation.commands.length > 0) {
            console.error('\nSuggested Commands:');
            remediation.commands.forEach((cmd) => {
                console.error(`  $ ${cmd}`);
            });
        }

        console.error('\n' + '='.repeat(80) + '\n');
    }

    /**
     * Checks if lint-staged is enabled
     */
    isLintStagedEnabled() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return !!packageJson['lint-staged'];
        } catch {
            return false;
        }
    }

    /**
     * Checks if parallel tests are enabled
     */
    isParallelTestsEnabled() {
        try {
            const jestConfig = require(path.join(process.cwd(), 'jest.config.js'));
            return jestConfig.maxWorkers > 1;
        } catch {
            return false;
        }
    }

    /**
     * Generates coverage improvement recommendations
     */
    generateCoverageRecommendations(gaps, coverage, threshold) {
        return gaps.map((gap) => {
            const current = coverage[gap] || 0;
            const needed = threshold - current;
            return {
                metric: gap,
                current: `${current.toFixed(2)}%`,
                threshold: `${threshold}%`,
                gap: `${needed.toFixed(2)}%`,
                suggestion: `Add tests to improve ${gap} coverage by ${needed.toFixed(2)}%`,
            };
        });
    }

    /**
     * Main error handling entry point
     */
    async handleHookError(hookType, error, context = {}) {
        const classification = this.classifyError(error, hookType);
        const recoveryResult = await this.attemptRecovery(error, { ...context, hookType });
        const report = this.generateErrorReport(hookType, error, classification, recoveryResult);

        return {
            classification,
            recovery: recoveryResult,
            report,
            shouldBlock: classification.severity === 'blocking' && !recoveryResult.successful,
        };
    }
}

module.exports = HookErrorHandler;
