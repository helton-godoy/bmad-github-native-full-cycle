#!/usr/bin/env node

/**
 * Simple test script for commit message validation
 * This tests the commit-msg hook functionality
 */

const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');

async function testCommitMessageValidation() {
    console.log('🧪 Testing commit message validation...\n');

    const orchestrator = new HookOrchestrator({
        developmentMode: false,
        enableGatekeeper: false // Disable for simple test
    });

    const testCases = [
        {
            name: 'Valid BMAD message',
            message: '[DEVELOPER] [STEP-001] Implement user authentication',
            expectedSuccess: true
        },
        {
            name: 'Valid conventional commit',
            message: 'feat(auth): add user login functionality',
            expectedSuccess: true
        },
        {
            name: 'Invalid message format',
            message: 'just a regular commit message',
            expectedSuccess: false
        },
        {
            name: 'Empty message',
            message: '',
            expectedSuccess: false
        },
        {
            name: 'BMAD with invalid persona',
            message: '[INVALID] [STEP-001] Some description',
            expectedSuccess: true // Should pass with warning
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`📝 Testing: ${testCase.name}`);
        console.log(`   Message: "${testCase.message}"`);

        try {
            const result = await orchestrator.executeCommitMsg(testCase.message);

            if (result.success === testCase.expectedSuccess) {
                console.log(`   ✅ PASS - Expected: ${testCase.expectedSuccess}, Got: ${result.success}`);
                passed++;
            } else {
                console.log(`   ❌ FAIL - Expected: ${testCase.expectedSuccess}, Got: ${result.success}`);
                failed++;
            }

            if (result.validationSummary) {
                console.log(`   📋 Summary: ${result.validationSummary}`);
            }

            if (result.results?.messageValidation?.warnings?.length > 0) {
                console.log(`   ⚠️  Warnings: ${result.results.messageValidation.warnings.join(', ')}`);
            }

        } catch (error) {
            console.log(`   💥 ERROR: ${error.message}`);
            failed++;
        }

        console.log('');
    }

    console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed!');
        process.exit(1);
    }
}

testCommitMessageValidation().catch(error => {
    console.error('💥 Test script crashed:', error);
    process.exit(1);
});