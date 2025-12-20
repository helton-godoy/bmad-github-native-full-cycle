#!/usr/bin/env node

/**
 * Hook Testing Utility
 * Tests Git hooks functionality for BMAD automation
 */

const HookOrchestrator = require('./hook-orchestrator');

async function testHooks() {
    console.log('🔧 Testing Git Hooks Infrastructure...\n');

    const orchestrator = new HookOrchestrator({
        enableLinting: true,
        enableTesting: true,
        enableContextValidation: true
    });

    try {
        // Test pre-commit hook
        console.log('Testing pre-commit hook...');
        const preCommitResult = await orchestrator.executePreCommit(['test.js', 'example.md']);
        console.log('Pre-commit result:', preCommitResult);
        console.log('✅ Pre-commit hook test completed\n');

        // Test commit-msg hook
        console.log('Testing commit-msg hook...');
        const commitMsgResult = await orchestrator.executeCommitMsg('[DEVELOPER] [STEP-001] Test commit message');
        console.log('Commit-msg result:', commitMsgResult);
        console.log('✅ Commit-msg hook test completed\n');

        // Test pre-push hook
        console.log('Testing pre-push hook...');
        const prePushResult = await orchestrator.executePrePush('main', 'origin');
        console.log('Pre-push result:', prePushResult);
        console.log('✅ Pre-push hook test completed\n');

        console.log('🎉 All hook tests completed successfully!');

    } catch (error) {
        console.error('❌ Hook testing failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    testHooks();
}

module.exports = { testHooks };