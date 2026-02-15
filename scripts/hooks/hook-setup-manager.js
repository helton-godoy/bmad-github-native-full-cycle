/**
 * Hook Setup Manager - Automated installation and configuration of git hooks
 * Part of the BMAD Git Hooks Automation system
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * @ai-context Manages automated setup, configuration, and validation of git hooks
 * @ai-invariant All hooks must be properly installed with executable permissions
 * @ai-connection Integrates with Hook Orchestrator for hook execution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('../lib/logger');

class HookSetupManager {
    constructor(options = {}) {
        this.options = {
            projectRoot: options.projectRoot || process.cwd(),
            huskyDir: options.huskyDir || '.husky',
            forceReinstall: options.forceReinstall || false,
            verbose: options.verbose || false,
            ...options
        };

        this.logger = new Logger('HookSetupManager');
        this.huskyPath = path.join(this.options.projectRoot, this.options.huskyDir);

        // Define required hooks
        this.requiredHooks = ['commit-msg', 'pre-commit', 'pre-push'];

        // Hook templates
        this.hookTemplates = {
            'commit-msg': this.getCommitMsgTemplate(),
            'pre-commit': this.getPreCommitTemplate(),
            'pre-push': this.getPrePushTemplate()
        };
    }

    /**
     * Install Husky and configure all required git hooks
     * Requirements: 1.1, 1.2, 1.3
     * 
     * @returns {Object} Installation result with status and details
     */
    async installHooks() {
        this.logger.info('Starting git hooks installation');

        try {
            const result = {
                success: false,
                huskyInstalled: false,
                hooksCreated: [],
                errors: [],
                warnings: []
            };

            // Step 1: Check if Husky is installed
            const huskyInstalled = this.isHuskyInstalled();

            if (!huskyInstalled) {
                this.logger.info('Husky not found, installing...');
                try {
                    this.installHusky();
                    result.huskyInstalled = true;
                    this.logger.info('Husky installed successfully');
                } catch (error) {
                    result.errors.push(`Failed to install Husky: ${error.message}`);
                    this.logger.error(`Husky installation failed: ${error.message}`);
                    return result;
                }
            } else {
                this.logger.info('Husky is already installed');
                result.huskyInstalled = true;
            }

            // Step 2: Ensure .husky directory exists
            if (!fs.existsSync(this.huskyPath)) {
                this.logger.info(`Creating ${this.options.huskyDir} directory`);
                fs.mkdirSync(this.huskyPath, { recursive: true });
            }

            // Step 3: Check for existing hooks
            const existingHooks = this.detectExistingHooks();

            if (existingHooks.hasHooks && !this.options.forceReinstall) {
                this.logger.warn('Existing hooks detected');
                result.warnings.push('Existing hooks detected - use forceReinstall option to overwrite');

                // Still validate existing hooks
                const validation = this.validateHookInstallation();
                if (!validation.allValid) {
                    result.warnings.push('Some existing hooks are not valid - consider reinstalling');
                }

                result.success = validation.allValid;
                result.hooksCreated = existingHooks.hooks.filter(h => h.exists).map(h => h.name);
                return result;
            }

            // Step 4: Create hook scripts
            for (const hookName of this.requiredHooks) {
                try {
                    this.createHookScript(hookName);
                    result.hooksCreated.push(hookName);
                    this.logger.info(`Created ${hookName} hook`);
                } catch (error) {
                    result.errors.push(`Failed to create ${hookName} hook: ${error.message}`);
                    this.logger.error(`Failed to create ${hookName} hook: ${error.message}`);
                }
            }

            // Step 5: Validate installation
            const validation = this.validateHookInstallation();
            result.success = validation.allValid && result.errors.length === 0;

            if (!validation.allValid) {
                result.errors.push(...validation.errors);
            }

            if (result.success) {
                this.logger.info('Git hooks installation completed successfully');
            } else {
                this.logger.error('Git hooks installation completed with errors');
            }

            return result;

        } catch (error) {
            this.logger.error(`Hook installation failed: ${error.message}`);
            return {
                success: false,
                huskyInstalled: false,
                hooksCreated: [],
                errors: [`Installation failed: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Detect existing hook configuration
     * Requirements: 1.5
     * 
     * @returns {Object} Detection result with existing hooks information
     */
    detectExistingHooks() {
        this.logger.info('Detecting existing git hooks');

        const result = {
            hasHooks: false,
            huskyInstalled: false,
            hooks: []
        };

        try {
            // Check if Husky is installed
            result.huskyInstalled = this.isHuskyInstalled();

            // Check if .husky directory exists
            if (!fs.existsSync(this.huskyPath)) {
                this.logger.info('No .husky directory found');

                // Still populate hooks array with non-existent hooks
                for (const hookName of this.requiredHooks) {
                    result.hooks.push({
                        name: hookName,
                        exists: false,
                        executable: false,
                        lastModified: null,
                        size: 0,
                        path: path.join(this.huskyPath, hookName)
                    });
                }

                return result;
            }

            // Check each required hook
            for (const hookName of this.requiredHooks) {
                const hookPath = path.join(this.huskyPath, hookName);
                const exists = fs.existsSync(hookPath);

                let executable = false;
                let lastModified = null;
                let size = 0;

                if (exists) {
                    try {
                        const stats = fs.statSync(hookPath);
                        // Check if file has execute permission (Unix-like systems)
                        executable = !!(stats.mode & fs.constants.S_IXUSR);
                        lastModified = stats.mtime.toISOString();
                        size = stats.size;
                    } catch (error) {
                        this.logger.warn(`Could not get stats for ${hookName}: ${error.message}`);
                    }
                }

                result.hooks.push({
                    name: hookName,
                    exists,
                    executable,
                    lastModified,
                    size,
                    path: hookPath
                });

                if (exists) {
                    result.hasHooks = true;
                }
            }

            this.logger.info(`Found ${result.hooks.filter(h => h.exists).length} existing hooks`);
            return result;

        } catch (error) {
            this.logger.error(`Failed to detect existing hooks: ${error.message}`);
            return result;
        }
    }

    /**
     * Update existing hooks to latest version
     * Requirements: 1.2, 1.3
     * 
     * @returns {Object} Update result with status and details
     */
    async updateHooks() {
        this.logger.info('Updating existing git hooks');

        try {
            const result = {
                success: false,
                hooksUpdated: [],
                errors: [],
                warnings: []
            };

            // Check if hooks exist
            const existingHooks = this.detectExistingHooks();

            if (!existingHooks.hasHooks) {
                result.warnings.push('No existing hooks found - use installHooks() instead');
                this.logger.warn('No existing hooks to update');
                return result;
            }

            // Update each hook
            for (const hookInfo of existingHooks.hooks) {
                if (hookInfo.exists) {
                    try {
                        // Backup existing hook
                        const backupPath = `${hookInfo.path}.backup`;
                        fs.copyFileSync(hookInfo.path, backupPath);
                        this.logger.info(`Backed up ${hookInfo.name} to ${backupPath}`);

                        // Create new hook script
                        this.createHookScript(hookInfo.name);
                        result.hooksUpdated.push(hookInfo.name);
                        this.logger.info(`Updated ${hookInfo.name} hook`);
                    } catch (error) {
                        result.errors.push(`Failed to update ${hookInfo.name}: ${error.message}`);
                        this.logger.error(`Failed to update ${hookInfo.name}: ${error.message}`);
                    }
                }
            }

            // Validate updated hooks
            const validation = this.validateHookInstallation();
            result.success = validation.allValid && result.errors.length === 0;

            if (!validation.allValid) {
                result.errors.push(...validation.errors);
            }

            if (result.success) {
                this.logger.info('Git hooks updated successfully');
            } else {
                this.logger.error('Git hooks update completed with errors');
            }

            return result;

        } catch (error) {
            this.logger.error(`Hook update failed: ${error.message}`);
            return {
                success: false,
                hooksUpdated: [],
                errors: [`Update failed: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Validate hook installation and functionality
     * Requirements: 1.4
     * 
     * @returns {Object} Validation result with detailed checks
     */
    validateHookInstallation() {
        this.logger.info('Validating git hooks installation');

        const result = {
            allValid: true,
            checks: [],
            errors: [],
            warnings: []
        };

        try {
            // Check 1: Husky is installed
            const huskyInstalled = this.isHuskyInstalled();
            result.checks.push({
                name: 'Husky installed',
                passed: huskyInstalled,
                message: huskyInstalled ? 'Husky is installed' : 'Husky is not installed'
            });

            if (!huskyInstalled) {
                result.allValid = false;
                result.errors.push('Husky is not installed');
            }

            // Check 2: .husky directory exists
            const huskyDirExists = fs.existsSync(this.huskyPath);
            result.checks.push({
                name: '.husky directory exists',
                passed: huskyDirExists,
                message: huskyDirExists ? '.husky directory exists' : '.husky directory not found'
            });

            if (!huskyDirExists) {
                result.allValid = false;
                result.errors.push('.husky directory not found');
                return result; // Can't continue without .husky directory
            }

            // Check 3: All required hooks exist
            for (const hookName of this.requiredHooks) {
                const hookPath = path.join(this.huskyPath, hookName);
                const exists = fs.existsSync(hookPath);

                result.checks.push({
                    name: `${hookName} exists`,
                    passed: exists,
                    message: exists ? `${hookName} hook exists` : `${hookName} hook not found`
                });

                if (!exists) {
                    result.allValid = false;
                    result.errors.push(`${hookName} hook not found`);
                    continue;
                }

                // Check 4: Hook is executable
                try {
                    const stats = fs.statSync(hookPath);
                    const executable = !!(stats.mode & fs.constants.S_IXUSR);

                    result.checks.push({
                        name: `${hookName} executable`,
                        passed: executable,
                        message: executable ? `${hookName} is executable` : `${hookName} is not executable`
                    });

                    if (!executable) {
                        result.allValid = false;
                        result.errors.push(`${hookName} is not executable`);
                    }
                } catch (error) {
                    result.checks.push({
                        name: `${hookName} permissions check`,
                        passed: false,
                        message: `Could not check permissions: ${error.message}`
                    });
                    result.warnings.push(`Could not check ${hookName} permissions: ${error.message}`);
                }

                // Check 5: Hook content is valid
                try {
                    const content = fs.readFileSync(hookPath, 'utf8');
                    const hasShebang = content.startsWith('#!/');
                    const hasHuskySource = content.includes('husky.sh');
                    const hasOrchestrator = content.includes('HookOrchestrator');

                    const contentValid = hasShebang && hasHuskySource && hasOrchestrator;

                    result.checks.push({
                        name: `${hookName} content valid`,
                        passed: contentValid,
                        message: contentValid ? `${hookName} content is valid` : `${hookName} content may be invalid`
                    });

                    if (!contentValid) {
                        result.warnings.push(`${hookName} content may be invalid or outdated`);
                    }
                } catch (error) {
                    result.checks.push({
                        name: `${hookName} content check`,
                        passed: false,
                        message: `Could not read content: ${error.message}`
                    });
                    result.warnings.push(`Could not read ${hookName} content: ${error.message}`);
                }
            }

            // Check 6: Git repository exists
            const isGitRepo = this.isGitRepository();
            result.checks.push({
                name: 'Git repository',
                passed: isGitRepo,
                message: isGitRepo ? 'Git repository detected' : 'Not a Git repository'
            });

            if (!isGitRepo) {
                result.warnings.push('Not a Git repository - hooks will not function');
            }

            // Check 7: Hook Orchestrator exists
            const orchestratorPath = path.join(this.options.projectRoot, 'scripts/hooks/hook-orchestrator.js');
            const orchestratorExists = fs.existsSync(orchestratorPath);

            result.checks.push({
                name: 'Hook Orchestrator exists',
                passed: orchestratorExists,
                message: orchestratorExists ? 'Hook Orchestrator found' : 'Hook Orchestrator not found'
            });

            if (!orchestratorExists) {
                result.allValid = false;
                result.errors.push('Hook Orchestrator not found - hooks will not function');
            }

            this.logger.info(`Validation completed: ${result.allValid ? 'PASSED' : 'FAILED'}`);
            return result;

        } catch (error) {
            this.logger.error(`Validation failed: ${error.message}`);
            result.allValid = false;
            result.errors.push(`Validation error: ${error.message}`);
            return result;
        }
    }

    /**
     * Generate hook configuration report
     * Requirements: 1.5
     * 
     * @returns {Object} Comprehensive configuration report
     */
    generateConfigReport() {
        this.logger.info('Generating hook configuration report');

        try {
            const report = {
                timestamp: new Date().toISOString(),
                projectRoot: this.options.projectRoot,
                huskyDirectory: this.options.huskyDir,
                configuration: {
                    hooksInstalled: false,
                    huskyVersion: null,
                    gitVersion: null,
                    nodeVersion: process.version
                },
                hooks: [],
                validation: null,
                recommendations: []
            };

            // Get Husky version
            if (this.isHuskyInstalled()) {
                try {
                    const huskyVersion = execSync('npx husky --version', {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();
                    report.configuration.huskyVersion = huskyVersion;
                } catch (error) {
                    report.configuration.huskyVersion = 'unknown';
                }
            }

            // Get Git version
            if (this.isGitRepository()) {
                try {
                    const gitVersion = execSync('git --version', {
                        encoding: 'utf8',
                        stdio: 'pipe'
                    }).trim();
                    report.configuration.gitVersion = gitVersion;
                } catch (error) {
                    report.configuration.gitVersion = 'unknown';
                }
            }

            // Detect existing hooks
            const existingHooks = this.detectExistingHooks();
            report.configuration.hooksInstalled = existingHooks.hasHooks;
            report.hooks = existingHooks.hooks;

            // Validate installation
            report.validation = this.validateHookInstallation();

            // Generate recommendations
            if (!existingHooks.huskyInstalled) {
                report.recommendations.push('Install Husky: npm install --save-dev husky');
            }

            if (!existingHooks.hasHooks) {
                report.recommendations.push('Install git hooks: npm run hooks:setup');
            }

            if (!report.validation.allValid) {
                report.recommendations.push('Fix validation errors before using git hooks');

                if (report.validation.errors.length > 0) {
                    report.recommendations.push(...report.validation.errors.map(err => `Fix: ${err}`));
                }
            }

            // Check for outdated hooks
            const outdatedHooks = report.hooks.filter(h => {
                if (!h.exists) return false;

                try {
                    const content = fs.readFileSync(h.path, 'utf8');
                    return !content.includes('HookOrchestrator');
                } catch (error) {
                    return false;
                }
            });

            if (outdatedHooks.length > 0) {
                report.recommendations.push(`Update outdated hooks: ${outdatedHooks.map(h => h.name).join(', ')}`);
            }

            this.logger.info('Configuration report generated successfully');
            return report;

        } catch (error) {
            this.logger.error(`Failed to generate config report: ${error.message}`);
            return {
                timestamp: new Date().toISOString(),
                error: error.message,
                configuration: {},
                hooks: [],
                validation: null,
                recommendations: ['Fix configuration report generation error']
            };
        }
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Check if Husky is installed
     * @private
     */
    isHuskyInstalled() {
        try {
            const packagePath = path.join(this.options.projectRoot, 'package.json');

            if (!fs.existsSync(packagePath)) {
                return false;
            }

            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const hasHusky = packageJson.devDependencies?.husky || packageJson.dependencies?.husky;

            return !!hasHusky;
        } catch (error) {
            this.logger.warn(`Could not check Husky installation: ${error.message}`);
            return false;
        }
    }

    /**
     * Install Husky
     * @private
     */
    installHusky() {
        try {
            this.logger.info('Installing Husky...');
            execSync('npm install --save-dev husky', {
                cwd: this.options.projectRoot,
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });

            // Initialize Husky
            execSync('npx husky init', {
                cwd: this.options.projectRoot,
                stdio: this.options.verbose ? 'inherit' : 'pipe'
            });

            this.logger.info('Husky installed and initialized');
        } catch (error) {
            throw new Error(`Failed to install Husky: ${error.message}`);
        }
    }

    /**
     * Create a hook script
     * @private
     */
    createHookScript(hookName) {
        const hookPath = path.join(this.huskyPath, hookName);
        const template = this.hookTemplates[hookName];

        if (!template) {
            throw new Error(`No template found for hook: ${hookName}`);
        }

        // Write hook script
        fs.writeFileSync(hookPath, template, { mode: 0o755 });

        // Ensure executable permissions (Unix-like systems)
        try {
            fs.chmodSync(hookPath, 0o755);
        } catch (error) {
            this.logger.warn(`Could not set executable permissions for ${hookName}: ${error.message}`);
        }

        this.logger.info(`Created hook script: ${hookPath}`);
    }

    /**
     * Check if current directory is a Git repository
     * @private
     */
    isGitRepository() {
        try {
            execSync('git rev-parse --git-dir', {
                cwd: this.options.projectRoot,
                stdio: 'pipe'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get commit-msg hook template
     * @private
     */
    getCommitMsgTemplate() {
        return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# BMAD Git Hooks Automation - Commit Message Hook
# Requirements: 2.1, 2.2, 2.3, 2.4

# Get commit message from file
COMMIT_MSG_FILE="$1"

# Check if commit message file exists
if [ ! -f "$COMMIT_MSG_FILE" ]; then
  echo "❌ Error: Commit message file not found: $COMMIT_MSG_FILE"
  exit 1
fi

# Execute commit message validation through Hook Orchestrator
node -e "
const fs = require('fs');
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');

async function runCommitMsgValidation() {
  try {
    const commitMsgFile = process.argv[1];
    
    if (!fs.existsSync(commitMsgFile)) {
      console.error('❌ Commit message file not found:', commitMsgFile);
      process.exit(1);
    }
    
    const message = fs.readFileSync(commitMsgFile, 'utf8').trim();
    
    if (!message) {
      console.error('❌ Commit message is empty');
      process.exit(1);
    }
    
    console.log('🔍 Validating commit message...');
    
    const orchestrator = new HookOrchestrator();
    const result = await orchestrator.executeCommitMsg(message);
    
    if (result.success) {
      console.log('✅ Commit message validation passed');
      console.log(\`⏱️  Completed in \${result.duration}ms\`);
      process.exit(0);
    } else {
      console.error('❌ Commit message validation failed');
      if (result.errorMessage) {
        console.error('\\n' + result.errorMessage);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Commit message validation crashed:', error.message);
    process.exit(1);
  }
}

runCommitMsgValidation();
" "$COMMIT_MSG_FILE"
`;
    }

    /**
     * Get pre-commit hook template
     * @private
     */
    getPreCommitTemplate() {
        return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# BMAD Git Hooks Automation - Pre-commit Hook
# Requirements: 1.1, 1.3, 1.4

# Get staged files
STAGED_FILES=$(git diff --cached --name-only)

# Execute pre-commit hook through Hook Orchestrator
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();

async function runPreCommit() {
  try {
    const stagedFiles = process.env.STAGED_FILES ? process.env.STAGED_FILES.split('\\n').filter(f => f.length > 0) : [];
    console.log('🔍 Running pre-commit validation...');
    
    const result = await orchestrator.executePreCommit(stagedFiles);
    
    if (result.success) {
      console.log('✅ Pre-commit validation passed');
      console.log(\`⏱️  Completed in \${result.duration}ms\`);
      process.exit(0);
    } else {
      console.error('❌ Pre-commit validation failed');
      console.error(\`⏱️  Failed after \${result.duration}ms\`);
      
      Object.entries(result.results).forEach(([name, result]) => {
        if (result.status === 'failed') {
          console.error(\`\\n🚫 \${name} failed:\`);
          if (result.error) {
            console.error(\`   Error: \${result.error}\`);
          }
        }
      });
      
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Pre-commit hook crashed:', error.message);
    process.exit(1);
  }
}

runPreCommit();
" STAGED_FILES="$STAGED_FILES"
`;
    }

    /**
     * Get pre-push hook template
     * @private
     */
    getPrePushTemplate() {
        return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# BMAD Git Hooks Automation - Pre-push Hook
# Requirements: 3.1, 3.2, 3.3, 3.4, 3.5

# Get branch and remote information
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REMOTE="$1"

# Execute pre-push validation through Hook Orchestrator
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();

async function runPrePush() {
  try {
    const branch = process.env.BRANCH || 'main';
    const remote = process.env.REMOTE || 'origin';
    
    console.log('🚀 Running pre-push validation...');
    console.log(\`📍 Branch: \${branch}\`);
    console.log(\`🌐 Remote: \${remote}\`);
    
    const result = await orchestrator.executePrePush(branch, remote);
    
    if (result.success) {
      console.log('✅ Pre-push validation passed');
      console.log(\`⏱️  Completed in \${result.duration}ms\`);
      process.exit(0);
    } else {
      console.error('❌ Pre-push validation failed');
      console.error(\`⏱️  Failed after \${result.duration}ms\`);
      
      if (result.failureReport) {
        console.error(\`\\n🚫 FAILED VALIDATIONS:\`);
        result.failureReport.failures.forEach((failure) => {
          console.error(\`   ❌ \${failure.check}: \${failure.error}\`);
        });
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Pre-push hook crashed:', error.message);
    process.exit(1);
  }
}

runPrePush();
" BRANCH="$BRANCH" REMOTE="$REMOTE"
`;
    }
}

module.exports = HookSetupManager;
