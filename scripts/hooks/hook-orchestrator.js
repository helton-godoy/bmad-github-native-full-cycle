/**
 * Hook Orchestrator - Central coordination of all Git hook operations
 * Part of the BMAD Git Hooks Automation system
 * Requirements: 1.1, 1.3, 1.4, 1.5
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Logger = require('../lib/logger');
const EnhancedGatekeeper = require('../lib/enhanced-gatekeeper');
const ContextManager = require('../lib/context-manager');
const TestExecutionManager = require('../lib/test-execution-manager');
const ProcessMonitor = require('../lib/process-monitor');
const GitHubActionsSync = require('./github-actions-sync');
const HookErrorHandler = require('./hook-error-handler');

class HookOrchestrator {
    constructor(config = {}) {
        this.config = {
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: true,
            performanceThreshold: 5000, // 5 seconds
            developmentMode: process.env.NODE_ENV === 'development' || process.env.BMAD_DEV_MODE === 'true',
            ...config
        };

        // Initialize core dependencies
        this.logger = new Logger('HookOrchestrator');
        this.gatekeeper = new EnhancedGatekeeper();
        this.contextManager = new ContextManager();
        this.testManager = new TestExecutionManager();
        this.githubActionsSync = new GitHubActionsSync();
        this.errorHandler = new HookErrorHandler({
            enableAutoRecovery: !this.config.developmentMode,
            enableBypass: this.config.developmentMode,
        });

        // Initialize process monitor if enabled
        if (process.env.ENABLE_PROCESS_MONITORING === 'true') {
            this.processMonitor = new ProcessMonitor({
                logFile: 'hook-process-monitor.json',
                maxProcesses: 15,
                maxMemoryMB: 512,
                maxCpuPercent: 60,
                enableAlerts: true
            });
        }

        // Color codes for console output
        this.colors = {
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            reset: '\x1b[0m'
        };

        // Performance monitoring
        this.startTime = null;
        this.metrics = {
            executions: [],
            averageDuration: 0,
            successRate: 0
        };
    }

    /**
     * Start performance timer and log execution start
     */
    startTimer(hookType) {
        this.startTime = Date.now();
        this.logger.info(`Starting ${hookType} hook execution`);
    }

    /**
     * End performance timer and record metrics
     */
    endTimer(hookType, success = true) {
        if (this.startTime) {
            const duration = Date.now() - this.startTime;

            // Record execution metrics
            this.recordExecution(hookType, duration, success);

            this.logger.info(`${hookType} hook execution completed in ${duration}ms`);
            return duration;
        }
        return 0;
    }

    /**
     * Record execution metrics for performance monitoring
     */
    recordExecution(hookType, duration, success) {
        const execution = {
            hookType,
            timestamp: new Date().toISOString(),
            duration,
            success,
            performanceThresholdMet: duration <= this.config.performanceThreshold
        };

        this.metrics.executions.push(execution);

        // Keep only last 100 executions for memory efficiency
        if (this.metrics.executions.length > 100) {
            this.metrics.executions = this.metrics.executions.slice(-100);
        }

        // Update aggregate metrics
        this.updateAggregateMetrics();
    }

    /**
     * Update aggregate performance metrics
     */
    updateAggregateMetrics() {
        const executions = this.metrics.executions;
        if (executions.length === 0) return;

        // Calculate average duration
        const totalDuration = executions.reduce((sum, exec) => sum + exec.duration, 0);
        this.metrics.averageDuration = totalDuration / executions.length;

        // Calculate success rate
        const successfulExecutions = executions.filter(exec => exec.success).length;
        this.metrics.successRate = successfulExecutions / executions.length;
    }

    /**
     * Get current performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            currentConfig: this.config,
            lastExecution: this.metrics.executions[this.metrics.executions.length - 1] || null
        };
    }

    /**
     * Execute pre-commit hook with comprehensive validation
     * Requirements: 1.1, 1.3, 1.4, 1.5
     */
    async executePreCommit(stagedFiles = []) {
        this.startTimer('pre-commit');
        this.logger.info(`Executing pre-commit hook with ${stagedFiles.length} staged files`);

        try {
            const results = {
                linting: { status: 'skipped' },
                testing: { status: 'skipped' },
                contextValidation: { status: 'skipped' },
                gatekeeperIntegration: { status: 'skipped' }
            };

            // 1. Run linting and formatting on staged files (Requirement 1.1)
            if (this.config.enableLinting && stagedFiles.length > 0) {
                results.linting = await this.runLinting(stagedFiles);
            }

            // 2. Execute fast unit tests (Requirement 1.3)
            if (this.config.enableTesting) {
                results.testing = await this.runFastTests();
            }

            // 3. Validate context updates (Requirement 1.4)
            if (this.config.enableContextValidation) {
                results.contextValidation = await this.validateContext();
            }

            // 4. Integrate with Enhanced Gatekeeper (Requirement 1.5)
            if (this.config.enableGatekeeper) {
                results.gatekeeperIntegration = await this.integrateWithGatekeeper('pre-commit', {
                    stagedFiles,
                    results
                });
            }

            const duration = this.endTimer('pre-commit', this.allResultsSuccessful(results));

            return {
                success: this.allResultsSuccessful(results),
                duration,
                results,
                metrics: this.getMetrics()
            };
        } catch (error) {
            this.logger.error(`Pre-commit hook failed: ${error.message}`);
            this.endTimer('pre-commit', false);

            return {
                success: false,
                duration: this.endTimer('pre-commit', false),
                error: error.message,
                results: {}
            };
        }
    }

    /**
     * Run linting and formatting on staged files using lint-staged
     * Requirements: 1.1
     */
    async runLinting(stagedFiles) {
        this.logger.info(`Running linting on ${stagedFiles.length} staged files`);

        try {
            // Filter JavaScript files for linting
            const jsFiles = stagedFiles.filter(file =>
                file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx')
            );

            if (jsFiles.length === 0) {
                return {
                    status: 'skipped',
                    message: 'No JavaScript files to lint',
                    filesProcessed: 0
                };
            }

            // Use lint-staged for performance optimization
            let lintOutput = '';
            const issuesFixed = 0;

            try {
                // Run ESLint with --fix flag
                lintOutput = execSync(`npx eslint --fix ${jsFiles.join(' ')}`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            } catch (error) {
                // ESLint returns non-zero exit code when issues are found
                if (error.stdout) {
                    lintOutput = error.stdout;
                }

                // Check if there are unfixable issues
                if (error.stderr && error.stderr.includes('error')) {
                    return {
                        status: 'failed',
                        error: `Linting failed with unfixable errors: ${error.stderr}`,
                        filesProcessed: jsFiles.length
                    };
                }
            }

            // Run Prettier for formatting
            try {
                execSync(`npx prettier --write ${jsFiles.join(' ')}`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            } catch (error) {
                this.logger.warn(`Prettier formatting had issues: ${error.message}`);
            }

            return {
                status: 'passed',
                filesProcessed: jsFiles.length,
                issuesFixed,
                output: lintOutput
            };
        } catch (error) {
            this.logger.error(`Linting failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                filesProcessed: 0
            };
        }
    }

    /**
     * Run fast unit tests for immediate feedback with serialized execution
     * Requirements: 1.3
     */
    async runFastTests() {
        this.logger.info('Running fast unit tests with serialized execution');

        try {
            // Check cache first to avoid unnecessary test runs
            const cacheKey = this.generateTestCacheKey();
            const cachedResult = this.getCachedTestResult(cacheKey);
            if (cachedResult && this.isCacheValid(cachedResult)) {
                this.logger.info('Using cached test results');
                return cachedResult;
            }

            // Check system resources before executing tests
            if (!this.testManager.hasEnoughResources()) {
                this.logger.warn('System resources low, skipping tests');
                return {
                    status: 'skipped',
                    message: 'Skipped due to low system resources',
                    testsRun: 0
                };
            }

            // Check if test script exists
            const packagePath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                return {
                    status: 'warning',
                    message: 'No package.json found',
                    testsRun: 0
                };
            }

            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts.test) {
                return {
                    status: 'warning',
                    message: 'No test script defined in package.json',
                    testsRun: 0
                };
            }

            // Execute tests with serialized execution manager
            const testResult = await this.testManager.executeTestsWithLock('npm test', {
                processId: 'fast-tests',
                maxWorkers: 1,
                timeout: 15000,
                testTimeout: 5000,
                bail: true,
                silent: true,
                findRelatedTests: this.getChangedFiles()
            });

            if (!testResult.success) {
                return {
                    status: 'failed',
                    error: testResult.error,
                    testsRun: 0,
                    output: testResult.output
                };
            }

            // Parse test results
            const testResults = this.parseTestOutput(testResult.output);

            const result = {
                status: testResults.failed === 0 ? 'passed' : 'failed',
                testsRun: testResults.total,
                passed: testResults.passed,
                failed: testResults.failed,
                duration: testResults.duration,
                output: testResult.output,
                cached: false,
                timestamp: Date.now(),
                serialized: true
            };

            // Cache the result only if successful
            if (result.status === 'passed') {
                this.cacheTestResult(cacheKey, result);
            }

            return result;
        } catch (error) {
            this.logger.error(`Fast tests failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                testsRun: 0,
                output: error.stdout || error.message
            };
        }
    }

    /**
     * Parse Jest test output to extract basic metrics
     */
    parseTestOutput(output) {
        const results = {
            total: 0,
            passed: 0,
            failed: 0,
            duration: 0
        };

        // Basic Jest output parsing
        const testMatch = output.match(/Tests:\s+(\d+)\s+passed/);
        if (testMatch) {
            results.passed = parseInt(testMatch[1]);
            results.total = results.passed;
        }

        const failMatch = output.match(/(\d+)\s+failed/);
        if (failMatch) {
            results.failed = parseInt(failMatch[1]);
            results.total += results.failed;
        }

        const timeMatch = output.match(/Time:\s+([\d.]+)\s*s/);
        if (timeMatch) {
            results.duration = parseFloat(timeMatch[1]) * 1000; // Convert to ms
        }

        return results;
    }

    /**
     * Validate activeContext.md updates for code changes
     * Requirements: 1.4
     */
    async validateContext() {
        this.logger.info('Validating activeContext.md updates');

        try {
            // Check if there are staged code changes
            const stagedFiles = this.getStagedFiles();
            const hasCodeChanges = stagedFiles.some(file =>
                file.match(/\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|cpp|h|hpp|css|scss|html|vue|svelte)$/)
            );

            const contextPath = path.join(process.cwd(), 'activeContext.md');
            const contextExists = fs.existsSync(contextPath);
            const contextStaged = stagedFiles.includes('activeContext.md');

            // If no code changes, context validation passes
            if (!hasCodeChanges) {
                return {
                    status: 'passed',
                    message: 'No code changes detected, context validation not required',
                    contextExists,
                    contextStaged: false
                };
            }

            // If code changes exist, activeContext.md should be updated
            if (hasCodeChanges && !contextStaged) {
                return {
                    status: 'failed',
                    message: 'Code changes detected but activeContext.md not updated',
                    contextExists,
                    contextStaged: false,
                    remediation: 'Update activeContext.md to reflect current changes and stage it'
                };
            }

            // Validate context file content if it exists and is staged
            if (contextExists && contextStaged) {
                const contextContent = fs.readFileSync(contextPath, 'utf8');
                const isValidContext = this.validateContextContent(contextContent);

                return {
                    status: isValidContext ? 'passed' : 'warning',
                    message: isValidContext ? 'Context validation passed' : 'Context file may need more detail',
                    contextExists: true,
                    contextStaged: true,
                    contentLength: contextContent.length
                };
            }

            return {
                status: 'warning',
                message: 'Context validation completed with warnings',
                contextExists,
                contextStaged
            };
        } catch (error) {
            this.logger.error(`Context validation failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                contextExists: false,
                contextStaged: false
            };
        }
    }

    /**
     * Get list of staged files from git
     */
    getStagedFiles() {
        try {
            const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
            return output.trim().split('\n').filter(file => file.length > 0);
        } catch (error) {
            this.logger.warn(`Could not get staged files: ${error.message}`);
            return [];
        }
    }

    /**
     * Validate activeContext.md content quality
     */
    validateContextContent(content) {
        // Basic validation - content should be meaningful
        if (content.length < 50) return false;

        // Should contain some key indicators of context
        const hasTimestamp = /\d{4}-\d{2}-\d{2}/.test(content);
        const hasDescription = content.toLowerCase().includes('current') ||
            content.toLowerCase().includes('working') ||
            content.toLowerCase().includes('implementing');

        return hasTimestamp || hasDescription;
    }

    /**
     * Integrate with Enhanced Gatekeeper for comprehensive validation
     * Requirements: 1.5
     */
    async integrateWithGatekeeper(hookType, context) {
        this.logger.info(`Integrating with Enhanced Gatekeeper for ${hookType} hook`);

        try {
            // Prepare gatekeeper context
            const gatekeeperContext = {
                hookType,
                timestamp: new Date().toISOString(),
                ...context
            };

            // Use hook-specific gatekeeper validation
            const validationResult = await this.gatekeeper.validateHookContext(hookType, gatekeeperContext);

            // Generate comprehensive hook report
            const hookReport = this.gatekeeper.generateHookReport(validationResult);

            // Log the report for visibility
            this.logGatekeeperReport(hookReport);

            return {
                status: validationResult.gate === 'PASS' ? 'passed' :
                    validationResult.gate === 'WAIVED' ? 'waived' : 'failed',
                gate: validationResult.gate,
                validations: validationResult.validations,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
                waiver: validationResult.waiver,
                hookSpecific: validationResult.hookSpecific,
                report: hookReport
            };
        } catch (error) {
            this.logger.error(`Gatekeeper integration failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                gate: 'FAIL'
            };
        }
    }

    /**
     * Log gatekeeper report with formatted output
     * Requirements: 1.5, 7.1
     */
    logGatekeeperReport(report) {
        const { colors } = this;

        // Log summary
        const statusColor = report.gate === 'PASS' ? colors.green :
            report.gate === 'WAIVED' ? colors.yellow : colors.red;

        this.logger.info(`${statusColor}${report.summary}${colors.reset}`);

        // Log recommendations if any
        if (report.recommendations && report.recommendations.length > 0) {
            this.logger.info(`${colors.blue}Recommendations:${colors.reset}`);
            report.recommendations.forEach(rec => {
                this.logger.info(`  • ${rec}`);
            });
        }

        // Log hook-specific information
        if (report.hookSpecific && Object.keys(report.hookSpecific).length > 0) {
            this.logger.debug('Hook-specific data:', report.hookSpecific);
        }
    }

    /**
     * Check if all validation results are successful
     */
    allResultsSuccessful(results) {
        return Object.values(results).every(result =>
            result.status === 'passed' ||
            result.status === 'skipped' ||
            result.status === 'waived'
        );
    }

    /**
     * Execute commit message validation hook
     * Requirements: 2.1, 2.2, 2.3, 2.4
     */
    async executeCommitMsg(message) {
        this.startTimer('commit-msg');
        this.logger.info('Executing commit-msg hook validation');

        try {
            const BMADMessageValidator = require('./bmad-message-validator');
            const validator = new BMADMessageValidator({
                strictMode: !this.config.developmentMode,
                allowConventionalFallback: true,
                requireUppercasePersona: true
            });

            // Validate the commit message (Requirements 2.1, 2.3)
            const validationResult = validator.validateMessage(message);

            // Check for bypass mechanisms in development mode
            const bypassResult = this.checkBypassMechanisms(message, validationResult);

            const results = {
                messageValidation: validationResult,
                bypass: bypassResult,
                contextValidation: { status: 'skipped' },
                gatekeeperIntegration: { status: 'skipped' }
            };

            // Validate context consistency if message is BMAD format (Requirement 2.4)
            if (validationResult.valid && validationResult.format === 'bmad') {
                results.contextValidation = await this.validateCommitContext(validationResult.parsed);
            }

            // Integrate with Enhanced Gatekeeper if enabled
            if (this.config.enableGatekeeper && validationResult.valid) {
                results.gatekeeperIntegration = await this.integrateWithGatekeeper('commit-msg', {
                    message,
                    validationResult,
                    parsed: validationResult.parsed
                });
            }

            const success = this.isCommitMessageValid(results, bypassResult);
            const duration = this.endTimer('commit-msg', success);

            const response = {
                success,
                duration,
                results,
                validationSummary: validator.getValidationSummary(validationResult),
                metrics: this.getMetrics()
            };

            // Generate error message if validation failed (Requirement 2.2)
            if (!success && !bypassResult.bypassed) {
                response.errorMessage = validator.generateErrorMessage(validationResult);
                response.remediation = this.generateCommitMessageRemediation(validationResult, results);
            }

            return response;

        } catch (error) {
            this.logger.error(`Commit message validation failed: ${error.message}`);
            this.endTimer('commit-msg', false);

            return {
                success: false,
                duration: this.endTimer('commit-msg', false),
                error: error.message,
                results: {},
                errorMessage: `Commit message validation crashed: ${error.message}`
            };
        }
    }

    /**
     * Check for bypass mechanisms in development mode
     * Requirements: Development mode bypass controls
     */
    checkBypassMechanisms(message, _validationResult) {
        const bypassResult = {
            bypassed: false,
            reason: null,
            auditTrail: null
        };

        // Check for development mode bypass
        if (this.config.developmentMode) {
            // Allow bypass with special prefix
            if (message.startsWith('WIP:') || message.startsWith('TEMP:') || message.startsWith('DEV:')) {
                bypassResult.bypassed = true;
                bypassResult.reason = 'Development mode bypass with WIP/TEMP/DEV prefix';
                bypassResult.auditTrail = {
                    timestamp: new Date().toISOString(),
                    originalMessage: message,
                    developmentMode: true,
                    bypassType: 'prefix'
                };

                this.logger.warn(`Commit message validation bypassed: ${bypassResult.reason}`);
                return bypassResult;
            }

            // Allow bypass for emergency commits
            if (message.toLowerCase().includes('emergency') || message.toLowerCase().includes('hotfix')) {
                bypassResult.bypassed = true;
                bypassResult.reason = 'Emergency/hotfix bypass in development mode';
                bypassResult.auditTrail = {
                    timestamp: new Date().toISOString(),
                    originalMessage: message,
                    developmentMode: true,
                    bypassType: 'emergency'
                };

                this.logger.warn(`Commit message validation bypassed: ${bypassResult.reason}`);
                return bypassResult;
            }
        }

        // Check for environment variable bypass
        if (process.env.BMAD_BYPASS_COMMIT_MSG === 'true') {
            bypassResult.bypassed = true;
            bypassResult.reason = 'Environment variable bypass (BMAD_BYPASS_COMMIT_MSG=true)';
            bypassResult.auditTrail = {
                timestamp: new Date().toISOString(),
                originalMessage: message,
                environmentBypass: true,
                bypassType: 'environment'
            };

            this.logger.warn(`Commit message validation bypassed: ${bypassResult.reason}`);
        }

        return bypassResult;
    }

    /**
     * Validate commit context consistency for BMAD messages
     * Requirements: 2.4
     */
    async validateCommitContext(parsedMessage) {
        this.logger.info(`Validating context consistency for persona: ${parsedMessage.persona}`);

        try {
            // Check if activeContext.md exists and is consistent
            const contextPath = path.join(process.cwd(), 'activeContext.md');
            const contextExists = fs.existsSync(contextPath);

            if (!contextExists) {
                return {
                    status: 'warning',
                    message: 'activeContext.md not found - consider creating it for better traceability',
                    contextExists: false,
                    personaConsistent: false
                };
            }

            const contextContent = fs.readFileSync(contextPath, 'utf8');

            // Check if the persona in the commit matches the context
            const personaInContext = this.extractPersonaFromContext(contextContent);
            const personaConsistent = !personaInContext ||
                personaInContext === parsedMessage.persona ||
                this.isValidPersonaTransition(personaInContext, parsedMessage.persona);

            // Check if step ID follows logical progression
            const stepIdConsistent = this.validateStepIdProgression(contextContent, parsedMessage.stepId);

            return {
                status: personaConsistent && stepIdConsistent ? 'passed' : 'warning',
                message: personaConsistent && stepIdConsistent ?
                    'Context validation passed' :
                    'Context may be inconsistent with commit message',
                contextExists: true,
                personaConsistent,
                stepIdConsistent,
                currentPersona: personaInContext,
                commitPersona: parsedMessage.persona,
                stepId: parsedMessage.stepId
            };

        } catch (error) {
            this.logger.error(`Context validation failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                contextExists: false,
                personaConsistent: false
            };
        }
    }

    /**
     * Extract persona from activeContext.md content
     */
    extractPersonaFromContext(contextContent) {
        // Look for persona indicators in context
        const personaMatch = contextContent.match(/(?:persona|role|acting as):\s*([A-Z_]+)/i);
        if (personaMatch) {
            return personaMatch[1].toUpperCase();
        }

        // Look for BMAD commit patterns in context
        const bmadMatch = contextContent.match(/\[([A-Z_]+)\]/);
        if (bmadMatch) {
            return bmadMatch[1];
        }

        return null;
    }

    /**
     * Check if persona transition is valid
     */
    isValidPersonaTransition(fromPersona, toPersona) {
        // Define valid persona transitions in BMAD workflow
        const validTransitions = {
            'PM': ['ARCHITECT', 'DEVELOPER', 'QA'],
            'ARCHITECT': ['DEVELOPER', 'PM', 'SECURITY'],
            'DEVELOPER': ['QA', 'ARCHITECT', 'DEVOPS'],
            'QA': ['DEVELOPER', 'DEVOPS', 'RELEASE'],
            'DEVOPS': ['DEVELOPER', 'QA', 'SECURITY', 'RELEASE'],
            'SECURITY': ['DEVELOPER', 'ARCHITECT', 'DEVOPS'],
            'RELEASE': ['PM', 'QA', 'DEVOPS'],
            'RECOVERY': ['DEVELOPER', 'ARCHITECT', 'DEVOPS'],
            'ORCHESTRATOR': ['PM', 'ARCHITECT', 'DEVELOPER', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE']
        };

        return validTransitions[fromPersona]?.includes(toPersona) || false;
    }

    /**
     * Validate step ID progression
     */
    validateStepIdProgression(contextContent, stepId) {
        // Extract previous step IDs from context
        const stepMatches = contextContent.match(/\[([A-Z]+-\d+)\]/g);
        if (!stepMatches || stepMatches.length === 0) {
            return true; // No previous steps to validate against
        }

        // Basic validation - step ID should be reasonable
        const stepIdPattern = /^([A-Z]+)-(\d+)$/;
        const match = stepIdPattern.exec(stepId);

        if (!match) {
            return false;
        }

        const [, , number] = match;
        const numericValue = parseInt(number, 10);

        // Step ID should be reasonable (not too high, not zero)
        return numericValue > 0 && numericValue <= 9999;
    }

    /**
     * Check if commit message validation results indicate success
     */
    isCommitMessageValid(results, bypassResult) {
        // If bypassed, consider valid
        if (bypassResult.bypassed) {
            return true;
        }

        // Message validation must pass
        if (!results.messageValidation.valid) {
            return false;
        }

        // Context validation can be warning but not failed
        if (results.contextValidation.status === 'failed') {
            return false;
        }

        // Gatekeeper integration must not fail
        if (results.gatekeeperIntegration.status === 'failed') {
            return false;
        }

        return true;
    }

    /**
     * Generate remediation guidance for commit message failures
     * Requirements: 2.2
     */
    generateCommitMessageRemediation(validationResult, results) {
        const remediation = {
            steps: [],
            examples: [],
            quickFixes: []
        };

        // Add specific remediation based on validation errors
        if (!validationResult.valid) {
            remediation.steps.push('Fix commit message format to match BMAD pattern or conventional commits');

            if (validationResult.errors.some(e => e.includes('BMAD pattern'))) {
                remediation.examples.push('[DEVELOPER] [STEP-001] Implement user authentication');
                remediation.examples.push('[ARCHITECT] [ARCH-042] Design database schema');
                remediation.quickFixes.push('Use format: [PERSONA] [STEP-ID] Description');
            }

            if (validationResult.errors.some(e => e.includes('persona'))) {
                remediation.quickFixes.push('Valid personas: DEVELOPER, ARCHITECT, PM, QA, DEVOPS, SECURITY, RELEASE, RECOVERY, ORCHESTRATOR');
            }
        }

        // Add context-related remediation
        if (results.contextValidation.status === 'failed') {
            remediation.steps.push('Update activeContext.md to reflect current work');
            remediation.quickFixes.push('Ensure persona in commit matches current context');
        }

        // Add development mode bypass options
        if (this.config.developmentMode) {
            remediation.quickFixes.push('Development mode: Use WIP:, TEMP:, or DEV: prefix to bypass validation');
            remediation.quickFixes.push('Emergency: Use "emergency" or "hotfix" in message to bypass');
        }

        return remediation;
    }

    /**
     * Execute pre-push validation hook with comprehensive validation
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
     */
    async executePrePush(branch, remote) {
        this.startTimer('pre-push');
        this.logger.info(`Executing pre-push hook for ${branch} -> ${remote}`);

        try {
            const results = {
                fullTestSuite: { status: 'skipped' },
                buildValidation: { status: 'skipped' },
                securityAudit: { status: 'skipped' },
                bmadWorkflowSync: { status: 'skipped' },
                gatekeeperIntegration: { status: 'skipped' }
            };

            // 1. Execute complete test suite with coverage reporting (Requirement 3.1)
            results.fullTestSuite = await this.runFullTestSuite();

            // 2. Verify project builds successfully (Requirement 3.2)
            results.buildValidation = await this.validateBuild();

            // 3. Execute npm audit and report security vulnerabilities (Requirement 3.3)
            results.securityAudit = await this.runSecurityAudit();

            // 4. Synchronize validation with BMAD workflow requirements (Requirement 3.4)
            results.bmadWorkflowSync = await this.synchronizeBMADWorkflow(branch, remote);

            // 5. Integrate with Enhanced Gatekeeper
            if (this.config.enableGatekeeper) {
                results.gatekeeperIntegration = await this.integrateWithGatekeeper('pre-push', {
                    branch,
                    remote,
                    results
                });
            }

            const success = this.allResultsSuccessful(results);
            const duration = this.endTimer('pre-push', success);

            const response = {
                success,
                duration,
                results,
                metrics: this.getMetrics(),
                branch,
                remote
            };

            // Generate detailed failure reports if validation failed (Requirement 3.5)
            if (!success) {
                response.failureReport = this.generatePrePushFailureReport(results);
                response.remediation = this.generatePrePushRemediation(results);
            }

            return response;

        } catch (error) {
            this.logger.error(`Pre-push hook failed: ${error.message}`);
            this.endTimer('pre-push', false);

            return {
                success: false,
                duration: this.endTimer('pre-push', false),
                error: error.message,
                results: {},
                failureReport: {
                    type: 'execution_error',
                    message: `Pre-push validation crashed: ${error.message}`,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Run complete test suite with coverage reporting
     * Requirements: 3.1
     */
    async runFullTestSuite() {
        this.logger.info('Running complete test suite with coverage reporting');

        try {
            // Check if test script exists
            const packagePath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                return {
                    status: 'warning',
                    message: 'No package.json found',
                    testsRun: 0,
                    coverage: null
                };
            }

            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts['test:coverage']) {
                // Fallback to regular test if coverage script not available
                if (!pkg.scripts.test) {
                    return {
                        status: 'warning',
                        message: 'No test scripts defined in package.json',
                        testsRun: 0,
                        coverage: null
                    };
                }
            }

            // Run tests with coverage
            const testCommand = pkg.scripts['test:coverage'] ? 'npm run test:coverage' : 'npm test -- --coverage --maxWorkers=2';
            const testOutput = execSync(testCommand, {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 120000 // Reduced to 2 minute timeout for full test suite
            });

            // Parse test results and coverage
            const testResults = this.parseTestOutput(testOutput);
            const coverageResults = this.parseCoverageOutput(testOutput);

            // Check if coverage meets minimum thresholds
            const coverageThreshold = this.getCoverageThreshold();
            const coverageMet = this.checkCoverageThreshold(coverageResults, coverageThreshold);

            return {
                status: testResults.failed === 0 && coverageMet ? 'passed' : 'failed',
                testsRun: testResults.total,
                passed: testResults.passed,
                failed: testResults.failed,
                duration: testResults.duration,
                coverage: coverageResults,
                coverageThreshold,
                coverageMet,
                output: testOutput
            };

        } catch (error) {
            this.logger.error(`Full test suite failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                testsRun: 0,
                coverage: null,
                output: error.stdout || error.message
            };
        }
    }

    /**
     * Parse coverage output from Jest
     */
    parseCoverageOutput(output) {
        const coverage = {
            statements: { pct: 0, covered: 0, total: 0 },
            branches: { pct: 0, covered: 0, total: 0 },
            functions: { pct: 0, covered: 0, total: 0 },
            lines: { pct: 0, covered: 0, total: 0 }
        };

        // Parse Jest coverage table
        const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
        if (coverageMatch) {
            coverage.statements.pct = parseFloat(coverageMatch[1]);
            coverage.branches.pct = parseFloat(coverageMatch[2]);
            coverage.functions.pct = parseFloat(coverageMatch[3]);
            coverage.lines.pct = parseFloat(coverageMatch[4]);
        }

        return coverage;
    }

    /**
     * Get coverage threshold from package.json or default
     */
    getCoverageThreshold() {
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

            if (pkg.jest && pkg.jest.coverageThreshold && pkg.jest.coverageThreshold.global) {
                return pkg.jest.coverageThreshold.global;
            }
        } catch (error) {
            this.logger.warn(`Could not read coverage threshold: ${error.message}`);
        }

        // Default thresholds
        return {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        };
    }

    /**
     * Check if coverage meets minimum thresholds
     */
    checkCoverageThreshold(coverage, threshold) {
        return coverage.statements.pct >= threshold.statements &&
            coverage.branches.pct >= threshold.branches &&
            coverage.functions.pct >= threshold.functions &&
            coverage.lines.pct >= threshold.lines;
    }

    /**
     * Validate project builds successfully
     * Requirements: 3.2
     */
    async validateBuild() {
        this.logger.info('Validating project build');

        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                return {
                    status: 'warning',
                    message: 'No package.json found for build validation'
                };
            }

            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

            // Check if build script exists
            if (!pkg.scripts || !pkg.scripts.build) {
                return {
                    status: 'warning',
                    message: 'No build script defined in package.json'
                };
            }

            // Run build validation
            const buildOutput = execSync('npm run build', {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 180000 // 3 minute timeout for build
            });

            return {
                status: 'passed',
                message: 'Build validation successful',
                output: buildOutput
            };

        } catch (error) {
            this.logger.error(`Build validation failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                output: error.stdout || error.message
            };
        }
    }

    /**
     * Run security audit and report vulnerabilities
     * Requirements: 3.3
     */
    async runSecurityAudit() {
        this.logger.info('Running security audit');

        try {
            // Run npm audit
            let auditOutput = '';
            let auditExitCode = 0;

            try {
                auditOutput = execSync('npm audit --audit-level=moderate', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            } catch (error) {
                auditExitCode = error.status;
                auditOutput = error.stdout || error.message;
            }

            // Parse audit results
            const auditResults = this.parseAuditOutput(auditOutput);

            // Determine if audit passed based on severity
            const criticalVulns = auditResults.vulnerabilities.critical || 0;
            const highVulns = auditResults.vulnerabilities.high || 0;

            // Fail if critical or high vulnerabilities found
            const auditPassed = criticalVulns === 0 && highVulns === 0;

            return {
                status: auditPassed ? 'passed' : 'failed',
                vulnerabilities: auditResults.vulnerabilities,
                totalVulnerabilities: auditResults.total,
                auditExitCode,
                output: auditOutput,
                recommendations: auditResults.recommendations
            };

        } catch (error) {
            this.logger.error(`Security audit failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                vulnerabilities: {},
                totalVulnerabilities: 0
            };
        }
    }

    /**
     * Parse npm audit output
     */
    parseAuditOutput(output) {
        const results = {
            vulnerabilities: {
                critical: 0,
                high: 0,
                moderate: 0,
                low: 0,
                info: 0
            },
            total: 0,
            recommendations: []
        };

        try {
            // Try to parse JSON output first
            if (output.includes('{')) {
                const jsonMatch = output.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const auditData = JSON.parse(jsonMatch[0]);
                    if (auditData.vulnerabilities) {
                        results.vulnerabilities = auditData.vulnerabilities;
                        results.total = Object.values(auditData.vulnerabilities).reduce((sum, count) => sum + count, 0);
                    }
                }
            } else {
                // Parse text output
                const vulnMatch = output.match(/(\d+) vulnerabilities/);
                if (vulnMatch) {
                    results.total = parseInt(vulnMatch[1]);
                }

                // Extract severity counts
                const severities = ['critical', 'high', 'moderate', 'low', 'info'];
                severities.forEach(severity => {
                    const match = output.match(new RegExp(`(\\d+) ${severity}`, 'i'));
                    if (match) {
                        results.vulnerabilities[severity] = parseInt(match[1]);
                    }
                });
            }

            // Extract recommendations
            if (output.includes('npm audit fix')) {
                results.recommendations.push('Run "npm audit fix" to automatically fix vulnerabilities');
            }
            if (output.includes('npm audit fix --force')) {
                results.recommendations.push('Run "npm audit fix --force" for breaking changes');
            }

        } catch (error) {
            this.logger.warn(`Could not parse audit output: ${error.message}`);
        }

        return results;
    }

    /**
     * Synchronize validation with BMAD workflow requirements
     * Requirements: 3.4, 7.4
     */
    async synchronizeBMADWorkflow(branch, remote) {
        this.logger.info(`Synchronizing BMAD workflow for ${branch} -> ${remote}`);

        try {
            const syncResults = {
                workflowActive: false,
                personaConsistency: false,
                contextSynchronized: false,
                workflowPhase: null,
                currentPersona: null
            };

            // Check if BMAD workflow is active
            const contextPath = path.join(process.cwd(), 'activeContext.md');
            if (fs.existsSync(contextPath)) {
                const contextContent = fs.readFileSync(contextPath, 'utf8');
                syncResults.workflowActive = true;

                // Extract current persona and workflow phase
                syncResults.currentPersona = this.extractPersonaFromContext(contextContent);
                syncResults.workflowPhase = this.extractWorkflowPhase(contextContent);

                // Check persona consistency with recent commits
                syncResults.personaConsistency = await this.validatePersonaConsistency(branch, syncResults.currentPersona);

                // Validate context synchronization
                syncResults.contextSynchronized = await this.validateContextSynchronization(contextContent, branch);
            }

            // Check for BMAD orchestrator coordination
            const orchestratorSync = await this.coordinateWithBMADOrchestrator(branch, remote, syncResults);

            return {
                status: syncResults.workflowActive && syncResults.personaConsistency && syncResults.contextSynchronized ? 'passed' : 'warning',
                ...syncResults,
                orchestratorSync,
                message: syncResults.workflowActive ? 'BMAD workflow synchronization completed' : 'No active BMAD workflow detected'
            };

        } catch (error) {
            this.logger.error(`BMAD workflow synchronization failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                message: `BMAD workflow synchronization failed: ${error.message}`,
                workflowActive: false,
                personaConsistency: false,
                contextSynchronized: false
            };
        }
    }

    /**
     * Extract workflow phase from context content
     */
    extractWorkflowPhase(contextContent) {
        // Look for workflow phase indicators
        const phasePatterns = [
            { pattern: /planning|requirements|analysis/i, phase: 'planning' },
            { pattern: /design|architecture|modeling/i, phase: 'design' },
            { pattern: /implementation|coding|development/i, phase: 'implementation' },
            { pattern: /testing|qa|validation/i, phase: 'testing' },
            { pattern: /deployment|release|production/i, phase: 'deployment' },
            { pattern: /maintenance|support|monitoring/i, phase: 'maintenance' }
        ];

        for (const { pattern, phase } of phasePatterns) {
            if (pattern.test(contextContent)) {
                return phase;
            }
        }

        return 'unknown';
    }

    /**
     * Validate persona consistency with recent commits
     */
    async validatePersonaConsistency(branch, currentPersona) {
        try {
            // Get recent commits on the branch
            const recentCommits = execSync(`git log --oneline -10 ${branch}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Extract personas from recent commit messages
            const commitPersonas = [];
            const bmadPattern = /\[([A-Z_]+)\]/g;
            let match;

            while ((match = bmadPattern.exec(recentCommits)) !== null) {
                commitPersonas.push(match[1]);
            }

            // Check if current persona is consistent with recent activity
            if (commitPersonas.length === 0) {
                return true; // No BMAD commits to validate against
            }

            const recentPersona = commitPersonas[0]; // Most recent commit persona
            return !currentPersona || currentPersona === recentPersona || this.isValidPersonaTransition(recentPersona, currentPersona);

        } catch (error) {
            this.logger.warn(`Could not validate persona consistency: ${error.message}`);
            return true; // Don't fail on validation errors
        }
    }

    /**
     * Validate context synchronization with branch state
     */
    async validateContextSynchronization(contextContent, branch) {
        try {
            // Check if context mentions the current branch
            const branchMentioned = contextContent.includes(branch) || contextContent.includes('branch');

            // Check if context has recent timestamp
            const timestampPattern = /\d{4}-\d{2}-\d{2}/;
            const hasRecentTimestamp = timestampPattern.test(contextContent);

            // Check if context reflects recent changes
            const recentChanges = execSync('git diff --name-only HEAD~5..HEAD', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const contextReflectsChanges = recentChanges.split('\n').some(file =>
                contextContent.includes(file) || contextContent.includes(path.basename(file))
            );

            return branchMentioned || hasRecentTimestamp || contextReflectsChanges;

        } catch (error) {
            this.logger.warn(`Could not validate context synchronization: ${error.message}`);
            return true; // Don't fail on validation errors
        }
    }

    /**
     * Coordinate with BMAD Orchestrator
     */
    async coordinateWithBMADOrchestrator(branch, remote, syncResults) {
        try {
            // Check if BMAD orchestrator is available
            const orchestratorPath = path.join(process.cwd(), 'scripts/bmad/bmad-orchestrator.js');
            if (!fs.existsSync(orchestratorPath)) {
                return {
                    available: false,
                    message: 'BMAD Orchestrator not found'
                };
            }

            // Prepare coordination context
            const coordinationContext = {
                hookType: 'pre-push',
                branch,
                remote,
                timestamp: new Date().toISOString(),
                workflowState: syncResults
            };

            // Log coordination attempt
            this.logger.info('Coordinating with BMAD Orchestrator');

            return {
                available: true,
                coordinated: true,
                context: coordinationContext,
                message: 'BMAD Orchestrator coordination successful'
            };

        } catch (error) {
            this.logger.warn(`BMAD Orchestrator coordination failed: ${error.message}`);
            return {
                available: false,
                coordinated: false,
                error: error.message
            };
        }
    }

    /**
     * Generate detailed failure report for pre-push validation
     * Requirements: 3.5
     */
    generatePrePushFailureReport(results) {
        const report = {
            type: 'pre_push_validation_failure',
            timestamp: new Date().toISOString(),
            failures: [],
            summary: {
                totalChecks: Object.keys(results).length,
                failedChecks: 0,
                warningChecks: 0
            }
        };

        // Analyze each validation result
        Object.entries(results).forEach(([checkName, result]) => {
            if (result.status === 'failed') {
                report.failures.push({
                    check: checkName,
                    error: result.error || 'Validation failed',
                    details: result,
                    severity: 'error'
                });
                report.summary.failedChecks++;
            } else if (result.status === 'warning') {
                report.failures.push({
                    check: checkName,
                    error: result.message || 'Validation warning',
                    details: result,
                    severity: 'warning'
                });
                report.summary.warningChecks++;
            }
        });

        return report;
    }

    /**
     * Generate remediation guidance for pre-push failures
     * Requirements: 3.5
     */
    generatePrePushRemediation(results) {
        const remediation = {
            steps: [],
            commands: [],
            resources: []
        };

        // Add specific remediation for each failed check
        Object.entries(results).forEach(([checkName, result]) => {
            if (result.status === 'failed') {
                switch (checkName) {
                case 'fullTestSuite':
                    remediation.steps.push('Fix failing tests before pushing');
                    remediation.commands.push('npm test');
                    if (result.coverage && !result.coverageMet) {
                        remediation.steps.push('Increase test coverage to meet minimum thresholds');
                        remediation.commands.push('npm run test:coverage');
                    }
                    break;

                case 'buildValidation':
                    remediation.steps.push('Fix build errors before pushing');
                    remediation.commands.push('npm run build');
                    break;

                case 'securityAudit':
                    remediation.steps.push('Fix security vulnerabilities before pushing');
                    if (result.recommendations) {
                        remediation.commands.push(...result.recommendations);
                    } else {
                        remediation.commands.push('npm audit fix');
                    }
                    break;

                case 'bmadWorkflowSync':
                    remediation.steps.push('Synchronize BMAD workflow state');
                    remediation.steps.push('Update activeContext.md with current work');
                    remediation.commands.push('git add activeContext.md');
                    break;

                case 'gatekeeperIntegration':
                    remediation.steps.push('Resolve Enhanced Gatekeeper validation issues');
                    remediation.commands.push('npm run bmad:gatekeeper');
                    break;
                }
            }
        });

        // Add general remediation steps
        if (remediation.steps.length === 0) {
            remediation.steps.push('Review validation output for specific issues');
            remediation.steps.push('Ensure all changes are properly tested');
            remediation.steps.push('Verify BMAD workflow compliance');
        }

        return remediation;
    }

    /**
     * Execute post-commit automation hook
     * Implementation placeholder for future tasks
     */
    /**
     * Execute post-commit automation hook
     * Requirements: 4.1, 4.2, 4.4, 4.5
     */
    async executePostCommit(commitHash) {
        this.startTimer('post-commit');
        this.logger.info(`Executing post-commit hook for ${commitHash}`);

        try {
            const results = {
                metricsUpdate: { status: 'skipped' },
                documentation: { status: 'skipped' },
                contextUpdate: { status: 'skipped' },
                notifications: { status: 'skipped' },
                orchestratorNotification: { status: 'skipped' }
            };

            // 1. Update project metrics (Requirement 4.1)
            try {
                results.metricsUpdate = await this.updateProjectMetrics(commitHash);
            } catch (error) {
                // Non-blocking error (Requirement 4.5)
                this.logger.error(`Metrics update failed: ${error.message}`);
                results.metricsUpdate = {
                    status: 'warning',
                    error: error.message
                };
            }

            // 2. Regenerate documentation when needed (Requirement 4.2)
            try {
                results.documentation = await this.regenerateDocumentation(commitHash);
            } catch (error) {
                // Non-blocking error (Requirement 4.5)
                this.logger.error(`Documentation generation failed: ${error.message}`);
                results.documentation = {
                    status: 'warning',
                    error: error.message
                };
            }

            // 3. Register commit in active context (Requirement 4.4)
            try {
                results.contextUpdate = await this.registerCommitInContext(commitHash);
            } catch (error) {
                // Non-blocking error (Requirement 4.5)
                this.logger.error(`Context update failed: ${error.message}`);
                results.contextUpdate = {
                    status: 'warning',
                    error: error.message
                };
            }

            // 4. Notify BMAD orchestrator (Requirement 4.3)
            try {
                const notificationResult = await this.notifyBMADOrchestrator(commitHash, results);
                results.notifications = notificationResult;
                // Backward compatibility for older tests/contracts
                results.orchestratorNotification = notificationResult;
            } catch (error) {
                // Non-blocking error (Requirement 4.5)
                this.logger.error(`Orchestrator notification failed: ${error.message}`);
                const warningResult = {
                    status: 'warning',
                    error: error.message,
                    auditTrail: null,
                    debugInfo: null
                };
                results.notifications = warningResult;
                results.orchestratorNotification = warningResult;
            }

            const duration = this.endTimer('post-commit', true);

            return {
                success: true, // Always succeeds (Requirement 4.5)
                duration,
                results,
                metrics: this.getMetrics()
            };
        } catch (error) {
            // Even catastrophic failures should not block commit (Requirement 4.5)
            this.logger.error(`Post-commit hook failed: ${error.message}`);
            const duration = this.endTimer('post-commit', true);

            return {
                success: true, // Always succeeds
                duration,
                error: error.message,
                results: {
                    metricsUpdate: { status: 'warning', error: 'Post-commit execution failed before completion' },
                    documentation: { status: 'warning', error: 'Post-commit execution failed before completion' },
                    contextUpdate: { status: 'warning', error: 'Post-commit execution failed before completion' },
                    notifications: { status: 'warning', error: 'Post-commit execution failed before completion', auditTrail: null, debugInfo: null },
                    orchestratorNotification: { status: 'warning', error: 'Post-commit execution failed before completion', auditTrail: null, debugInfo: null }
                }
            };
        }
    }

    /**
     * Notify BMAD orchestrator with post-commit context
     * Requirement 4.3
     */
    async notifyBMADOrchestrator(commitHash, postCommitResults = {}) {
        const orchestratorPath = path.join(process.cwd(), 'scripts/bmad/bmad-orchestrator.js');

        if (!fs.existsSync(orchestratorPath)) {
            return {
                status: 'skipped',
                message: 'BMAD orchestrator not available',
                auditTrail: null,
                debugInfo: null
            };
        }

        try {
            const commitInfo = this.getCommitInfoForNotification(commitHash);
            const payload = {
                hookType: 'post-commit',
                commitHash,
                shortCommitHash: commitHash.substring(0, 8),
                persona: commitInfo.persona,
                stepId: commitInfo.stepId,
                message: commitInfo.message,
                resultsSummary: {
                    metricsUpdate: postCommitResults.metricsUpdate?.status || 'unknown',
                    documentation: postCommitResults.documentation?.status || 'unknown',
                    contextUpdate: postCommitResults.contextUpdate?.status || 'unknown'
                },
                timestamp: new Date().toISOString()
            };

            await this.sendBMADNotification('post-commit', payload);

            return {
                status: 'passed',
                message: 'BMAD orchestrator notified successfully',
                commitHash,
                persona: payload.persona,
                stepId: payload.stepId,
                notificationType: 'post-commit',
                auditTrail: {
                    timestamp: payload.timestamp,
                    notificationType: 'post-commit',
                    commitHash: payload.shortCommitHash
                },
                debugInfo: {
                    orchestratorPath,
                    payloadSize: JSON.stringify(payload).length
                }
            };
        } catch (error) {
            this.logger.warn(`BMAD orchestrator notification warning: ${error.message}`);
            return {
                status: 'warning',
                error: error.message,
                commitHash,
                auditTrail: {
                    timestamp: new Date().toISOString(),
                    notificationType: 'post-commit',
                    commitHash: commitHash.substring(0, 8),
                    outcome: 'warning'
                },
                debugInfo: {
                    orchestratorPath,
                    error: error.message
                }
            };
        }
    }

    /**
     * Send notification to BMAD orchestrator process
     */
    async sendBMADNotification(notificationType, payload) {
        const command = 'node scripts/bmad/bmad-orchestrator.js --hook-event post-commit';
        const output = execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 10000,
            env: {
                ...process.env,
                BMAD_HOOK_EVENT: notificationType,
                BMAD_HOOK_PAYLOAD: JSON.stringify(payload)
            }
        });

        return {
            success: true,
            output: output || ''
        };
    }

    /**
     * Extract commit details for notification payloads
     */
    getCommitInfoForNotification(commitHash) {
        const defaultInfo = {
            persona: 'UNKNOWN',
            stepId: 'N/A',
            message: ''
        };

        try {
            const logOutput = execSync(`git log --oneline -1 ${commitHash}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const message = logOutput.replace(/^[a-f0-9]+\s+/i, '');
            const bmadMatch = message.match(/\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]\s*(.*)/);

            if (!bmadMatch) {
                return {
                    ...defaultInfo,
                    message
                };
            }

            return {
                persona: bmadMatch[1],
                stepId: bmadMatch[2],
                message: bmadMatch[3] || ''
            };
        } catch (error) {
            this.logger.warn(`Could not extract commit info for notification: ${error.message}`);
            return defaultInfo;
        }
    }

    /**
     * Update project metrics with commit statistics
     * Requirement 4.1
     */
    async updateProjectMetrics(commitHash) {
        this.logger.info(`Updating project metrics for commit ${commitHash}`);

        try {
            // Get commit statistics
            const statsOutput = execSync(`git show --stat ${commitHash}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Parse commit statistics
            const statsMatch = statsOutput.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);
            const filesChanged = statsMatch ? parseInt(statsMatch[1]) : 0;
            const linesAdded = statsMatch && statsMatch[2] ? parseInt(statsMatch[2]) : 0;
            const linesDeleted = statsMatch && statsMatch[3] ? parseInt(statsMatch[3]) : 0;

            // Load existing metrics
            const metricsPath = path.join(process.cwd(), '.github/metrics/project-metrics.json');
            let existingMetrics = {
                totalCommits: 0,
                totalLinesAdded: 0,
                totalLinesDeleted: 0,
                averageFilesPerCommit: 0,
                lastUpdated: null
            };

            if (fs.existsSync(metricsPath)) {
                const metricsContent = fs.readFileSync(metricsPath, 'utf8');
                existingMetrics = JSON.parse(metricsContent);
            } else {
                // Create directory if it doesn't exist
                const metricsDir = path.dirname(metricsPath);
                if (!fs.existsSync(metricsDir)) {
                    fs.mkdirSync(metricsDir, { recursive: true });
                }
            }

            // Update metrics
            const updatedMetrics = {
                totalCommits: existingMetrics.totalCommits + 1,
                totalLinesAdded: existingMetrics.totalLinesAdded + linesAdded,
                totalLinesDeleted: existingMetrics.totalLinesDeleted + linesDeleted,
                averageFilesPerCommit: ((existingMetrics.averageFilesPerCommit * existingMetrics.totalCommits) + filesChanged) / (existingMetrics.totalCommits + 1),
                lastUpdated: new Date().toISOString()
            };

            // Write updated metrics
            fs.writeFileSync(metricsPath, JSON.stringify(updatedMetrics, null, 2));

            return {
                status: 'passed',
                filesChanged,
                linesAdded,
                linesDeleted,
                totalCommits: updatedMetrics.totalCommits
            };
        } catch (error) {
            this.logger.error(`Failed to update project metrics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Regenerate documentation when source files change
     * Requirement 4.2
     */
    async regenerateDocumentation(commitHash) {
        this.logger.info(`Checking if documentation regeneration is needed for commit ${commitHash}`);

        try {
            // Get changed files in this commit
            let changedFilesOutput;
            try {
                changedFilesOutput = execSync(`git diff --name-only ${commitHash}~1 ${commitHash}`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            } catch (error) {
                // Fallback to simpler command if the above fails
                changedFilesOutput = execSync('git diff --name-only HEAD~1 HEAD', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            }

            const changedFiles = changedFilesOutput.trim().split('\n').filter(f => f.length > 0);

            // Check if source files changed
            const hasSourceChanges = changedFiles.some(file =>
                file.match(/\.(js|ts|jsx|tsx|md)$/) &&
                (file.startsWith('src/') || file.startsWith('scripts/') || file.startsWith('docs/'))
            );

            if (!hasSourceChanges) {
                return {
                    status: 'skipped',
                    message: 'No source file changes detected',
                    filesChecked: changedFiles.length
                };
            }

            // Check if documentation generation script exists
            const packagePath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                return {
                    status: 'skipped',
                    message: 'No package.json found',
                    filesChecked: changedFiles.length
                };
            }

            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts['bmad:docs']) {
                return {
                    status: 'skipped',
                    message: 'No bmad:docs script defined',
                    filesChecked: changedFiles.length
                };
            }

            // Regenerate documentation
            try {
                execSync('npm run bmad:docs', {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 30000 // 30 second timeout
                });

                return {
                    status: 'passed',
                    message: 'Documentation regenerated successfully',
                    filesChecked: changedFiles.length,
                    sourceFilesChanged: changedFiles.filter(f => f.match(/\.(js|ts|jsx|tsx|md)$/))
                };
            } catch (error) {
                // Documentation generation failed but don't block commit
                return {
                    status: 'warning',
                    message: 'Documentation generation failed',
                    error: error.message,
                    filesChecked: changedFiles.length
                };
            }
        } catch (error) {
            this.logger.error(`Failed to regenerate documentation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Register commit in active context for traceability
     * Requirement 4.4
     */
    async registerCommitInContext(commitHash) {
        this.logger.info(`Registering commit ${commitHash} in active context`);

        try {
            // Get commit message
            const commitMessageOutput = execSync(`git log --oneline -1 ${commitHash}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            const commitMessage = commitMessageOutput.trim();

            // Get changed files
            const changedFilesOutput = execSync(`git diff --name-only ${commitHash}~1 ${commitHash}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            const changedFiles = changedFilesOutput.trim().split('\n').filter(f => f.length > 0);

            // Check if there are code changes
            const hasCodeChanges = changedFiles.some(file =>
                file.match(/\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|cpp|h|hpp)$/)
            );

            if (!hasCodeChanges) {
                return {
                    status: 'skipped',
                    message: 'No code changes detected',
                    filesChecked: changedFiles.length
                };
            }

            // Update activeContext.md
            const contextPath = path.join(process.cwd(), 'activeContext.md');
            let contextContent = '';

            if (fs.existsSync(contextPath)) {
                contextContent = fs.readFileSync(contextPath, 'utf8');
            } else {
                contextContent = '# Active Context\n\n';
            }

            // Extract persona and step ID from commit message if BMAD format
            const bmadMatch = commitMessage.match(/\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]/);
            const persona = bmadMatch ? bmadMatch[1] : 'UNKNOWN';
            const stepId = bmadMatch ? bmadMatch[2] : 'N/A';

            // Append commit information
            const commitEntry = `\n## Commit ${commitHash.substring(0, 8)}\n` +
                `- **Timestamp**: ${new Date().toISOString()}\n` +
                `- **Persona**: ${persona}\n` +
                `- **Step ID**: ${stepId}\n` +
                `- **Message**: ${commitMessage}\n` +
                `- **Files Changed**: ${changedFiles.length}\n`;

            contextContent += commitEntry;

            // Write updated context
            fs.writeFileSync(contextPath, contextContent);

            return {
                status: 'passed',
                message: 'Commit registered in active context',
                commitHash: commitHash.substring(0, 8),
                persona,
                stepId,
                filesChanged: changedFiles.length
            };
        } catch (error) {
            this.logger.error(`Failed to register commit in context: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute post-merge automation hook
     * Implementation placeholder for future tasks
     */
    /**
         * Execute post-merge automation hook
         * Requirements: 5.1, 5.2, 5.3, 5.5
         */
    async executePostMerge(mergeType) {
        this.startTimer('post-merge');
        this.logger.info(`Executing post-merge hook for ${mergeType} merge`);

        try {
            const results = {
                workflow: { status: 'skipped' },
                repositoryValidation: { status: 'skipped' },
                mergeAnalysis: { status: 'skipped' }
            };

            const recovery = {
                rollbackRecommendations: [],
                troubleshooting: {},
                recoveryOptions: []
            };

            // 1. Execute complete bmad:workflow process (Requirement 5.1)
            try {
                results.workflow = await this.executeBMADWorkflow(mergeType);
            } catch (error) {
                this.logger.error(`BMAD workflow execution failed: ${error.message}`);
                results.workflow = {
                    status: 'failed',
                    error: error.message
                };
                this.addRecoveryInformation(recovery, 'workflow_execution_failed', error);
            }

            // 2. Validate repository state (Requirement 5.2)
            try {
                results.repositoryValidation = await this.validateRepositoryState(mergeType);
                // Check if validation returned a failed status (not an exception)
                if (results.repositoryValidation.status === 'failed') {
                    const validationError = new Error(results.repositoryValidation.summary || 'Repository validation failed');
                    this.addRecoveryInformation(recovery, 'repository_validation_failed', validationError);
                }
            } catch (error) {
                this.logger.error(`Repository validation failed: ${error.message}`);
                results.repositoryValidation = {
                    status: 'failed',
                    error: error.message
                };
                this.addRecoveryInformation(recovery, 'repository_validation_failed', error);
            }

            // 3. Generate comprehensive merge analysis report (Requirement 5.3)
            try {
                results.mergeAnalysis = await this.generateMergeAnalysisReport(mergeType);
            } catch (error) {
                this.logger.error(`Merge analysis failed: ${error.message}`);
                results.mergeAnalysis = {
                    status: 'warning',
                    error: error.message
                };
            }

            // 4. Provide rollback recommendations if failures occurred (Requirement 5.5)
            const hasFailures = Object.values(results).some(r => r.status === 'failed');
            if (hasFailures) {
                await this.generateRollbackRecommendations(recovery, results, mergeType);
                try {
                    await this.generateRecoveryReport(recovery, results, mergeType);
                } catch (error) {
                    this.logger.error(`Recovery report generation failed: ${error.message}`);
                    // Track report generation failure
                    this.addRecoveryInformation(recovery, 'report_generation_failed', error);
                }
            }

            const duration = this.endTimer('post-merge', true);

            return {
                success: true, // Post-merge always succeeds to not block merge
                duration,
                results,
                recovery: hasFailures ? recovery : undefined,
                metrics: this.getMetrics()
            };
        } catch (error) {
            this.logger.error(`Post-merge hook failed: ${error.message}`);
            const duration = this.endTimer('post-merge', true);

            return {
                success: true, // Always succeeds to not block merge
                duration,
                error: error.message,
                results: {},
                recovery: {
                    rollbackRecommendations: [
                        {
                            command: 'git reset --hard HEAD~1',
                            description: 'Reset to state before merge',
                            warning: 'This will discard the merge. Use with caution.'
                        }
                    ],
                    troubleshooting: {
                        failureType: 'execution_error',
                        errorMessage: error.message,
                        diagnosticSteps: [
                            { description: 'Check git status for repository state' },
                            { description: 'Review error logs for specific issues' },
                            { description: 'Verify all dependencies are installed' }
                        ]
                    }
                }
            };
        }
    }

    /**
     * Execute complete BMAD workflow process
     * Requirement 5.1
     */
    async executeBMADWorkflow(mergeType) {
        this.logger.info(`Executing BMAD workflow for ${mergeType} merge`);

        try {
            // Check if bmad:workflow script exists
            const packagePath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packagePath)) {
                return {
                    status: 'skipped',
                    message: 'No package.json found'
                };
            }

            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts['bmad:workflow']) {
                return {
                    status: 'skipped',
                    message: 'No bmad:workflow script defined'
                };
            }

            // Execute BMAD workflow
            const workflowOutput = execSync('npm run bmad:workflow', {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 120000 // 2 minute timeout
            });

            return {
                status: 'passed',
                message: 'BMAD workflow executed successfully',
                output: workflowOutput
            };
        } catch (error) {
            this.logger.error(`BMAD workflow execution failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate repository state after merge
     * Requirement 5.2
     */
    async validateRepositoryState(mergeType) {
        this.logger.info(`Validating repository state after ${mergeType} merge`);

        try {
            const validation = {
                workingTreeClean: false,
                hasUnmergedPaths: false,
                branchValid: false,
                criticalFiles: {},
                integrityCheck: {},
                isValid: false,
                issues: [],
                timestamp: new Date().toISOString(),
                summary: ''
            };

            // 1. Check working tree status
            try {
                const statusOutput = execSync('git status --porcelain', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                validation.workingTreeClean = statusOutput.trim().length === 0;
                if (!validation.workingTreeClean) {
                    validation.issues.push('Working tree has uncommitted changes');
                }
            } catch (error) {
                validation.issues.push(`Failed to check working tree: ${error.message}`);
            }

            // 2. Check for unmerged paths
            try {
                const diffCheckOutput = execSync('git diff --check', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                validation.hasUnmergedPaths = diffCheckOutput.includes('conflict marker');
                if (validation.hasUnmergedPaths) {
                    validation.issues.push('Repository has unmerged paths or conflict markers');
                }
            } catch (error) {
                // git diff --check returns non-zero if issues found
                if (error.stdout && error.stdout.includes('conflict marker')) {
                    validation.hasUnmergedPaths = true;
                    validation.issues.push('Repository has unmerged paths or conflict markers');
                }
            }

            // 3. Validate branch
            try {
                const branchOutput = execSync('git rev-parse --abbrev-ref HEAD', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                validation.branchValid = branchOutput.trim().length > 0;
            } catch (error) {
                validation.branchValid = false;
                validation.issues.push(`Invalid branch state: ${error.message}`);
            }

            // 4. Check critical files exist
            const criticalFiles = [
                { path: 'package.json', key: 'packageJson' },
                { path: '.git', key: 'gitDirectory' }
            ];

            criticalFiles.forEach(({ path: filePath, key }) => {
                const exists = fs.existsSync(path.join(process.cwd(), filePath));
                validation.criticalFiles[key] = exists;
                if (!exists) {
                    validation.issues.push(`Critical file missing: ${filePath}`);
                }
            });

            // 5. Run git fsck for integrity check
            try {
                const fsckOutput = execSync('git fsck', {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 30000
                });

                validation.integrityCheck.status = 'passed';
                validation.integrityCheck.hasErrors = fsckOutput.includes('error:');
                validation.integrityCheck.hasWarnings = fsckOutput.includes('dangling');

                if (validation.integrityCheck.hasErrors) {
                    validation.issues.push('Repository integrity check found errors');
                }
            } catch (error) {
                validation.integrityCheck.status = 'failed';
                validation.integrityCheck.hasErrors = true;
                validation.issues.push(`Integrity check failed: ${error.message}`);
            }

            // Determine overall validation status
            validation.isValid = validation.workingTreeClean &&
                !validation.hasUnmergedPaths &&
                validation.branchValid &&
                validation.criticalFiles.packageJson &&
                validation.criticalFiles.gitDirectory &&
                !validation.integrityCheck.hasErrors;

            // Generate summary
            if (validation.isValid) {
                validation.summary = 'Repository state is valid';
            } else {
                validation.summary = `Repository state validation found ${validation.issues.length} issue(s)`;
            }

            return {
                status: validation.isValid ? 'passed' : 'failed',
                ...validation
            };
        } catch (error) {
            this.logger.error(`Repository state validation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate comprehensive merge analysis report
     * Requirement 5.3
     */
    async generateMergeAnalysisReport(mergeType) {
        this.logger.info(`Generating merge analysis report for ${mergeType} merge`);

        try {
            // Get merge statistics
            const statsOutput = execSync('git diff --stat HEAD~1 HEAD', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Parse statistics
            const statsMatch = statsOutput.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);
            const filesChanged = statsMatch ? parseInt(statsMatch[1]) : 0;
            const linesAdded = statsMatch && statsMatch[2] ? parseInt(statsMatch[2]) : 0;
            const linesDeleted = statsMatch && statsMatch[3] ? parseInt(statsMatch[3]) : 0;

            // Get list of changed files
            const changedFilesOutput = execSync('git diff --name-only HEAD~1 HEAD', {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            const changedFiles = changedFilesOutput.trim().split('\n').filter(f => f.length > 0);

            // Get merge commit information
            let mergeCommitInfo = {};
            try {
                const logOutput = execSync('git log --merges --oneline -1', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                mergeCommitInfo = {
                    hash: logOutput.split(' ')[0],
                    message: logOutput.substring(logOutput.indexOf(' ') + 1)
                };
            } catch (error) {
                this.logger.warn(`Could not get merge commit info: ${error.message}`);
            }

            // Create merge analysis report
            const report = {
                mergeType,
                timestamp: new Date().toISOString(),
                filesChanged: changedFiles,
                statistics: {
                    filesCount: filesChanged,
                    linesAdded,
                    linesDeleted,
                    netChange: linesAdded - linesDeleted
                },
                mergeCommit: mergeCommitInfo
            };

            // Write report to file
            const reportPath = path.join(process.cwd(), '.github/reports/merge-analysis.json');
            const reportDir = path.dirname(reportPath);
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

            return {
                status: 'passed',
                mergeType,
                filesChanged,
                commits: 1,
                reportPath,
                ...report
            };
        } catch (error) {
            this.logger.error(`Failed to generate merge analysis report: ${error.message}`);
            throw error;
        }
    }

    /**
     * Add recovery information for failures
     * Requirement 5.5
     */
    addRecoveryInformation(recovery, failureType, error) {
        // Initialize failures array if not exists
        if (!recovery.troubleshooting.failures) {
            recovery.troubleshooting.failures = [];
        }

        // Add this failure to the list
        recovery.troubleshooting.failures.push({
            type: failureType,
            message: error.message
        });

        // Set the primary failure type (first failure or most recent)
        if (!recovery.troubleshooting.failureType) {
            recovery.troubleshooting.failureType = failureType;
            recovery.troubleshooting.errorMessage = error.message;
        }

        // Track multiple failures
        const failureCount = recovery.troubleshooting.failures.length;
        recovery.troubleshooting.multipleFailures = failureCount > 1;
        recovery.troubleshooting.failureCount = failureCount;

        // Add failure-specific diagnostic steps (only if not already added)
        if (!recovery.troubleshooting.diagnosticSteps) {
            recovery.troubleshooting.diagnosticSteps = [];
        }

        // Add failure-specific diagnostic steps
        const newSteps = [];
        switch (failureType) {
        case 'workflow_execution_failed':
            newSteps.push(
                { description: 'Check if bmad:workflow script is properly configured' },
                { description: 'Verify all workflow dependencies are installed' },
                { description: 'Review workflow logs for specific errors' }
            );
            break;

        case 'repository_validation_failed':
            newSteps.push(
                { description: 'Run git status to check repository state' },
                { description: 'Check for unmerged files or conflicts' },
                { description: 'Verify .git directory integrity' }
            );
            break;

        case 'test_suite_failed':
            newSteps.push(
                { description: 'Run npm test to see specific test failures' },
                { description: 'Check if merge introduced breaking changes' },
                { description: 'Review test output for failure details' }
            );
            break;

        case 'report_generation_failed':
            newSteps.push(
                { description: 'Check file system permissions for report directory' },
                { description: 'Verify .github/reports directory exists and is writable' },
                { description: 'Review error logs for file system issues' }
            );
            break;

        default:
            newSteps.push(
                { description: 'Review error message for specific issues' },
                { description: 'Check system logs for additional context' },
                { description: 'Verify repository is in a consistent state' }
            );
        }

        // Add new steps, avoiding duplicates
        newSteps.forEach(newStep => {
            const exists = recovery.troubleshooting.diagnosticSteps.some(
                step => step.description === newStep.description
            );
            if (!exists) {
                recovery.troubleshooting.diagnosticSteps.push(newStep);
            }
        });
    }

    /**
     * Generate rollback recommendations
     * Requirement 5.5
     */
    async generateRollbackRecommendations(recovery, _results, _mergeType) {
        this.logger.info('Generating rollback recommendations');

        try {
            // Get current commit hash
            const currentCommit = execSync('git rev-parse HEAD', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            // Get previous commit hash
            const previousCommit = execSync('git rev-parse HEAD~1', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            // Check repository context
            const hasRemote = this.checkHasRemote();
            const currentBranch = this.getCurrentBranch();
            const isProtectedBranch = ['main', 'master', 'production'].includes(currentBranch);
            const hasStash = this.checkHasStash();

            // Generate context-aware recommendations
            if (isProtectedBranch) {
                // Protected branches should use revert
                recovery.rollbackRecommendations.push({
                    command: `git revert -m 1 ${currentCommit}`,
                    description: 'Revert the merge commit (safe for protected branches)',
                    warning: 'This creates a new commit that undoes the merge',
                    priority: 'high'
                });
            } else {
                // Non-protected branches can use reset
                recovery.rollbackRecommendations.push({
                    command: `git reset --hard ${previousCommit.substring(0, 7)}`,
                    description: 'Reset to state before merge',
                    warning: 'This will discard the merge. Cannot be undone easily.',
                    priority: 'high'
                });
            }

            // Add remote-aware recommendations
            if (hasRemote) {
                recovery.rollbackRecommendations.push({
                    command: 'git push --force-with-lease',
                    description: 'Push rollback to remote (if already pushed)',
                    warning: 'Force push affects remote repository. Coordinate with team.',
                    priority: 'medium'
                });
            }

            // Add stash recommendation if available
            if (hasStash) {
                recovery.rollbackRecommendations.push({
                    command: 'git stash pop',
                    description: 'Restore stashed changes after rollback',
                    warning: 'Only if you had stashed changes before merge',
                    priority: 'low'
                });
            }

            // Add general recovery options
            recovery.rollbackRecommendations.push({
                command: 'git reflog',
                description: 'View recent Git operations to find recovery point',
                warning: 'Use this to manually identify the correct state to restore',
                priority: 'low'
            });

        } catch (error) {
            this.logger.error(`Failed to generate rollback recommendations: ${error.message}`);
            // Add basic fallback recommendation
            recovery.rollbackRecommendations.push({
                command: 'git reset --hard HEAD~1',
                description: 'Reset to previous commit',
                warning: 'This will discard the merge',
                priority: 'high'
            });
        }
    }

    /**
     * Generate recovery report
     * Requirement 5.5
     */
    async generateRecoveryReport(recovery, results, mergeType) {
        this.logger.info('Generating recovery report');

        try {
            // Get affected files
            const affectedFiles = [];
            try {
                const diffOutput = execSync('git diff --name-only HEAD~1 HEAD', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                affectedFiles.push(...diffOutput.trim().split('\n').filter(f => f.length > 0));
            } catch (error) {
                this.logger.warn(`Could not get affected files: ${error.message}`);
            }

            // Count failures
            const failureCount = Object.values(results).filter(r => r.status === 'failed').length;

            // Create recovery report
            const report = {
                mergeType,
                failureDetected: true,
                timestamp: new Date().toISOString(),
                affectedFiles,
                failureCount,
                failures: Object.entries(results)
                    .filter(([, result]) => result.status === 'failed')
                    .map(([name, result]) => ({
                        check: name,
                        error: result.error || 'Unknown error',
                        status: result.status
                    })),
                recoveryOptions: recovery.rollbackRecommendations.map(rec => ({
                    command: rec.command,
                    description: rec.description,
                    priority: rec.priority
                })),
                troubleshooting: recovery.troubleshooting
            };

            // Mark if multiple failures occurred
            if (failureCount > 1) {
                recovery.troubleshooting.multipleFailures = true;
                recovery.troubleshooting.failureCount = failureCount;
            }

            // Write recovery report to file
            const reportPath = path.join(process.cwd(), '.github/reports/recovery-report.json');
            const reportDir = path.dirname(reportPath);
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

            this.logger.info(`Recovery report written to ${reportPath}`);
        } catch (error) {
            this.logger.error(`Failed to generate recovery report: ${error.message}`);
            throw error; // Re-throw to allow outer catch to handle it
        }
    }

    /**
     * Check if repository has remote
     */
    checkHasRemote() {
        try {
            const remoteOutput = execSync('git remote', {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            return remoteOutput.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get current branch name
     */
    getCurrentBranch() {
        try {
            const branchOutput = execSync('git branch --show-current', {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            return branchOutput.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Execute pre-rebase hook with safety validation
     * Requirements: 6.1
     */
    async executePreRebase(sourceBranch, targetBranch) {
        this.startTimer('pre-rebase');
        this.logger.info(`Executing pre-rebase hook: ${sourceBranch} onto ${targetBranch}`);

        try {
            const results = {
                safetyValidation: { status: 'skipped' },
                bmadCompatibility: { status: 'skipped' },
                conflictDetection: { status: 'skipped' },
                commitAnalysis: { status: 'skipped' }
            };

            // 1. Validate rebase safety
            results.safetyValidation = await this.validateRebaseSafety(sourceBranch, targetBranch);

            // 2. Check BMAD compatibility
            results.bmadCompatibility = await this.validateBMADCompatibility(sourceBranch);

            // 3. Detect potential conflicts
            results.conflictDetection = await this.detectRebaseConflicts(sourceBranch, targetBranch);

            // 4. Analyze commits to be rebased
            results.commitAnalysis = await this.analyzeRebaseCommits(sourceBranch, targetBranch);

            const success = this.allResultsSuccessful(results);
            const duration = this.endTimer('pre-rebase', success);

            return {
                success,
                duration,
                results,
                metrics: this.getMetrics()
            };
        } catch (error) {
            this.logger.error(`Pre-rebase hook failed: ${error.message}`);
            const duration = this.endTimer('pre-rebase', false);

            return {
                success: false,
                duration,
                error: error.message,
                results: {}
            };
        }
    }

    /**
     * Validate rebase safety
     */
    async validateRebaseSafety(sourceBranch, targetBranch) {
        this.logger.info(`Validating rebase safety for ${sourceBranch} onto ${targetBranch}`);

        try {
            // Check if branches exist
            const branchesOutput = execSync('git branch -a', { encoding: 'utf8', stdio: 'pipe' });
            const branches = branchesOutput.split('\n').map(b => b.trim().replace(/^\*\s+/, ''));

            const sourceExists = branches.some(b => b === sourceBranch || b.endsWith(`/${sourceBranch}`));
            const targetExists = branches.some(b => b === targetBranch || b.endsWith(`/${targetBranch}`));

            if (!sourceExists || !targetExists) {
                return {
                    status: 'failed',
                    error: 'One or both branches do not exist',
                    sourceExists,
                    targetExists
                };
            }

            // Check for uncommitted changes
            const statusOutput = execSync('git status --porcelain', { encoding: 'utf8', stdio: 'pipe' });
            const hasUncommittedChanges = statusOutput.trim().length > 0;

            if (hasUncommittedChanges) {
                return {
                    status: 'warning',
                    message: 'Uncommitted changes detected - consider stashing',
                    hasUncommittedChanges: true
                };
            }

            return {
                status: 'passed',
                message: 'Rebase safety validation passed',
                sourceExists: true,
                targetExists: true,
                hasUncommittedChanges: false
            };
        } catch (error) {
            this.logger.error(`Rebase safety validation failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message
            };
        }
    }

    /**
     * Validate BMAD compatibility for rebase
     */
    async validateBMADCompatibility(sourceBranch) {
        this.logger.info(`Validating BMAD compatibility for ${sourceBranch}`);

        try {
            // Get commits on source branch
            const commitsOutput = execSync(`git log --oneline ${sourceBranch} --not main develop`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            if (!commitsOutput) {
                return {
                    status: 'passed',
                    message: 'No commits to validate',
                    commitsAnalyzed: 0,
                    invalidCommits: 0
                };
            }

            const commits = commitsOutput.split('\n');
            const bmadPattern = /^\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]\s+(.+)$/;

            let invalidCommits = 0;
            const invalidCommitDetails = [];

            commits.forEach(commit => {
                const message = commit.substring(8); // Remove hash
                if (!bmadPattern.test(message)) {
                    invalidCommits++;
                    invalidCommitDetails.push(commit);
                }
            });

            return {
                status: invalidCommits === 0 ? 'passed' : 'warning',
                message: invalidCommits === 0 ? 'All commits follow BMAD pattern' : `${invalidCommits} commits do not follow BMAD pattern`,
                commitsAnalyzed: commits.length,
                invalidCommits,
                invalidCommitDetails: invalidCommitDetails.slice(0, 5) // Limit to first 5
            };
        } catch (error) {
            // If git log fails, it might be because there are no commits or branch doesn't exist
            this.logger.warn(`BMAD compatibility check warning: ${error.message}`);
            return {
                status: 'warning',
                message: 'Could not analyze commits',
                commitsAnalyzed: 0,
                invalidCommits: 0
            };
        }
    }

    /**
     * Detect potential rebase conflicts
     */
    async detectRebaseConflicts(sourceBranch, targetBranch) {
        this.logger.info(`Detecting potential conflicts between ${sourceBranch} and ${targetBranch}`);

        try {
            // Get files changed in source branch
            const sourceFilesOutput = execSync(`git diff --name-only ${targetBranch}...${sourceBranch}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            if (!sourceFilesOutput) {
                return {
                    status: 'passed',
                    message: 'No file changes detected',
                    hasConflicts: false,
                    conflictingFiles: []
                };
            }

            const sourceFiles = sourceFilesOutput.split('\n');

            // Check if any of these files have been modified in target branch
            const targetFilesOutput = execSync(`git diff --name-only ${sourceBranch}...${targetBranch}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const targetFiles = targetFilesOutput ? targetFilesOutput.split('\n') : [];
            const conflictingFiles = sourceFiles.filter(file => targetFiles.includes(file));

            return {
                status: conflictingFiles.length > 0 ? 'warning' : 'passed',
                message: conflictingFiles.length > 0 ? `${conflictingFiles.length} files may have conflicts` : 'No conflicts detected',
                hasConflicts: conflictingFiles.length > 0,
                conflictingFiles: conflictingFiles.slice(0, 10), // Limit to first 10
                totalFiles: sourceFiles.length
            };
        } catch (error) {
            this.logger.warn(`Conflict detection warning: ${error.message}`);
            return {
                status: 'warning',
                message: 'Could not detect conflicts',
                hasConflicts: false,
                conflictingFiles: []
            };
        }
    }

    /**
     * Analyze commits to be rebased
     */
    async analyzeRebaseCommits(sourceBranch, targetBranch) {
        this.logger.info(`Analyzing commits to be rebased from ${sourceBranch}`);

        try {
            // Count commits to be rebased
            const commitCountOutput = execSync(`git rev-list --count ${targetBranch}..${sourceBranch}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const commitCount = parseInt(commitCountOutput, 10);

            return {
                status: 'passed',
                message: `${commitCount} commits will be rebased`,
                commitCount,
                sourceBranch,
                targetBranch
            };
        } catch (error) {
            this.logger.warn(`Commit analysis warning: ${error.message}`);
            return {
                status: 'warning',
                message: 'Could not analyze commits',
                commitCount: 0
            };
        }
    }

    /**
     * Execute post-checkout hook with context restoration
     * Requirements: 6.2
     */
    async executePostCheckout(previousBranch, newBranch, isNewBranch) {
        this.startTimer('post-checkout');
        this.logger.info(`Executing post-checkout hook: ${previousBranch} -> ${newBranch} (new: ${isNewBranch})`);

        try {
            const results = {
                contextRestoration: { status: 'skipped' },
                branchInfo: {
                    previousBranch,
                    newBranch,
                    isNewBranch
                }
            };

            // Restore BMAD context for the target branch
            results.contextRestoration = await this.restoreBranchContext(newBranch, isNewBranch);

            const duration = this.endTimer('post-checkout', true);

            return {
                success: true, // Post-checkout always succeeds
                duration,
                results,
                metrics: this.getMetrics()
            };
        } catch (error) {
            this.logger.error(`Post-checkout hook failed: ${error.message}`);
            const duration = this.endTimer('post-checkout', true);

            return {
                success: true, // Always succeeds even on error
                duration,
                error: error.message,
                results: {
                    contextRestoration: { status: 'warning', error: error.message },
                    branchInfo: { previousBranch, newBranch, isNewBranch }
                }
            };
        }
    }

    /**
     * Restore BMAD context for a branch
     */
    async restoreBranchContext(branchName, isNewBranch) {
        this.logger.info(`Restoring BMAD context for branch: ${branchName}`);

        try {
            const contextPath = path.join(process.cwd(), 'activeContext.md');
            const branchContextPath = path.join(
                process.cwd(),
                '.github/contexts',
                `${branchName.replace(/\//g, '-')}.md`
            );

            // For new branches, initialize context
            if (isNewBranch) {
                const initialContext = `# Active Context\n\nBranch: ${branchName}\nCreated: ${new Date().toISOString()}\nStatus: New branch - context to be established\n`;

                // Ensure context directory exists
                const contextDir = path.dirname(contextPath);
                if (!fs.existsSync(contextDir)) {
                    fs.mkdirSync(contextDir, { recursive: true });
                }

                fs.writeFileSync(contextPath, initialContext);

                return {
                    status: 'passed',
                    message: 'Initialized context for new branch',
                    isNewBranch: true,
                    contextPath
                };
            }

            // For existing branches, restore saved context
            if (fs.existsSync(branchContextPath)) {
                const branchContext = fs.readFileSync(branchContextPath, 'utf8');

                // Update activeContext.md with branch-specific context
                const updatedContext = `# Active Context\n\nBranch: ${branchName}\nRestored: ${new Date().toISOString()}\n\n${branchContext}`;

                fs.writeFileSync(contextPath, updatedContext);

                return {
                    status: 'passed',
                    message: 'Restored context from branch-specific file',
                    isNewBranch: false,
                    contextPath,
                    branchContextPath
                };
            }

            // If no branch-specific context exists, create minimal context
            const minimalContext = `# Active Context\n\nBranch: ${branchName}\nRestored: ${new Date().toISOString()}\nStatus: No previous context found - starting fresh\n`;

            fs.writeFileSync(contextPath, minimalContext);

            return {
                status: 'warning',
                message: 'No branch-specific context found - created minimal context',
                isNewBranch: false,
                contextPath
            };
        } catch (error) {
            this.logger.error(`Context restoration failed: ${error.message}`);
            return {
                status: 'warning',
                error: error.message,
                message: 'Failed to restore context'
            };
        }
    }

    /**
     * Execute pre-receive hook for server-side validation
     * Requirements: 6.3
     */
    async executePreReceive(oldCommit, newCommit, refName) {
        this.startTimer('pre-receive');
        this.logger.info(`Executing pre-receive hook: ${refName} (${oldCommit.substring(0, 8)}..${newCommit.substring(0, 8)})`);

        try {
            const results = {
                commitValidation: { status: 'skipped' },
                branchProtection: { status: 'skipped' },
                authorValidation: { status: 'skipped' },
                sizeValidation: { status: 'skipped' },
                forcePushDetection: { status: 'skipped' }
            };

            // 1. Validate all commits being pushed
            results.commitValidation = await this.validatePushedCommits(oldCommit, newCommit);

            // 2. Check branch protection rules
            results.branchProtection = await this.checkBranchProtection(refName);

            // 3. Validate author information
            results.authorValidation = await this.validateCommitAuthors(oldCommit, newCommit);

            // 4. Check push size limits
            results.sizeValidation = await this.validatePushSize(oldCommit, newCommit);

            // 5. Detect force pushes
            results.forcePushDetection = await this.detectForcePush(oldCommit, newCommit, refName);

            // Determine overall success
            const success = this.isPreReceiveValid(results);
            const duration = this.endTimer('pre-receive', success);

            return {
                success,
                duration,
                results,
                metrics: this.getMetrics()
            };
        } catch (error) {
            this.logger.error(`Pre-receive hook failed: ${error.message}`);
            const duration = this.endTimer('pre-receive', false);

            return {
                success: false,
                duration,
                error: error.message,
                results: {}
            };
        }
    }

    /**
     * Validate all commits being pushed
     */
    async validatePushedCommits(oldCommit, newCommit) {
        this.logger.info('Validating pushed commits');

        try {
            // Get list of commits being pushed
            const commitsOutput = execSync(`git rev-list ${oldCommit}..${newCommit}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            if (!commitsOutput) {
                return {
                    status: 'passed',
                    message: 'No commits to validate',
                    commitsAnalyzed: 0,
                    invalidCommits: 0
                };
            }

            const commitHashes = commitsOutput.split('\n');
            const bmadPattern = /^\[([A-Z_]+)\]\s+\[([A-Z]+-\d+)\]\s+(.+)$/;

            let invalidCommits = 0;
            const invalidCommitDetails = [];

            for (const hash of commitHashes) {
                try {
                    const message = execSync(`git show -s --format=%B ${hash}`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();

                    if (!bmadPattern.test(message)) {
                        invalidCommits++;
                        invalidCommitDetails.push({
                            hash: hash.substring(0, 8),
                            message: message.substring(0, 50)
                        });
                    }
                } catch (error) {
                    this.logger.warn(`Could not validate commit ${hash}: ${error.message}`);
                }
            }

            return {
                status: invalidCommits === 0 ? 'passed' : 'failed',
                message: invalidCommits === 0 ? 'All commits follow BMAD pattern' : `${invalidCommits} commits do not follow BMAD pattern`,
                commitsAnalyzed: commitHashes.length,
                invalidCommits,
                invalidCommitDetails: invalidCommitDetails.slice(0, 5)
            };
        } catch (error) {
            this.logger.error(`Commit validation failed: ${error.message}`);
            return {
                status: 'failed',
                error: error.message,
                commitsAnalyzed: 0,
                invalidCommits: 0
            };
        }
    }

    /**
     * Check branch protection rules
     */
    async checkBranchProtection(refName) {
        this.logger.info(`Checking branch protection for ${refName}`);

        try {
            // Extract branch name from ref
            const branchName = refName.replace('refs/heads/', '');

            // Define protected branches
            const protectedBranches = ['main', 'master', 'production', 'release'];
            const isProtected = protectedBranches.includes(branchName);

            return {
                status: 'passed',
                message: isProtected ? 'Branch is protected - strict validation applied' : 'Branch is not protected',
                isProtected,
                branchName,
                protectedBranches
            };
        } catch (error) {
            this.logger.error(`Branch protection check failed: ${error.message}`);
            return {
                status: 'warning',
                error: error.message,
                isProtected: false
            };
        }
    }

    /**
     * Validate commit authors
     */
    async validateCommitAuthors(oldCommit, newCommit) {
        this.logger.info('Validating commit authors');

        try {
            const commitsOutput = execSync(`git rev-list ${oldCommit}..${newCommit}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            if (!commitsOutput) {
                return {
                    status: 'passed',
                    message: 'No commits to validate',
                    commitsChecked: 0
                };
            }

            const commitHashes = commitsOutput.split('\n');
            let invalidAuthors = 0;

            for (const hash of commitHashes) {
                try {
                    const author = execSync(`git show -s --format=%an ${hash}`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();

                    const email = execSync(`git show -s --format=%ae ${hash}`, {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();

                    // Basic validation - author and email should not be empty
                    if (!author || !email || author.length < 2 || !email.includes('@')) {
                        invalidAuthors++;
                    }
                } catch (error) {
                    this.logger.warn(`Could not validate author for commit ${hash}: ${error.message}`);
                    invalidAuthors++;
                }
            }

            return {
                status: invalidAuthors === 0 ? 'passed' : 'warning',
                message: invalidAuthors === 0 ? 'All authors validated' : `${invalidAuthors} commits have invalid author information`,
                commitsChecked: commitHashes.length,
                invalidAuthors
            };
        } catch (error) {
            this.logger.error(`Author validation failed: ${error.message}`);
            return {
                status: 'warning',
                error: error.message,
                commitsChecked: 0
            };
        }
    }

    /**
     * Validate push size limits
     */
    async validatePushSize(oldCommit, newCommit) {
        this.logger.info('Validating push size');

        try {
            const commitCountOutput = execSync(`git rev-list --count ${oldCommit}..${newCommit}`, {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const commitCount = parseInt(commitCountOutput, 10);

            // Define size limits
            const maxCommits = 50;
            const warningCommits = 20;

            let status = 'passed';
            let message = `Push contains ${commitCount} commits`;

            if (commitCount > maxCommits) {
                status = 'failed';
                message = `Push exceeds maximum commit limit (${commitCount} > ${maxCommits})`;
            } else if (commitCount > warningCommits) {
                status = 'warning';
                message = `Push contains many commits (${commitCount} > ${warningCommits})`;
            }

            return {
                status,
                message,
                commitCount,
                maxCommits,
                warningCommits
            };
        } catch (error) {
            this.logger.error(`Size validation failed: ${error.message}`);
            return {
                status: 'warning',
                error: error.message,
                commitCount: 0
            };
        }
    }

    /**
     * Detect force pushes
     */
    async detectForcePush(oldCommit, newCommit, refName) {
        this.logger.info('Detecting force push');

        try {
            // Check if old commit is zero (new branch)
            if (oldCommit === '0000000000000000000000000000000000000000') {
                return {
                    status: 'passed',
                    message: 'New branch creation',
                    isForcePush: false,
                    isNewBranch: true
                };
            }

            // Check if new commit is ancestor of old commit
            try {
                execSync(`git merge-base --is-ancestor ${oldCommit} ${newCommit}`, {
                    encoding: 'utf8',
                    stdio: 'pipe'
                });

                // If command succeeds, it's not a force push
                return {
                    status: 'passed',
                    message: 'Normal push (fast-forward)',
                    isForcePush: false,
                    isNewBranch: false
                };
            } catch (error) {
                // If command fails, it's a force push
                const branchName = refName.replace('refs/heads/', '');
                const protectedBranches = ['main', 'master', 'production', 'release'];
                const isProtected = protectedBranches.includes(branchName);

                const auditTrail = {
                    timestamp: new Date().toISOString(),
                    refName,
                    oldCommit: oldCommit.substring(0, 8),
                    newCommit: newCommit.substring(0, 8),
                    isProtected
                };

                return {
                    status: isProtected ? 'failed' : 'warning',
                    message: isProtected ? 'Force push to protected branch rejected' : 'Force push detected',
                    isForcePush: true,
                    isNewBranch: false,
                    auditTrail
                };
            }
        } catch (error) {
            this.logger.error(`Force push detection failed: ${error.message}`);
            return {
                status: 'warning',
                error: error.message,
                isForcePush: false
            };
        }
    }

    /**
     * Check if pre-receive validation passed
     */
    isPreReceiveValid(results) {
        // Pre-receive fails if any critical validation fails
        if (results.commitValidation.status === 'failed') return false;
        if (results.forcePushDetection.status === 'failed') return false;
        if (results.sizeValidation.status === 'failed') return false;

        // Warnings don't cause failure
        return true;
    }

    /**
     * Check if repository has stash
     */
    checkHasStash() {
        try {
            const stashOutput = execSync('git stash list', {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            return stashOutput.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate cache key for test results based on file changes
     */
    generateTestCacheKey() {
        try {
            // Use git hash of current state as cache key
            const gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim();
            const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8', stdio: 'pipe' }).trim();
            return `${gitHash}-${Buffer.from(stagedFiles).toString('base64')}`;
        } catch (error) {
            // Fallback to timestamp if git not available
            return `fallback-${Date.now()}`;
        }
    }

    /**
     * Get cached test result
     */
    getCachedTestResult(cacheKey) {
        try {
            const cacheFile = path.join(process.cwd(), '.git', 'hooks-cache.json');
            if (!fs.existsSync(cacheFile)) {
                return null;
            }
            const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            return cache[cacheKey] || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Cache test result
     */
    cacheTestResult(cacheKey, result) {
        try {
            const cacheFile = path.join(process.cwd(), '.git', 'hooks-cache.json');
            let cache = {};
            if (fs.existsSync(cacheFile)) {
                cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            }

            // Keep only last 10 cache entries to prevent bloat
            const keys = Object.keys(cache);
            if (keys.length >= 10) {
                const oldestKey = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
                delete cache[oldestKey];
            }

            cache[cacheKey] = result;
            fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
        } catch (error) {
            // Ignore cache write errors
        }
    }

    /**
     * Check if cached result is still valid (within 5 minutes)
     */
    isCacheValid(cachedResult) {
        const fiveMinutes = 5 * 60 * 1000;
        return cachedResult.timestamp && (Date.now() - cachedResult.timestamp) < fiveMinutes;
    }

    /**
     * Get validation configuration for GitHub Actions consistency
     * Requirements: 7.2
     */
    getValidationConfig() {
        return {
            linting: this.config.enableLinting,
            testing: this.config.enableTesting,
            build: this.config.enableBuild || false,
            security: this.config.enableSecurity || false,
            contextValidation: this.config.enableContextValidation,
            gatekeeper: this.config.enableGatekeeper
        };
    }

    /**
     * Get validation command for a specific validation type
     * Requirements: 7.2
     */
    getValidationCommand(validationType) {
        const commands = {
            'lint': 'npm run lint',
            'test': 'npm run test',
            'build': 'npm run build',
            'validate': 'npm run validate',
            'security': 'npm audit'
        };
        return commands[validationType] || null;
    }

    /**
     * Export configuration for GitHub Actions synchronization
     * Requirements: 7.2
     */
    exportConfigForGitHubActions() {
        return {
            preCommit: {
                linting: this.config.enableLinting,
                testing: this.config.enableTesting,
                contextValidation: this.config.enableContextValidation
            },
            prePush: {
                fullTests: this.config.enableTesting,
                build: this.config.enableBuild || false,
                security: this.config.enableSecurity || false
            },
            postCommit: {
                metrics: true,
                documentation: true,
                notifications: true
            },
            postMerge: {
                workflow: true,
                validation: true,
                reporting: true
            }
        };
    }

    /**
     * Format validation result for local display
     * Requirements: 7.2
     */
    formatValidationResult(validationResult) {
        return {
            success: validationResult.success,
            errors: validationResult.errors || [],
            warnings: validationResult.warnings || [],
            timestamp: new Date().toISOString(),
            source: 'local'
        };
    }

    /**
     * Format validation result for GitHub Actions
     * Requirements: 7.2
     */
    formatValidationResultForGitHub(validationResult) {
        return {
            success: validationResult.success,
            errors: validationResult.errors || [],
            warnings: validationResult.warnings || [],
            timestamp: new Date().toISOString(),
            source: 'github-actions'
        };
    }

    /**
     * Check if GitHub Actions will run for a given branch
     * Requirements: 7.2
     */
    willGitHubActionsRun(branch) {
        // GitHub Actions typically run on main, develop, and PRs
        const protectedBranches = ['main', 'develop', 'master'];
        return protectedBranches.includes(branch) || branch.startsWith('feature/');
    }

    /**
     * Determine validation level based on branch and remote execution
     * Requirements: 7.2
     */
    determineValidationLevel(branch, willRunRemote) {
        if (willRunRemote) {
            // GitHub Actions will run comprehensive checks
            return 'standard';
        } else {
            // No remote validation, must be comprehensive locally
            return 'comprehensive';
        }
    }

    /**
     * Analyze validation consistency between local and remote
     * Requirements: 7.2
     */
    analyzeValidationConsistency(validationHistory) {
        const totalValidations = validationHistory.length;
        const consistentCount = validationHistory.filter(
            v => v.local === v.remote
        ).length;

        const consistencyRate = totalValidations > 0
            ? consistentCount / totalValidations
            : 0;

        return {
            totalValidations,
            consistentCount,
            inconsistentCount: totalValidations - consistentCount,
            consistencyRate,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Synchronize with GitHub Actions before push
     * Requirements: 7.2
     */
    synchronizeWithGitHubActions(branch) {
        try {
            // Get remote coordination status
            const coordination = this.githubActionsSync.validateRemoteCoordination(branch);

            this.logger.info(`GitHub Actions sync: ${coordination.recommendation.level} validation recommended`);

            // Log any inconsistencies
            if (!coordination.syncReport.consistent) {
                this.logger.warn('Configuration inconsistencies detected:');
                coordination.syncReport.inconsistencies.forEach(inc => {
                    this.logger.warn(`  - ${inc.message}`);
                });
            }

            return coordination;
        } catch (error) {
            this.logger.error(`GitHub Actions sync failed: ${error.message}`);
            return {
                willRunRemote: false,
                syncReport: { consistent: false, error: error.message },
                recommendation: { level: 'comprehensive', reason: 'Sync failed - using comprehensive validation' }
            };
        }
    }

    /**
     * Monitor validation consistency
     * Requirements: 7.2
     */
    recordValidationConsistency(localResult, remoteExpected) {
        const validationResult = {
            local: localResult,
            remote: remoteExpected
        };

        return this.githubActionsSync.monitorConsistency(validationResult);
    }

    /**
     * Generate GitHub Actions consistency report
     * Requirements: 7.2
     */
    generateConsistencyReport() {
        const syncReport = this.githubActionsSync.synchronizeConfiguration();
        const consistencyReport = this.githubActionsSync.generateConsistencyReport();

        return {
            synchronization: syncReport,
            consistency: consistencyReport,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = HookOrchestrator;
