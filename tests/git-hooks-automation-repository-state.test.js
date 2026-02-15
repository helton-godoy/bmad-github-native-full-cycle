/**
 * Property-based tests for Git Hooks Automation - Repository State Validation
 * **Validates: Requirements 5.2**
 * **Feature: git-hooks-automation, Property 14: Repository state validation**
 * 
 * Property 14: For any merge or integration operation, when repository state validation 
 * is needed, the system should verify the repository remains in a valid state
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

describe('Repository State Validation - Property 14', () => {
    let mockExecSync;
    let mockFs;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFs = require('fs');
        mockExecSync = require('child_process').execSync;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Property 14.1: Validation always returns a complete result object
     * For any merge type, validateRepositoryState should return an object
     * with all required fields for determining repository validity
     */
    test('**Property 14.1: Validation returns complete result object**', async () => {
        // Setup mocks for successful validation
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        // Run validation for different merge types
        const mergeTypes = ['fast-forward', 'merge-commit', 'rebase', 'squash'];

        await Promise.all(mergeTypes.map(async (mergeType) => {
            const result = await orchestrator.validateRepositoryState(mergeType);

            // Property: Result should always have all required fields
            expect(result).toHaveProperty('workingTreeClean');
            expect(result).toHaveProperty('hasUnmergedPaths');
            expect(result).toHaveProperty('branchValid');
            expect(result).toHaveProperty('criticalFiles');
            expect(result).toHaveProperty('integrityCheck');
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('issues');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('status');
        }));
    });

    /**
     * Property 14.2: Validation detects working tree issues
     * When there are uncommitted changes, validation should detect them
     */
    test('**Property 14.2: Validation detects uncommitted changes**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        let callCount = 0;
        mockExecSync.mockImplementation((command) => {
            callCount++;
            if (command.includes('git status')) {
                // Return non-empty status indicating uncommitted changes
                return ' M src/test.js\n?? untracked.txt';
            }
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const result = await orchestrator.validateRepositoryState('merge-commit');

        // Property: Uncommitted changes should be detected
        expect(result.workingTreeClean).toBe(false);
        expect(result.issues).toContain('Working tree has uncommitted changes');
        expect(result.isValid).toBe(false);
    });

    /**
     * Property 14.3: Validation detects unmerged paths
     * When there are merge conflicts, validation should detect them
     */
    test('**Property 14.3: Validation detects unmerged paths**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) {
                // Simulate conflict markers detected - git diff --check returns non-zero
                const error = new Error('conflict markers found');
                error.stdout = 'conflict marker in file.js';
                throw error;
            }
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const result = await orchestrator.validateRepositoryState('merge-commit');

        // Property: Unmerged paths should be detected
        expect(result.hasUnmergedPaths).toBe(true);
        expect(result.issues).toContain('Repository has unmerged paths or conflict markers');
        expect(result.isValid).toBe(false);
    });

    /**
     * Property 14.4: Validation detects missing critical files
     * When critical files are missing, validation should fail
     */
    test('**Property 14.4: Validation detects missing critical files**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            // Simulate missing package.json
            if (filePath.endsWith('package.json')) return false;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const result = await orchestrator.validateRepositoryState('merge-commit');

        // Property: Missing critical files should be detected
        expect(result.criticalFiles.packageJson).toBe(false);
        expect(result.issues).toContain('Critical file missing: package.json');
        expect(result.isValid).toBe(false);
    });

    /**
     * Property 14.5: Validation passes for clean repository
     * When repository is in valid state, validation should pass
     */
    test('**Property 14.5: Validation passes for clean repository**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const result = await orchestrator.validateRepositoryState('merge-commit');

        // Property: Clean repository should pass validation
        expect(result.workingTreeClean).toBe(true);
        expect(result.hasUnmergedPaths).toBe(false);
        expect(result.branchValid).toBe(true);
        expect(result.criticalFiles.packageJson).toBe(true);
        expect(result.criticalFiles.gitDirectory).toBe(true);
        expect(result.integrityCheck.hasErrors).toBe(false);
        expect(result.isValid).toBe(true);
        expect(result.status).toBe('passed');
        expect(result.summary).toBe('Repository state is valid');
    });

    /**
     * Property 14.6: Validation detects git integrity issues
     * When git fsck finds errors, validation should detect them
     */
    test('**Property 14.6: Validation detects git integrity issues**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) {
                // Simulate git fsck finding errors
                return 'error: refs/heads/main: invalid reflog entry';
            }
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const result = await orchestrator.validateRepositoryState('merge-commit');

        // Property: Git integrity errors should be detected
        expect(result.integrityCheck.hasErrors).toBe(true);
        expect(result.issues).toContain('Repository integrity check found errors');
        expect(result.isValid).toBe(false);
    });

    /**
     * Property 14.7: Validation works for all merge types
     * validateRepositoryState should work consistently for any merge type
     */
    test('**Property 14.7: Validation works for all merge types**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const mergeTypes = ['fast-forward', 'merge-commit', 'rebase', 'squash', 'unknown'];

        // Property: Validation should work for all merge types
        for (const mergeType of mergeTypes) {
            const result = await orchestrator.validateRepositoryState(mergeType);

            expect(result).toBeDefined();
            expect(result.status).toBeDefined();
            expect(result.isValid).toBeDefined();
            expect(result.issues).toBeInstanceOf(Array);
        }
    });

    /**
     * Property 14.8: Post-merge validation integrates with repository state check
     * executePostMerge should include repository validation in results
     */
    test('**Property 14.8: Post-merge includes repository validation**', async () => {
        mockFs.existsSync.mockImplementation((filePath) => {
            if (filePath.endsWith('package.json')) return true;
            if (filePath.endsWith('.git')) return true;
            return false;
        });

        mockExecSync.mockImplementation((command) => {
            if (command.includes('git status')) return '';
            if (command.includes('git diff --check')) return '';
            if (command.includes('git rev-parse')) return 'main';
            if (command.includes('git fsck')) return '';
            if (command.includes('npm run bmad:workflow')) {
                throw new Error('Workflow script not found');
            }
            return '';
        });

        const orchestrator = new HookOrchestrator({
            enableLinting: true,
            enableTesting: true,
            enableContextValidation: true,
            enableGatekeeper: false,
            developmentMode: false
        });

        const result = await orchestrator.executePostMerge('merge-commit');

        // Property: Post-merge should include repository validation
        expect(result.results).toHaveProperty('repositoryValidation');
        expect(result.results.repositoryValidation.status).toBeDefined();
        expect(result.results.repositoryValidation.isValid).toBeDefined();
    });
});