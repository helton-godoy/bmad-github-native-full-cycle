const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

/**
 * Enhanced Gatekeeper for BMAD workflow validation
 * Provides robust mock data system, test execution, and comprehensive error reporting
 */
class EnhancedGatekeeper {
    constructor(options = {}) {
        this.logger = new Logger('EnhancedGatekeeper');
        this.config = {
            requireContextUpdate: true,
            developmentMode: process.env.NODE_ENV === 'development' || process.env.BMAD_DEV_MODE === 'true',
            skipTests: process.env.BMAD_SKIP_TESTS === 'true',
            maxRetries: 3,
            bypassEnabled: false,
            ...options
        };

        this.colors = {
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            reset: '\x1b[0m'
        };

        this.mockData = this.generateMockData();
        this.bypassAuditTrail = [];
    }

    /**
     * Generate robust mock data for testing scenarios
     * Requirements: 3.1
     */
    generateMockData() {
        return {
            commits: [
                {
                    hash: 'abc123def456',
                    message: '[DEVELOPER] [STEP-001] Implement user authentication',
                    author: 'bmad-agent',
                    timestamp: new Date().toISOString(),
                    files: ['src/auth/login.js', 'tests/auth.test.js']
                },
                {
                    hash: 'def456ghi789',
                    message: '[QA] [STEP-002] Add integration tests',
                    author: 'bmad-agent',
                    timestamp: new Date().toISOString(),
                    files: ['tests/integration/auth.test.js']
                }
            ],
            testResults: {
                passed: 15,
                failed: 0,
                total: 15,
                coverage: {
                    lines: 85.5,
                    functions: 90.2,
                    branches: 82.1,
                    statements: 87.3
                },
                suites: [
                    { name: 'auth.test.js', status: 'passed', tests: 8 },
                    { name: 'user.test.js', status: 'passed', tests: 7 }
                ]
            },
            workflowContext: {
                currentPersona: 'DEVELOPER',
                stepId: 'STEP-001',
                phase: 'implementation',
                lastTransition: new Date().toISOString()
            },
            gitStatus: {
                staged: ['src/auth/login.js'],
                modified: ['activeContext.md'],
                untracked: []
            }
        };
    }

