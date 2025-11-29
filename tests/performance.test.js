/**
 * @ai-context Performance Test for Caching
 */
const BasePersona = require('../personas/base-persona-enhanced');
const { mockOctokit } = require('./mocks/bmad-mocks');

// Mock dependencies
jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

// Mock ContextManager/Logger/SecretManager to avoid side effects during test
jest.mock('../scripts/lib/logger');
jest.mock('../scripts/lib/secret-manager');
// We keep CacheManager real or use a temp dir? 
// For "Deep Dive" performance test, we want to test the CacheManager integration.
// But we should mock the FS or use a temp dir to avoid polluting .github/cache
// For simplicity in this unit/perf test, we can let it write to a test-specific cache dir 
// or mock CacheManager if we only want to test the logic flow.
// Let's mock CacheManager to control hits/misses purely in memory for stability?
// No, the user wants "Deep Dive" performance. Let's use the real CacheManager but verify the logic.
// Actually, to verify "Hit is faster than Miss", we need the logic to work.
// Let's just ensure we clean up.

describe('Performance Optimization', () => {
    let persona;

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup Mock Octokit with delay
        mockOctokit.rest.issues.get.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms network delay simulation
            return { data: { number: 999, title: 'Performance Test Issue' } };
        });

        persona = new BasePersona('PerfTester', 'TEST', 'token');
        // Ensure cache is empty
        persona.cacheManager.clear();
    });

    afterEach(() => {
        persona.cacheManager.clear();
    });

    test('Cache Hit should be significantly faster than Cache Miss', async () => {
        console.log('1️⃣ First Call (Cache Miss)...');
        const start1 = Date.now();
        await persona.getIssue(999);
        const duration1 = Date.now() - start1;
        console.log(`⏱️ Duration Miss: ${duration1}ms`);

        console.log('2️⃣ Second Call (Cache Hit)...');
        const start2 = Date.now();
        await persona.getIssue(999);
        const duration2 = Date.now() - start2;
        console.log(`⏱️ Duration Hit: ${duration2}ms`);

        expect(duration1).toBeGreaterThanOrEqual(200); // Should reflect network delay
        expect(duration2).toBeLessThan(50); // Should be instant (file read)
    });
});
