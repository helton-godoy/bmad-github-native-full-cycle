#!/usr/bin/env node

/**
 * Git Hooks Installation Script
 * Installs and configures BMAD Git Hooks Automation
 * Requirements: 6.4, 8.4
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class HooksInstaller {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.huskyDir = path.join(this.projectRoot, '.husky');
    this.configPath = path.join(this.huskyDir, 'hooks-config.json');
    this.templatePath = path.join(__dirname, 'hooks-config.template.json');
    this.force = options.force || false;
    this.verbose = options.verbose || false;
  }

  /**
   * Main installation process
   */
  async install() {
    console.log('🚀 Installing BMAD Git Hooks Automation...\n');

    try {
      // Step 1: Check prerequisites
      this.log('📋 Checking prerequisites...');
      this.checkPrerequisites();
      console.log('✅ Prerequisites check passed\n');

      // Step 2: Initialize Husky
      this.log('🔧 Initializing Husky...');
      this.initializeHusky();
      console.log('✅ Husky initialized\n');

      // Step 3: Install hook configuration
      this.log('⚙️  Installing hook configuration...');
      this.installConfiguration();
      console.log('✅ Configuration installed\n');

      // Step 4: Install hook scripts
      this.log('📝 Installing hook scripts...');
      this.installHookScripts();
      console.log('✅ Hook scripts installed\n');

      // Step 5: Set permissions
      this.log('🔐 Setting permissions...');
      this.setPermissions();
      console.log('✅ Permissions set\n');

      // Step 6: Validate installation
      this.log('✔️  Validating installation...');
      const validation = this.validateInstallation();
      if (validation.valid) {
        console.log('✅ Installation validated\n');
      } else {
        console.warn('⚠️  Installation validation found issues:\n');
        validation.issues.forEach((issue) => {
          console.warn(`   • ${issue}`);
        });
        console.warn('');
      }

      // Step 7: Display summary
      this.displaySummary();

      console.log('\n✅ BMAD Git Hooks Automation installed successfully!\n');
      return { success: true };
    } catch (error) {
      console.error('\n❌ Installation failed:', error.message);
      if (this.verbose) {
        console.error('Stack trace:', error.stack);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Check prerequisites for installation
   */
  checkPrerequisites() {
    // Check if git is installed
    try {
      execSync('git --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Git is not installed or not in PATH');
    }

    // Check if this is a git repository
    if (!fs.existsSync(path.join(this.projectRoot, '.git'))) {
      throw new Error('Not a git repository. Run "git init" first.');
    }

    // Check if Node.js version is compatible
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      throw new Error(
        `Node.js >= 18.0.0 required. Current version: ${nodeVersion}`
      );
    }

    // Check if package.json exists
    if (!fs.existsSync(path.join(this.projectRoot, 'package.json'))) {
      throw new Error('package.json not found. Run "npm init" first.');
    }

    // Check if husky is installed
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
    );
    const hasHusky =
      packageJson.devDependencies?.husky || packageJson.dependencies?.husky;
    if (!hasHusky) {
      throw new Error(
        'Husky is not installed. Run "npm install --save-dev husky" first.'
      );
    }
  }

  /**
   * Initialize Husky
   */
  initializeHusky() {
    try {
      // Run husky install
      execSync('npx husky install', {
        cwd: this.projectRoot,
        stdio: this.verbose ? 'inherit' : 'pipe',
      });

      // Ensure .husky directory exists
      if (!fs.existsSync(this.huskyDir)) {
        fs.mkdirSync(this.huskyDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to initialize Husky: ${error.message}`);
    }
  }

  /**
   * Install hook configuration
   */
  installConfiguration() {
    // Check if configuration already exists
    if (fs.existsSync(this.configPath) && !this.force) {
      console.log('   ℹ️  Configuration already exists, skipping...');
      console.log('   💡 Use --force to overwrite existing configuration');
      return;
    }

    // Copy template to configuration location
    if (!fs.existsSync(this.templatePath)) {
      throw new Error(`Configuration template not found: ${this.templatePath}`);
    }

    const template = fs.readFileSync(this.templatePath, 'utf8');
    fs.writeFileSync(this.configPath, template);

    console.log(`   📄 Configuration created: ${this.configPath}`);
  }

  /**
   * Install hook scripts
   */
  installHookScripts() {
    const hooks = [
      'pre-commit',
      'commit-msg',
      'pre-push',
      'post-commit',
      'post-merge',
      'post-checkout',
      'pre-rebase',
    ];

    const scriptsDir = path.join(__dirname);
    const hookTemplatesDir = path.join(scriptsDir, 'templates');

    hooks.forEach((hook) => {
      const hookPath = path.join(this.huskyDir, hook);
      const templatePath = path.join(hookTemplatesDir, hook);

      // Check if hook already exists
      if (fs.existsSync(hookPath) && !this.force) {
        console.log(`   ℹ️  Hook ${hook} already exists, skipping...`);
        return;
      }

      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        console.log(`   ⚠️  Template for ${hook} not found, skipping...`);
        return;
      }

      // Copy template
      const content = fs.readFileSync(templatePath, 'utf8');
      fs.writeFileSync(hookPath, content);

      console.log(`   ✅ Installed: ${hook}`);
    });
  }

  /**
   * Set proper permissions for hook scripts
   */
  setPermissions() {
    const hooks = fs
      .readdirSync(this.huskyDir)
      .filter((file) => !file.startsWith('.') && !file.endsWith('.json'));

    hooks.forEach((hook) => {
      const hookPath = path.join(this.huskyDir, hook);
      if (fs.existsSync(hookPath)) {
        try {
          fs.chmodSync(hookPath, 0o755);
          this.log(`   Set executable: ${hook}`);
        } catch (error) {
          console.warn(
            `   ⚠️  Could not set permissions for ${hook}: ${error.message}`
          );
        }
      }
    });
  }

  /**
   * Validate installation
   */
  validateInstallation() {
    const issues = [];

    // Check if .husky directory exists
    if (!fs.existsSync(this.huskyDir)) {
      issues.push('.husky directory not found');
    }

    // Check if configuration exists
    if (!fs.existsSync(this.configPath)) {
      issues.push('Hook configuration not found');
    }

    // Check if hook scripts exist
    const requiredHooks = ['pre-commit', 'commit-msg', 'pre-push'];
    requiredHooks.forEach((hook) => {
      const hookPath = path.join(this.huskyDir, hook);
      if (!fs.existsSync(hookPath)) {
        issues.push(`Required hook ${hook} not found`);
      }
    });

    // Validate configuration
    if (fs.existsSync(this.configPath)) {
      try {
        const ConfigValidator = require('./config-validator');
        const validator = new ConfigValidator();
        const result = validator.validate();
        if (!result.valid) {
          result.errors.forEach((error) => {
            issues.push(`Configuration error: ${error.message}`);
          });
        }
      } catch (error) {
        issues.push(`Configuration validation failed: ${error.message}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Display installation summary
   */
  displaySummary() {
    console.log('📊 Installation Summary:');
    console.log('');
    console.log('   Installed hooks:');
    console.log('   • pre-commit    - Linting, testing, context validation');
    console.log('   • commit-msg    - Message format validation');
    console.log('   • pre-push      - Full tests, security audit, BMAD sync');
    console.log('   • post-commit   - Metrics, documentation, notifications');
    console.log('   • post-merge    - Workflow automation, validation');
    console.log('');
    console.log('   Configuration:');
    console.log(`   • Location: ${this.configPath}`);
    console.log('   • Edit configuration to customize hook behavior');
    console.log('');
    console.log('   Next steps:');
    console.log('   1. Review configuration: cat .husky/hooks-config.json');
    console.log('   2. Customize settings as needed');
    console.log('   3. Test hooks: git commit -m "test: hook validation"');
    console.log('   4. View documentation: docs/hooks/README.md');
  }

  /**
   * Log message if verbose mode is enabled
   */
  log(message) {
    if (this.verbose) {
      console.log(message);
    }
  }

  /**
   * Uninstall hooks
   */
  async uninstall() {
    console.log('🗑️  Uninstalling BMAD Git Hooks Automation...\n');

    try {
      // Remove hook scripts
      const hooks = [
        'pre-commit',
        'commit-msg',
        'pre-push',
        'post-commit',
        'post-merge',
      ];
      hooks.forEach((hook) => {
        const hookPath = path.join(this.huskyDir, hook);
        if (fs.existsSync(hookPath)) {
          fs.unlinkSync(hookPath);
          console.log(`   ✅ Removed: ${hook}`);
        }
      });

      // Remove configuration (with confirmation)
      if (fs.existsSync(this.configPath)) {
        if (this.force) {
          fs.unlinkSync(this.configPath);
          console.log('   ✅ Removed: hooks-config.json');
        } else {
          console.log('   ℹ️  Configuration preserved (use --force to remove)');
        }
      }

      console.log('\n✅ BMAD Git Hooks Automation uninstalled successfully!\n');
      return { success: true };
    } catch (error) {
      console.error('\n❌ Uninstallation failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'install';
  const options = {
    force: args.includes('--force') || args.includes('-f'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  const installer = new HooksInstaller(options);

  if (command === 'install') {
    installer.install().then((result) => {
      process.exit(result.success ? 0 : 1);
    });
  } else if (command === 'uninstall') {
    installer.uninstall().then((result) => {
      process.exit(result.success ? 0 : 1);
    });
  } else {
    console.error(`Unknown command: ${command}`);
    console.log(
      'Usage: node install-hooks.js [install|uninstall] [--force] [--verbose]'
    );
    process.exit(1);
  }
}

module.exports = HooksInstaller;
