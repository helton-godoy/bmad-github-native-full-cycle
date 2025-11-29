/**
 * @ai-context Unit Tests for BMAD Orchestrator
 */
const { mockOctokit, mockContextManager, mockLogger } = require('../mocks/bmad-mocks');

// Mock dependencies BEFORE importing the class under test
jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

jest.mock('../../scripts/lib/context-manager', () => {
    return jest.fn().mockImplementation(() => mockContextManager);
});

jest.mock('../../scripts/lib/logger', () => {
    return jest.fn().mockImplementation(() => mockLogger);
});

// Mock Personas to avoid loading real files and dependencies
const mockExecute = jest.fn().mockResolvedValue({ status: 'completed' });
const MockPersona = jest.fn().mockImplementation(() => ({
    execute: mockExecute
}));

jest.mock('../../personas/project-manager', () => MockPersona);
jest.mock('../../personas/architect', () => MockPersona);
jest.mock('../../personas/developer-enhanced', () => MockPersona);
jest.mock('../../personas/qa', () => MockPersona);
jest.mock('../../personas/security', () => MockPersona);
jest.mock('../../personas/devops', () => MockPersona);
jest.mock('../../personas/release-manager', () => MockPersona);

const BMADOrchestrator = require('../../scripts/bmad/bmad-orchestrator');

describe('BMADOrchestrator', () => {
    let orchestrator;
    let eventEmitter;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup default environment
        process.env.GITHUB_TOKEN = 'test-token';
        process.env.GITHUB_OWNER = 'test-owner';
        process.env.GITHUB_REPO = 'test-repo';

        // Mock EventEmitter
        eventEmitter = {
            emit: jest.fn(),
            on: jest.fn()
        };

        orchestrator = new BMADOrchestrator(eventEmitter);
    });

    describe('orchestrate', () => {
        it('should handle initial state correctly', async () => {
            // Setup mocks
            mockContextManager.read.mockReturnValue(null); // No existing handover state
            mockOctokit.rest.issues.get.mockResolvedValue({
                data: { title: 'Feature Request', body: 'Description', number: 1 }
            });

            const result = await orchestrator.orchestrate(1);

            expect(result).toBe(true); // Action taken
            expect(mockContextManager.write).toHaveBeenCalled(); // State updated
            expect(eventEmitter.emit).toHaveBeenCalledWith('action-determined', expect.objectContaining({
                persona: 'pm',
                nextPhase: 'Planning'
            }));
        });

        it('should detect AUDIT mode from issue title', async () => {
            mockContextManager.read.mockReturnValue(null);
            mockOctokit.rest.issues.get.mockResolvedValue({
                data: { title: '[AUDIT] Security Check', body: 'Audit request', number: 2 }
            });

            await orchestrator.orchestrate(2);

            expect(eventEmitter.emit).toHaveBeenCalledWith('action-determined', expect.objectContaining({
                source: 'Audit Request'
            }));
        });

        it('should handle PM -> Architect transition', async () => {
            // Mock state: PM finished Planning
            const stateContent = `
Current Persona: **[PM]**
Current Phase

**Planning**

Retry Count: 0
Issue: #3
            `;
            mockContextManager.read.mockReturnValue(stateContent);

            mockOctokit.rest.issues.get.mockResolvedValue({
                data: { title: 'Feature', number: 3 }
            });

            // Mock PRD existence
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue('## Architect Prompt\nDesign the system.');

            await orchestrator.orchestrate(3);

            expect(eventEmitter.emit).toHaveBeenCalledWith('action-determined', expect.objectContaining({
                persona: 'architect',
                nextPhase: 'Architecture Design'
            }));
        });

        it('should handle Retry Logic when artifact is missing', async () => {
            // Mock state: PM finished Planning but PRD missing
            const stateContent = `
Current Persona: **[PM]**
Current Phase

**Planning**

Retry Count: 0
Issue: #4
            `;
            mockContextManager.read.mockReturnValue(stateContent);

            mockOctokit.rest.issues.get.mockResolvedValue({
                data: { title: 'Feature', number: 4 }
            });

            // Mock PRD MISSING
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            await orchestrator.orchestrate(4);

            expect(eventEmitter.emit).toHaveBeenCalledWith('action-determined', expect.objectContaining({
                persona: 'pm', // Should retry PM
                source: 'System Init'
            }));

            // Verify retry increment in state update (mocked via write)
            // In a real integration test we'd check the file, here we check the logic flow
        });

        it('should stop workflow when MAX_RETRIES reached', async () => {
            // Mock state: PM finished Planning but PRD missing, Retry = 3
            const stateContent = `
Current Persona: **[PM]**
Current Phase

**Planning**

Retry Count: 3
Issue: #5
            `;
            mockContextManager.read.mockReturnValue(stateContent);
            mockOctokit.rest.issues.get.mockResolvedValue({
                data: { title: 'Feature', number: 5 }
            });
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            const result = await orchestrator.orchestrate(5);

            expect(result).toBe(false); // No action taken (stopped)
            // Should verify error logging if we mocked console.error
        });
    });
});
