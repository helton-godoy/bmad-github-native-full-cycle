/**
 * @ai-context Test script for ContextManager concurrency
 */
const ContextManager = require('../scripts/lib/context-manager');
const fs = require('fs');
const path = require('path');

async function testConcurrency() {
    console.log('🧪 Starting ContextManager Concurrency Test...');

    const contextManager = new ContextManager();
    const testFile = 'test-concurrency.md';
    const iterations = 5;

    // Initialize file
    contextManager.write(testFile, 'Initial Content\n');

    console.log(`Running ${iterations} concurrent writes...`);

    const promises = [];

    for (let i = 0; i < iterations; i++) {
        promises.push(new Promise(async (resolve) => {
            const id = i;
            try {
                await contextManager.write(testFile, `Write from process ${id}\n`);
                console.log(`✅ Process ${id} wrote successfully`);
                resolve(true);
            } catch (error) {
                console.error(`❌ Process ${id} failed: ${error.message}`);
                resolve(false);
            }
        }));
    }

    await Promise.all(promises);

    const finalContent = contextManager.read(testFile);
    console.log('Final Content:', finalContent);

    // Cleanup
    fs.unlinkSync(testFile);
    if (fs.existsSync('.locks')) {
        fs.rmdirSync('.locks', { recursive: true });
    }

    console.log('🎉 Test Completed');
}

testConcurrency();
