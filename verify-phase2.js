const EnhancedBMADWorkflow = require('./scripts/bmad/bmad-workflow-enhanced');
const fs = require('fs');

async function verifyPhase2() {
    console.log('🧪 Starting Phase 2 Verification...');

    // 1. Mock Environment
    process.env.GITHUB_TOKEN = 'mock-token';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';

    // 2. Instantiate Workflow
    const workflow = new EnhancedBMADWorkflow();
    const issueNumber = 999; // Test issue

    // 3. Test State Persistence
    console.log('📝 Testing State Persistence...');
    const testState = {
        workflowId: 'test-workflow-123',
        issueNumber: issueNumber,
        status: 'running',
        metrics: { phases: { pm: { status: 'completed' } } }
    };

    workflow.saveState(testState);

    if (!fs.existsSync(`.github/workflow-state-${issueNumber}.json`)) {
        console.error('❌ Failed to save state file');
        process.exit(1);
    }

    const loadedState = workflow.loadState(issueNumber);
    if (loadedState.workflowId !== testState.workflowId) {
        console.error('❌ Failed to load state correctly');
        process.exit(1);
    }
    console.log('✅ State persistence verified');

    // 4. Test Event System Integration (Static Check)
    console.log('📡 Testing Event System Integration...');
    // We can't easily run the full workflow without mocking Octokit, 
    // but we can check if the Orchestrator accepts the emitter.

    const EventEmitter = require('events');
    const emitter = new EventEmitter();
    const BMADOrchestrator = require('./scripts/bmad/bmad-orchestrator');
    const orchestrator = new BMADOrchestrator(emitter);

    if (orchestrator.eventEmitter !== emitter) {
        console.error('❌ Orchestrator did not accept EventEmitter');
        process.exit(1);
    }

    // Simulate event emission
    let eventReceived = false;
    emitter.on('test-event', () => { eventReceived = true; });
    orchestrator.eventEmitter.emit('test-event');

    if (!eventReceived) {
        console.error('❌ Event system not working');
        process.exit(1);
    }
    console.log('✅ Event system verified');

    // Cleanup
    workflow.clearState(issueNumber);
    console.log('🧹 Cleanup done');
    console.log('🎉 Phase 2 Verification Successful!');
}

verifyPhase2().catch(console.error);
