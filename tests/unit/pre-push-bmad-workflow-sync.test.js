/**
 * Property-Based Tests for BMAD Workflow Synchronization
 * Requirements: 3.4, 7.4
 */

const fc = require('fast-check');

// Mock child_process before requiring HookOrchestrator
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

// Mock fs before requiring HookOrchestrator
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn()
}));

// Mock lib dependencies
jest.mock('../../scripts/lib/logger', () => {
    return jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }));
});

jest.mock('../../scripts/lib/enhanced-gatekeeper', () => {
    return jest.fn().mockImplementation(() => ({
        validateWorkflowConditions: jest.fn().mockResolvedValue({
            gate: 'PASS',
            validations: [],
            errors: [],
            warnings: []
        })
    }));
});

jest.mock('../../scripts/lib/context-manager', () => {
    return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../../scripts/lib/test-execution-manager', () => {
    return jest.fn().mockImplementation(() => ({
        hasEnoughResources: jest.fn().mockReturnValue(true),
        executeTestsWithLock: jest.fn().mockResolvedValue({
            success: true,
            output: 'Tests: 5 passed, 5 total\nTime: 2.5s'
        })
    }));
});

jest.mock('../../scripts/lib/process-monitor', () => {
    return jest.fn().mockImplementation(() => ({}));
});

const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

