#!/usr/bin/env node

/**
 * Configure Test Mode - Script to configure different test execution modes
 * Usage: node scripts/configure-test-mode.js [mode]
 * Modes: development, ci, performance, minimal
 */

const fs = require('fs');
const path = require('path');

const modes = {
    development: {
        description: 'Development mode - Fast execution, minimal validation',
        jestConfig: {
            maxWorkers: 1,
            testTimeout: 5000,
            bail: 1,
            cache: false,
            verbose: false,
            silent: true,
            forceExit: true
        },
        envVars: {
            BMAD_DEV_MODE: 'true',
            BMAD_SKIP_AUDIT: 'true',
            NODE_OPTIONS: '--max-old-space-size=1024'
        }
    },

    ci: {
        description: 'CI mode - Comprehensive testing with resource limits',
        jestConfig: {
            maxWorkers: 2,
            testTimeout: 10000,
            bail: false,
            cache: true,
            verbose: true,
            silent: false,
            forceExit: true,
            ci: true
        },
        envVars: {
            CI: 'true',
            NODE_OPTIONS: '--max-old-space-size=2048'
        }
    },

    performance: {
        description: 'Performance mode - Optimized for speed',
        jestConfig: {
            maxWorkers: 1,
            testTimeout: 3000,
            bail: 1,
            cache: false,
            verbose: false,
            silent: true,
            forceExit: true,
            detectOpenHandles: false,
            testPathIgnorePatterns: ['/integration/', '/e2e/']
        },
        envVars: {
            BMAD_PERFORMANCE_MODE: 'true',
            BMAD_SKIP_INTEGRATION: 'true',
            NODE_OPTIONS: '--max-old-space-size=512'
        }
    },

    minimal: {
        description: 'Minimal mode - Only essential tests',
        jestConfig: {
            maxWorkers: 1,
            testTimeout: 2000,
            bail: 1,
            cache: false,
            verbose: false,
            silent: true,
            forceExit: true,
            testPathIgnorePatterns: ['/integration/', '/e2e/', '/property/'],
            testNamePattern: '^(?!.*property).*$'
        },
        envVars: {
            BMAD_MINIMAL_MODE: 'true',
            BMAD_SKIP_PROPERTY_TESTS: 'true',
            BMAD_SKIP_INTEGRATION: 'true',
            NODE_OPTIONS: '--max-old-space-size=256'
        }
    }
};

function updateJestConfig(modeConfig) {
    const jestConfigPath = path.join(process.cwd(), 'jest.config.js');

    if (!fs.existsSync(jestConfigPath)) {
        console.error('jest.config.js not found');
        process.exit(1);
    }

    // Read current config
    const currentConfig = require(jestConfigPath);

    // Merge with mode-specific config
    const newConfig = {
        ...currentConfig,
        ...modeConfig.jestConfig
    };

    // Write updated config
    const configContent = `module.exports = ${JSON.stringify(newConfig, null, 4)};`;
    fs.writeFileSync(jestConfigPath, configContent);

    console.log(`✅ Updated jest.config.js for ${getCurrentMode()} mode`);
}

function updateEnvFile(modeConfig) {
    const envPath = path.join(process.cwd(), '.env.test');

    // Create or update .env.test file
    const envContent = Object.entries(modeConfig.envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env.test for ${getCurrentMode()} mode`);
}

function getCurrentMode() {
    return process.argv[2] || 'development';
}

function showUsage() {
    console.log('Usage: node scripts/configure-test-mode.js [mode]\n');
    console.log('Available modes:');

    Object.entries(modes).forEach(([mode, config]) => {
        console.log(`  ${mode.padEnd(12)} - ${config.description}`);
    });

    console.log('\nExample: node scripts/configure-test-mode.js performance');
}

function main() {
    const mode = getCurrentMode();

    if (mode === 'help' || mode === '--help' || mode === '-h') {
        showUsage();
        return;
    }

    if (!modes[mode]) {
        console.error(`❌ Unknown mode: ${mode}`);
        showUsage();
        process.exit(1);
    }

    const modeConfig = modes[mode];

    console.log(`🔧 Configuring test environment for ${mode} mode`);
    console.log(`📝 ${modeConfig.description}\n`);

    try {
        updateJestConfig(modeConfig);
        updateEnvFile(modeConfig);

        console.log('\n✅ Configuration complete!');
        console.log('\nNext steps:');
        console.log('1. Run tests: npm test');
        console.log('2. Check performance: npm run test:performance');
        console.log('3. Reset to default: node scripts/configure-test-mode.js development');

    } catch (error) {
        console.error(`❌ Configuration failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { modes, updateJestConfig, updateEnvFile };