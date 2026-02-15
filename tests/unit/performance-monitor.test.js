/**
 * Property-Based Tests for Performance Monitor
 * **Feature: git-hooks-automation, Property 22: Optimized execution**
 * **Feature: git-hooks-automation, Property 23: Development workflow bypass**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 */

const fc = require('fast-check');
const PerformanceMonitor = require('../../scripts/lib/performance-monitor');

describe('Performance Monitor Property Tests', () => {
    let monitor;

    beforeEach(() => {
        monitor = new PerformanceMonitor({
            performanceThreshold: 5000,
            optimizationThreshold: 3000,
            developmentMode: false,
            enableOptimizations: true
        });
    });

    afterEach(() => {
        monitor.clearMetrics();
    });

    /**
     * **Property 22: Optimized execution**
     * **Validates: Requirements 8.2, 8.3**
     * 
     * Property: For any hook execution, the monitor should:
     * 1. Track execution timing accurately
     * 2. Detect optimization opportunities when execution exceeds threshold
     * 3. Generate appropriate recommendations based on hook type and duration
     * 4. Maintain performance metrics within acceptable limits
     */
    test('should detect optimization opportunities and generate recommendations for any slow execution', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('pre-commit', 'pre-push', 'post-commit', 'post-merge', 'commit-msg'),
            fc.integer({ min: 3001, max: 30000 }), // Duration above optimization threshold (exclusive)
            fc.boolean(), // success
            fc.integer({ min: 3, max: 10 }), // number of executions
            async (hookType, duration, success, executionCount) => {
                // Clear previous metrics
                monitor.clearMetrics();

                // Simulate multiple slow executions
                const executionIds = [];
                for (let i = 0; i < executionCount; i++) {
                    const execId = monitor.startExecution(hookType, { iteration: i });
                    executionIds.push(execId);

                    // Simulate execution time
                    await new Promise(resolve => setTimeout(resolve, 10));

                    // Manually set duration for testing
                    const startData = monitor.startTimes.get(execId);
                    startData.startTime = Date.now() - duration;

                    const execution = monitor.endExecution(execId, success);

                    // Property: Execution should be marked as optimizable
                    expect(execution.optimizable).toBe(duration > monitor.config.optimizationThreshold);

                    // Property: Performance threshold should be correctly evaluated
                    expect(execution.performanceThresholdMet).toBe(duration <= monitor.config.performanceThreshold);

                    // Property: Duration should be recorded accurately
                    expect(execution.duration).toBeGreaterThanOrEqual(duration - 100); // Allow small variance
                    expect(execution.duration).toBeLessThanOrEqual(duration + 100);
                }

                // Property: Metrics should be tracked for all executions
                const metrics = monitor.getMetrics();
                expect(metrics.totalExecutions).toBe(executionCount);
                expect(metrics.byHookType[hookType]).toBeDefined();
                expect(metrics.byHookType[hookType].count).toBe(executionCount);

                // Property: If executions are slow, optimizations should be detected
                if (executionCount >= 3 && duration > monitor.config.optimizationThreshold) {
                    const optimizations = monitor.getOptimizationRecommendations();
                    expect(optimizations.length).toBeGreaterThan(0);

                    // Property: Recommendations should be relevant to hook type
                    const latestOptimization = optimizations[optimizations.length - 1];
                    expect(latestOptimization.hookType).toBe(hookType);
                    expect(latestOptimization.recommendations).toBeDefined();
                    expect(latestOptimization.recommendations.length).toBeGreaterThan(0);

                    // Property: Recommendations should be strings
                    latestOptimization.recommendations.forEach(rec => {
                        expect(typeof rec).toBe('string');
                        expect(rec.length).toBeGreaterThan(0);
                    });
                }

                // Property: Average duration should be calculated correctly
                expect(metrics.averageDuration).toBeGreaterThan(0);
                expect(metrics.averageDuration).toBeGreaterThanOrEqual(duration - 200);
                expect(metrics.averageDuration).toBeLessThanOrEqual(duration + 200);

                // Property: Success rate should be accurate
                const expectedSuccessRate = success ? 1.0 : 0.0;
                expect(metrics.successRate).toBe(expectedSuccessRate);
            }
        ), { numRuns: 20 });
    });

    /**
     * **Property 23: Development workflow bypass**
     * **Validates: Requirements 8.4**
     * 
     * Property: In development mode, the monitor should recommend bypass when:
     * 1. Multiple recent executions are consistently slow
     * 2. More than 60% of recent executions exceed performance threshold
     * 3. Bypass should not be recommended for fast executions
     */
    test('should recommend development workflow bypass for consistently slow executions', async () => {
        await fc.assert(fc.asyncProperty(
            fc.boolean(), // developmentMode
            fc.array(
                fc.record({
                    duration: fc.integer({ min: 1000, max: 15000 }),
                    success: fc.boolean()
                }),
                { minLength: 5, maxLength: 10 }
            ),
            async (developmentMode, executions) => {
                // Create monitor with specified development mode
                const devMonitor = new PerformanceMonitor({
                    performanceThreshold: 5000,
                    optimizationThreshold: 3000,
                    developmentMode,
                    enableOptimizations: true
                });

                // Execute all test executions
                for (const exec of executions) {
                    const execId = devMonitor.startExecution('pre-commit', {});

                    // Simulate execution time
                    await new Promise(resolve => setTimeout(resolve, 5));

                    // Set duration for testing
                    const startData = devMonitor.startTimes.get(execId);
                    startData.startTime = Date.now() - exec.duration;

                    devMonitor.endExecution(execId, exec.success);
                }

                // Check bypass recommendation
                const shouldBypass = devMonitor.shouldBypassInDevelopment();

                // Property: Bypass should only be recommended in development mode
                if (!developmentMode) {
                    expect(shouldBypass).toBe(false);
                } else {
                    // Calculate expected bypass based on recent executions
                    const recentExecs = executions.slice(-5);

                    if (recentExecs.length >= 3) {
                        const slowCount = recentExecs.filter(
                            e => e.duration > devMonitor.config.performanceThreshold
                        ).length;
                        const slowRate = slowCount / recentExecs.length;

                        // Property: Bypass should be recommended if >60% are slow
                        if (slowRate > 0.6) {
                            expect(shouldBypass).toBe(true);
                        } else {
                            expect(shouldBypass).toBe(false);
                        }
                    } else {
                        // Property: Not enough data, should not bypass
                        expect(shouldBypass).toBe(false);
                    }
                }

                // Property: Metrics should be consistent
                const metrics = devMonitor.getMetrics();
                expect(metrics.totalExecutions).toBe(executions.length);

                devMonitor.clearMetrics();
            }
        ), { numRuns: 25 });
    });

    /**
     * Additional property: Metrics aggregation should be accurate
     */
    test('should maintain accurate aggregate metrics for any sequence of executions', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(
                fc.record({
                    hookType: fc.constantFrom('pre-commit', 'pre-push', 'post-commit'),
                    duration: fc.integer({ min: 100, max: 10000 }),
                    success: fc.boolean()
                }),
                { minLength: 1, maxLength: 20 }
            ),
            async (executions) => {
                monitor.clearMetrics();

                // Execute all test cases
                for (const exec of executions) {
                    const execId = monitor.startExecution(exec.hookType, {});

                    await new Promise(resolve => setTimeout(resolve, 5));

                    const startData = monitor.startTimes.get(execId);
                    startData.startTime = Date.now() - exec.duration;

                    monitor.endExecution(execId, exec.success);
                }

                const metrics = monitor.getMetrics();

                // Property: Total executions should match
                expect(metrics.totalExecutions).toBe(executions.length);

                // Property: Success rate should be accurate
                const successCount = executions.filter(e => e.success).length;
                const expectedSuccessRate = successCount / executions.length;
                expect(metrics.successRate).toBeCloseTo(expectedSuccessRate, 2);

                // Property: Average duration should be within expected range
                const totalDuration = executions.reduce((sum, e) => sum + e.duration, 0);
                const expectedAvg = totalDuration / executions.length;
                expect(metrics.averageDuration).toBeGreaterThanOrEqual(expectedAvg - 200);
                expect(metrics.averageDuration).toBeLessThanOrEqual(expectedAvg + 200);

                // Property: Performance threshold met rate should be accurate
                const thresholdMetCount = executions.filter(
                    e => e.duration <= monitor.config.performanceThreshold
                ).length;
                const expectedThresholdRate = thresholdMetCount / executions.length;
                expect(metrics.performanceThresholdMetRate).toBeCloseTo(expectedThresholdRate, 2);

                // Property: Hook type breakdown should be accurate
                const hookTypes = [...new Set(executions.map(e => e.hookType))];
                hookTypes.forEach(hookType => {
                    const hookExecs = executions.filter(e => e.hookType === hookType);
                    expect(metrics.byHookType[hookType].count).toBe(hookExecs.length);
                });
            }
        ), { numRuns: 20 });
    });

    /**
     * Additional property: Optimization recommendations should be hook-specific
     */
    test('should generate hook-specific optimization recommendations', async () => {
        await fc.assert(fc.asyncProperty(
            fc.constantFrom('pre-commit', 'pre-push', 'post-commit'),
            fc.integer({ min: 5000, max: 30000 }),
            async (hookType, duration) => {
                monitor.clearMetrics();

                // Create multiple slow executions to trigger optimization detection
                for (let i = 0; i < 5; i++) {
                    const execId = monitor.startExecution(hookType, {});

                    await new Promise(resolve => setTimeout(resolve, 5));

                    const startData = monitor.startTimes.get(execId);
                    startData.startTime = Date.now() - duration;

                    monitor.endExecution(execId, true);
                }

                const optimizations = monitor.getOptimizationRecommendations();

                // Property: Optimizations should be detected for slow executions
                if (duration > monitor.config.optimizationThreshold) {
                    expect(optimizations.length).toBeGreaterThan(0);

                    const latestOpt = optimizations[optimizations.length - 1];

                    // Property: Recommendations should exist and be relevant
                    expect(latestOpt.recommendations).toBeDefined();
                    expect(Array.isArray(latestOpt.recommendations)).toBe(true);

                    if (latestOpt.recommendations.length > 0) {
                        // Property: Recommendations should contain hook-specific advice
                        const recommendationText = latestOpt.recommendations.join(' ').toLowerCase();

                        if (hookType === 'pre-commit' && duration > 5000) {
                            expect(
                                recommendationText.includes('test') ||
                                recommendationText.includes('lint') ||
                                recommendationText.includes('cache')
                            ).toBe(true);
                        }

                        if (hookType === 'pre-push' && duration > 30000) {
                            expect(
                                recommendationText.includes('parallel') ||
                                recommendationText.includes('optimize')
                            ).toBe(true);
                        }

                        if (hookType === 'post-commit' && duration > 8000) {
                            expect(
                                recommendationText.includes('background') ||
                                recommendationText.includes('documentation')
                            ).toBe(true);
                        }
                    }
                }
            }
        ), { numRuns: 15 });
    });

    /**
     * Additional property: Memory management should prevent unbounded growth
     */
    test('should maintain bounded memory usage regardless of execution count', async () => {
        await fc.assert(fc.asyncProperty(
            fc.integer({ min: 100, max: 500 }),
            async (executionCount) => {
                monitor.clearMetrics();

                // Create many executions
                for (let i = 0; i < executionCount; i++) {
                    const execId = monitor.startExecution('pre-commit', {});

                    const startData = monitor.startTimes.get(execId);
                    startData.startTime = Date.now() - 1000;

                    monitor.endExecution(execId, true);
                }

                const metrics = monitor.getMetrics();

                // Property: Executions array should be bounded to 100
                expect(monitor.executions.length).toBeLessThanOrEqual(100);

                // Property: If more than 100 executions, should keep most recent
                if (executionCount > 100) {
                    expect(monitor.executions.length).toBe(100);
                }

                // Property: Optimizations array should be bounded to 50
                expect(monitor.optimizations.length).toBeLessThanOrEqual(50);

                // Property: Metrics should still be calculable
                expect(metrics.totalExecutions).toBeGreaterThan(0);
                expect(metrics.averageDuration).toBeGreaterThan(0);
            }
        ), { numRuns: 10 });
    });
});