describe('BMAD Workflow Synchronization Property Tests', () => {
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Setup fs mock
        mockFs = require('fs');
        mockFs.existsSync.mockClear();
        mockFs.readFileSync.mockClear();
        mockFs.writeFileSync.mockClear();

        // Setup execSync mock
        mockExecSync = require('child_process').execSync;
        mockExecSync.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Simple unit test to verify the behavior before property-based testing
     */
    test('should handle no active context case correctly', async () => {
        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        // Setup mocks for no active context case
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('activeContext.md')) return false; // No active context
            if (filePath.includes('bmad-orchestrator.js')) return false;
            return false;
        });

        mockFs.readFileSync.mockImplementation((filePath, encoding) => {
            if (filePath.endsWith('package.json')) {
                return JSON.stringify({
                    scripts: {
                        test: 'jest',
                        'test:coverage': 'jest --coverage',
                        build: 'echo "Building..."'
                    }
                });
            }
            return '';
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('npm test') || command.includes('test:coverage')) {
                return 'Tests: 5 passed, 5 total\nTime: 2.5s\nAll files | 85.5 | 80.2 | 90.1 | 85.5';
            }
            if (command.includes('npm run build')) {
                return 'Build completed successfully';
            }
            if (command.includes('npm audit')) {
                return JSON.stringify({
                    vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
                });
            }
            if (command.includes('git log')) {
                return 'Initial commit';
            }
            if (command.includes('git diff')) {
                return '';
            }
            if (command.includes('git rev-parse')) {
                return 'abc123def456';
            }
            return '';
        });

        const result = await orchestrator.executePrePush('main', 'origin');
        const syncResult = result.results.bmadWorkflowSync;

        expect(syncResult).toBeDefined();
        expect(syncResult.status).toMatch(/^(passed|failed|warning|skipped)$/);
        expect(syncResult.workflowActive).toBe(false);
        expect(syncResult.message).toContain('No active BMAD workflow detected');
    });

    /**
     * **Feature: git-hooks-automation, Property 8: BMAD workflow synchronization**
     * **Validates: Requirements 3.4, 7.4**
     */
    test('should synchronize validation requirements with active BMAD workflows and coordinate with existing scripts', async () => {
        await fc.assert(fc.asyncProperty(
            fc.record({
                branch: fc.constantFrom('main', 'develop'),
                remote: fc.constantFrom('origin', 'upstream'),
                hasActiveContext: fc.boolean(),
                currentPersona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA'),
                workflowPhase: fc.constantFrom('implementation', 'testing'),
                hasOrchestrator: fc.boolean()
            }),
            async ({ branch, remote, hasActiveContext, currentPersona, workflowPhase, hasOrchestrator }) => {
                // Reset mocks for each iteration
                jest.clearAllMocks();

                // Create fresh orchestrator for each iteration
                const freshOrchestrator = new HookOrchestrator({
                    enableLinting: true,
                    enableTesting: true,
                    enableContextValidation: true,
                    enableGatekeeper: false,
                    developmentMode: false
                });

                // Setup mocks for this test case - more comprehensive mocking
                mockFs.existsSync.mockImplementation((filePath) => {
                    if (filePath.endsWith('package.json')) return true;
                    if (filePath.endsWith('activeContext.md')) return hasActiveContext;
                    if (filePath.includes('bmad-orchestrator.js')) return hasOrchestrator;
                    return false;
                });

                mockFs.readFileSync.mockImplementation((filePath, encoding) => {
                    if (filePath.endsWith('package.json')) {
                        return JSON.stringify({
                            scripts: {
                                test: 'jest',
                                'test:coverage': 'jest --coverage',
                                build: 'echo "Building..."'
                            }
                        });
                    }
                    if (filePath.endsWith('activeContext.md') && hasActiveContext) {
                        return `# Active Context\n\npersona: ${currentPersona}\nPhase: ${workflowPhase}\nBranch: ${branch}\n`;
                    }
                    return '';
                });

                mockExecSync.mockImplementation((command) => {
                    if (command.includes('npm test') || command.includes('test:coverage')) {
                        return 'Tests: 5 passed, 5 total\nTime: 2.5s\nAll files | 85.5 | 80.2 | 90.1 | 85.5';
                    }
                    if (command.includes('npm run build')) {
                        return 'Build completed successfully';
                    }
                    if (command.includes('npm audit')) {
                        return JSON.stringify({
                            vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
                        });
                    }
                    if (command.includes('git log')) {
                        return hasActiveContext ? `[${currentPersona}] [STEP-001] Test commit` : 'Initial commit';
                    }
                    if (command.includes('git diff')) {
                        return hasActiveContext ? 'src/test.js' : '';
                    }
                    if (command.includes('git rev-parse')) {
                        return 'abc123def456';
                    }
                    return '';
                });

                const result = await freshOrchestrator.executePrePush(branch, remote);

                // Property: BMAD workflow synchronization should always be attempted
                if (!result.results.bmadWorkflowSync) {
                    console.log('Missing bmadWorkflowSync in result:', JSON.stringify(result, null, 2));
                    return false;
                }
                if (!result.results.bmadWorkflowSync.status.match(/^(passed|failed|warning|skipped)$/)) {
                    console.log('Invalid status:', result.results.bmadWorkflowSync.status);
                    return false;
                }

                const syncResult = result.results.bmadWorkflowSync;

                // Property: Workflow active status should be boolean when defined
                if (syncResult.workflowActive !== undefined && typeof syncResult.workflowActive !== 'boolean') {
                    console.log('workflowActive is not boolean:', syncResult.workflowActive);
                    return false;
                }

                // Property: Workflow synchronization should provide meaningful status message
                if (!syncResult.message || typeof syncResult.message !== 'string' || syncResult.message.length === 0) {
                    console.log('Invalid message:', syncResult.message, 'Full syncResult:', JSON.stringify(syncResult, null, 2));
                    return false;
                }

                // Property: Synchronization should correctly detect workflow state
                if (hasActiveContext) {
                    // When context exists, workflow should be active
                    if (syncResult.workflowActive !== true) {
                        console.log('Expected workflowActive=true but got:', syncResult.workflowActive);
                        return false;
                    }
                    // Message should indicate successful synchronization
                    if (!syncResult.message.includes('BMAD workflow synchronization completed')) {
                        console.log('Expected success message but got:', syncResult.message);
                        return false;
                    }
                } else {
                    // When no context exists, workflow should not be active
                    if (syncResult.workflowActive !== false) {
                        console.log('Expected workflowActive=false but got:', syncResult.workflowActive, 'Full syncResult:', JSON.stringify(syncResult, null, 2));
                        return false;
                    }
                    // Message should indicate no workflow detected
                    if (!syncResult.message.includes('No active BMAD workflow detected')) {
                        console.log('Expected no workflow message but got:', syncResult.message);
                        return false;
                    }
                }

                // Property: When workflow is active, should have additional context
                if (hasActiveContext && syncResult.workflowActive) {
                    // Should have persona information when workflow is active
                    if (syncResult.currentPersona === undefined) {
                        console.log('Missing currentPersona when workflow is active');
                        return false;
                    }
                    if (syncResult.workflowPhase === undefined) {
                        console.log('Missing workflowPhase when workflow is active');
                        return false;
                    }
                }

                // All properties hold
                return true;
            }
        ), { numRuns: 10 });
    });
});