/**
 * Hook Configuration Validator
 * Validates hook configuration files and ensures consistency
 * Requirements: 6.4, 8.4
 */

const fs = require('fs');
const path = require('path');

class ConfigValidator {
  constructor() {
    this.configPath = path.join(process.cwd(), '.husky', 'hooks-config.json');
    this.templatePath = path.join(__dirname, 'hooks-config.template.json');
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate the hook configuration file
   * @returns {Object} Validation result with errors and warnings
   */
  validate() {
    this.errors = [];
    this.warnings = [];

    // Check if config file exists
    if (!fs.existsSync(this.configPath)) {
      this.errors.push({
        type: 'missing_config',
        message: 'Hook configuration file not found',
        path: this.configPath,
        remediation: 'Run: npm run hooks:init to create configuration',
      });
      return this.getResult();
    }

    // Load and parse configuration
    let config;
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      config = JSON.parse(configContent);
    } catch (error) {
      this.errors.push({
        type: 'invalid_json',
        message: 'Configuration file contains invalid JSON',
        error: error.message,
        remediation: 'Fix JSON syntax errors or restore from template',
      });
      return this.getResult();
    }

    // Validate structure
    this.validateStructure(config);

    // Validate individual hook configurations
    this.validatePreCommitConfig(config.preCommit);
    this.validateCommitMsgConfig(config.commitMsg);
    this.validatePrePushConfig(config.prePush);
    this.validatePostCommitConfig(config.postCommit);
    this.validatePostMergeConfig(config.postMerge);
    this.validateGitHubActionsSync(config.githubActionsSync);

    // Check for deprecated options
    this.checkDeprecatedOptions(config);

    // Validate consistency
    this.validateConsistency(config);

    return this.getResult();
  }

  /**
   * Validate overall configuration structure
   */
  validateStructure(config) {
    const requiredSections = [
      'preCommit',
      'commitMsg',
      'prePush',
      'postCommit',
      'postMerge',
    ];

    requiredSections.forEach((section) => {
      if (!config[section]) {
        this.errors.push({
          type: 'missing_section',
          section,
          message: `Required configuration section '${section}' is missing`,
          remediation: 'Add the missing section or restore from template',
        });
      } else if (typeof config[section] !== 'object') {
        this.errors.push({
          type: 'invalid_section',
          section,
          message: `Configuration section '${section}' must be an object`,
          remediation: 'Fix the section structure or restore from template',
        });
      }
    });
  }

  /**
   * Validate pre-commit configuration
   */
  validatePreCommitConfig(config) {
    if (!config) return;

    const validOptions = [
      'linting',
      'testing',
      'contextValidation',
      'gatekeeper',
    ];
    this.validateBooleanOptions('preCommit', config, validOptions);

    // Warn if all validations are disabled
    if (!config.linting && !config.testing && !config.contextValidation) {
      this.warnings.push({
        type: 'weak_validation',
        section: 'preCommit',
        message: 'All pre-commit validations are disabled',
        recommendation: 'Enable at least linting or testing for code quality',
      });
    }
  }

  /**
   * Validate commit message configuration
   */
  validateCommitMsgConfig(config) {
    if (!config) return;

    const validOptions = ['bmadPattern', 'conventionalCommits'];
    this.validateBooleanOptions('commitMsg', config, validOptions);

    // Warn if both patterns are disabled
    if (!config.bmadPattern && !config.conventionalCommits) {
      this.warnings.push({
        type: 'no_validation',
        section: 'commitMsg',
        message: 'No commit message validation is enabled',
        recommendation:
          'Enable bmadPattern or conventionalCommits for message validation',
      });
    }
  }

  /**
   * Validate pre-push configuration
   */
  validatePrePushConfig(config) {
    if (!config) return;

    const validOptions = ['fullTests', 'build', 'security', 'bmadSync'];
    this.validateBooleanOptions('prePush', config, validOptions);

    // Warn if security audit is disabled
    if (!config.security) {
      this.warnings.push({
        type: 'security_disabled',
        section: 'prePush',
        message: 'Security audit is disabled in pre-push',
        recommendation:
          'Enable security audits to catch vulnerabilities before pushing',
      });
    }

    // Warn if full tests are disabled
    if (!config.fullTests) {
      this.warnings.push({
        type: 'tests_disabled',
        section: 'prePush',
        message: 'Full test suite is disabled in pre-push',
        recommendation:
          'Enable full tests to ensure code quality before pushing',
      });
    }
  }

  /**
   * Validate post-commit configuration
   */
  validatePostCommitConfig(config) {
    if (!config) return;

    const validOptions = [
      'metrics',
      'documentation',
      'notifications',
      'contextUpdate',
    ];
    this.validateBooleanOptions('postCommit', config, validOptions);
  }

  /**
   * Validate post-merge configuration
   */
  validatePostMergeConfig(config) {
    if (!config) return;

    const validOptions = ['workflow', 'validation', 'reporting', 'personaSync'];
    this.validateBooleanOptions('postMerge', config, validOptions);

    // Warn if workflow automation is disabled
    if (!config.workflow) {
      this.warnings.push({
        type: 'workflow_disabled',
        section: 'postMerge',
        message: 'BMAD workflow automation is disabled in post-merge',
        recommendation:
          'Enable workflow to maintain BMAD automation after merges',
      });
    }
  }

  /**
   * Validate GitHub Actions sync configuration
   */
  validateGitHubActionsSync(config) {
    if (!config) return;

    const validOptions = [
      'enabled',
      'monitorConsistency',
      'reportInconsistencies',
    ];
    this.validateBooleanOptions('githubActionsSync', config, validOptions);

    // Warn if sync is disabled
    if (!config.enabled) {
      this.warnings.push({
        type: 'sync_disabled',
        section: 'githubActionsSync',
        message: 'GitHub Actions synchronization is disabled',
        recommendation:
          'Enable sync to maintain consistency between local and remote validation',
      });
    }
  }

