/**
 * Property-Based Tests for Enhanced Gatekeeper Integration
 * Requirements: 1.5, 7.1
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Enhanced Gatekeeper Integration Property Tests', () => {
    let orchestrator;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mocks
        const mockExecSync = require('child_process').execSync;
        const mockFs = require('fs');

        mockExecSync.mockReturnValue('');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"test":"jest"}}');

        orchestrator = new HookOrchestrator({
            enableLinting: false,
            enableTesting: false,
            enableContextValidation: false,
            enableGatekeeper: true
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 5: Enhanced Gatekeeper integration**
     * **Validates: Requirements 1.5, 7.1**
     */
    test('should integrate with Enhanced Gatekeeper when available and maintain synchronization', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 5 }),
            fc.constantFrom('PASS', 'FAIL', 'WAIVED'),
            fc.array(fc.record({
                name: fc.string(),
                status: fc.constantFrom('passed', 'failed', 'warning')
            }), { maxLength: 3 }),
            async (stagedFiles, gatekeeperResult, validations) => {
                // Mock gatekeeper response
                const mockGatekeeper = orchestrator.gatekeeper;
                mockGatekeeper.validateHookContext = jest.fn().mockResolvedValue({
                    gate: gatekeeperResult,
                    validations: validations,
                    errors: gatekeeperResult === 'FAIL' ? [{ type: 'TEST_ERROR', message: 'Test failed' }] : [],
                    warnings: [],
                    waiver: { active: gatekeeperResult === 'WAIVED' }
                });
                mockGatekeeper.generateHookReport = jest.fn().mockReturnValue('Mock report');

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Gatekeeper integration should be consistent with configuration
                expect(result.results.gatekeeperIntegration.status).toBeDefined();
                expect(result.results.gatekeeperIntegration.gate).toBe(gatekeeperResult);

                // Verify gatekeeper was called with correct context
                expect(mockGatekeeper.validateHookContext).toHaveBeenCalledWith(
                    'pre-commit',
                    expect.objectContaining({
                        hookType: 'pre-commit',
                        stagedFiles,
                        results: expect.any(Object)
                    })
                );

                // Property: Status should match gate result
                const expectedStatus = gatekeeperResult === 'PASS' ? 'passed' :
                    gatekeeperResult === 'WAIVED' ? 'waived' : 'failed';
                expect(result.results.gatekeeperIntegration.status).toBe(expectedStatus);

                // Property: Validations should be preserved
                expect(result.results.gatekeeperIntegration.validations).toEqual(validations);
            }
        ), { numRuns: 20 });
    });

    test('should handle gatekeeper failures gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { maxLength: 3 }),
            fc.string().filter(s => s.length > 0),
            async (stagedFiles, errorMessage) => {
                // Mock gatekeeper to fail
                const mockGatekeeper = orchestrator.gatekeeper;
                mockGatekeeper.validateHookContext = jest.fn().mockRejectedValue(
                    new Error(errorMessage)
                );
                mockGatekeeper.generateHookReport = jest.fn().mockReturnValue('Mock report');

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Gatekeeper failures should not crash the hook execution
                expect(result.results.gatekeeperIntegration.status).toBe('failed');
                expect(result.results.gatekeeperIntegration.error).toContain(errorMessage);
                expect(result.results.gatekeeperIntegration.gate).toBe('FAIL');

                // Property: Hook should still complete execution
                expect(result.success).toBeDefined();
                expect(result.duration).toBeGreaterThanOrEqual(0);
            }
        ), { numRuns: 15 });
    });

    test('should maintain synchronization across multiple hook types', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('pre-commit', 'commit-msg', 'pre-push', 'post-commit', 'post-merge'),
            fc.record({
                gate: fc.constantFrom('PASS', 'FAIL', 'WAIVED'),
                validations: fc.array(fc.record({
                    name: fc.string(),
                    status: fc.constantFrom('passed', 'failed', 'warning')
                }), { maxLength: 2 })
            }),
            async (hookType, gatekeeperResponse) => {
                // Mock gatekeeper response
                const mockGatekeeper = orchestrator.gatekeeper;
                mockGatekeeper.validateHookContext = jest.fn().mockResolvedValue(gatekeeperResponse);
                mockGatekeeper.generateHookReport = jest.fn().mockReturnValue('Mock report');

                let result;
                switch (hookType) {
                    case 'pre-commit':
                        result = await orchestrator.executePreCommit(['test.js']);
                        break;
                    case 'commit-msg':
                        result = await orchestrator.executeCommitMsg('test message');
                        break;
                    case 'pre-push':
                        result = await orchestrator.executePrePush('main', 'origin');
                        break;
                    case 'post-commit':
                        result = await orchestrator.executePostCommit('abc123');
                        break;
                    case 'post-merge':
                        result = await orchestrator.executePostMerge('fast-forward');
                        break;
                }

                // Property: All hook types should maintain consistent integration
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // For pre-commit, verify gatekeeper integration
                if (hookType === 'pre-commit') {
                    expect(result.results.gatekeeperIntegration.gate).toBe(gatekeeperResponse.gate);
                    expect(mockGatekeeper.validateHookContext).toHaveBeenCalledWith(
                        'pre-commit',
                        expect.objectContaining({
                            hookType: 'pre-commit'
                        })
                    );
                }
            }
        ), { numRuns: 10 });
    });

    test('should preserve gatekeeper context and metadata', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.string(), { minLength: 1, maxLength: 4 }),
            fc.record({
                timestamp: fc.date(),
                user: fc.string(),
                environment: fc.constantFrom('development', 'staging', 'production')
            }),
            async (stagedFiles, contextMetadata) => {
                // Mock gatekeeper with metadata
                const mockGatekeeper = orchestrator.gatekeeper;
                mockGatekeeper.validateHookContext = jest.fn().mockResolvedValue({
                    gate: 'PASS',
                    validations: [],
                    errors: [],
                    warnings: [],
                    waiver: { active: false },
                    metadata: contextMetadata
                });
                mockGatekeeper.generateHookReport = jest.fn().mockReturnValue('Mock report');

                const result = await orchestrator.executePreCommit(stagedFiles);

                // Property: Context and metadata should be preserved through integration
                expect(mockGatekeeper.validateHookContext).toHaveBeenCalledWith(
                    'pre-commit',
                    expect.objectContaining({
                        hookType: 'pre-commit',
                        stagedFiles,
                        timestamp: expect.any(String),
                        results: expect.any(Object)
                    })
                );

                // Property: Integration should succeed with metadata
                expect(result.results.gatekeeperIntegration.status).toBe('passed');
                expect(result.results.gatekeeperIntegration.gate).toBe('PASS');
            }
        ), { numRuns: 15 });
    });
});