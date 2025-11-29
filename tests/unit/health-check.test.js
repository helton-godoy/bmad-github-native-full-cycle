/**
 * @ai-context Unit Tests for Health Check and Circuit Breaker
 */
const ContextManager = require('../../scripts/lib/context-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mock Logger to avoid cluttering output
jest.mock('../../scripts/lib/logger', () => {
    return jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }));
});

describe('Watchdog & Circuit Breaker', () => {
    const contextManager = new ContextManager();
    const cbFile = 'circuit-breaker.json';
    const testStateFile = '.github/workflow-state-999.json';

    beforeEach(() => {
        // Reset state
        if (fs.existsSync(cbFile)) fs.unlinkSync(cbFile);
        if (fs.existsSync(testStateFile)) fs.unlinkSync(testStateFile);

        // Ensure .github exists
        if (!fs.existsSync('.github')) fs.mkdirSync('.github');
    });

    afterAll(() => {
        if (fs.existsSync(cbFile)) fs.unlinkSync(cbFile);
        if (fs.existsSync(testStateFile)) fs.unlinkSync(testStateFile);
    });

    test('Circuit Breaker should open after 3 failures', () => {
        contextManager.recordFailure();
        contextManager.recordFailure();
        const state = contextManager.recordFailure();

        expect(state.failures).toBe(3);
        expect(state.isOpen).toBe(true);
        expect(contextManager.isCircuitOpen()).toBe(true);
    });

    test('Circuit Breaker should reset manually', () => {
        contextManager.recordFailure();
        contextManager.recordFailure();
        contextManager.recordFailure();
        expect(contextManager.isCircuitOpen()).toBe(true);

        contextManager.resetFailure();
        expect(contextManager.isCircuitOpen()).toBe(false);
    });

    test('Health Check should detect stalled workflow', () => {
        // Create a stale state file (15 mins old)
        fs.writeFileSync(testStateFile, JSON.stringify({ status: 'running' }));
        const oldTime = new Date(Date.now() - 15 * 60 * 1000);
        fs.utimesSync(testStateFile, oldTime, oldTime);

        // Run health check script
        // We use execSync to run the script as a separate process to capture stdout
        const output = execSync('node scripts/bmad/health-check.js').toString();

        expect(output).toContain('RESUME_NEEDED:999');
    });

    test('Health Check should respect Circuit Breaker', () => {
        // Open Circuit
        contextManager.recordFailure();
        contextManager.recordFailure();
        contextManager.recordFailure();

        const output = execSync('node scripts/bmad/health-check.js').toString();

        expect(output).toContain('CIRCUIT_OPEN');
        expect(output).not.toContain('RESUME_NEEDED');
    });
});
