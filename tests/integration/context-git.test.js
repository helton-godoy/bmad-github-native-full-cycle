/**
 * @ai-context Integration Test for ContextManager with Git Backend
 */
const ContextManager = require('../../scripts/lib/context-manager');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('ContextManager Integration (Git Backend)', () => {
    const TEST_FILE = 'integration-test.md';
    const TEST_CONTENT = '# Integration Test Content';

    beforeAll(() => {
        process.env.BMAD_USE_GIT_STATE = 'true';
    });

    afterAll(() => {
        delete process.env.BMAD_USE_GIT_STATE;
        // Cleanup local file
        if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
    });

    test('should write to both Git and Local FS', () => {
        const manager = new ContextManager();
        manager.write(TEST_FILE, TEST_CONTENT);

        // Check Local
        expect(fs.existsSync(TEST_FILE)).toBe(true);
        expect(fs.readFileSync(TEST_FILE, 'utf-8')).toBe(TEST_CONTENT);

        // Check Git
        const gitContent = execSync(`git show bmad-state:${TEST_FILE}`, { encoding: 'utf-8' });
        expect(gitContent).toBe(TEST_CONTENT);
    });

    test('should read from Git even if local file is deleted', () => {
        const manager = new ContextManager();

        // Delete local file to prove it reads from Git
        fs.unlinkSync(TEST_FILE);
        expect(fs.existsSync(TEST_FILE)).toBe(false);

        const content = manager.read(TEST_FILE);
        expect(content).toBe(TEST_CONTENT);
    });
});
