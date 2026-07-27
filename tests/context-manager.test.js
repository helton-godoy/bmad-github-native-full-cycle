/**
 * @ai-context Test script for ContextManager concurrency
 */
const ContextManager = require('../scripts/lib/context-manager');
const fs = require('fs');
const path = require('path');

describe('ContextManager Concurrency', () => {
    test('handles concurrent writes', async () => {
        const contextManager = new ContextManager();
        const testFile = 'test-concurrency.md';
        const iterations = 5;

        // Initialize file
        contextManager.write(testFile, 'Initial Content\n');

        const promises = [];

        for (let i = 0; i < iterations; i++) {
            promises.push(new Promise(async (resolve) => {
                const id = i;
                try {
                    await contextManager.write(testFile, `Write from process ${id}\n`);
                    resolve(true);
                } catch (error) {
                    resolve(false);
                }
            }));
        }

        const results = await Promise.all(promises);
        expect(results.every(r => r === true)).toBe(true);

        const finalContent = contextManager.read(testFile);
        expect(finalContent).toBeDefined();

        // Cleanup
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
        if (fs.existsSync('.locks')) {
            fs.rmSync('.locks', { recursive: true, force: true });
        }
    });
});
