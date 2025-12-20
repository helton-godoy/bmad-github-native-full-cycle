/**
 * @ai-context Example usage of the enhanced CommitHandler
 * @ai-invariant Demonstrates proper commit handling patterns for BMAD system
 */

const CommitHandler = require('../scripts/lib/commit-handler');

async function demonstrateCommitHandler() {
  console.log('=== CommitHandler Usage Example ===\n');

  // Create a new commit handler instance
  const commitHandler = new CommitHandler({
    maxRetries: 2,
    validateStaging: true,
    validateFormat: true,
    enableRollback: true,
  });

  // Example 1: Format commit messages
  console.log('1. Formatting commit messages:');
  const message1 = commitHandler.formatCommitMessage(
    'developer',
    '1',
    'Add user authentication'
  );
  const message2 = commitHandler.formatCommitMessage(
    'ARCHITECT',
    '42',
    'Design database schema'
  );
  console.log(`   - ${message1}`);
  console.log(`   - ${message2}\n`);

  // Example 2: Validate commit message formats
  console.log('2. Validating commit message formats:');

  const validMessage = '[DEVELOPER] [STEP-001] Add user authentication';
  const invalidMessage = 'Fix bug';
  const lowercaseMessage = '[developer] [STEP-001] Add feature';

  console.log(`   Valid message: "${validMessage}"`);
  const validResult = commitHandler.validateMessageFormat(validMessage);
  console.log(`   Result: ${validResult.valid ? 'VALID' : 'INVALID'}`);

  console.log(`\n   Invalid message: "${invalidMessage}"`);
  const invalidResult = commitHandler.validateMessageFormat(invalidMessage);
  console.log(`   Result: ${invalidResult.valid ? 'VALID' : 'INVALID'}`);
  console.log(`   Errors: ${invalidResult.errors.join(', ')}`);

  console.log(`\n   Lowercase persona: "${lowercaseMessage}"`);
  const lowercaseResult = commitHandler.validateMessageFormat(lowercaseMessage);
  console.log(`   Result: ${lowercaseResult.valid ? 'VALID' : 'INVALID'}`);
  console.log(`   Errors: ${lowercaseResult.errors.join(', ')}\n`);

  // Example 3: Generate error reports
  console.log('3. Error report for invalid message:');
  const errorReport = commitHandler.generateFormatErrorReport(invalidResult);
  console.log(errorReport);

  // Example 4: Attempt to correct common format issues
  console.log('4. Correcting common format issues:');
  const messagesToCorrect = [
    '[developer] [STEP-001] Add feature',
    '[DEVELOPER] [001] Add feature',
    'DEVELOPER: Add feature',
  ];

  messagesToCorrect.forEach((msg) => {
    const correction = commitHandler.correctMessageFormat(msg);
    console.log(`   Original: "${msg}"`);
    console.log(`   Corrected: "${correction.correctedMessage}"`);
    console.log(`   Changes: ${correction.corrections.join(', ')}\n`);
  });

  console.log('=== Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateCommitHandler().catch(console.error);
}

module.exports = { demonstrateCommitHandler };
