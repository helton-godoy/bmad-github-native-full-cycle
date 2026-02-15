/**
 * Unit Tests for Performance Monitor - Edge Cases and Error Handling
 * Tests edge cases, accuracy, and error recovery
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

const PerformanceMonitor = require('../../scripts/lib/performance-monitor');

describe('Performance Monitor - Edge Cases', () => {
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

    describe('Execution Lifecycle', () => {
        test('should handle starting execution with valid parameters', () => {
            const execId = monitor.startExecution('pre-commit', { test: 'data' });

            expect(execId).toBeDefined();
            expect(typeof execId).toBe('string');
            expect(execId.length).toBeGreaterThan(0);
        });

        test('should handle starting execution without context', () => {
            const execId = monitor.startExecution('pre-commit');

            expect(execId).toBeDefined();
        });

        test('should handle starting execution with null context', () => {
            const execId = monitor.startExecution('pre-commit', null);

            expect(execId).toBeDefined();
        });

        test('should handle ending non-existent execution', () => {
            const result = monitor.endExecution('non-existent-id', true);

            expect(result).toBeDefined();
            expect(result.duration).toBe(0);
            expect(result.error).toBeDefined();
        });

        test('should handle ending execution twice', () => {
            const execId = monitor.startExecution('pre-commit', {});
            monitor.endExecution(execId, true);

            // Try to end again
            const result = monitor.endExecution(execId, true);

            expect(result).toBeDefined();
            expect(result.error).toBeDefined();
        });

        test('should handle very short execution times', async () => {
            const execId = monitor.startExecution('pre-commit', {});

            // End immediately
            const result = monitor.endExecution(execId, true);

            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.duration).toBeLessThan(100);
        });

        test('should handle execution with zero duration', () => {
            const execId = monitor.startExecution('pre-commit', {});

            // Manually set start time to now
            const startData = monitor.startTimes.get(execId);
            startData.startTime = Date.now();

            const result = monitor.endExecution(execId, true);

            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Hook Type Validation', () => {
        test('should handle valid hook types', () => {
            const validTypes = ['pre-commit', 'pre-push', 'post-commit', 'post-merge', 'commit-msg'];

            validTypes.forEach(hookType => {
                const execId = monitor.startExecution(hookType, {});
                expect(execId).toBeDefined();
            });
        });

        test('should handle invalid hook type', () => {
            const execId = monitor.startExecution('invalid-hook', {});

            expect(execId).toBeDefined();
            // Should still work but might log warning
        });

        test('should handle empty hook type', () => {
            const execId = monitor.startExecution('', {});

            expect(execId).toBeDefined();
        });

        test('should handle null hook type', () => {
            const execId = monitor.startExecution(null, {});

            expect(execId).toBeDefined();
        });
    });

    describe('Metrics Calculation', () => {
        test('should calculate metrics with no executions', () => {
            const metrics = monitor.getMetrics();

            expect(metrics.totalExecutions).toBe(0);
            expect(metrics.successRate).toBe(0);
            expect(metrics.averageDuration).toBe(0);
            expect(metrics.performanceThresholdMetRate).toBe(0);
        });

        test('should calculate metrics with single execution', () => {
            const execId = monitor.startExecution('pre-commit', {});
            const startData = monitor.startTimes.get(execId);
            startData.startTime = Date.now() - 1000;
            monitor.endExecution(execId, true);

            const metrics = monitor.getMetrics();

            expect(metrics.totalExecutions).toBe(1);
            expect(metrics.successRate).toBe(1.0);
            expect(metrics.averageDuration).toBeGreaterThan(0);
        });

        test('should calculate success rate correctly', () => {
            // Add successful executions
            for (let i = 0; i < 7; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000;
                monitor.endExecution(execId, true);
            }

            // Add failed executions
            for (let i = 0; i < 3; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000;
                monitor.endExecution(execId, false);
            }

            const metrics = monitor.getMetrics();

            expect(metrics.totalExecutions).toBe(10);
            expect(metrics.successRate).toBeCloseTo(0.7, 2);
        });

        test('should calculate average duration correctly', () => {
            const durations = [1000, 2000, 3000, 4000, 5000];

            durations.forEach(duration => {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - duration;
                monitor.endExecution(execId, true);
            });

            const metrics = monitor.getMetrics();
            const expectedAvg = durations.reduce((a, b) => a + b, 0) / durations.length;

            expect(metrics.averageDuration).toBeGreaterThanOrEqual(expectedAvg - 200);
            expect(metrics.averageDuration).toBeLessThanOrEqual(expectedAvg + 200);
        });

        test('should calculate performance threshold met rate', () => {
            // 6 executions under threshold
            for (let i = 0; i < 6; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 2000;
                monitor.endExecution(execId, true);
            }

            // 4 executions over threshold
            for (let i = 0; i < 4; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 6000;
                monitor.endExecution(execId, true);
            }

            const metrics = monitor.getMetrics();

            expect(metrics.performanceThresholdMetRate).toBeCloseTo(0.6, 2);
        });
    });

    describe('Hook Type Breakdown', () => {
        test('should track metrics by hook type', () => {
            const execId1 = monitor.startExecution('pre-commit', {});
            const startData1 = monitor.startTimes.get(execId1);
            startData1.startTime = Date.now() - 1000;
            monitor.endExecution(execId1, true);

            const execId2 = monitor.startExecution('pre-push', {});
            const startData2 = monitor.startTimes.get(execId2);
            startData2.startTime = Date.now() - 2000;
            monitor.endExecution(execId2, false);

            const metrics = monitor.getMetrics();

            expect(metrics.byHookType['pre-commit']).toBeDefined();
            expect(metrics.byHookType['pre-commit'].count).toBe(1);
            expect(metrics.byHookType['pre-push']).toBeDefined();
            expect(metrics.byHookType['pre-push'].count).toBe(1);
        });

        test('should calculate per-hook-type averages', () => {
            // Multiple pre-commit executions
            for (let i = 0; i < 3; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000;
                monitor.endExecution(execId, true);
            }

            const metrics = monitor.getMetrics();

            expect(metrics.byHookType['pre-commit'].averageDuration).toBeGreaterThan(0);
            expect(metrics.byHookType['pre-commit'].successRate).toBe(1.0);
        });
    });

    describe('Optimization Detection', () => {
        test('should detect optimization opportunities', () => {
            // Create slow executions
            for (let i = 0; i < 5; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 4000; // Above optimization threshold
                monitor.endExecution(execId, true);
            }

            const optimizations = monitor.getOptimizationRecommendations();

            expect(optimizations.length).toBeGreaterThan(0);
        });

        test('should not detect optimizations for fast executions', () => {
            // Create fast executions
            for (let i = 0; i < 5; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000; // Below optimization threshold
                monitor.endExecution(execId, true);
            }

            const optimizations = monitor.getOptimizationRecommendations();

            expect(optimizations.length).toBe(0);
        });

        test('should generate hook-specific recommendations', () => {
            const execId = monitor.startExecution('pre-commit', {});
            const startData = monitor.startTimes.get(execId);
            startData.startTime = Date.now() - 6000;
            monitor.endExecution(execId, true);

            const optimizations = monitor.getOptimizationRecommendations();

            if (optimizations.length > 0) {
                const latest = optimizations[optimizations.length - 1];
                expect(latest.hookType).toBe('pre-commit');
                expect(latest.recommendations).toBeDefined();
                expect(Array.isArray(latest.recommendations)).toBe(true);
            }
        });
    });

    describe('Development Mode Bypass', () => {
        test('should not recommend bypass in production mode', () => {
            monitor.config.developmentMode = false;

            // Create slow executions
            for (let i = 0; i < 5; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 6000;
                monitor.endExecution(execId, true);
            }

            const shouldBypass = monitor.shouldBypassInDevelopment();

            expect(shouldBypass).toBe(false);
        });

        test('should recommend bypass in development mode with slow executions', () => {
            monitor.config.developmentMode = true;

            // Create consistently slow executions
            for (let i = 0; i < 5; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 6000;
                monitor.endExecution(execId, true);
            }

            const shouldBypass = monitor.shouldBypassInDevelopment();

            expect(shouldBypass).toBe(true);
        });

        test('should not recommend bypass with insufficient data', () => {
            monitor.config.developmentMode = true;

            // Only 2 executions (need at least 3)
            for (let i = 0; i < 2; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 6000;
                monitor.endExecution(execId, true);
            }

            const shouldBypass = monitor.shouldBypassInDevelopment();

            expect(shouldBypass).toBe(false);
        });

        test('should not recommend bypass with mixed performance', () => {
            monitor.config.developmentMode = true;

            // Mix of fast and slow executions
            for (let i = 0; i < 3; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000; // Fast
                monitor.endExecution(execId, true);
            }

            for (let i = 0; i < 2; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 6000; // Slow
                monitor.endExecution(execId, true);
            }

            const shouldBypass = monitor.shouldBypassInDevelopment();

            // Less than 60% are slow, should not bypass
            expect(shouldBypass).toBe(false);
        });
    });

    describe('Memory Management', () => {
        test('should limit executions array size', () => {
            // Create more than 100 executions
            for (let i = 0; i < 150; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000;
                monitor.endExecution(execId, true);
            }

            expect(monitor.executions.length).toBeLessThanOrEqual(100);
        });

        test('should limit optimizations array size', () => {
            // Create many slow executions to trigger optimizations
            for (let i = 0; i < 100; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 4000;
                monitor.endExecution(execId, true);
            }

            expect(monitor.optimizations.length).toBeLessThanOrEqual(50);
        });

        test('should keep most recent executions', () => {
            // Create 150 executions
            for (let i = 0; i < 150; i++) {
                const execId = monitor.startExecution('pre-commit', { iteration: i });
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000;
                monitor.endExecution(execId, true);
            }

            // Should keep last 100
            expect(monitor.executions.length).toBe(100);
            expect(monitor.executions[0].context.iteration).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Clear Metrics', () => {
        test('should clear all metrics', () => {
            // Add some executions
            for (let i = 0; i < 5; i++) {
                const execId = monitor.startExecution('pre-commit', {});
                const startData = monitor.startTimes.get(execId);
                startData.startTime = Date.now() - 1000;
                monitor.endExecution(execId, true);
            }

            monitor.clearMetrics();

            const metrics = monitor.getMetrics();
            expect(metrics.totalExecutions).toBe(0);
            expect(monitor.executions.length).toBe(0);
            expect(monitor.optimizations.length).toBe(0);
        });

        test('should clear start times', () => {
            const execId = monitor.startExecution('pre-commit', {});

            monitor.clearMetrics();

            expect(monitor.startTimes.size).toBe(0);
        });
    });

    describe('Edge Cases in Duration Calculation', () => {
        test('should handle negative duration (clock skew)', () => {
            const execId = monitor.startExecution('pre-commit', {});
            const startData = monitor.startTimes.get(execId);
            startData.startTime = Date.now() + 1000; // Future time

            const result = monitor.endExecution(execId, true);

            // Should handle gracefully, duration should be 0 or positive
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });

        test('should handle very large durations', () => {
            const execId = monitor.startExecution('pre-commit', {});
            const startData = monitor.startTimes.get(execId);
            startData.startTime = Date.now() - 1000000; // Very long time ago

            const result = monitor.endExecution(execId, true);

            expect(result.duration).toBeGreaterThan(0);
            expect(result.optimizable).toBe(true);
        });
    });

    describe('Configuration Edge Cases', () => {
        test('should handle zero thresholds', () => {
            const zeroMonitor = new PerformanceMonitor({
                performanceThreshold: 0,
                optimizationThreshold: 0
            });

            const execId = zeroMonitor.startExecution('pre-commit', {});
            const startData = zeroMonitor.startTimes.get(execId);
            startData.startTime = Date.now() - 1000;
            const result = zeroMonitor.endExecution(execId, true);

            // Any duration should exceed zero threshold
            expect(result.optimizable).toBe(true);
            expect(result.performanceThresholdMet).toBe(false);
        });

        test('should handle very high thresholds', () => {
            const highMonitor = new PerformanceMonitor({
                performanceThreshold: 1000000,
                optimizationThreshold: 1000000
            });

            const execId = highMonitor.startExecution('pre-commit', {});
            const startData = highMonitor.startTimes.get(execId);
            startData.startTime = Date.now() - 5000;
            const result = highMonitor.endExecution(execId, true);

            // Should not trigger optimization
            expect(result.optimizable).toBe(false);
            expect(result.performanceThresholdMet).toBe(true);
        });

        test('should handle disabled optimizations', () => {
            const disabledMonitor = new PerformanceMonitor({
                enableOptimizations: false
            });

            for (let i = 0; i < 5; i++) {
                const execId = disabledMonitor.startExecution('pre-commit', {});
                const startData = disabledMonitor.startTimes.get(execId);
                startData.startTime = Date.now() - 6000;
                disabledMonitor.endExecution(execId, true);
            }

            const optimizations = disabledMonitor.getOptimizationRecommendations();

            // Should not generate optimizations when disabled
            expect(optimizations.length).toBe(0);
        });
    });

    describe('Concurrent Execution Tracking', () => {
        test('should track multiple concurrent executions', () => {
            const execId1 = monitor.startExecution('pre-commit', { id: 1 });
            const execId2 = monitor.startExecution('pre-push', { id: 2 });
            const execId3 = monitor.startExecution('post-commit', { id: 3 });

            expect(monitor.startTimes.size).toBe(3);

            monitor.endExecution(execId1, true);
            monitor.endExecution(execId2, true);
            monitor.endExecution(execId3, true);

            const metrics = monitor.getMetrics();
            expect(metrics.totalExecutions).toBe(3);
        });

        test('should handle interleaved execution starts and ends', () => {
            const execId1 = monitor.startExecution('pre-commit', {});
            const execId2 = monitor.startExecution('pre-push', {});

            monitor.endExecution(execId1, true);

            const execId3 = monitor.startExecution('post-commit', {});

            monitor.endExecution(execId2, true);
            monitor.endExecution(execId3, true);

            const metrics = monitor.getMetrics();
            expect(metrics.totalExecutions).toBe(3);
        });
    });
});
