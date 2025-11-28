/**
 * @ai-context Test suite for BMAD workflow orchestrator
 * @ai-invariant Workflow should coordinate all personas correctly
 * @ai-connection Tests validate workflow execution and GitHub integration
 */
const BMADWorkflow = require('../scripts/bmad/bmad-workflow');

describe('BMAD Workflow', () => {
    describe('Workflow Initialization', () => {
        const originalExit = process.exit;

        beforeEach(() => {
            process.exit = jest.fn();
        });

        afterEach(() => {
            process.exit = originalExit;
        });

        test('Should initialize without GitHub token', () => {
            const originalToken = process.env.GITHUB_TOKEN;
            const originalExit = process.exit;
            
            delete process.env.GITHUB_TOKEN;
            process.exit = jest.fn();

            new BMADWorkflow();
            
            expect(process.exit).toHaveBeenCalledWith(1);

            process.env.GITHUB_TOKEN = originalToken;
            process.exit = originalExit;
        });

        test('Should initialize with GitHub token', () => {
            process.env.GITHUB_TOKEN = 'mock-token';
            
            const workflow = new BMADWorkflow();
            expect(workflow.githubToken).toBe('mock-token');
            expect(workflow.personas).toBeDefined();
            expect(Object.keys(workflow.personas)).toHaveLength(7);
        });
    });

    describe('Persona Coordination', () => {
        test('Should have all required personas', () => {
            process.env.GITHUB_TOKEN = 'mock-token';
            
            const workflow = new BMADWorkflow();
            const personas = workflow.personas;

            expect(personas.pm).toBeDefined();
            expect(personas.architect).toBeDefined();
            expect(personas.developer).toBeDefined();
            expect(personas.qa).toBeDefined();
            expect(personas.security).toBeDefined();
            expect(personas.devops).toBeDefined();
            expect(personas.releaseManager).toBeDefined();
        });
    });

    describe('Workflow Methods', () => {
        test('Should have executeWorkflow method', () => {
            process.env.GITHUB_TOKEN = 'mock-token';
            
            const workflow = new BMADWorkflow();
            expect(typeof workflow.executeWorkflow).toBe('function');
        });

        test('Should have getLatestIssue method', () => {
            process.env.GITHUB_TOKEN = 'mock-token';
            
            const workflow = new BMADWorkflow();
            expect(typeof workflow.getLatestIssue).toBe('function');
        });

        test('Should have generateWorkflowReport method', () => {
            process.env.GITHUB_TOKEN = 'mock-token';
            
            const workflow = new BMADWorkflow();
            expect(typeof workflow.generateWorkflowReport).toBe('function');
        });
    });
});
