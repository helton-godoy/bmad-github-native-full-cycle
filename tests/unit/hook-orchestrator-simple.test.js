/**
 * Simple Unit Tests for Hook Orchestrator
 * Requirements: 1.1, 1.5, 7.1
 */

const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('HookOrchestrator Simple Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mocks
        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');

        // Default mock implementations
        mockExecSync.mockReturnValue('');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"test":"jest"}}');

        orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: false,
            enableContextValidation: false,
            enableGatekeeper: false
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 1: Pre-commit lint and format execution**
     * **Validates: Requirements 1.1**
     */
    test('should execute lint operations on JavaScript files', async () => {
        const stagedFiles = ['src/test.js', 'lib/utils.ts'];

        mockExecSync.mockImplementation((command) => {
            if (command.includes('eslint')) {
                expect(command).toContain('src/test.js');
                expect(command).toContain('lib/utils.ts');
                return 'ESLint output';
            }
            if (command.includes('prettier')) {
                expect(command).toContain('src/test.js');
                expect(command).toContain('lib/utils.ts');
                return 'Prettier output';
            }
            return '';
        });

        const result = await orchestrator.executePreCommit(stagedFiles);

        expect(result.results.linting.status).toBe('passed');
        expect(result.results.linting.filesProcessed).toBe(2);
        expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('eslint --fix'),
            expect.any(Object)
        );
        expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('prettier --write'),
            expect.any(Object)
        );
    });

    test('should skip linting when no JavaScript files are provided', async () => {
        const stagedFiles = ['README.md', 'package.json'];

        const result = await orchestrator.executePreCommit(stagedFiles);

        expect(result.results.linting.status).toBe('skipped');
        expect(result.results.linting.filesProcessed).toBe(0);
        expect(mockExecSync).not.toHaveBeenCalled();
    });

    /**
     * **Feature: git-hooks-automation, Property 5: Enhanced Gatekeeper integration**
     * **Validates: Requirements 1.5, 7.1**
     */
    test('should integrate with Enhanced Gatekeeper when enabled', async () => {
        orchestrator.config.enableGatekeeper = true;

        // Mock gatekeeper response
        const mockGatekeeper = orchestrator.gatekeeper;
        mockGatekeeper.validateHookContext = jest.fn().mockResolvedValue({
            gate: 'PASS',
            validations: [],
            errors: [],
            warnings: [],
            waiver: { active: false }
        });
        mockGatekeeper.generateHookReport = jest.fn().mockReturnValue('Mock report');

        const result = await orchestrator.executePreCommit(['test.js']);

        expect(result.results.gatekeeperIntegration.status).toBe('passed');
        expect(result.results.gatekeeperIntegration.gate).toBe('PASS');
        expect(mockGatekeeper.validateHookContext).toHaveBeenCalledWith(
            'pre-commit',
            expect.objectContaining({
                hookType: 'pre-commit',
                stagedFiles: ['test.js'],
                results: expect.any(Object)
            })
        );
    });

    test('should skip gatekeeper when disabled', async () => {
        orchestrator.config.enableGatekeeper = false;

        const result = await orchestrator.executePreCommit(['test.js']);

        expect(result.results.gatekeeperIntegration.status).toBe('skipped');
    });

    test('should record execution metrics', async () => {
        const initialCount = orchestrator.metrics.executions.length;

        await orchestrator.executePreCommit(['test.js']);

        expect(orchestrator.metrics.executions.length).toBe(initialCount + 1);

        const lastExecution = orchestrator.metrics.executions[orchestrator.metrics.executions.length - 1];
        expect(lastExecution.hookType).toBe('pre-commit');
        expect(lastExecution.timestamp).toBeDefined();
        expect(lastExecution.duration).toBeGreaterThanOrEqual(0);
        expect(typeof lastExecution.success).toBe('boolean');
    });
});