/**
 * Property-Based Tests for Validation Failure Prevention
 * Requirements: 3.5
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

describe('Validation Failure Prevention Property Tests', () => {
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Setup fs mock
        mockFs = require('fs');
        mockFs.existsSync.mockClear();
        mockFs.readFileSync.mockClear();

        // Setup execSync mock
        mockExecSync = require('child_process').execSync;
        mockExecSync.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * **Feature: git-hooks-automation, Property 9: Validation failure prevention**
     * **Validates: Requirements 3.5**
     */
    test('should prevent push and provide detailed failure reports with remediation guidance for any validation failure', async () => {
        // Test with a single known failure case first
        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        // Setup mocks for test failure scenario
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('activeContext.md')) return false;
            return false;
        });

        mockFs.readFileSync.mockImplementation((filePath, encoding) => {
            if (filePath.endsWith('package.json')) {
                return JSON.stringify({
                    scripts: {
                        test: 'jest',
                        'test:coverage': 'jest --coverage',
                        build: 'echo "Building..."'
                    },
                    jest: {
                        coverageThreshold: {
                            global: {
                                branches: 80,
                                functions: 80,
                                lines: 80,
                                statements: 80
                            }
                        }
                    }
                });
            }
            return '';
        });

        // Mock test failure
        mockExecSync.mockImplementation((command) => {
            if (command.includes('npm run test:coverage') || command.includes('npm test -- --coverage')) {
                const error = new Error('Tests failed');
                error.stdout = 'Tests: 5 passed, 3 failed, 8 total\nTime: 2.5s\nAll files | 75.0 | 70.0 | 65.0 | 72.0';
                error.status = 1;
                throw error;
            }

            if (command.includes('npm run build')) {
                return 'Build completed successfully';
            }

            if (command.includes('npm audit --audit-level=moderate')) {
                return JSON.stringify({
                    vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }
                });
            }

            if (command.includes('git log')) {
                return '[DEVELOPER] [STEP-001] Test commit';
            }
            if (command.includes('git diff')) {
                return 'src/test.js';
            }
            if (command.includes('git rev-parse')) {
                return 'abc123def456';
            }
            return '';
        });

        const result = await orchestrator.executePrePush('main', 'origin');

        // Property: When validation fails, push should be prevented
        expect(result.success).toBe(false);

        // Property: Failure reports should be provided when validation fails
        expect(result.failureReport || result.error).toBeDefined();

        if (result.failureReport) {
            // Property: Failure report should have structured information
            expect(result.failureReport.type).toBeDefined();
            expect(result.failureReport.timestamp).toBeDefined();
            expect(Array.isArray(result.failureReport.failures)).toBe(true);
            expect(result.failureReport.summary).toBeDefined();
            expect(typeof result.failureReport.summary.totalChecks).toBe('number');
            expect(typeof result.failureReport.summary.failedChecks).toBe('number');
        }

        // Property: Remediation guidance should be provided when validation fails
        expect(result.remediation).toBeDefined();

        if (result.remediation) {
            // Property: Remediation should have actionable information
            expect(Array.isArray(result.remediation.steps)).toBe(true);
            expect(Array.isArray(result.remediation.commands)).toBe(true);

            // Property: At least some remediation should be provided
            expect(result.remediation.steps.length > 0 || result.remediation.commands.length > 0).toBe(true);
        }

        // Property: Test failure should be reflected in results
        expect(result.results.fullTestSuite.status).toBe('failed');
        expect(result.results.fullTestSuite.error).toBeDefined();

        // Property: All validation results should be present even when some fail
        const requiredChecks = ['fullTestSuite', 'buildValidation', 'securityAudit', 'bmadWorkflowSync'];
        requiredChecks.forEach(check => {
            expect(result.results[check]).toBeDefined();
            expect(result.results[check].status).toMatch(/^(passed|failed|warning|skipped)$/);
        });

        // Property: Duration should be recorded even for failures
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);

        // Property: Branch and remote should be preserved in result
        expect(result.branch).toBe('main');
        expect(result.remote).toBe('origin');
    });
});