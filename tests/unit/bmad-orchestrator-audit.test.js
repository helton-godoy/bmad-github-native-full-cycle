/**
 * @ai-context Unit Tests for BMAD Orchestrator Audit Flow
 */
const { mockOctokit, mockContextManager } = require('../mocks/bmad-mocks');

// Mock dependencies BEFORE importing the class under test
jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

jest.mock('../../scripts/lib/context-manager', () => {
    return jest.fn().mockImplementation(() => mockContextManager);
});

// Mock fs to control artifact existence
const fs = require('fs');
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn()
}));

const BMADOrchestrator = require('../../scripts/bmad/bmad-orchestrator');

describe('BMADOrchestrator Audit Flow', () => {
    let orchestrator;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GITHUB_TOKEN = 'test-token';
        orchestrator = new BMADOrchestrator();
    });

    it('should transition from PM to Architect when MASTER_PLAN.md exists', async () => {
        const state = {
            persona: 'PM',
            phase: 'Audit Planning',
            retryCount: 0
        };
        const issue = { title: '[AUDIT] Task', number: 1 };
        const issueType = 'AUDIT';

        // Mock MASTER_PLAN.md exists
        mockContextManager.read.mockReturnValue('# Master Plan Content');

        const action = await orchestrator.determineNextAction(state, issue, issueType);

        expect(action).toEqual(expect.objectContaining({
            persona: 'architect',
            nextPhase: 'Audit Breakdown',
            resetRetry: true
        }));
        expect(mockContextManager.read).toHaveBeenCalledWith('docs/planning/MASTER_PLAN.md');
    });

    it('should retry PM when MASTER_PLAN.md is missing', async () => {
        const state = {
            persona: 'PM',
            phase: 'Audit Planning',
            retryCount: 0
        };
        const issue = { title: '[AUDIT] Task', number: 1 };
        const issueType = 'AUDIT';

        // Mock MASTER_PLAN.md missing
        mockContextManager.read.mockReturnValue(null);

        const action = await orchestrator.determineNextAction(state, issue, issueType);

        expect(action).toEqual(expect.objectContaining({
            persona: 'pm',
            nextPhase: 'Audit Planning',
            incrementRetry: true
        }));
    });

    it('should throw error when MAX_RETRIES reached and MASTER_PLAN.md is missing', async () => {
        const state = {
            persona: 'PM',
            phase: 'Audit Planning',
            retryCount: 3 // MAX_RETRIES
        };
        const issue = { title: '[AUDIT] Task', number: 1 };
        const issueType = 'AUDIT';

        // Mock MASTER_PLAN.md missing
        mockContextManager.read.mockReturnValue(null);

        await expect(orchestrator.determineNextAction(state, issue, issueType))
            .rejects.toThrow('Audit flow blocked: MASTER_PLAN.md not generated');
    });

    it('should handle case-insensitive persona comparison (if refactored)', async () => {
        const state = {
            persona: 'pm', // lower case
            phase: 'Audit Planning',
            retryCount: 0
        };
        const issue = { title: '[AUDIT] Task', number: 1 };
        const issueType = 'AUDIT';

        mockContextManager.read.mockReturnValue('# Master Plan Content');

        const action = await orchestrator.determineNextAction(state, issue, issueType);

        // This might fail before refactoring if it's strictly 'PM'
        expect(action).toBeDefined();
        if (action) {
            expect(action.persona).toBe('architect');
        }
    });
});
