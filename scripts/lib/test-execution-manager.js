/**
 * Test Execution Manager - Controls test execution serialization and resource usage
 * Prevents multiple test processes from running simultaneously
 */
/* global setTimeout */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('./logger');

class TestExecutionManager {
    constructor() {
        this.logger = new Logger('TestExecutionManager');
        this.lockFile = path.join(process.cwd(), '.git', 'test-execution.lock');
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 seconds
        this.lockTimeout = 300000; // 5 minutes max lock time
    }

    /**
     * Acquire exclusive lock for test execution
     */
    async acquireLock(processId = 'unknown') {
        const lockData = {
            processId,
            timestamp: Date.now(),
            pid: process.pid
        };

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Check if lock exists and is still valid
                if (fs.existsSync(this.lockFile)) {
                    const existingLock = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
                    const lockAge = Date.now() - existingLock.timestamp;

                    // If lock is too old, remove it (stale lock)
                    if (lockAge > this.lockTimeout) {
                        this.logger.warn(`Removing stale lock (age: ${lockAge}ms)`);
                        fs.unlinkSync(this.lockFile);
                    } else {
                        // Check if the process is still running
                        if (!this.isProcessRunning(existingLock.pid)) {
                            this.logger.warn(`Removing lock from dead process (PID: ${existingLock.pid})`);
                            fs.unlinkSync(this.lockFile);
                        } else {
                            this.logger.info(`Test execution locked by process ${existingLock.processId} (PID: ${existingLock.pid}), waiting...`);
                            await this.sleep(this.retryDelay * attempt);
                            continue;
                        }
                    }
                }

                // Create lock file atomically
                fs.writeFileSync(this.lockFile, JSON.stringify(lockData, null, 2), { flag: 'wx' });
                this.logger.info(`Acquired test execution lock for ${processId}`);
                return true;

            } catch (error) {
                if (error.code === 'EEXIST') {
                    // Lock file was created by another process between our check and write
                    this.logger.info(`Lock acquired by another process, attempt ${attempt}/${this.maxRetries}`);
                    await this.sleep(this.retryDelay * attempt);
                    continue;
                } else {
                    this.logger.error(`Failed to acquire lock: ${error.message}`);
                    throw error;
                }
            }
        }

        throw new Error(`Failed to acquire test execution lock after ${this.maxRetries} attempts`);
    }

    /**
     * Release the execution lock
     */
    releaseLock(processId = 'unknown') {
        try {
            if (fs.existsSync(this.lockFile)) {
                const lockData = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));

                // Verify we own the lock
                if (lockData.pid === process.pid) {
                    fs.unlinkSync(this.lockFile);
                    this.logger.info(`Released test execution lock for ${processId}`);
                } else {
                    this.logger.warn(`Cannot release lock owned by PID ${lockData.pid} (we are ${process.pid})`);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to release lock: ${error.message}`);
        }
    }

    /**
     * Execute tests with exclusive lock and resource limits
     */
    async executeTestsWithLock(testCommand, options = {}) {
        const processId = options.processId || 'test-execution';
        const maxWorkers = options.maxWorkers || 1;
        const timeout = options.timeout || 30000;
        const testTimeout = options.testTimeout || 5000;

        try {
            // Acquire exclusive lock
            await this.acquireLock(processId);

            // Build optimized test command
            const optimizedCommand = this.buildOptimizedTestCommand(testCommand, {
                maxWorkers,
                testTimeout,
                ...options
            });

            this.logger.info(`Executing serialized test: ${optimizedCommand}`);

            // Execute with resource limits
            const result = execSync(optimizedCommand, {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout,
                env: {
                    ...process.env,
                    NODE_OPTIONS: '--max-old-space-size=2048', // Limit memory to 2GB
                    JEST_WORKER_ID: '1', // Force single worker mode
                    CI: 'true' // Enable CI optimizations
                }
            });

            return {
                success: true,
                output: result,
                command: optimizedCommand
            };

        } catch (error) {
            this.logger.error(`Serialized test execution failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                output: error.stdout || error.message,
                command: testCommand
            };
        } finally {
            // Always release lock
            this.releaseLock(processId);
        }
    }

    /**
     * Build optimized test command with resource limits
     */
    buildOptimizedTestCommand(baseCommand, options) {
        const {
            maxWorkers = 1,
            testTimeout = 5000,
            bail = true,
            silent = true,
            coverage = false,
            findRelatedTests = null,
            testPathPattern = null
        } = options;

        let command = baseCommand;

        // Add Jest-specific optimizations
        const jestOptions = [
            `--maxWorkers=${maxWorkers}`,
            `--testTimeout=${testTimeout}`,
            '--passWithNoTests',
            '--no-cache', // Disable Jest cache to reduce I/O
            '--forceExit', // Force exit after tests complete
        ];

        if (bail) {
            jestOptions.push('--bail=1'); // Stop on first failure
        }

        if (silent) {
            jestOptions.push('--silent'); // Reduce output
        }

        if (coverage) {
            jestOptions.push('--coverage');
        }

        if (findRelatedTests && Array.isArray(findRelatedTests)) {
            jestOptions.push(`--findRelatedTests ${findRelatedTests.join(' ')}`);
        }

        if (testPathPattern) {
            jestOptions.push(`--testPathPattern="${testPathPattern}"`);
        }

        // Append options to command
        if (command.includes('--')) {
            command += ` ${jestOptions.join(' ')}`;
        } else {
            command += ` -- ${jestOptions.join(' ')}`;
        }

        return command;
    }

    /**
     * Execute tests in batches to reduce resource usage
     */
    async executeTestsInBatches(testFiles, options = {}) {
        const batchSize = options.batchSize || 5;
        const results = [];

        this.logger.info(`Executing ${testFiles.length} test files in batches of ${batchSize}`);

        for (let i = 0; i < testFiles.length; i += batchSize) {
            const batch = testFiles.slice(i, i + batchSize);
            const batchId = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(testFiles.length / batchSize);

            this.logger.info(`Executing batch ${batchId}/${totalBatches} (${batch.length} files)`);

            const testPattern = batch.join('|');
            const result = await this.executeTestsWithLock('npm test', {
                processId: `batch-${batchId}`,
                testPathPattern: testPattern,
                maxWorkers: 1,
                timeout: 60000, // 1 minute per batch
                ...options
            });

            results.push({
                batch: batchId,
                files: batch,
                ...result
            });

            // Small delay between batches to let system recover
            if (i + batchSize < testFiles.length) {
                await this.sleep(1000);
            }
        }

        return results;
    }

    /**
     * Check if a process is still running
     */
    isProcessRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current system resource usage
     */
    getSystemResources() {
        try {
            const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
            const loadAvg = fs.readFileSync('/proc/loadavg', 'utf8');

            const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
            const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
            const memUsed = memTotal - memAvailable;
            const memUsagePercent = (memUsed / memTotal) * 100;

            const [load1, load5, load15] = loadAvg.trim().split(' ').slice(0, 3).map(parseFloat);

            return {
                memory: {
                    total: memTotal,
                    used: memUsed,
                    available: memAvailable,
                    usagePercent: memUsagePercent
                },
                load: { load1, load5, load15 }
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if system has enough resources for test execution
     */
    hasEnoughResources(thresholds = {}) {
        const {
            maxMemoryUsage = 85, // 85% max memory usage
            maxLoadAverage = 4.0  // Max load average
        } = thresholds;

        const resources = this.getSystemResources();
        if (!resources) return true; // Can't check, assume OK

        const memoryOk = resources.memory.usagePercent < maxMemoryUsage;
        const loadOk = resources.load.load1 < maxLoadAverage;

        if (!memoryOk) {
            this.logger.warn(`High memory usage: ${resources.memory.usagePercent.toFixed(1)}%`);
        }

        if (!loadOk) {
            this.logger.warn(`High load average: ${resources.load.load1}`);
        }

        return memoryOk && loadOk;
    }
}

module.exports = TestExecutionManager;