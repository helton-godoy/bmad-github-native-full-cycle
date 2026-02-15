#!/usr/bin/env node

/**
 * Git Hooks Setup CLI - Interactive setup for BMAD git hooks
 * Part of the BMAD Git Hooks Automation system
 * Requirements: 1.1, 1.5
 *
 * @ai-context CLI wrapper for HookSetupManager with interactive prompts
 * @ai-invariant Must provide clear feedback and handle errors gracefully
 * @ai-connection Integrates with HookSetupManager for hook installation
 */

const readline = require('readline');
const HookSetupManager = require('./hook-setup-manager');
const Logger = require('../lib/logger');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class HookSetupCLI {
  constructor() {
    this.logger = new Logger('HookSetupCLI');
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Print colored message
   * @private
   */
  print(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Print section header
   * @private
   */
  printHeader(title) {
    console.log('');
    this.print('═'.repeat(60), 'cyan');
    this.print(`  ${title}`, 'bright');
    this.print('═'.repeat(60), 'cyan');
    console.log('');
  }

  /**
   * Print success message
   * @private
   */
  printSuccess(message) {
    this.print(`✅ ${message}`, 'green');
  }

  /**
   * Print error message
   * @private
   */
  printError(message) {
    this.print(`❌ ${message}`, 'red');
  }

  /**
   * Print warning message
   * @private
   */
  printWarning(message) {
    this.print(`⚠️  ${message}`, 'yellow');
  }

  /**
   * Print info message
   * @private
   */
  printInfo(message) {
    this.print(`ℹ️  ${message}`, 'blue');
  }

  /**
   * Ask user a yes/no question
   * @private
   */
  async askYesNo(question, defaultAnswer = 'y') {
    return new Promise((resolve) => {
      const prompt = `${question} [${defaultAnswer === 'y' ? 'Y/n' : 'y/N'}]: `;
      this.rl.question(prompt, (answer) => {
        const normalized = answer.toLowerCase().trim() || defaultAnswer;
        resolve(normalized === 'y' || normalized === 'yes');
      });
    });
  }

  /**
   * Display configuration report
   * @private
   */
  displayConfigReport(report) {
    this.printHeader('Current Configuration');

    // System information
    this.printInfo(`Node.js: ${report.configuration.nodeVersion}`);
    this.printInfo(`Git: ${report.configuration.gitVersion || 'Not detected'}`);
    this.printInfo(
      `Husky: ${report.configuration.huskyVersion || 'Not installed'}`
    );
    this.printInfo(`Project Root: ${report.projectRoot}`);
    console.log('');

    // Hooks status
    this.print('Git Hooks Status:', 'bright');
    console.log('');

    if (report.hooks.length === 0) {
      this.printWarning('No hooks detected');
    } else {
      report.hooks.forEach((hook) => {
        const status = hook.exists
          ? hook.executable
            ? '✅ Installed'
            : '⚠️  Not executable'
          : '❌ Missing';

        console.log(`  ${hook.name.padEnd(15)} ${status}`);

        if (hook.exists) {
          console.log(`    ${colors.dim}Path: ${hook.path}${colors.reset}`);
          console.log(
            `    ${colors.dim}Modified: ${hook.lastModified}${colors.reset}`
          );
        }
      });
    }

    console.log('');

    // Validation results
    if (report.validation) {
      this.print('Validation Results:', 'bright');
      console.log('');

      report.validation.checks.forEach((check) => {
        const icon = check.passed ? '✅' : '❌';
        console.log(`  ${icon} ${check.name}: ${check.message}`);
      });

      console.log('');

      if (report.validation.errors.length > 0) {
        this.print('Errors:', 'red');
        report.validation.errors.forEach((error) => {
          console.log(`  • ${error}`);
        });
        console.log('');
      }

      if (report.validation.warnings.length > 0) {
        this.print('Warnings:', 'yellow');
        report.validation.warnings.forEach((warning) => {
          console.log(`  • ${warning}`);
        });
        console.log('');
      }
    }

    // Recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      this.print('Recommendations:', 'bright');
      console.log('');
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
      console.log('');
    }
  }

  /**
   * Display installation result
   * @private
   */
  displayInstallationResult(result) {
    console.log('');

    if (result.success) {
      this.printHeader('Installation Successful');
      this.printSuccess('Git hooks have been installed successfully!');
      console.log('');

      if (result.hooksCreated.length > 0) {
        this.print('Hooks Created:', 'bright');
        result.hooksCreated.forEach((hook) => {
          console.log(`  ✅ ${hook}`);
        });
        console.log('');
      }

      this.printInfo('You can now use git commands with automatic validation:');
      console.log('  • git commit - Validates commit message format');
      console.log('  • git commit (pre-commit) - Runs linting and fast tests');
      console.log('  • git push - Runs full test suite and security audit');
      console.log('');

      this.printInfo('Test your hooks with: npm run hooks:test');
    } else {
      this.printHeader('Installation Failed');
      this.printError('Git hooks installation encountered errors');
      console.log('');

      if (result.errors.length > 0) {
        this.print('Errors:', 'red');
        result.errors.forEach((error) => {
          console.log(`  • ${error}`);
        });
        console.log('');
      }

      if (result.warnings.length > 0) {
        this.print('Warnings:', 'yellow');
        result.warnings.forEach((warning) => {
          console.log(`  • ${warning}`);
        });
        console.log('');
      }

      this.printInfo('Please fix the errors above and try again.');
    }

    console.log('');
  }

  /**
   * Display update result
   * @private
   */
  displayUpdateResult(result) {
    console.log('');

    if (result.success) {
      this.printHeader('Update Successful');
      this.printSuccess('Git hooks have been updated successfully!');
      console.log('');

      if (result.hooksUpdated.length > 0) {
        this.print('Hooks Updated:', 'bright');
        result.hooksUpdated.forEach((hook) => {
          console.log(`  ✅ ${hook}`);
        });
        console.log('');
      }

      this.printInfo('Backup files created with .backup extension');
      this.printInfo('Test your updated hooks with: npm run hooks:test');
    } else {
      this.printHeader('Update Failed');
      this.printError('Git hooks update encountered errors');
      console.log('');

      if (result.errors.length > 0) {
        this.print('Errors:', 'red');
        result.errors.forEach((error) => {
          console.log(`  • ${error}`);
        });
        console.log('');
      }

      if (result.warnings.length > 0) {
        this.print('Warnings:', 'yellow');
        result.warnings.forEach((warning) => {
          console.log(`  • ${warning}`);
        });
        console.log('');
      }
    }

    console.log('');
  }

  /**
   * Run the interactive setup process
   */
  async run() {
    try {
      this.printHeader('BMAD Git Hooks Setup');
      this.printInfo(
        'This wizard will help you set up git hooks for the BMAD workflow'
      );
      console.log('');

      // Create HookSetupManager
      const manager = new HookSetupManager({
        verbose: false,
      });

      // Generate and display configuration report
      const report = manager.generateConfigReport();
      this.displayConfigReport(report);

      // Determine what action to take
      const existingHooks = manager.detectExistingHooks();

      if (!existingHooks.huskyInstalled) {
        // Husky not installed - offer to install
        this.printWarning('Husky is not installed in this project');
        console.log('');

        const shouldInstall = await this.askYesNo(
          'Would you like to install Husky and set up git hooks?',
          'y'
        );

        if (!shouldInstall) {
          this.printInfo('Setup cancelled by user');
          this.rl.close();
          return;
        }

        // Install hooks
        this.printInfo('Installing git hooks...');
        console.log('');

        const result = await manager.installHooks();
        this.displayInstallationResult(result);

        this.rl.close();
        process.exit(result.success ? 0 : 1);
      } else if (!existingHooks.hasHooks) {
        // Husky installed but no hooks - offer to create hooks
        this.printInfo('Husky is installed but git hooks are not configured');
        console.log('');

        const shouldInstall = await this.askYesNo(
          'Would you like to create git hooks?',
          'y'
        );

        if (!shouldInstall) {
          this.printInfo('Setup cancelled by user');
          this.rl.close();
          return;
        }

        // Install hooks
        this.printInfo('Creating git hooks...');
        console.log('');

        const result = await manager.installHooks();
        this.displayInstallationResult(result);

        this.rl.close();
        process.exit(result.success ? 0 : 1);
      } else {
        // Hooks already exist - offer to update or skip
        this.printInfo('Git hooks are already installed');
        console.log('');

        // Check if hooks are valid
        const validation = manager.validateHookInstallation();

        if (!validation.allValid) {
          this.printWarning('Some hooks have validation issues');
          console.log('');

          const shouldUpdate = await this.askYesNo(
            'Would you like to update the hooks to fix these issues?',
            'y'
          );

          if (!shouldUpdate) {
            this.printInfo('Setup cancelled by user');
            this.rl.close();
            return;
          }

          // Update hooks
          this.printInfo('Updating git hooks...');
          console.log('');

          const result = await manager.updateHooks();
          this.displayUpdateResult(result);

          this.rl.close();
          process.exit(result.success ? 0 : 1);
        } else {
          // Hooks are valid - ask if user wants to update anyway
          const shouldUpdate = await this.askYesNo(
            'Hooks are valid. Would you like to update them anyway?',
            'n'
          );

          if (!shouldUpdate) {
            this.printSuccess('Git hooks are already properly configured');
            this.printInfo('No changes needed');
            console.log('');
            this.rl.close();
            return;
          }

          // Update hooks
          this.printInfo('Updating git hooks...');
          console.log('');

          const result = await manager.updateHooks();
          this.displayUpdateResult(result);

          this.rl.close();
          process.exit(result.success ? 0 : 1);
        }
      }
    } catch (error) {
      console.log('');
      this.printError(`Setup failed: ${error.message}`);
      console.log('');
      this.logger.error(`Setup failed: ${error.message}`, error);
      this.rl.close();
      process.exit(1);
    }
  }
}

// Run the CLI if executed directly
if (require.main === module) {
  const cli = new HookSetupCLI();
  cli.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = HookSetupCLI;
