#!/usr/bin/env node

/**
 * Hook Configuration Validation CLI
 * Command-line tool for validating and managing hook configuration
 * Requirements: 6.4, 8.4
 */

const ConfigValidator = require('./config-validator');
const fs = require('fs');
const path = require('path');

class ConfigCLI {
    constructor() {
        this.validator = new ConfigValidator();
    }

    /**
     * Run validation and display results
     */
    validate(options = {}) {
        console.log('🔍 Validating hook configuration...\n');

        const result = this.validator.validate();

        if (result.valid && result.warnings.length === 0) {
            console.log('✅ Configuration is valid with no issues\n');
            this.displaySummary(result);
            return 0;
        }

        if (result.valid && result.warnings.length > 0) {
            console.log('✅ Configuration is valid but has warnings\n');
            this.displayWarnings(result.warnings);
            this.displaySummary(result);
            return 0;
        }

        console.log('❌ Configuration validation failed\n');
        this.displayErrors(result.errors);
        if (result.warnings.length > 0) {
            this.displayWarnings(result.warnings);
        }
        this.displaySummary(result);

        if (options.fix) {
            console.log('\n🔧 Attempting auto-fix...\n');
            const fixResult = this.validator.autoFix();
            if (fixResult.success) {
                console.log(`✅ ${fixResult.message}`);
                if (fixResult.fixes.length > 0) {
                    console.log('\nFixes applied:');
                    fixResult.fixes.forEach(fix => {
                        console.log(`   • ${fix}`);
                    });
                }
                console.log('\n💡 Run validation again to verify fixes');
                return 0;
            } else {
                console.log(`❌ ${fixResult.message}`);
                return 1;
            }
        }

        return 1;
    }

    /**
     * Display errors
     */
    displayErrors(errors) {
        console.log('🚫 ERRORS:\n');
        errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error.message}`);
            if (error.section) console.log(`   Section: ${error.section}`);
            if (error.option) console.log(`   Option: ${error.option}`);
            if (error.remediation) console.log(`   Fix: ${error.remediation}`);
            console.log('');
        });
    }

    /**
     * Display warnings
     */
    displayWarnings(warnings) {
        console.log('⚠️  WARNINGS:\n');
        warnings.forEach((warning, index) => {
            console.log(`${index + 1}. ${warning.message}`);
            if (warning.section) console.log(`   Section: ${warning.section}`);
            if (warning.option) console.log(`   Option: ${warning.option}`);
            if (warning.recommendation) console.log(`   Recommendation: ${warning.recommendation}`);
            console.log('');
        });
    }

    /**
     * Display summary
     */
    displaySummary(result) {
        console.log('📊 SUMMARY:');
        console.log(`   Total issues: ${result.summary.totalIssues}`);
        console.log(`   Errors: ${result.summary.errors}`);
        console.log(`   Warnings: ${result.summary.warnings}`);
    }

    /**
     * Generate and save validation report
     */
    generateReport(outputPath) {
        console.log('📄 Generating validation report...\n');

        const report = this.validator.generateReport();
        const reportPath = outputPath || path.join(process.cwd(), 'hook-config-validation.md');

        fs.writeFileSync(reportPath, report);

        console.log(`✅ Report generated: ${reportPath}\n`);
        return 0;
    }

    /**
     * Display current configuration
     */
    showConfig() {
        const configPath = this.validator.configPath;

        if (!fs.existsSync(configPath)) {
            console.log('❌ Configuration file not found');
            console.log(`   Expected location: ${configPath}`);
            console.log('   Run: npm run hooks:install');
            return 1;
        }

        console.log('📋 Current Hook Configuration:\n');
        console.log(`Location: ${configPath}\n`);

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(JSON.stringify(config, null, 2));
        console.log('');

        return 0;
    }

    /**
     * Reset configuration to template
     */
    resetConfig(options = {}) {
        const configPath = this.validator.configPath;
        const templatePath = this.validator.templatePath;

        if (!fs.existsSync(templatePath)) {
            console.log('❌ Configuration template not found');
            console.log(`   Expected location: ${templatePath}`);
            return 1;
        }

        if (fs.existsSync(configPath) && !options.force) {
            console.log('⚠️  Configuration file already exists');
            console.log('   Use --force to overwrite');
            return 1;
        }

        console.log('🔄 Resetting configuration to template...\n');

        const template = fs.readFileSync(templatePath, 'utf8');
        fs.writeFileSync(configPath, template);

        console.log(`✅ Configuration reset: ${configPath}\n`);
        return 0;
    }

    /**
     * Display help
     */
    showHelp() {
        console.log(`
BMAD Hook Configuration Validator

Usage: node validate-config.js [command] [options]

Commands:
  validate              Validate hook configuration (default)
  report [path]         Generate validation report
  show                  Display current configuration
  reset                 Reset configuration to template

Options:
  --fix                 Auto-fix common issues
  --force               Force overwrite (for reset command)
  --help, -h            Show this help message

Examples:
  node validate-config.js
  node validate-config.js validate --fix
  node validate-config.js report ./validation-report.md
  node validate-config.js show
  node validate-config.js reset --force

For more information, see: docs/hooks/README.md
`);
        return 0;
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'validate';
    const options = {
        fix: args.includes('--fix'),
        force: args.includes('--force') || args.includes('-f'),
        help: args.includes('--help') || args.includes('-h')
    };

    const cli = new ConfigCLI();

    if (options.help) {
        process.exit(cli.showHelp());
    }

    let exitCode = 0;

    switch (command) {
        case 'validate':
            exitCode = cli.validate(options);
            break;

        case 'report':
            const outputPath = args[1];
            exitCode = cli.generateReport(outputPath);
            break;

        case 'show':
            exitCode = cli.showConfig();
            break;

        case 'reset':
            exitCode = cli.resetConfig(options);
            break;

        case '--help':
        case '-h':
            exitCode = cli.showHelp();
            break;

        default:
            console.error(`Unknown command: ${command}`);
            console.log('Run with --help for usage information');
            exitCode = 1;
    }

    process.exit(exitCode);
}

module.exports = ConfigCLI;