  /**
   * Validate boolean options in a configuration section
   */
  validateBooleanOptions(section, config, validOptions) {
    Object.keys(config).forEach((key) => {
      if (!validOptions.includes(key)) {
        this.warnings.push({
          type: 'unknown_option',
          section,
          option: key,
          message: `Unknown option '${key}' in ${section} configuration`,
          recommendation: 'Remove unknown option or check for typos',
        });
      } else if (typeof config[key] !== 'boolean') {
        this.errors.push({
          type: 'invalid_type',
          section,
          option: key,
          message: `Option '${key}' in ${section} must be a boolean`,
          remediation: `Set ${key} to true or false`,
        });
      }
    });
  }

  /**
   * Check for deprecated configuration options
   */
  checkDeprecatedOptions(config) {
    const deprecated = {
      'preCommit.fastTests': 'Use testing instead',
      'prePush.coverage': 'Coverage is now included in fullTests',
    };

    Object.entries(deprecated).forEach(([path, message]) => {
      const [section, option] = path.split('.');
      if (config[section] && config[section][option] !== undefined) {
        this.warnings.push({
          type: 'deprecated_option',
          section,
          option,
          message: `Option '${option}' in ${section} is deprecated`,
          recommendation: message,
        });
      }
    });
  }

  /**
   * Validate consistency across configuration sections
   */
  validateConsistency(config) {
    // If BMAD sync is enabled in pre-push, context validation should be enabled in pre-commit
    if (config.prePush?.bmadSync && !config.preCommit?.contextValidation) {
      this.warnings.push({
        type: 'inconsistent_config',
        message: 'BMAD sync is enabled but context validation is disabled',
        recommendation:
          'Enable preCommit.contextValidation for consistent BMAD workflow',
      });
    }

    // If GitHub Actions sync is enabled, monitoring should be enabled
    if (
      config.githubActionsSync?.enabled &&
      !config.githubActionsSync?.monitorConsistency
    ) {
      this.warnings.push({
        type: 'incomplete_sync',
        message:
          'GitHub Actions sync is enabled but consistency monitoring is disabled',
        recommendation:
          'Enable githubActionsSync.monitorConsistency for full sync benefits',
      });
    }
  }

  /**
   * Get validation result
   */
  getResult() {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalIssues: this.errors.length + this.warnings.length,
        errors: this.errors.length,
        warnings: this.warnings.length,
      },
    };
  }

  /**
   * Generate a detailed validation report
   */
  generateReport() {
    const result = this.validate();
    let report = '# Hook Configuration Validation Report\n\n';

    report += `**Status:** ${result.valid ? '✅ Valid' : '❌ Invalid'}\n`;
    report += `**Total Issues:** ${result.summary.totalIssues}\n`;
    report += `**Errors:** ${result.summary.errors}\n`;
    report += `**Warnings:** ${result.summary.warnings}\n\n`;

    if (result.errors.length > 0) {
      report += '## Errors\n\n';
      result.errors.forEach((error, index) => {
        report += `### ${index + 1}. ${error.message}\n\n`;
        report += `- **Type:** ${error.type}\n`;
        if (error.section) report += `- **Section:** ${error.section}\n`;
        if (error.option) report += `- **Option:** ${error.option}\n`;
        if (error.remediation)
          report += `- **Remediation:** ${error.remediation}\n`;
        report += '\n';
      });
    }

    if (result.warnings.length > 0) {
      report += '## Warnings\n\n';
      result.warnings.forEach((warning, index) => {
        report += `### ${index + 1}. ${warning.message}\n\n`;
        report += `- **Type:** ${warning.type}\n`;
        if (warning.section) report += `- **Section:** ${warning.section}\n`;
        if (warning.option) report += `- **Option:** ${warning.option}\n`;
        if (warning.recommendation)
          report += `- **Recommendation:** ${warning.recommendation}\n`;
        report += '\n';
      });
    }

    if (result.valid && result.warnings.length === 0) {
      report += '## Summary\n\n';
      report += 'Configuration is valid with no issues detected. ✅\n';
    }

    return report;
  }

  /**
   * Fix common configuration issues automatically
   */
  autoFix() {
    const result = this.validate();
    const fixes = [];

    // Can't auto-fix if config doesn't exist or has invalid JSON
    if (
      result.errors.some(
        (e) => e.type === 'missing_config' || e.type === 'invalid_json'
      )
    ) {
      return {
        success: false,
        message:
          'Cannot auto-fix: configuration file is missing or has invalid JSON',
        fixes: [],
      };
    }

    // Load current config
    const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));

    // Fix invalid types
    result.errors.forEach((error) => {
      if (error.type === 'invalid_type' && error.section && error.option) {
        config[error.section][error.option] = false;
        fixes.push(
          `Set ${error.section}.${error.option} to false (was invalid type)`
        );
      }
    });

    // Remove deprecated options
    result.warnings.forEach((warning) => {
      if (
        warning.type === 'deprecated_option' &&
        warning.section &&
        warning.option
      ) {
        delete config[warning.section][warning.option];
        fixes.push(
          `Removed deprecated option ${warning.section}.${warning.option}`
        );
      }
    });

    // Save fixed configuration
    if (fixes.length > 0) {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4));
      return {
        success: true,
        message: `Auto-fixed ${fixes.length} issue(s)`,
        fixes,
      };
    }

    return {
      success: true,
      message: 'No auto-fixable issues found',
      fixes: [],
    };
  }
}

module.exports = ConfigValidator;
