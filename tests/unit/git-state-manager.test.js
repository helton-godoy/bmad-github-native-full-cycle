/**
 * @ai-context Unit Tests for GitStateManager
 */
const GitStateManager = require('../../scripts/lib/git-state-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('GitStateManager', () => {
    const TEST_BRANCH = 'bmad-test-state';
    const manager = new GitStateManager(TEST_BRANCH);
    const testFile = 'test-context.json';
    const testContent = JSON.stringify({ status: 'active', step: 1 });

    beforeAll(() => {
        // Cleanup existing test branch if any
        try {
            execSync(`git branch -D ${TEST_BRANCH}`, { stdio: 'ignore' });
        } catch (e) { }
    });

    afterAll(() => {
        // Cleanup
        try {
            execSync(`git branch -D ${TEST_BRANCH}`, { stdio: 'ignore' });
        } catch (e) { }
    });

    test('should initialize the orphan branch', () => {
        manager.init();
        const branches = execSync('git branch').toString();
        // Since it's an orphan branch with no checkout, it might not show up in 'git branch' 
        // until a commit is made? No, update-ref creates it.
        // However, 'git branch' usually lists refs/heads.

        // Let's check via rev-parse
        const ref = execSync(`git rev-parse --verify ${TEST_BRANCH}`).toString().trim();
        expect(ref).toBeTruthy();
    });

    test('should write content without touching working directory', () => {
        manager.write(testFile, testContent);

        // Verify file does NOT exist in current work dir
        expect(fs.existsSync(testFile)).toBe(false);

        // Verify content exists in branch
        const content = manager.read(testFile);
        expect(content).toBe(testContent);
    });

    test('should update existing content', () => {
        const newContent = JSON.stringify({ status: 'completed', step: 2 });
        manager.write(testFile, newContent);

        const content = manager.read(testFile);
        expect(content).toBe(newContent);
    });

    test('should handle nested paths', () => {
        const nestedFile = 'deep/nested/state.md';
        const nestedContent = '# Deep State';

        manager.write(nestedFile, nestedContent);

        const content = manager.read(nestedFile);
        expect(content).toBe(nestedContent);
    });
});
