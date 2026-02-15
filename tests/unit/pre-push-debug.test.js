/**
 * Debug test for Pre-push Validation
 */

// Mock child_process before requiring HookOrchestrator
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

// Mock fs before requiring HookOrchestrator
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

const HookOrchestrator = require('../../scripts/hooks/hook-orchestrator');

describe('Pre-push Debug Tests', () => {
    let orchestrator;
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        // Setup fs mock
        mockFs = require('fs');
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

        // Setup execSync mock
        mockExecSync = require('child_process').execSync;
        mockExecSync.mockClear();

        // Default mock implementations
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
                return '[DEVELOPER] [STEP-001] Test commit\n[QA] [TEST-002] Another commit';
            }
            if (command.includes('git diff')) {
                return 'src/test.js\nREADME.md';
            }
            return '';
        });

        orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false, // Disable for isolated testing
            developmentMode: false
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should execute pre-push validation and return structured result', async () => {
        const result = await orchestrator.executePrePush('main', 'origin');

        console.log('Pre-push result:', JSON.stringify(result, null, 2));

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
        expect(result.results).toBeDefined();
    });

    test('should run full test suite', async () => {
        const result = await orchestrator.runFullTestSuite();

        console.log('Test suite result:', JSON.stringify(result, null, 2));

        expect(result).toBeDefined();
        expect(result.status).toMatch(/^(passed|failed|warning|skipped)$/);
    });

    test('should validate build', async () => {
        const result = await orchestrator.validateBuild();

        console.log('Build validation result:', JSON.stringify(result, null, 2));

        expect(result).toBeDefined();
        expect(result.status).toMatch(/^(passed|failed|warning)$/);
    });

    test('should run security audit', async () => {
        const result = await orchestrator.runSecurityAudit();

        console.log('Security audit result:', JSON.stringify(result, null, 2));

        expect(result).toBeDefined();
        expect(result.status).toMatch(/^(passed|failed|warning)$/);
    });
});