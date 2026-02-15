/**
 * Performance Monitor - Tracks and optimizes hook execution performance
 * Part of the BMAD Git Hooks Automation system
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

class PerformanceMonitor {
    constructor(config = {}) {
        this.config = {
            performanceThreshold: config.performanceThreshold || 5000, // 5 seconds default
            optimizationThreshold: config.optimizationThreshold || 3000, // 3 seconds for optimization
            developmentMode: config.developmentMode || process.env.NODE_ENV === 'development',
            enableOptimizations: config.enableOptimizations !== false,
            ...config
        };

        this.executions = [];
        this.optimizations = [];
        this.startTimes = new Map();
    }

    /**
     * Start timing a hook execution
     * @param {string} hookType - Type of hook being executed
     * @param {Object} context - Additional context information
     * @returns {string} - Execution ID for tracking
     */
    startExecution(hookType, context = {}) {
        const executionId = `${hookType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        this.startTimes.set(executionId, {
            hookType,
            startTime: Date.now(),
            context
        });

        return executionId;
    }

    /**
     * End timing a hook execution and record metrics
     * @param {string} executionId - Execution ID from startExecution
     * @param {boolean} success - Whether execution was successful
     * @param {Object} metadata - Additional metadata about execution
     * @returns {Object} - Execution metrics
     */
    endExecution(executionId, success = true, metadata = {}) {
        const startData = this.startTimes.get(executionId);

        if (!startData) {
            throw new Error(`No start time found for execution ID: ${executionId}`);
        }

        const endTime = Date.now();
        const duration = endTime - startData.startTime;

        const execution = {
            executionId,
            hookType: startData.hookType,
            startTime: startData.startTime,
            endTime,
            duration,
            success,
            performanceThresholdMet: duration <= this.config.performanceThreshold,
            optimizable: duration > this.config.optimizationThreshold,
            context: startData.context,
            metadata,
            timestamp: new Date(startData.startTime).toISOString()
        };

        this.executions.push(execution);
        this.startTimes.delete(executionId);

        // Keep only last 100 executions for memory efficiency
        if (this.executions.length > 100) {
            this.executions = this.executions.slice(-100);
        }

        // Check if optimization is needed
        if (execution.optimizable && this.config.enableOptimizations) {
            this.detectOptimizationOpportunity(execution);
        }

        return execution;
    }

    /**
     * Detect optimization opportunities based on execution patterns
     * @param {Object} execution - Execution data
     */
    detectOptimizationOpportunity(execution) {
        const recentExecutions = this.getRecentExecutions(execution.hookType, 5);

        if (recentExecutions.length >= 3) {
            const avgDuration = recentExecutions.reduce((sum, exec) => sum + exec.duration, 0) / recentExecutions.length;

            if (avgDuration > this.config.optimizationThreshold) {
                const optimization = {
                    hookType: execution.hookType,
                    detectedAt: new Date().toISOString(),
                    averageDuration: avgDuration,
                    threshold: this.config.optimizationThreshold,
                    recommendations: this.generateOptimizationRecommendations(execution, avgDuration)
                };

                this.optimizations.push(optimization);

                // Keep only last 50 optimizations
                if (this.optimizations.length > 50) {
                    this.optimizations = this.optimizations.slice(-50);
                }
            }
        }
    }

    /**
     * Generate optimization recommendations based on execution data
     * @param {Object} execution - Execution data
     * @param {number} avgDuration - Average duration
     * @returns {Array} - List of recommendations
     */
    generateOptimizationRecommendations(execution, avgDuration) {
        const recommendations = [];

        // Recommendation based on hook type
        if (execution.hookType === 'pre-commit') {
            if (avgDuration > 10000) {
                recommendations.push('Consider running only fast tests in pre-commit hook');
                recommendations.push('Move comprehensive tests to pre-push hook');
            } else if (avgDuration > 5000) {
                recommendations.push('Enable test result caching');
                recommendations.push('Run linting only on staged files');
            } else if (avgDuration > this.config.optimizationThreshold) {
                recommendations.push('Consider optimizing pre-commit validation steps');
                recommendations.push('Enable caching for faster execution');
            }
        }

        if (execution.hookType === 'pre-push') {
            if (avgDuration > 30000) {
                recommendations.push('Consider parallel test execution');
                recommendations.push('Optimize test suite for faster execution');
            } else if (avgDuration > this.config.optimizationThreshold) {
                recommendations.push('Review test suite performance');
                recommendations.push('Consider incremental testing strategies');
            }
        }

        if (execution.hookType === 'post-commit') {
            if (avgDuration > 8000) {
                recommendations.push('Move non-critical operations to background');
                recommendations.push('Reduce documentation generation scope');
            } else if (avgDuration > this.config.optimizationThreshold) {
                recommendations.push('Optimize post-commit automation tasks');
                recommendations.push('Consider async processing for non-blocking operations');
            }
        }

        if (execution.hookType === 'post-merge') {
            if (avgDuration > this.config.optimizationThreshold) {
                recommendations.push('Optimize merge workflow execution');
                recommendations.push('Consider reducing validation scope');
            }
        }

        if (execution.hookType === 'commit-msg') {
            if (avgDuration > this.config.optimizationThreshold) {
                recommendations.push('Optimize commit message validation');
                recommendations.push('Reduce context validation overhead');
            }
        }

        // General recommendations
        if (avgDuration > this.config.performanceThreshold * 2) {
            recommendations.push('Enable development mode bypass for faster local workflow');
            recommendations.push('Review and optimize slow operations');
        }

        // Ensure at least one recommendation is provided
        if (recommendations.length === 0 && avgDuration > this.config.optimizationThreshold) {
            recommendations.push('Review hook execution performance');
            recommendations.push('Consider optimization strategies for this hook type');
        }

        return recommendations;
    }

    /**
     * Get recent executions for a specific hook type
     * @param {string} hookType - Type of hook
     * @param {number} count - Number of recent executions to retrieve
     * @returns {Array} - Recent executions
     */
    getRecentExecutions(hookType, count = 10) {
        return this.executions
            .filter(exec => exec.hookType === hookType)
            .slice(-count);
    }

    /**
     * Get aggregate metrics for all executions
     * @returns {Object} - Aggregate metrics
     */
    getMetrics() {
        if (this.executions.length === 0) {
            return {
                totalExecutions: 0,
                averageDuration: 0,
                successRate: 0,
                performanceThresholdMetRate: 0,
                optimizableExecutions: 0,
                byHookType: {}
            };
        }

        const successfulExecutions = this.executions.filter(exec => exec.success).length;
        const thresholdMetExecutions = this.executions.filter(exec => exec.performanceThresholdMet).length;
        const optimizableExecutions = this.executions.filter(exec => exec.optimizable).length;
        const totalDuration = this.executions.reduce((sum, exec) => sum + exec.duration, 0);

        // Metrics by hook type
        const byHookType = {};
        const hookTypes = [...new Set(this.executions.map(exec => exec.hookType))];

        hookTypes.forEach(hookType => {
            const hookExecutions = this.executions.filter(exec => exec.hookType === hookType);
            const hookDuration = hookExecutions.reduce((sum, exec) => sum + exec.duration, 0);
            const hookSuccess = hookExecutions.filter(exec => exec.success).length;

            byHookType[hookType] = {
                count: hookExecutions.length,
                averageDuration: hookDuration / hookExecutions.length,
                successRate: hookSuccess / hookExecutions.length,
                lastExecution: hookExecutions[hookExecutions.length - 1]
            };
        });

        return {
            totalExecutions: this.executions.length,
            averageDuration: totalDuration / this.executions.length,
            successRate: successfulExecutions / this.executions.length,
            performanceThresholdMetRate: thresholdMetExecutions / this.executions.length,
            optimizableExecutions,
            byHookType,
            recentExecutions: this.executions.slice(-10),
            optimizations: this.optimizations
        };
    }

    /**
     * Check if development workflow bypass should be enabled
     * Requirements: 8.4
     * @returns {boolean} - Whether bypass should be enabled
     */
    shouldBypassInDevelopment() {
        if (!this.config.developmentMode) {
            return false;
        }

        // Bypass if recent executions are consistently slow
        const recentExecutions = this.executions.slice(-5);

        if (recentExecutions.length < 3) {
            return false;
        }

        const slowExecutions = recentExecutions.filter(
            exec => exec.duration > this.config.performanceThreshold
        ).length;

        // Bypass if more than 60% of recent executions are slow
        return slowExecutions / recentExecutions.length > 0.6;
    }

    /**
     * Get optimization recommendations
     * @returns {Array} - List of all optimization recommendations
     */
    getOptimizationRecommendations() {
        return this.optimizations;
    }

    /**
     * Clear all recorded metrics (useful for testing)
     */
    clearMetrics() {
        this.executions = [];
        this.optimizations = [];
        this.startTimes.clear();
    }

    /**
     * Export metrics to JSON format
     * @returns {string} - JSON string of metrics
     */
    exportMetrics() {
        return JSON.stringify({
            config: this.config,
            metrics: this.getMetrics(),
            timestamp: new Date().toISOString()
        }, null, 2);
    }
}

module.exports = PerformanceMonitor;
