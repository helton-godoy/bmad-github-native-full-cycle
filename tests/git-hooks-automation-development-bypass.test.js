/**
 * Property-based tests for Git Hooks Automation - Development Workflow Bypass
 * **Validates: Requirements 8.4**
 * **Feature: git-hooks-automation, Property 23: Development workflow bypass**
 * 
 * Property 23: For any development workflow execution, the system should provide 
 * bypass controls for rapid iteration while maintaining audit trails
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
jest.mock('../scripts/lib/logger', () => {
    return jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }));
});

jest.mock('../scripts/lib/enhanced-gatekeeper', () => {
    return jest.fn().mockImplementation(() => ({
        validateWorkflowConditions: jest.fn().mockResolvedValue({
            gate: 'PASS',
            validations: [],
            errors: [],
            warnings: []
        })
    }));
});

jest.mock('../scripts/lib/context-manager', () => {
    return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../scripts/lib/test-execution-manager', () => {
    return jest.fn().mockImplementation(() => ({
        hasEnoughResources: jest.fn().mockReturnValue(true),
        executeTestsWithLock: jest.fn().mockResolvedValue({
            success: true,
            output: 'Tests: 5 passed, 5 total\nTime: 2.5s'
        })
    }));
});

jest.mock('../scripts/lib/process-monitor', () => {
    return jest.fn().mockImplementation(() => ({}));
});

const HookOrchestrator = require('../scripts/hooks/hook-orchestrator');

describe('Development Workflow Bypass - Property 23', () => {
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    /**
     * Property 23.1: Development mode enables bypass mechanisms
     * When developmentMode is enabled, bypass mechanisms should be available
     */
    test('**Property 23.1: Development mode enables bypass mechanisms**', () => {
        const orchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true
        });

        const validationResult = { isValid: false, errors: ['Invalid format'] };

        // Test WIP prefix bypass
        const wipResult = orchestrator.checkBypassMechanisms('WIP: testing feature', validationResult);
        expect(wipResult.bypassed).toBe(true);
        expect(wipResult.reason).toContain('Development mode bypass');
        expect(wipResult.auditTrail).toBeDefined();
        expect(wipResult.auditTrail.developmentMode).toBe(true);

        // Test TEMP prefix bypass
        const tempResult = orchestrator.checkBypassMechanisms('TEMP: quick fix', validationResult);
        expect(tempResult.bypassed).toBe(true);
        expect(tempResult.auditTrail.bypassType).toBe('prefix');

        // Test DEV prefix bypass
        const devResult = orchestrator.checkBypassMechanisms('DEV: experiment', validationResult);
        expect(devResult.bypassed).toBe(true);
        expect(devResult.auditTrail.bypassType).toBe('prefix');
    });

    /**
     * Property 23.2: Emergency bypass works in development mode
     * When developmentMode is enabled, emergency keywords should trigger bypass
     */
    test('**Property 23.2: Emergency bypass works in development mode**', () => {
        const orchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true
        });

        const validationResult = { isValid: false, errors: ['Invalid format'] };

        // Test emergency keyword
        const emergencyResult = orchestrator.checkBypassMechanisms('emergency fix for production', validationResult);
        expect(emergencyResult.bypassed).toBe(true);
        expect(emergencyResult.reason).toContain('Emergency/hotfix bypass');
        expect(emergencyResult.auditTrail.bypassType).toBe('emergency');

        // Test hotfix keyword
        const hotfixResult = orchestrator.checkBypassMechanisms('hotfix: critical bug', validationResult);
        expect(hotfixResult.bypassed).toBe(true);
        expect(hotfixResult.auditTrail.bypassType).toBe('emergency');
    });

    /**
     * Property 23.3: Bypass mechanisms disabled in production mode
     * When developmentMode is false, prefix bypasses should not work
     */
    test('**Property 23.3: Bypass mechanisms disabled in production mode**', () => {
        const orchestrator = new HookOrchestrator({
            developmentMode: false,
            enableLinting: true,
            enableTesting: true
        });

        const validationResult = { isValid: false, errors: ['Invalid format'] };

        // Test that WIP prefix doesn't bypass in production
        const wipResult = orchestrator.checkBypassMechanisms('WIP: testing feature', validationResult);
        expect(wipResult.bypassed).toBe(false);

        // Test that emergency doesn't bypass in production
        const emergencyResult = orchestrator.checkBypassMechanisms('emergency fix', validationResult);
        expect(emergencyResult.bypassed).toBe(false);
    });

    /**
     * Property 23.4: Environment variable bypass works regardless of mode
     * BMAD_BYPASS_COMMIT_MSG should work in both development and production
     */
    test('**Property 23.4: Environment variable bypass works in any mode**', () => {
        process.env.BMAD_BYPASS_COMMIT_MSG = 'true';

        // Test in development mode
        const devOrchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true
        });

        const devResult = devOrchestrator.checkBypassMechanisms('any message', {});
        expect(devResult.bypassed).toBe(true);
        expect(devResult.reason).toContain('Environment variable bypass');
        expect(devResult.auditTrail.environmentBypass).toBe(true);

        // Test in production mode
        const prodOrchestrator = new HookOrchestrator({
            developmentMode: false,
            enableLinting: true,
            enableTesting: true
        });

        const prodResult = prodOrchestrator.checkBypassMechanisms('any message', {});
        expect(prodResult.bypassed).toBe(true);
        expect(prodResult.auditTrail.bypassType).toBe('environment');
    });

    /**
     * Property 23.5: Audit trail is always created for bypasses
     * Every bypass should create a complete audit trail with timestamp
     */
    test('**Property 23.5: Audit trail created for all bypasses**', () => {
        const orchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true
        });

        const validationResult = { isValid: false };

        // Test prefix bypass audit trail
        const prefixResult = orchestrator.checkBypassMechanisms('WIP: test', validationResult);
        expect(prefixResult.auditTrail).toBeDefined();
        expect(prefixResult.auditTrail.timestamp).toBeDefined();
        expect(prefixResult.auditTrail.originalMessage).toBe('WIP: test');
        expect(prefixResult.auditTrail.bypassType).toBe('prefix');

        // Test emergency bypass audit trail
        const emergencyResult = orchestrator.checkBypassMechanisms('emergency fix', validationResult);
        expect(emergencyResult.auditTrail).toBeDefined();
        expect(emergencyResult.auditTrail.timestamp).toBeDefined();
        expect(emergencyResult.auditTrail.originalMessage).toBe('emergency fix');
        expect(emergencyResult.auditTrail.bypassType).toBe('emergency');

        // Test environment bypass audit trail
        process.env.BMAD_BYPASS_COMMIT_MSG = 'true';
        const envResult = orchestrator.checkBypassMechanisms('any message', validationResult);
        expect(envResult.auditTrail).toBeDefined();
        expect(envResult.auditTrail.timestamp).toBeDefined();
        expect(envResult.auditTrail.bypassType).toBe('environment');
    });

    /**
     * Property 23.6: Bypass prefixes are case-sensitive
     * Only exact prefix matches should trigger bypass
     */
    test('**Property 23.6: Bypass prefixes are case-sensitive**', () => {
        const orchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true
        });

        const validationResult = { isValid: false };

        // Correct case should bypass
        expect(orchestrator.checkBypassMechanisms('WIP: test', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('TEMP: test', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('DEV: test', validationResult).bypassed).toBe(true);

        // Wrong case should not bypass
        expect(orchestrator.checkBypassMechanisms('wip: test', validationResult).bypassed).toBe(false);
        expect(orchestrator.checkBypassMechanisms('Wip: test', validationResult).bypassed).toBe(false);
        expect(orchestrator.checkBypassMechanisms('temp: test', validationResult).bypassed).toBe(false);
        expect(orchestrator.checkBypassMechanisms('dev: test', validationResult).bypassed).toBe(false);
    });

    /**
     * Property 23.7: Emergency keywords are case-insensitive
     * Emergency and hotfix should work in any case
     */
    test('**Property 23.7: Emergency keywords are case-insensitive**', () => {
        const orchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true
        });

        const validationResult = { isValid: false };

        // Various cases of emergency
        expect(orchestrator.checkBypassMechanisms('emergency fix', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('EMERGENCY fix', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('Emergency fix', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('EmErGeNcY fix', validationResult).bypassed).toBe(true);

        // Various cases of hotfix
        expect(orchestrator.checkBypassMechanisms('hotfix issue', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('HOTFIX issue', validationResult).bypassed).toBe(true);
        expect(orchestrator.checkBypassMechanisms('HotFix issue', validationResult).bypassed).toBe(true);
    });

    /**
     * Property 23.8: Property-based test - bypass behavior is consistent
     * For any message with bypass prefix in dev mode, bypass should work consistently
     */
    test('**Property 23.8: Bypass behavior is consistent across messages**', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant('WIP:'),
                    fc.constant('TEMP:'),
                    fc.constant('DEV:')
                ),
                fc.string({ minLength: 1, maxLength: 100 }),
                (prefix, message) => {
                    const orchestrator = new HookOrchestrator({
                        developmentMode: true,
                        enableLinting: true,
                        enableTesting: true
                    });

                    const fullMessage = `${prefix} ${message}`;
                    const result = orchestrator.checkBypassMechanisms(fullMessage, { isValid: false });

                    // Property: All valid prefixes should bypass in dev mode
                    expect(result.bypassed).toBe(true);
                    expect(result.auditTrail).toBeDefined();
                    expect(result.auditTrail.originalMessage).toBe(fullMessage);
                    expect(result.auditTrail.bypassType).toBe('prefix');
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 23.9: Property-based test - no bypass without valid trigger
     * For any message without bypass triggers in production, bypass should not occur
     */
    test('**Property 23.9: No bypass without valid trigger in production**', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }).filter(
                    msg => !msg.startsWith('WIP:') &&
                        !msg.startsWith('TEMP:') &&
                        !msg.startsWith('DEV:') &&
                        !msg.toLowerCase().includes('emergency') &&
                        !msg.toLowerCase().includes('hotfix')
                ),
                (message) => {
                    const orchestrator = new HookOrchestrator({
                        developmentMode: false,
                        enableLinting: true,
                        enableTesting: true
                    });

                    const result = orchestrator.checkBypassMechanisms(message, { isValid: false });

                    // Property: Without valid triggers in production, no bypass should occur
                    expect(result.bypassed).toBe(false);
                    expect(result.auditTrail).toBeNull();
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 23.10: Bypass maintains rapid iteration capability
     * Bypass should allow commits to proceed without validation delays
     */
    test('**Property 23.10: Bypass enables rapid iteration**', async () => {
        const mockFs = require('fs');
        const mockExecSync = require('child_process').execSync;

        mockFs.existsSync.mockReturnValue(true);
        mockExecSync.mockReturnValue('');

        const orchestrator = new HookOrchestrator({
            developmentMode: true,
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: true
        });

        // Simulate commit message validation with bypass
        const startTime = Date.now();
        const result = await orchestrator.executeCommitMsg('WIP: rapid iteration test');
        const duration = Date.now() - startTime;

        // Property: Bypass should allow quick execution
        expect(result.success).toBe(true);
        expect(result.results.bypass.bypassed).toBe(true);
        expect(duration).toBeLessThan(1000); // Should be fast
    });
});
