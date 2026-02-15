#!/usr/bin/env node

/**
 * Example demonstrating HookErrorHandler usage in Git hooks
 * This shows how to integrate error handling into hook scripts
 */

const HookErrorHandler = require('./hook-error-handler');

// Initialize error handler
const errorHandler = new HookErrorHandler({
  enableAutoRecovery: true,
  enableBypass: process.env.BMAD_DEV_MODE === 'true',
  auditLogPath: '.git/hooks/audit.log',
});

/**
 * Example 1: Handling a lint error with automatic recovery
 */
async function exampleLintError() {
  console.log('\n=== Example 1: Lint Error with Auto-Recovery ===\n');

  const error = new Error('Lint error: missing semicolon on line 42');
  const context = {
    hookType: 'pre-commit',
    stagedFiles: ['src/example.js', 'src/utils.js'],
  };

  const result = await errorHandler.handleHookError(
    'pre-commit',
    error,
    context
  );

  console.log('Classification:', result.classification.category);
  console.log('Severity:', result.classification.severity);
  console.log('Recovery Successful:', result.recovery.successful);
  console.log('Should Block:', result.shouldBlock);

  if (result.recovery.successful) {
    console.log('\n✓ Auto-recovery succeeded:', result.recovery.details);
  }
}

/**
 * Example 2: Handling a test failure (blocking, non-recoverable)
 */
async function exampleTestFailure() {
  console.log('\n=== Example 2: Test Failure (Blocking) ===\n');

  const error = new Error('Test suite failed with 3 failures');
  const context = {
    hookType: 'pre-push',
  };

  const result = await errorHandler.handleHookError('pre-push', error, context);

  console.log('Classification:', result.classification.category);
  console.log('Severity:', result.classification.severity);
  console.log('Should Block:', result.shouldBlock);

  console.log('\nRemediation Steps:');
  result.report.remediation.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });
}

/**
 * Example 3: Handling a warning with bypass options
 */
async function exampleWarningWithBypass() {
  console.log('\n=== Example 3: Warning with Bypass Options ===\n');

  const error = new Error('Context not updated for current session');
  const context = {
    hookType: 'pre-commit',
  };

  const result = await errorHandler.handleHookError(
    'pre-commit',
    error,
    context
  );

  console.log('Classification:', result.classification.category);
  console.log('Severity:', result.classification.severity);
  console.log('Should Block:', result.shouldBlock);

  if (result.report.bypassOptions.available) {
    console.log('\nBypass Options Available:');
    result.report.bypassOptions.methods.forEach((method) => {
      console.log(`  - ${method.name}: ${method.description}`);
      console.log(`    Command: ${method.command}`);
    });
  }
}

/**
 * Example 4: Handling a non-blocking error
 */
async function exampleNonBlockingError() {
  console.log('\n=== Example 4: Non-Blocking Error ===\n');

  const error = new Error('Notification failed to send');
  const context = {
    hookType: 'post-commit',
  };

  const result = await errorHandler.handleHookError(
    'post-commit',
    error,
    context
  );

  console.log('Classification:', result.classification.category);
  console.log('Severity:', result.classification.severity);
  console.log('Should Block:', result.shouldBlock);

  console.log('\nImpact Assessment:');
  console.log('  Workflow:', result.report.impact.workflow);
  console.log('  Team:', result.report.impact.team);
  console.log('  Project:', result.report.impact.project);
}

/**
 * Example 5: Recording a bypass action
 */
function exampleBypassRecording() {
  console.log('\n=== Example 5: Recording Bypass Action ===\n');

  const classification = {
    category: 'MISSING_CONTEXT_UPDATE',
    severity: 'warning',
  };

  const record = errorHandler.recordBypass(
    'pre-commit',
    classification,
    'development-mode',
    'Testing new feature without context update'
  );

  console.log('Bypass Recorded:');
  console.log('  Timestamp:', record.timestamp);
  console.log('  Hook Type:', record.hookType);
  console.log('  Error Category:', record.errorCategory);
  console.log('  Method:', record.bypassMethod);
  console.log('  Reason:', record.reason);
}

/**
 * Example 6: Retrieving bypass audit trail
 */
function exampleAuditTrail() {
  console.log('\n=== Example 6: Bypass Audit Trail ===\n');

  const trail = errorHandler.getBypassAuditTrail();

  if (trail.length === 0) {
    console.log('No bypass actions recorded yet.');
  } else {
    console.log(`Found ${trail.length} bypass action(s):\n`);
    trail.forEach((record, i) => {
      console.log(`${i + 1}. ${record.timestamp}`);
      console.log(`   Hook: ${record.hookType}`);
      console.log(`   Category: ${record.errorCategory}`);
      console.log(`   Method: ${record.bypassMethod}`);
      console.log(`   Reason: ${record.reason}\n`);
    });
  }
}

// Run examples
async function runExamples() {
  try {
    await exampleLintError();
    await exampleTestFailure();
    await exampleWarningWithBypass();
    await exampleNonBlockingError();
    exampleBypassRecording();
    exampleAuditTrail();

    console.log('\n=== All Examples Completed ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runExamples();
}

module.exports = { runExamples };
