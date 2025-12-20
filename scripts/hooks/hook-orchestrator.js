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
            let issuesFixed = 0;

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
     * Run fast unit tests for immediate feedback
     * Requirements: 1.3
     */
    async runFastTests() {
        this.logger.info('Running fast unit tests');

        try {
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

            // Run tests with timeout for fast execution
            const testOutput = execSync('npm test -- --passWithNoTests --testTimeout=10000', {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 30000 // 30 second timeout for fast tests
            });

            // Parse test results (basic parsing for Jest output)
            const testResults = this.parseTestOutput(testOutput);

            return {
                status: 'passed',
                testsRun: testResults.total,
                passed: testResults.passed,
                failed: testResults.failed,
                duration: testResults.duration,
                output: testOutput
            };
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

            // Use existing gatekeeper validation
            const validationResult = await this.gatekeeper.validateWorkflowConditions(gatekeeperContext);

            return {
                status: validationResult.gate === 'PASS' ? 'passed' :
                    validationResult.gate === 'WAIVED' ? 'waived' : 'failed',
                gate: validationResult.gate,
                validations: validationResult.validations,
                errors: validationResult.errors,
                warnings: validationResult.warnings,
                waiver: validationResult.waiver
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
     * Implementation placeholder for future tasks
     */
    async executeCommitMsg(message) {
        this.startTimer('commit-msg');
        this.logger.info('Executing commit-msg hook');

        const duration = this.endTimer('commit-msg', true);
        return {
            success: true,
            message: 'Commit message validation not yet implemented',
            duration
        };
    }

    /**
     * Execute pre-push validation hook
     * Implementation placeholder for future tasks
     */
    async executePrePush(branch, remote) {
        this.startTimer('pre-push');
        this.logger.info(`Executing pre-push hook for ${branch} -> ${remote}`);

        const duration = this.endTimer('pre-push', true);
        return {
            success: true,
            message: 'Pre-push validation not yet implemented',
            duration
        };
    }

    /**
     * Execute post-commit automation hook
     * Implementation placeholder for future tasks
     */
    async executePostCommit(commitHash) {
        this.startTimer('post-commit');
        this.logger.info(`Executing post-commit hook for ${commitHash}`);

        const duration = this.endTimer('post-commit', true);
        return {
            success: true,
            message: 'Post-commit automation not yet implemented',
            duration
        };
    }

    /**
     * Execute post-merge automation hook
     * Implementation placeholder for future tasks
     */
    async executePostMerge(mergeType) {
        this.startTimer('post-merge');
        this.logger.info(`Executing post-merge hook for ${mergeType} merge`);

        const duration = this.endTimer('post-merge', true);
        return {
            success: true,
            message: 'Post-merge automation not yet implemented',
            duration
        };
    }
}

module.exports = HookOrchestrator;