/**
 * Debug test to understand property test failures
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

describe('Debug Property Test', () => {
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

    test('should debug single execution', async () => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup consistent successful mocks
        mockFs.existsSync.mockImplementation((filePath) => {
            console.log('existsSync called with:', filePath);
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('activeContext.md')) return false;
            return false;
        });

        mockFs.readFileSync.mockImplementation((filePath, encoding) => {
            console.log('readFileSync called with:', filePath);
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
            console.log('execSync called with:', command);
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

        // Create fresh orchestrator
        const freshOrchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        console.log('About to call executePrePush...');
        const result = await freshOrchestrator.executePrePush('main', 'origin');
        console.log('Result:', JSON.stringify(result, null, 2));

        // Basic assertions
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
        // Don't require duration > 0 for now
        expect(result.results).toBeDefined();
        expect(result.branch).toBe('main');
        expect(result.remote).toBe('origin');
    });
});