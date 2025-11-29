const EnhancedBMADWorkflow = require('../../scripts/bmad/bmad-workflow-enhanced');
const fs = require('fs');
const path = require('path');

// Mock Orchestrator to avoid real execution
jest.mock('../../scripts/bmad/bmad-orchestrator', () => {
    return class MockOrchestrator {
        constructor(emitter) {
            this.eventEmitter = emitter;
        }
        async orchestrate() {
            // Simulate work
            if (this.eventEmitter) {
                this.eventEmitter.emit('phase-completed', { persona: 'Test', nextPhase: 'Next' });
            }
            return true; // Keep running
        }
    };
});

describe('EnhancedBMADWorkflow Integration', () => {
    let workflow;
    const issueNumber = 12345;
    const stateFile = `.github/workflow-state-${issueNumber}.json`;

    beforeEach(() => {
        process.env.GITHUB_TOKEN = 'test-token';
        workflow = new EnhancedBMADWorkflow();
        // Mock delay to speed up tests
        workflow.delay = jest.fn().mockResolvedValue();
        // Mock generateWorkflowReport to avoid file writing
        workflow.generateWorkflowReport = jest.fn().mockResolvedValue();
        workflow.logWorkflow = jest.fn();
    });

    afterEach(() => {
        if (fs.existsSync(stateFile)) {
            fs.unlinkSync(stateFile);
        }
        jest.clearAllMocks();
    });

    test('should save state during execution', async () => {
        // We'll modify the loop condition in the real class via mocking or just run it.
        // Since we can't easily inject into the loop, we'll rely on the side effect (file creation).

        // To prevent infinite loop in test if logic fails, we rely on MAX_STEPS in the code.
        // But we want to test just one iteration or so.
        // The mock orchestrator returns true, so it will run until MAX_STEPS.
        // Let's spy on saveState.

        const saveStateSpy = jest.spyOn(workflow, 'saveState');

        // Run workflow (it will run for MAX_STEPS which is 20, might be slow? No, delay is mocked)
        await workflow.executeWorkflow(issueNumber);

        expect(saveStateSpy).toHaveBeenCalled();
        expect(fs.existsSync(stateFile)).toBe(false); // Should be cleared at end
    });

    test('should resume from existing state', async () => {
        const initialState = {
            workflowId: 'resume-test-id',
            issueNumber: issueNumber,
            status: 'running',
            metrics: { phases: { pm: { status: 'completed' } } }
        };

        fs.writeFileSync(stateFile, JSON.stringify(initialState));

        const consoleSpy = jest.spyOn(console, 'log');

        await workflow.executeWorkflow(issueNumber);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Resuming existing workflow resume-test-id'));
        expect(workflow.workflowMetrics.phases.pm).toBeDefined();
    });
});
