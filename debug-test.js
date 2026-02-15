// Debug test to understand the issue
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');

async function debugTest() {
    try {
        console.log('Creating HookOrchestrator...');
        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        console.log('Orchestrator created successfully');

        console.log('Testing executePrePush...');
        const result = await orchestrator.executePrePush('main', 'origin');

        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugTest();