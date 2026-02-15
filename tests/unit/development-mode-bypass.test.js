/**
 * Property-Based Tests for Development Mode Bypass Controls
 * **Feature: git-hooks-automation, Property 19: Development mode bypass controls**
 * **Validates: Requirements 6.4, 6.5**
 */

const fc = require('fast-check');
const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');
const fs = require('fs');
const path = require('path');

// Arbitraries for test data generation
const bypassReasonArb = fc.constantFrom(
    'WIP: Testing new feature',
    'TEMP: Quick fix for demo',
    'DEV: Experimental code',
    'EMERGENCY: Production hotfix',
    'DEBUG: Investigating issue'
);

const hookTypeArb = fc.constantFrom('pre-commit', 'commit-msg', 'pre-push', 'pre-rebase');

const commitMessageArb = fc.oneof(
    // Valid BMAD format
    fc.record({
        persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA'),
        stepId: fc.string({ minLength: 6, maxLength: 10 }).map(s => `STEP-${s.slice(0, 3)}`),
        description: fc.string({ minLength: 10, maxLength: 50 })
    }).map(m => `[${m.persona}] [${m.stepId}] ${m.description}`),
    // Invalid format with bypass prefix
    bypassReasonArb
);

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/enhanced-gatekeeper');
jest.mock('../../scripts/lib/context-manager');

describe('Development Mode Bypass Controls Property Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();

        // Save original environment
        originalEnv = { ...process.env };

        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');

        // Default mock implementations
        mockExecSync.mockReturnValue('');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{"scripts":{"test":"jest"}}');
        mockFs.writeFileSync.mockImplementation(() => { });
        mockFs.mkdirSync.mockImplementation(() => { });
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    /**
     * **Feature: git-hooks-automation, Property 19: Development mode bypass controls**
     * **Validates: Requirements 6.4, 6.5**
     */
    test('should provide controlled bypass mechanisms in development mode', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(), // development mode enabled
            commitMessageArb,
            fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 5 }), // staged files
            async (devMode, commitMessage, stagedFiles) => {
                // Set development mode
                process.env.NODE_ENV = devMode ? 'development' : 'production';
                process.env.BMAD_DEV_MODE = devMode ? 'true' : 'false';

                orchestrator = new HookOrchestrator({
                    enableLinting: true,
                    enableTesting: true,
                    enableContextValidation: true,
                    enableGatekeeper: true,
                    developmentMode: devMode
                });

                // Mock git commands
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git diff --cached --name-only')) {
                        return stagedFiles.join('\n');
                    }
                    return '';
                });

                const result = await orchestrator.executeCommitMsg(commitMessage);

                // Property: Development mode should be detected (Requirement 6.4)
                expect(orchestrator.config.developmentMode).toBe(devMode);

                // Property: Bypass should work with special prefixes in dev mode
                const hasBypassPrefix = commitMessage.startsWith('WIP:') ||
                    commitMessage.startsWith('TEMP:') ||
                    commitMessage.startsWith('DEV:') ||
                    commitMessage.startsWith('EMERGENCY:');

                if (devMode && hasBypassPrefix) {
                    expect(result.success).toBe(true);
                    expect(result.results.bypass).toBeDefined();
                    expect(result.results.bypass.bypassed).toBe(true);
                    expect(result.results.bypass.reason).toBeDefined();
                }

                // Property: Bypass should be logged with audit trail (Requirement 6.5)
                if (result.results.bypass && result.results.bypass.bypassed) {
                    expect(result.results.bypass.auditTrail).toBeDefined();
                    expect(result.results.bypass.auditTrail.timestamp).toBeDefined();
                    expect(result.results.bypass.auditTrail.originalMessage).toBe(commitMessage);
                    expect(result.results.bypass.auditTrail.developmentMode).toBe(devMode);
                }

                // Property: Production mode should not allow bypass
                if (!devMode && hasBypassPrefix) {
                    expect(result.results.bypass.bypassed).toBe(false);
                }
            }
        ), { numRuns: 10 });
    });

    test('should log all bypass attempts with detailed audit trails', async () => {
        await fc.assert(fc.asyncProperty(
            bypassReasonArb,
            fc.record({
                username: fc.string({ minLength: 3, maxLength: 20 }),
                email: fc.emailAddress(),
                timestamp: fc.date()
            }),
            async (bypassMessage, userInfo) => {
                process.env.NODE_ENV = 'development';
                process.env.BMAD_DEV_MODE = 'true';

                orchestrator = new HookOrchestrator({
                    developmentMode: true
                });

                // Mock git user info
                mockExecSync.mockImplementation((command) => {
                    if (command.includes('git config user.name')) {
                        return userInfo.username;
                    }
                    if (command.includes('git config user.email')) {
                        return userInfo.email;
                    }
                    return '';
                });

                const result = await orchestrator.executeCommitMsg(bypassMessage);

                // Property: Bypass attempts should be logged (Requirement 6.5)
                if (result.results.bypass && result.results.bypass.bypassed) {
                    const auditTrail = result.results.bypass.auditTrail;

                    expect(auditTrail).toBeDefined();
                    expect(auditTrail.timestamp).toBeDefined();
                    expect(auditTrail.originalMessage).toBe(bypassMessage);
                    expect(auditTrail.developmentMode).toBe(true);
                    expect(auditTrail.bypassType).toBeDefined();

                    // Property: Audit trail should contain enough information for troubleshooting
                    expect(typeof auditTrail.timestamp).toBe('string');
                    expect(auditTrail.bypassType).toMatch(/^(prefix|emergency|environment)$/);
                }
            }
        ), { numRuns: 5 });
    });

    test('should support environment variable bypass with audit trail', async () => {
        await fc.assert(fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 50 }), // any commit message
            fc.boolean(), // bypass env var set
            async (commitMessage, bypassEnvSet) => {
                process.env.BMAD_BYPASS_COMMIT_MSG = bypassEnvSet ? 'true' : 'false';

                orchestrator = new HookOrchestrator({
                    developmentMode: false // Even in production
                });

                const result = await orchestrator.executeCommitMsg(commitMessage);

                // Property: Environment variable bypass should work (Requirement 6.4)
                if (bypassEnvSet) {
                    expect(result.success).toBe(true);
                    expect(result.results.bypass.bypassed).toBe(true);
                    expect(result.results.bypass.reason).toContain('Environment variable bypass');
                }

                // Property: Environment bypass should be audited (Requirement 6.5)
                if (bypassEnvSet) {
                    expect(result.results.bypass.auditTrail).toBeDefined();
                    expect(result.results.bypass.auditTrail.environmentBypass).toBe(true);
                    expect(result.results.bypass.auditTrail.bypassType).toBe('environment');
                }
            }
        ), { numRuns: 5 });
    });

    test('should handle emergency/hotfix bypass in development mode', async () => {
        await fc.assert(fc.asyncProperty(
            fc.oneof(
                fc.constant('emergency fix for production'),
                fc.constant('hotfix: critical bug'),
                fc.constant('EMERGENCY: system down'),
                fc.constant('Quick hotfix for customer issue')
            ),
            async (emergencyMessage) => {
                process.env.NODE_ENV = 'development';
                process.env.BMAD_DEV_MODE = 'true';

                orchestrator = new HookOrchestrator({
                    developmentMode: true
                });

                const result = await orchestrator.executeCommitMsg(emergencyMessage);

                // Property: Emergency messages should bypass in dev mode (Requirement 6.4)
                const isEmergency = emergencyMessage.toLowerCase().includes('emergency') ||
                    emergencyMessage.toLowerCase().includes('hotfix');

                if (isEmergency) {
                    expect(result.success).toBe(true);
                    expect(result.results.bypass.bypassed).toBe(true);
                    expect(result.results.bypass.reason).toContain('Emergency');
                }

                // Property: Emergency bypass should be clearly marked in audit trail
                if (result.results.bypass && result.results.bypass.bypassed) {
                    expect(result.results.bypass.auditTrail.bypassType).toBe('emergency');
                }
            }
        ), { numRuns: 5 });
    });

    test('should provide detailed logging for troubleshooting bypass failures', async () => {
        await fc.assert(fc.asyncProperty(
            commitMessageArb,
            fc.boolean(), // development mode
            async (commitMessage, devMode) => {
                process.env.NODE_ENV = devMode ? 'development' : 'production';
                process.env.BMAD_DEV_MODE = devMode ? 'true' : 'false';

                orchestrator = new HookOrchestrator({
                    developmentMode: devMode
                });

                const result = await orchestrator.executeCommitMsg(commitMessage);

                // Property: All executions should be logged in metrics (Requirement 6.5)
                const metrics = orchestrator.getMetrics();
                expect(metrics.executions.length).toBeGreaterThan(0);

                const lastExecution = metrics.executions[metrics.executions.length - 1];
                expect(lastExecution.hookType).toBe('commit-msg');
                expect(lastExecution.success).toBeDefined();
                expect(lastExecution.timestamp).toBeDefined();

                // Property: Failed validations should have detailed error information
                if (!result.success && !result.results.bypass?.bypassed) {
                    expect(result.errorMessage).toBeDefined();
                    expect(result.results.messageValidation).toBeDefined();
                }
            }
        ), { numRuns: 5 });
    });

    test('should maintain bypass controls across different hook types', async () => {
        await fc.assert(fc.asyncProperty(
            hookTypeArb,
            fc.boolean(), // development mode
            async (hookType, devMode) => {
                process.env.NODE_ENV = devMode ? 'development' : 'production';
                process.env.BMAD_DEV_MODE = devMode ? 'true' : 'false';
                process.env.BMAD_BYPASS_COMMIT_MSG = 'false';

                orchestrator = new HookOrchestrator({
                    developmentMode: devMode,
                    enableLinting: false,
                    enableTesting: false
                });

                // Mock git commands
                mockExecSync.mockImplementation(() => '');

                let result;
                switch (hookType) {
                    case 'pre-commit':
                        result = await orchestrator.executePreCommit([]);
                        break;
                    case 'commit-msg':
                        result = await orchestrator.executeCommitMsg('WIP: test');
                        break;
                    case 'pre-push':
                        result = await orchestrator.executePrePush('origin', 'refs/heads/main');
                        break;
                    case 'pre-rebase':
                        result = await orchestrator.executePreRebase('feature', 'main');
                        break;
                }

                // Property: Development mode should be consistent across hooks
                expect(orchestrator.config.developmentMode).toBe(devMode);

                // Property: All hooks should complete successfully
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
                expect(result.duration).toBeGreaterThanOrEqual(0);

                // Property: Metrics should track all hook executions
                const metrics = orchestrator.getMetrics();
                expect(metrics.executions.length).toBeGreaterThan(0);
            }
        ), { numRuns: 5 });
    });

    test('should prevent bypass abuse by limiting bypass types', async () => {
        await fc.assert(fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 50 }),
            async (randomMessage) => {
                process.env.NODE_ENV = 'development';
                process.env.BMAD_DEV_MODE = 'true';
                process.env.BMAD_BYPASS_COMMIT_MSG = 'false';

                orchestrator = new HookOrchestrator({
                    developmentMode: true
                });

                const result = await orchestrator.executeCommitMsg(randomMessage);

                // Property: Only specific bypass mechanisms should work
                const validBypassPrefixes = ['WIP:', 'TEMP:', 'DEV:', 'EMERGENCY:', 'emergency', 'hotfix'];
                const hasValidBypass = validBypassPrefixes.some(prefix =>
                    randomMessage.toLowerCase().includes(prefix.toLowerCase())
                );

                if (result.results.bypass && result.results.bypass.bypassed) {
                    // If bypass was granted, it must be for a valid reason
                    expect(hasValidBypass).toBe(true);
                    expect(result.results.bypass.reason).toBeDefined();
                    expect(result.results.bypass.auditTrail).toBeDefined();
                }

                // Property: Random messages without valid bypass should not bypass
                if (!hasValidBypass) {
                    expect(result.results.bypass?.bypassed || false).toBe(false);
                }
            }
        ), { numRuns: 10 });
    });
});
