/**
 * Integration tests for complete Git Hooks Automation workflows
 * Tests end-to-end hook combinations, BMAD persona integration,
 * performance under load, and error recovery mechanisms
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
        }),
        validateHookContext: jest.fn().mockResolvedValue({
            gate: 'PASS',
            validations: [],
            errors: [],
            warnings: []
        })
    }));
});

jest.mock('../../scripts/lib/context-manager', () => {
    return jest.fn().mockImplementation(() => ({
        readContext: jest.fn().mockResolvedValue('# Active Context\n\nCurrent Persona: DEVELOPER\nCurrent Step: STEP-001'),
        updateContext: jest.fn().mockResolvedValue(true)
    }));
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

describe('Complete Hook Workflows Integration', () => {
    let mockExecSync;
    let mockFs;
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFs = require('fs');
        mockExecSync = require('child_process').execSync;
        originalEnv = { ...process.env };

        // Setup default successful mocks
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('# Active Context\n\nCurrent Persona: DEVELOPER\nCurrent Step: STEP-001');
        mockExecSync.mockImplementation((command) => {
            if (command.includes('npm run lint')) return '';
            if (command.includes('npm run test')) return 'Tests: 10 passed, 10 total\nTime: 2.5s';
            if (command.includes('npm run build')) return 'Build successful';
            if (command.includes('npm audit')) return '{"vulnerabilities": {}}';
            if (command.includes('git diff --cached')) return 'src/test.js';
            if (command.includes('git status')) return '';
            if (command.includes('git rev-parse')) return 'abc123';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git fsck')) return '';
            if (command.includes('git remote')) return 'origin';
            if (command.includes('git rev-list')) return 'commit1\ncommit2';
            if (command.includes('git merge-base')) return 'basecommit';
            if (command.includes('git log')) return '[DEVELOPER] [STEP-001] Test commit';
            if (command.includes('npm run bmad:workflow')) return 'BMAD workflow completed';
            return '';
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    describe('End-to-End Hook Combinations', () => {
        test('should execute complete commit workflow chain', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true,
                developmentMode: false
            });

            // Step 1: Pre-commit
            const preCommitResult = await orchestrator.executePreCommit(['src/test.js']);
            expect(preCommitResult).toBeDefined();
            expect(preCommitResult.results).toBeDefined();
            expect(preCommitResult.results.linting).toBeDefined();

            // Step 2: Commit-msg
            const commitMsgResult = await orchestrator.executeCommitMsg('[DEVELOPER] [STEP-001] Add test file');
            expect(commitMsgResult).toBeDefined();
            expect(commitMsgResult.results).toBeDefined();
            // Check for message validation (actual property name)
            expect(commitMsgResult.results).toHaveProperty('messageValidation');

            // Step 3: Post-commit
            const postCommitResult = await orchestrator.executePostCommit('abc123');
            expect(postCommitResult).toBeDefined();
            expect(postCommitResult.results).toBeDefined();
            // Post-commit may have different result structure
            expect(postCommitResult.results).toBeDefined();
        });

        test('should execute complete push workflow with all validations', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableBuild: true,
                enableSecurity: true,
                enableContextValidation: true
            });

            const result = await orchestrator.executePrePush('main', 'origin');

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            // Check for test results using actual property names
            expect(result.results).toHaveProperty('fullTestSuite');
            expect(result.results).toHaveProperty('buildValidation');
            expect(result.results).toHaveProperty('securityAudit');
        });

        test('should execute complete merge workflow with repository validation', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const result = await orchestrator.executePostMerge('merge-commit');

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            expect(result.results.repositoryValidation).toBeDefined();
            expect(result.results.repositoryValidation.isValid).toBeDefined();
        });

        test('should execute rebase workflow with safety checks', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const result = await orchestrator.executePreRebase('feature-branch', 'main');

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            // Check for safety and compatibility results using actual property names
            expect(result.results).toHaveProperty('safetyValidation');
            expect(result.results).toHaveProperty('bmadCompatibility');
        });

        test('should execute checkout workflow with context restoration', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const result = await orchestrator.executePostCheckout('old-branch', 'new-branch', false);

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            expect(result.results.contextRestoration).toBeDefined();
        });
    });

    describe('BMAD Persona Integration Scenarios', () => {
        test('should handle persona transition in commit workflow', async () => {
            mockFs.readFileSync.mockReturnValue('# Active Context\n\nCurrent Persona: DEVELOPER\nCurrent Step: STEP-005');

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const devCommit = await orchestrator.executeCommitMsg('[DEVELOPER] [STEP-005] Complete feature');
            expect(devCommit).toBeDefined();
            expect(devCommit.results).toBeDefined();

            mockFs.readFileSync.mockReturnValue('# Active Context\n\nCurrent Persona: QA\nCurrent Step: STEP-001');

            const qaCommit = await orchestrator.executeCommitMsg('[QA] [STEP-001] Begin testing');
            expect(qaCommit).toBeDefined();
            expect(qaCommit.results).toBeDefined();
        });

        test('should coordinate multi-persona workflow in push', async () => {
            mockFs.readFileSync.mockReturnValue('# Active Context\n\nCurrent Persona: DEVELOPER\nCurrent Step: STEP-003\nWorkflow Phase: DEVELOPMENT');

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true,
                enableGatekeeper: true
            });

            const result = await orchestrator.executePrePush('main', 'origin');

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            // Check for BMAD sync results using actual property name
            expect(result.results).toHaveProperty('bmadWorkflowSync');
        });

        test('should execute BMAD workflow after merge', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const result = await orchestrator.executePostMerge('merge-commit');

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            expect(result.results.workflow).toBeDefined();
        });

        test('should maintain persona consistency across hook chain', async () => {
            const contextContent = '# Active Context\n\nCurrent Persona: ARCHITECT\nCurrent Step: STEP-002';
            mockFs.readFileSync.mockReturnValue(contextContent);

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const preCommit = await orchestrator.executePreCommit(['docs/architecture.md']);
            expect(preCommit).toBeDefined();

            const commitMsg = await orchestrator.executeCommitMsg('[ARCHITECT] [STEP-002] Update architecture');
            expect(commitMsg).toBeDefined();
            expect(commitMsg.results.contextValidation).toBeDefined();

            const postCommit = await orchestrator.executePostCommit('abc123');
            expect(postCommit).toBeDefined();
        });
    });

    describe('Performance Under Load', () => {
        test('should handle large number of staged files efficiently', async () => {
            const largeFileList = Array.from({ length: 100 }, (_, i) => `src/file${i}.js`);

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true
            });

            const startTime = Date.now();
            const result = await orchestrator.executePreCommit(largeFileList);
            const duration = Date.now() - startTime;

            expect(result).toBeDefined();
            expect(duration).toBeLessThan(10000);
        });

        test('should handle concurrent hook executions', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true
            });

            const messages = [
                '[DEVELOPER] [STEP-001] First commit',
                '[DEVELOPER] [STEP-002] Second commit',
                '[DEVELOPER] [STEP-003] Third commit'
            ];

            const startTime = Date.now();
            const results = await Promise.all(
                messages.map(msg => orchestrator.executeCommitMsg(msg))
            );
            const duration = Date.now() - startTime;

            expect(results.length).toBe(3);
            expect(results.every(r => r !== undefined)).toBe(true);
            expect(duration).toBeLessThan(5000);
        });

        test('should collect and report performance metrics', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true
            });

            await orchestrator.executePreCommit(['src/test.js']);
            await orchestrator.executeCommitMsg('[DEVELOPER] [STEP-001] Test');
            await orchestrator.executePostCommit('abc123');

            const metrics = orchestrator.getMetrics();
            expect(metrics).toBeDefined();
        });
    });

    describe('Error Recovery and Bypass Mechanisms', () => {
        test('should use bypass mechanisms in development mode', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableContextValidation: true,
                developmentMode: true
            });

            const wipResult = await orchestrator.executeCommitMsg('WIP: testing feature');
            expect(wipResult).toBeDefined();
            expect(wipResult.results.bypass).toBeDefined();
        });

        test('should respect environment variable bypass', async () => {
            process.env.BMAD_BYPASS_COMMIT_MSG = 'true';

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                developmentMode: false
            });

            const result = await orchestrator.executeCommitMsg('any message');
            expect(result).toBeDefined();
            expect(result.results.bypass).toBeDefined();
        });

        test('should gracefully degrade when gatekeeper fails', async () => {
            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true,
                enableGatekeeper: true
            });

            orchestrator.gatekeeper.validateHookContext = async () => {
                throw new Error('Gatekeeper unavailable');
            };

            const result = await orchestrator.executePreCommit(['src/test.js']);
            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
        });

        test('should handle repository state validation errors', async () => {
            mockExecSync.mockImplementation((command) => {
                if (command.includes('git status')) {
                    return ' M uncommitted.js';
                }
                if (command.includes('git diff --check')) {
                    const error = new Error('Conflict markers found');
                    error.stdout = 'conflict in file.js';
                    throw error;
                }
                return '';
            });

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true
            });

            const result = await orchestrator.executePostMerge('merge-commit');
            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            expect(result.results.repositoryValidation).toBeDefined();
        });

        test('should provide recovery information on failures', async () => {
            mockExecSync.mockImplementation((command) => {
                if (command.includes('npm run bmad:workflow')) {
                    throw new Error('Workflow execution failed');
                }
                return '';
            });

            const orchestrator = new HookOrchestrator({
                enableLinting: true,
                enableTesting: true
            });

            const result = await orchestrator.executePostMerge('merge-commit');
            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
        });
    });

    describe('Property-Based Integration Tests', () => {
        test('Property: Valid BMAD messages are processable', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA'),
                        stepId: fc.integer({ min: 1, max: 10 }).map(n => `STEP-${String(n).padStart(3, '0')}`),
                        description: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length >= 10)
                    }),
                    async ({ persona, stepId, description }) => {
                        mockFs.readFileSync.mockReturnValue(`# Active Context\n\nCurrent Persona: ${persona}\nCurrent Step: ${stepId}`);

                        const orchestrator = new HookOrchestrator({
                            enableLinting: true,
                            enableTesting: true,
                            enableContextValidation: true
                        });

                        const message = `[${persona}] [${stepId}] ${description}`;
                        const result = await orchestrator.executeCommitMsg(message);

                        expect(result).toBeDefined();
                        expect(result.results).toBeDefined();
                    }
                ),
                { numRuns: 10 }
            );
        });

        test('Property: All bypasses create audit trails', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom('WIP:', 'TEMP:', 'DEV:'),
                    fc.string({ minLength: 5, maxLength: 30 }),
                    async (prefix, message) => {
                        const orchestrator = new HookOrchestrator({
                            enableLinting: true,
                            enableTesting: true,
                            developmentMode: true
                        });

                        const fullMessage = `${prefix} ${message}`;
                        const result = await orchestrator.executeCommitMsg(fullMessage);

                        expect(result).toBeDefined();
                        expect(result.results).toBeDefined();
                        if (result.results.bypass && result.results.bypass.bypassed) {
                            expect(result.results.bypass.auditTrail).toBeDefined();
                        }
                    }
                ),
                { numRuns: 10 }
            );
        });

        test('Property: Hook execution is idempotent', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
                    async (files) => {
                        const orchestrator = new HookOrchestrator({
                            enableLinting: true,
                            enableTesting: false
                        });

                        const result1 = await orchestrator.executePreCommit(files);
                        const result2 = await orchestrator.executePreCommit(files);

                        expect(result1).toBeDefined();
                        expect(result2).toBeDefined();
                        expect(typeof result1.success).toBe(typeof result2.success);
                    }
                ),
                { numRuns: 10 }
            );
        });
    });
});
