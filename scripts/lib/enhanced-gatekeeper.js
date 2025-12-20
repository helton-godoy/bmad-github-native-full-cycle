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
}

module.exports = EnhancedGatekeeper;
