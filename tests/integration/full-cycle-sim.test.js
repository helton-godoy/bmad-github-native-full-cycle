/**
 * @ai-context Full Cycle Integration Test using GitHub Simulator
 */
const GitHubSimulator = require('../simulation/github-simulator');
const ProjectManager = require('../../personas/project-manager');
const ContextManager = require('../../scripts/lib/context-manager');

// Mocks
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/context-manager');
jest.mock('../../scripts/lib/secret-manager');
jest.mock('../../scripts/lib/cache-manager');

describe('Full Cycle Simulation', () => {
    let simulator;
    let pm;

    beforeEach(() => {
        simulator = new GitHubSimulator();

        // Setup PM with Simulated Octokit
        pm = new ProjectManager('fake-token');
        pm.octokit = simulator.getOctokitMock(); // Inject Simulator

        // Mock ContextManager to avoid file I/O during sim
        ContextManager.mockImplementation(() => ({
            read: jest.fn(),
            write: jest.fn(),
            withLock: jest.fn((name, op) => op())
        }));

        // Skip validation for simulation speed
        process.env.BMAD_SKIP_VALIDATION = 'true';
    });

    afterEach(() => {
        delete process.env.BMAD_SKIP_VALIDATION;
    });

    test('PM should analyze issue and create architecture plan', async () => {
        // 1. Setup: User creates an issue in Simulator
        const userIssue = await simulator.getOctokitMock().rest.issues.create({
            title: 'Implement User Login',
            body: 'As a user, I want to login with email and password.'
        });
        const issueNumber = userIssue.data.number;

        // 2. Execution: PM analyzes the issue
        // We mock the LLM response to avoid real API calls
        pm.generateResponse = jest.fn().mockResolvedValue(`
# Implementation Plan
1. Create Login API
2. Create Login UI
        `);

        await pm.execute(issueNumber);

        // 3. Verification: Check Simulator State
        const issues = simulator.dumpState().issues;

        // Should have 2 issues: Original + Architecture Plan
        expect(issues.length).toBe(2);

        const planIssue = issues.find(i => i.title.includes('Architecture Planning'));
        expect(planIssue).toBeDefined();
        expect(planIssue.body).toContain('Implement User Login'); // References original
        expect(planIssue.labels).toEqual(expect.arrayContaining([{ name: 'architecture' }]));
    });

    test('Simulator should handle file operations', async () => {
        const octokit = simulator.getOctokitMock();

        // Create file
        await octokit.rest.repos.createOrUpdateFileContents({
            path: 'docs/PLAN.md',
            message: 'Add plan',
            content: Buffer.from('# Plan').toString('base64')
        });

        // Read file
        const res = await octokit.rest.repos.getContent({ path: 'docs/PLAN.md' });
        const content = Buffer.from(res.data.content, 'base64').toString('utf-8');

        expect(content).toBe('# Plan');
    });
});