    /**
     * Main validation entry point
     * Requirements: 3.1, 3.2, 3.3, 3.4
     */
    async validateWorkflowConditions(context = {}) {
        this.logger.info('Starting workflow validation');

        const validationResult = {
            gate: 'FAIL',
            timestamp: new Date().toISOString(),
            validations: [],
            errors: [],
            warnings: [],
            waiver: { active: false }
        };

        try {
            // Check for development mode bypass first
            if (this.checkBypass('workflow')) {
                this.applyDevelopmentBypass(validationResult);
                return validationResult;
            }

            // 1. Validate commit message format
            await this.validateCommitMessage(context.commitMessage, validationResult);

            // 2. Validate context updates
            await this.validateContextUpdate(validationResult);

            // 3. Execute test suite
            await this.executeTestSuite(validationResult);

            // 4. Evaluate overall results
            this.evaluateResults(validationResult);

            return validationResult;

        } catch (error) {
            this.logger.error('Validation failed with error:', error);
            validationResult.errors.push({
                type: 'VALIDATION_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            return validationResult;
        }
    }

    /**
     * Validate commit message format
     * Requirements: 3.2
     */
    async validateCommitMessage(commitMsg, result) {
        if (!commitMsg) {
            result.validations.push({
                name: 'commit_message',
                status: 'skipped',
                message: 'No commit message provided'
            });
            return;
        }

        // BMAD pattern: [PERSONA] [STEP-ID] Description
        const bmadPattern = /^\[([A-Z_]+)\] \[([A-Z]+-\d+)\] .+/;
        // Conventional commits pattern
        const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?: .+/;

        if (bmadPattern.test(commitMsg) || conventionalPattern.test(commitMsg)) {
            result.validations.push({
                name: 'commit_message',
                status: 'passed',
                message: 'Commit message format is valid'
            });
        } else {
            result.validations.push({
                name: 'commit_message',
                status: 'failed',
                message: 'Invalid commit message format',
                expected: '[PERSONA] [STEP-ID] Description OR type(scope): description'
            });
            result.errors.push({
                type: 'COMMIT_FORMAT_ERROR',
                message: 'Commit message does not follow required format',
                remediation: 'Use format: [PERSONA] [STEP-ID] Description or conventional commits format'
            });
        }
    }

    /**
     * Validate context update requirements
     * Requirements: 3.2
     */
    async validateContextUpdate(result) {
        if (!this.config.requireContextUpdate) {
            result.validations.push({
                name: 'context_update',
                status: 'skipped',
                message: 'Context update validation disabled'
            });
            return;
        }

        try {
            const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' });
            const hasCodeChanges = staged.match(/\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|cpp|h|hpp|css|scss|html|vue|svelte)$/m);
            const hasContextUpdate = staged.includes('activeContext.md');

            if (hasCodeChanges && !hasContextUpdate) {
                result.validations.push({
                    name: 'context_update',
                    status: 'failed',
                    message: 'Code changes detected without activeContext.md update'
                });
                result.errors.push({
                    type: 'CONTEXT_UPDATE_ERROR',
                    message: 'Code changes require activeContext.md update',
                    remediation: 'Update activeContext.md to reflect current changes'
                });
            } else {
                result.validations.push({
                    name: 'context_update',
                    status: 'passed',
                    message: 'Context update requirements satisfied'
                });
            }
        } catch (error) {
            result.warnings.push({
                type: 'GIT_WARNING',
                message: 'Could not check git status: ' + error.message
            });
            result.validations.push({
                name: 'context_update',
                status: 'warning',
                message: 'Could not validate git status'
            });
        }
    }

    /**
     * Execute test suite and evaluate results
     * Requirements: 3.2
     */
    async executeTestSuite(result) {
        if (this.config.skipTests) {
            result.validations.push({
                name: 'test_execution',
                status: 'waived',
                message: 'Tests skipped via BMAD_SKIP_TESTS'
            });
            result.waiver = {
                active: true,
                reason: 'BMAD_SKIP_TESTS environment variable set',
                approved_by: 'Developer (Local Override)'
            };
            return;
        }

        try {
            // Check if test script exists
            const pkg = require(path.join(process.cwd(), 'package.json'));
            if (!pkg.scripts || !pkg.scripts.test) {
                result.validations.push({
                    name: 'test_execution',
                    status: 'warning',
                    message: 'No test script defined in package.json'
                });
                result.warnings.push({
                    type: 'NO_TESTS_WARNING',
                    message: 'No test script found',
                    remediation: 'Add test script to package.json'
                });
                return;
            }

            // Execute tests
            this.logger.info('Executing test suite...');
            const testOutput = execSync('npm test --if-present', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            result.validations.push({
                name: 'test_execution',
                status: 'passed',
                message: 'All tests passed successfully',
                output: testOutput
            });

        } catch (error) {
            result.validations.push({
                name: 'test_execution',
                status: 'failed',
                message: 'Test execution failed',
                output: error.stdout || error.message
            });
            result.errors.push({
                type: 'TEST_FAILURE',
                message: 'Test suite execution failed',
                details: error.stdout || error.message,
                remediation: 'Fix failing tests before proceeding'
            });
        }
    }

    /**
     * Evaluate overall validation results
     * Requirements: 3.3
     */
    evaluateResults(result) {
        const hasErrors = result.errors.length > 0;
        const hasFailedValidations = result.validations.some(v => v.status === 'failed');

        if (hasErrors || hasFailedValidations) {
            result.gate = 'FAIL';
        } else if (result.waiver.active) {
            result.gate = 'WAIVED';
        } else {
            result.gate = 'PASS';
        }

        // Log results
        this.logValidationResults(result);
    }

    /**
     * Generate detailed error report with remediation suggestions
     * Requirements: 3.3, 3.5
     */
    generateErrorReport(failures) {
        const report = {
            summary: `Validation failed with ${failures.length} error(s)`,
            timestamp: new Date().toISOString(),
            errors: failures,
            context: {
                developmentMode: this.config.developmentMode,
                bypassEnabled: this.config.bypassEnabled,
                environment: process.env.NODE_ENV || 'unknown',
                user: process.env.USER || 'unknown'
            },
            remediation: {
                immediate: [],
                longTerm: [],
                automated: []
            },
            severity: this.calculateSeverity(failures),
            impact: this.assessImpact(failures)
        };

        failures.forEach(error => {
            const remediation = this.getRemediationForError(error);
            report.remediation.immediate.push(...remediation.immediate);
            report.remediation.longTerm.push(...remediation.longTerm);
            report.remediation.automated.push(...remediation.automated);
        });

        // Remove duplicates
        report.remediation.immediate = [...new Set(report.remediation.immediate)];
        report.remediation.longTerm = [...new Set(report.remediation.longTerm)];
        report.remediation.automated = [...new Set(report.remediation.automated)];

        return report;
    }

    /**
     * Get specific remediation suggestions for error types
     * Requirements: 3.3
     */
    getRemediationForError(error) {
        const remediation = {
            immediate: [],
            longTerm: [],
            automated: []
        };

        switch (error.type) {
        case 'COMMIT_FORMAT_ERROR':
            remediation.immediate.push('Fix commit message format to match [PERSONA] [STEP-ID] Description');
            remediation.immediate.push('Use conventional commits format as alternative');
            remediation.longTerm.push('Set up commit message templates in .gitmessage');
            remediation.longTerm.push('Configure git hooks for commit validation');
            remediation.automated.push('Install commitizen for guided commit messages');
            break;

        case 'CONTEXT_UPDATE_ERROR':
            remediation.immediate.push('Update activeContext.md to reflect current changes');
            remediation.immediate.push('Stage activeContext.md with git add');
            remediation.longTerm.push('Implement automated context update hooks');
            remediation.longTerm.push('Create context update templates');
            remediation.automated.push('Set up pre-commit hook to remind about context updates');
            break;

        case 'TEST_FAILURE':
            remediation.immediate.push('Fix failing tests before proceeding');
            remediation.immediate.push('Review test output for specific failure details');
            remediation.longTerm.push('Improve test coverage and reliability');
            remediation.longTerm.push('Implement test-driven development practices');
            remediation.automated.push('Set up continuous integration for automated testing');
            break;

        case 'VALIDATION_ERROR':
            remediation.immediate.push('Review validation error details and fix accordingly');
            remediation.immediate.push('Check system configuration and environment');
            remediation.longTerm.push('Implement better error handling and recovery');
            remediation.automated.push('Add monitoring and alerting for validation failures');
            break;

        default:
            remediation.immediate.push('Review error details and consult documentation');
            remediation.longTerm.push('Improve error handling for this scenario');
        }

        return remediation;
    }

    /**
     * Calculate severity level based on error types
     * Requirements: 3.3
     */
    calculateSeverity(failures) {
        const severityLevels = {
            'TEST_FAILURE': 'HIGH',
            'COMMIT_FORMAT_ERROR': 'MEDIUM',
            'CONTEXT_UPDATE_ERROR': 'MEDIUM',
            'VALIDATION_ERROR': 'HIGH'
        };

        const maxSeverity = failures.reduce((max, error) => {
            const severity = severityLevels[error.type] || 'LOW';
            if (severity === 'HIGH') return 'HIGH';
            if (severity === 'MEDIUM' && max !== 'HIGH') return 'MEDIUM';
            return max;
        }, 'LOW');

        return maxSeverity;
    }

    /**
     * Assess impact of failures on workflow
     * Requirements: 3.3
     */
    assessImpact(failures) {
        const impact = {
            workflowBlocked: true,
            affectedComponents: [],
            estimatedFixTime: 'Unknown',
            riskLevel: 'Medium'
        };

        failures.forEach(error => {
            switch (error.type) {
            case 'TEST_FAILURE':
                impact.affectedComponents.push('Test Suite');
                impact.estimatedFixTime = '15-30 minutes';
                impact.riskLevel = 'High';
                break;
            case 'COMMIT_FORMAT_ERROR':
                impact.affectedComponents.push('Version Control');
                impact.estimatedFixTime = '2-5 minutes';
                break;
            case 'CONTEXT_UPDATE_ERROR':
                impact.affectedComponents.push('Documentation');
                impact.estimatedFixTime = '5-10 minutes';
                break;
            }
        });

        impact.affectedComponents = [...new Set(impact.affectedComponents)];
        return impact;
    }

    /**
     * Log success validation and allow workflow continuation
     * Requirements: 3.5
     */
    logSuccessValidation(result) {
        const { colors } = this;

        this.logger.info('Validation completed successfully');

        console.log(`${colors.green}✅ BMAD Enhanced Gatekeeper - VALIDATION PASSED${colors.reset}`);
        console.log(`Timestamp: ${result.timestamp}`);
        console.log(`Gate Status: ${colors.green}${result.gate}${colors.reset}`);

        // Log successful validations
        const passedValidations = result.validations.filter(v => v.status === 'passed');
        if (passedValidations.length > 0) {
            console.log(`\n${colors.green}✅ Passed Validations:${colors.reset}`);
            passedValidations.forEach(validation => {
                console.log(`  • ${validation.name}: ${validation.message}`);
            });
        }

        // Log any warnings even on success
        if (result.warnings.length > 0) {
            console.log(`\n${colors.yellow}⚠️  Warnings (non-blocking):${colors.reset}`);
            result.warnings.forEach(warning => {
                console.log(`  • ${warning.message}`);
            });
        }

        // Log waiver info if applicable
        if (result.waiver.active) {
            console.log(`\n${colors.blue}ℹ️  Waiver Applied:${colors.reset}`);
            console.log(`  Reason: ${result.waiver.reason}`);
            console.log(`  Approved by: ${result.waiver.approved_by}`);
        }

        console.log(`\n${colors.green}🚀 Workflow can continue${colors.reset}\n`);

        return true;
    }

    /**
     * Enhanced error reporting with detailed context
     * Requirements: 3.3, 3.5
     */
    reportDetailedError(result) {
        const { colors } = this;

        if (result.errors.length === 0) {
            return this.logSuccessValidation(result);
        }

        const errorReport = this.generateErrorReport(result.errors);

        console.log(`${colors.red}❌ BMAD Enhanced Gatekeeper - VALIDATION FAILED${colors.reset}`);
        console.log(`Timestamp: ${result.timestamp}`);
        console.log(`Gate Status: ${colors.red}${result.gate}${colors.reset}`);
        console.log(`Severity: ${this.getStatusColor(errorReport.severity)}${errorReport.severity}${colors.reset}`);
        console.log(`Risk Level: ${errorReport.impact.riskLevel}`);

        // Detailed error breakdown
        console.log(`\n${colors.red}📋 Error Details:${colors.reset}`);
        result.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error.type}: ${error.message}`);
            if (error.details) {
                console.log(`     Details: ${error.details}`);
            }
        });

        // Impact assessment
        console.log(`\n${colors.yellow}📊 Impact Assessment:${colors.reset}`);
        console.log(`  • Workflow Blocked: ${errorReport.impact.workflowBlocked ? 'Yes' : 'No'}`);
        console.log(`  • Affected Components: ${errorReport.impact.affectedComponents.join(', ')}`);
        console.log(`  • Estimated Fix Time: ${errorReport.impact.estimatedFixTime}`);

        // Immediate remediation steps
        if (errorReport.remediation.immediate.length > 0) {
            console.log(`\n${colors.blue}🔧 Immediate Actions Required:${colors.reset}`);
            errorReport.remediation.immediate.forEach((action, index) => {
                console.log(`  ${index + 1}. ${action}`);
            });
        }

        // Long-term improvements
        if (errorReport.remediation.longTerm.length > 0) {
            console.log(`\n${colors.yellow}📈 Long-term Improvements:${colors.reset}`);
            errorReport.remediation.longTerm.forEach((improvement, index) => {
                console.log(`  ${index + 1}. ${improvement}`);
            });
        }

        // Automated solutions
        if (errorReport.remediation.automated.length > 0) {
            console.log(`\n${colors.blue}🤖 Automated Solutions Available:${colors.reset}`);
            errorReport.remediation.automated.forEach((solution, index) => {
                console.log(`  ${index + 1}. ${solution}`);
            });
        }

        console.log(`\n${colors.red}🛑 Workflow blocked until issues are resolved${colors.reset}\n`);

        return false;
    }

    /**
     * Log validation results with appropriate formatting
     * Requirements: 3.5
     */
    logValidationResults(result) {
        // Use enhanced error reporting
        return this.reportDetailedError(result);
    }

    /**
     * Get appropriate color for status
     */
    getStatusColor(status) {
        const { colors } = this;
        switch (status) {
        case 'PASS':
        case 'passed':
            return colors.green;
        case 'FAIL':
        case 'failed':
            return colors.red;
        case 'WAIVED':
        case 'waived':
        case 'warning':
            return colors.yellow;
        default:
            return colors.reset;
        }
    }

    /**
     * Enable or disable development mode bypass
     * Requirements: 3.4
     */
    enableDevelopmentMode(bypass = true, reason = 'Development testing') {
        if (!this.config.developmentMode) {
            this.logger.warn('Cannot enable bypass: not in development mode');
            return false;
        }

        this.config.bypassEnabled = bypass;

        const auditEntry = {
            timestamp: new Date().toISOString(),
            action: bypass ? 'BYPASS_ENABLED' : 'BYPASS_DISABLED',
            reason: reason,
            user: process.env.USER || 'unknown',
            environment: process.env.NODE_ENV || 'unknown'
        };

        this.bypassAuditTrail.push(auditEntry);
        this.logger.info(`Development bypass ${bypass ? 'enabled' : 'disabled'}: ${reason}`);

        return true;
    }

    /**
     * Check if bypass is active and log accordingly
     * Requirements: 3.4
     */
    checkBypass(validationType) {
        if (this.config.bypassEnabled && this.config.developmentMode) {
            const bypassLog = {
                timestamp: new Date().toISOString(),
                validationType: validationType,
                bypassed: true,
                reason: 'Development mode bypass active'
            };

            this.bypassAuditTrail.push(bypassLog);
            this.logger.warn(`Bypassing ${validationType} validation (development mode)`);

            return true;
        }

        return false;
    }

    /**
     * Get bypass audit trail
     * Requirements: 3.4
     */
    getBypassAuditTrail() {
        return {
            entries: this.bypassAuditTrail,
            count: this.bypassAuditTrail.length,
            developmentMode: this.config.developmentMode,
            bypassEnabled: this.config.bypassEnabled
        };
    }

    /**
     * Apply development mode bypass to validation
     * Requirements: 3.4
     */
    applyDevelopmentBypass(result) {
        if (!this.config.developmentMode || !this.config.bypassEnabled) {
            return false;
        }

        // Log bypass application
        this.logger.warn('Applying development mode bypass to validation');

        result.gate = 'WAIVED';
        result.waiver = {
            active: true,
            reason: 'Development mode bypass enabled',
            approved_by: 'Developer (Development Mode)',
            timestamp: new Date().toISOString()
        };

        // Add bypass to audit trail
        this.bypassAuditTrail.push({
            timestamp: new Date().toISOString(),
            action: 'VALIDATION_BYPASSED',
            originalGate: result.gate,
            errors: result.errors.length,
            warnings: result.warnings.length
        });

        return true;
    }


    /**
     * Validate hook-specific context and requirements
     * Requirements: 1.5, 7.1
     * @param {string} hookType - Type of hook (pre-commit, commit-msg, pre-push, post-commit, post-merge)
     * @param {object} context - Hook execution context
     * @returns {object} Validation result with hook-specific checks
     */
    async validateHookContext(hookType, context = {}) {
        this.logger.info(`Validating hook context for ${hookType}`);

        const validationResult = {
            hookType,
            gate: 'FAIL',
            timestamp: new Date().toISOString(),
            validations: [],
            errors: [],
            warnings: [],
            waiver: { active: false },
            hookSpecific: {}
        };

        try {
            // Check for development mode bypass
            if (this.checkBypass(`hook-${hookType}`)) {
                this.applyDevelopmentBypass(validationResult);
                return validationResult;
            }

            // Hook-specific validation logic
            switch (hookType) {
            case 'pre-commit':
                await this.validatePreCommitContext(context, validationResult);
                break;
            case 'commit-msg':
                await this.validateCommitMsgContext(context, validationResult);
                break;
            case 'pre-push':
                await this.validatePrePushContext(context, validationResult);
                break;
            case 'post-commit':
                await this.validatePostCommitContext(context, validationResult);
                break;
            case 'post-merge':
                await this.validatePostMergeContext(context, validationResult);
                break;
            case 'pre-rebase':
                await this.validatePreRebaseContext(context, validationResult);
                break;
            case 'post-checkout':
                await this.validatePostCheckoutContext(context, validationResult);
                break;
            case 'pre-receive':
                await this.validatePreReceiveContext(context, validationResult);
                break;
            default:
                validationResult.warnings.push({
                    type: 'UNKNOWN_HOOK_TYPE',
                    message: `Unknown hook type: ${hookType}`,
                    remediation: 'Verify hook type is supported'
                });
            }

            // Evaluate overall results
            this.evaluateResults(validationResult);

            return validationResult;

        } catch (error) {
            this.logger.error(`Hook context validation failed: ${error.message}`);
            validationResult.errors.push({
                type: 'HOOK_VALIDATION_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            return validationResult;
        }
    }

    /**
     * Validate pre-commit hook context
     * Requirements: 1.5, 7.1
     */
    async validatePreCommitContext(context, result) {
        // Validate staged files exist
        if (!context.stagedFiles || context.stagedFiles.length === 0) {
            result.warnings.push({
                type: 'NO_STAGED_FILES',
                message: 'No staged files detected',
                remediation: 'Stage files with git add before committing'
            });
        } else {
            result.validations.push({
                name: 'staged_files',
                status: 'passed',
                message: `${context.stagedFiles.length} staged file(s) detected`
            });
        }

        // Validate linting results if provided
        if (context.lintingResults) {
            if (context.lintingResults.success) {
                result.validations.push({
                    name: 'linting',
                    status: 'passed',
                    message: 'Linting completed successfully'
                });
            } else {
                result.validations.push({
                    name: 'linting',
                    status: 'failed',
                    message: 'Linting failed'
                });
                result.errors.push({
                    type: 'LINTING_ERROR',
                    message: 'Code linting failed',
                    details: context.lintingResults.errors,
                    remediation: 'Fix linting errors or run npm run lint:fix'
                });
            }
        }

        // Validate fast tests if provided
        if (context.testResults) {
            if (context.testResults.success) {
                result.validations.push({
                    name: 'fast_tests',
                    status: 'passed',
                    message: 'Fast tests passed'
                });
            } else {
                result.validations.push({
                    name: 'fast_tests',
                    status: 'failed',
                    message: 'Fast tests failed'
                });
                result.errors.push({
                    type: 'TEST_FAILURE',
                    message: 'Fast test suite failed',
                    details: context.testResults.output,
                    remediation: 'Fix failing tests before committing'
                });
            }
        }

        // Validate context update
        await this.validateContextUpdate(result);
    }

    /**
     * Validate commit-msg hook context
     * Requirements: 1.5, 7.1
     */
    async validateCommitMsgContext(context, result) {
        if (!context.message) {
            result.errors.push({
                type: 'MISSING_COMMIT_MESSAGE',
                message: 'No commit message provided',
                remediation: 'Provide a commit message'
            });
            return;
        }

        // Use existing commit message validation
        await this.validateCommitMessage(context.message, result);

        // Validate persona and step ID if provided
        if (context.parsedMessage) {
            const { persona, stepId } = context.parsedMessage;

            if (persona && stepId) {
                result.validations.push({
                    name: 'bmad_metadata',
                    status: 'passed',
                    message: `BMAD metadata validated: ${persona} ${stepId}`
                });
                result.hookSpecific.persona = persona;
                result.hookSpecific.stepId = stepId;
            }
        }
    }

    /**
     * Validate pre-push hook context
     * Requirements: 1.5, 7.1
     */
    async validatePrePushContext(context, result) {
        // Validate branch and remote
        if (!context.branch || !context.remote) {
            result.warnings.push({
                type: 'MISSING_PUSH_INFO',
                message: 'Branch or remote information missing',
                remediation: 'Ensure git push includes branch and remote'
            });
        } else {
            result.validations.push({
                name: 'push_metadata',
                status: 'passed',
                message: `Pushing ${context.branch} to ${context.remote}`
            });
        }

        // Validate full test suite results
        if (context.testResults) {
            if (context.testResults.success) {
                result.validations.push({
                    name: 'full_test_suite',
                    status: 'passed',
                    message: 'Full test suite passed'
                });

                // Validate coverage if provided
                if (context.testResults.coverage) {
                    const coverage = context.testResults.coverage;
                    const threshold = context.coverageThreshold || 80;

                    if (coverage.lines >= threshold) {
                        result.validations.push({
                            name: 'coverage',
                            status: 'passed',
                            message: `Coverage ${coverage.lines}% meets threshold ${threshold}%`
                        });
                    } else {
                        result.validations.push({
                            name: 'coverage',
                            status: 'failed',
                            message: `Coverage ${coverage.lines}% below threshold ${threshold}%`
                        });
                        result.errors.push({
                            type: 'COVERAGE_ERROR',
                            message: 'Test coverage below threshold',
                            details: `Current: ${coverage.lines}%, Required: ${threshold}%`,
                            remediation: 'Add tests to improve coverage'
                        });
                    }
                }
            } else {
                result.validations.push({
                    name: 'full_test_suite',
                    status: 'failed',
                    message: 'Full test suite failed'
                });
                result.errors.push({
                    type: 'TEST_FAILURE',
                    message: 'Full test suite execution failed',
                    details: context.testResults.output,
                    remediation: 'Fix failing tests before pushing'
                });
            }
        }

        // Validate build results
        if (context.buildResults) {
            if (context.buildResults.success) {
                result.validations.push({
                    name: 'build',
                    status: 'passed',
                    message: 'Build validation passed'
                });
            } else {
                result.validations.push({
                    name: 'build',
                    status: 'failed',
                    message: 'Build validation failed'
                });
                result.errors.push({
                    type: 'BUILD_ERROR',
                    message: 'Build validation failed',
                    details: context.buildResults.output,
                    remediation: 'Fix build errors before pushing'
                });
            }
        }

        // Validate security audit
        if (context.securityResults) {
            if (context.securityResults.vulnerabilities === 0) {
                result.validations.push({
                    name: 'security_audit',
                    status: 'passed',
                    message: 'No security vulnerabilities detected'
                });
            } else {
                const severity = context.securityResults.severity || 'unknown';
                if (severity === 'high' || severity === 'critical') {
                    result.validations.push({
                        name: 'security_audit',
                        status: 'failed',
                        message: `${context.securityResults.vulnerabilities} ${severity} vulnerabilities found`
                    });
                    result.errors.push({
                        type: 'SECURITY_ERROR',
                        message: 'Security vulnerabilities detected',
                        details: context.securityResults.details,
                        remediation: 'Run npm audit fix to resolve vulnerabilities'
                    });
                } else {
                    result.validations.push({
                        name: 'security_audit',
                        status: 'warning',
                        message: `${context.securityResults.vulnerabilities} ${severity} vulnerabilities found`
                    });
                    result.warnings.push({
                        type: 'SECURITY_WARNING',
                        message: 'Low/moderate security vulnerabilities detected',
                        remediation: 'Consider running npm audit fix'
                    });
                }
            }
        }
    }

    /**
     * Validate post-commit hook context
     * Requirements: 1.5, 7.1
     */
    async validatePostCommitContext(context, result) {
        // Validate commit hash
        if (!context.commitHash) {
            result.warnings.push({
                type: 'MISSING_COMMIT_HASH',
                message: 'Commit hash not provided',
                remediation: 'Ensure commit hash is passed to post-commit hook'
            });
        } else {
            result.validations.push({
                name: 'commit_hash',
                status: 'passed',
                message: `Commit hash validated: ${context.commitHash.substring(0, 8)}`
            });
        }

        // Validate metrics update (non-blocking)
        if (context.metricsUpdated !== undefined) {
            if (context.metricsUpdated) {
                result.validations.push({
                    name: 'metrics_update',
                    status: 'passed',
                    message: 'Project metrics updated'
                });
            } else {
                result.warnings.push({
                    type: 'METRICS_WARNING',
                    message: 'Metrics update failed (non-blocking)',
                    remediation: 'Check metrics update logs'
                });
            }
        }

        // Validate documentation generation (non-blocking)
        if (context.docsGenerated !== undefined) {
            if (context.docsGenerated) {
                result.validations.push({
                    name: 'documentation',
                    status: 'passed',
                    message: 'Documentation regenerated'
                });
            } else {
                result.warnings.push({
                    type: 'DOCS_WARNING',
                    message: 'Documentation generation failed (non-blocking)',
                    remediation: 'Check documentation generation logs'
                });
            }
        }

        // Post-commit validations are non-blocking, so always pass
        result.gate = 'PASS';
    }

    /**
     * Validate post-merge hook context
     * Requirements: 1.5, 7.1
     */
    async validatePostMergeContext(context, result) {
        // Validate merge type
        if (!context.mergeType) {
            result.warnings.push({
                type: 'MISSING_MERGE_TYPE',
                message: 'Merge type not provided',
                remediation: 'Ensure merge type is passed to post-merge hook'
            });
        } else {
            result.validations.push({
                name: 'merge_type',
                status: 'passed',
                message: `Merge type: ${context.mergeType}`
            });
        }

        // Validate workflow execution
        if (context.workflowExecuted !== undefined) {
            if (context.workflowExecuted) {
                result.validations.push({
                    name: 'bmad_workflow',
                    status: 'passed',
                    message: 'BMAD workflow executed successfully'
                });
            } else {
                result.errors.push({
                    type: 'WORKFLOW_ERROR',
                    message: 'BMAD workflow execution failed',
                    details: context.workflowError,
                    remediation: 'Check workflow logs and retry'
                });
            }
        }

        // Validate repository state
        if (context.repositoryStateValid !== undefined) {
            if (context.repositoryStateValid) {
                result.validations.push({
                    name: 'repository_state',
                    status: 'passed',
                    message: 'Repository state validated'
                });
            } else {
                result.errors.push({
                    type: 'REPOSITORY_STATE_ERROR',
                    message: 'Repository state validation failed',
                    details: context.stateError,
                    remediation: 'Review repository state and resolve conflicts'
                });
            }
        }
    }

    /**
     * Validate pre-rebase hook context
     * Requirements: 1.5, 7.1
     */
    async validatePreRebaseContext(context, result) {
        if (!context.sourceBranch || !context.targetBranch) {
            result.errors.push({
                type: 'MISSING_REBASE_INFO',
                message: 'Source or target branch missing',
                remediation: 'Ensure rebase includes source and target branches'
            });
            return;
        }

        result.validations.push({
            name: 'rebase_metadata',
            status: 'passed',
            message: `Rebasing ${context.sourceBranch} onto ${context.targetBranch}`
        });

        // Validate rebase safety
        if (context.safetyCheck !== undefined) {
            if (context.safetyCheck.safe) {
                result.validations.push({
                    name: 'rebase_safety',
                    status: 'passed',
                    message: 'Rebase safety validated'
                });
            } else {
                result.errors.push({
                    type: 'REBASE_SAFETY_ERROR',
                    message: 'Rebase operation is unsafe',
                    details: context.safetyCheck.reason,
                    remediation: 'Review conflicts and resolve before rebasing'
                });
            }
        }
    }

    /**
     * Validate post-checkout hook context
     * Requirements: 1.5, 7.1
     */
    async validatePostCheckoutContext(context, result) {
        if (!context.newBranch) {
            result.warnings.push({
                type: 'MISSING_BRANCH_INFO',
                message: 'New branch information missing',
                remediation: 'Ensure branch name is passed to post-checkout hook'
            });
        } else {
            result.validations.push({
                name: 'checkout_metadata',
                status: 'passed',
                message: `Checked out branch: ${context.newBranch}`
            });
        }

        // Validate context restoration
        if (context.contextRestored !== undefined) {
            if (context.contextRestored) {
                result.validations.push({
                    name: 'context_restoration',
                    status: 'passed',
                    message: 'Branch context restored'
                });
            } else {
                result.warnings.push({
                    type: 'CONTEXT_WARNING',
                    message: 'Context restoration failed (non-blocking)',
                    remediation: 'Manually restore context if needed'
                });
            }
        }

        // Post-checkout validations are non-blocking
        result.gate = 'PASS';
    }

    /**
     * Validate pre-receive hook context
     * Requirements: 1.5, 7.1
     */
    async validatePreReceiveContext(context, result) {
        if (!context.oldCommit || !context.newCommit || !context.refName) {
            result.errors.push({
                type: 'MISSING_RECEIVE_INFO',
                message: 'Commit or ref information missing',
                remediation: 'Ensure pre-receive hook receives all required parameters'
            });
            return;
        }

        result.validations.push({
            name: 'receive_metadata',
            status: 'passed',
            message: `Receiving ${context.refName}: ${context.oldCommit.substring(0, 8)}..${context.newCommit.substring(0, 8)}`
        });

        // Validate pushed commits
        if (context.commitsValid !== undefined) {
            if (context.commitsValid) {
                result.validations.push({
                    name: 'commit_validation',
                    status: 'passed',
                    message: 'All pushed commits validated'
                });
            } else {
                result.errors.push({
                    type: 'COMMIT_VALIDATION_ERROR',
                    message: 'Invalid commits detected',
                    details: context.invalidCommits,
                    remediation: 'Fix invalid commits before pushing'
                });
            }
        }

        // Validate branch protection
        if (context.branchProtected !== undefined && context.branchProtected) {
            result.errors.push({
                type: 'BRANCH_PROTECTION_ERROR',
                message: 'Cannot push to protected branch',
                details: context.protectionRules,
                remediation: 'Use pull request workflow for protected branches'
            });
        }
    }

    /**
     * Generate hook-specific report with unified error formatting
     * Requirements: 1.5, 7.1
     */
    generateHookReport(validationResult) {
        const { hookType, gate, validations, errors, warnings, waiver, hookSpecific } = validationResult;

        const report = {
            hookType,
            gate,
            timestamp: validationResult.timestamp,
            summary: this.generateHookSummary(validationResult),
            validations: {
                passed: validations.filter(v => v.status === 'passed'),
                failed: validations.filter(v => v.status === 'failed'),
                warnings: validations.filter(v => v.status === 'warning'),
                skipped: validations.filter(v => v.status === 'skipped')
            },
            errors: errors.map(error => ({
                ...error,
                remediation: error.remediation || this.getRemediationForError(error)
            })),
            warnings,
            waiver,
            hookSpecific,
            performance: {
                timestamp: validationResult.timestamp,
                hookType
            },
            recommendations: this.generateHookRecommendations(validationResult)
        };

        return report;
    }

    /**
     * Generate hook-specific summary
     * Requirements: 1.5, 7.1
     */
    generateHookSummary(validationResult) {
        const { hookType, gate, validations, errors, warnings } = validationResult;

        const passedCount = validations.filter(v => v.status === 'passed').length;
        const failedCount = validations.filter(v => v.status === 'failed').length;
        const warningCount = warnings.length;

        let summary = `${hookType} hook validation ${gate === 'PASS' ? 'passed' : gate === 'WAIVED' ? 'waived' : 'failed'}`;

        if (passedCount > 0) {
            summary += ` (${passedCount} check${passedCount > 1 ? 's' : ''} passed`;
        }

        if (failedCount > 0) {
            summary += `, ${failedCount} failed`;
        }

        if (warningCount > 0) {
            summary += `, ${warningCount} warning${warningCount > 1 ? 's' : ''}`;
        }

        summary += ')';

        return summary;
    }

    /**
     * Generate hook-specific recommendations
     * Requirements: 1.5, 7.1
     */
    generateHookRecommendations(validationResult) {
        const recommendations = [];
        const { hookType, errors, warnings } = validationResult;

        // Hook-specific recommendations
        switch (hookType) {
        case 'pre-commit':
            if (errors.some(e => e.type === 'LINTING_ERROR')) {
                recommendations.push('Run npm run lint:fix to automatically fix linting issues');
            }
            if (errors.some(e => e.type === 'TEST_FAILURE')) {
                recommendations.push('Run npm test to see detailed test failure information');
            }
            if (errors.some(e => e.type === 'CONTEXT_UPDATE_ERROR')) {
                recommendations.push('Update activeContext.md to document your changes');
            }
            break;

        case 'commit-msg':
            if (errors.some(e => e.type === 'COMMIT_FORMAT_ERROR')) {
                recommendations.push('Use format: [PERSONA] [STEP-ID] Description');
                recommendations.push('Example: [DEVELOPER] [STEP-001] Implement user authentication');
            }
            break;

        case 'pre-push':
            if (errors.some(e => e.type === 'COVERAGE_ERROR')) {
                recommendations.push('Add tests to improve code coverage');
                recommendations.push('Run npm run test:coverage to see coverage details');
            }
            if (errors.some(e => e.type === 'SECURITY_ERROR')) {
                recommendations.push('Run npm audit fix to resolve security vulnerabilities');
            }
            break;

        case 'post-merge':
            if (errors.some(e => e.type === 'WORKFLOW_ERROR')) {
                recommendations.push('Check BMAD workflow logs for detailed error information');
                recommendations.push('Run npm run bmad:workflow manually to retry');
            }
            break;
        }

        // General recommendations based on warnings
        if (warnings.length > 0) {
            recommendations.push('Review warnings to improve code quality');
        }

        return recommendations;
    }

}

module.exports = EnhancedGatekeeper;
