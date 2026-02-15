#!/usr/bin/env node

/**
 * BMAD Enhanced Gatekeeper
 * Provides robust validation with mock data, development mode bypass, and comprehensive error reporting
 */

const path = require('path');
const EnhancedGatekeeper = require('../lib/enhanced-gatekeeper');

async function main() {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
  };

  console.log(`${colors.yellow}🛡️  BMAD Enhanced Gatekeeper 🛡️${colors.reset}`);

  try {
    // Load configuration from package.json
    let config = { requireContextUpdate: true };
    try {
      const pkg = require(path.join(process.cwd(), 'package.json'));
      if (pkg.bmad) {
        config = { ...config, ...pkg.bmad };
      }
    } catch (error) {
      console.warn('Could not load package.json configuration, using defaults');
    }

    // Create enhanced gatekeeper instance
    const gatekeeper = new EnhancedGatekeeper(config);

    // Get commit message from command line arguments
    const commitMessage = process.argv[2];

    // Prepare validation context
    const context = {
      commitMessage: commitMessage,
      timestamp: new Date().toISOString(),
    };

    // Run validation
    const result = await gatekeeper.validateWorkflowConditions(context);

    // Output structured result for potential consumption by other tools
    if (process.env.BMAD_OUTPUT_JSON === 'true') {
      console.log(JSON.stringify(result, null, 2));
    }

    // Exit with appropriate code
    if (result.gate === 'PASS' || result.gate === 'WAIVED') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `${colors.red}❌ Enhanced Gatekeeper failed with error:${colors.reset}`
    );
    console.error(error.message);

    if (process.env.BMAD_DEBUG === 'true') {
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main };
