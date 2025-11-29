/**
 * @ai-context Centralized Context Manager with Atomic Locking
 * @ai-invariant Ensures data integrity across concurrent processes
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const GitStateManager = require('./git-state-manager');

class ContextManager {
    constructor() {
        this.rootDir = process.cwd();
        this.lockDir = path.join(this.rootDir, '.locks');
        this.retryOptions = {
            retries: 10,
            minTimeout: 100,
            maxTimeout: 1000
        };

        // Ensure lock directory exists
        if (!fs.existsSync(this.lockDir)) {
            fs.mkdirSync(this.lockDir, { recursive: true });
        }

        // Initialize Git State Manager if enabled
        this.useGitState = process.env.BMAD_USE_GIT_STATE === 'true';
        if (this.useGitState) {
            this.gitState = new GitStateManager();
            this.gitState.init();
        }
    }

    /**
     * @ai-context Atomic Read with Lock
     */
    read(filePath, options = { encoding: 'utf-8' }) {
        const absolutePath = path.resolve(this.rootDir, filePath);
        const lockName = this.getLockName(filePath);

        return this.withLock(lockName, () => {
            if (this.useGitState) {
                // Try reading from Git first
                const content = this.gitState.read(filePath);
                if (content !== null) return content;
                // Fallback to local file if not found in git (migration scenario)
            }

            if (!fs.existsSync(absolutePath)) return null;
            return fs.readFileSync(absolutePath, options);
        });
    }

    /**
     * @ai-context Atomic Write with Lock and Validation
     */
    write(filePath, content, options = {}) {
        const absolutePath = path.resolve(this.rootDir, filePath);
        const lockName = this.getLockName(filePath);

        return this.withLock(lockName, () => {
            // Optional: Schema Validation hook could go here

            if (this.useGitState) {
                this.gitState.write(filePath, content);
            }

            // Always write to local filesystem as well for backward compatibility and easy viewing
            // Ensure directory exists
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(absolutePath, content, { encoding: 'utf-8' });

            // Return hash of written content
            return this.computeHash(content);
        });
    }

    /**
     * @ai-context Execute function within a lock (Synchronous)
     */
    withLock(lockName, operation) {
        const lockPath = path.join(this.lockDir, lockName);
        let acquired = false;
        let attempt = 0;

        while (!acquired && attempt < this.retryOptions.retries) {
            try {
                // Atomic lock acquisition using mkdir
                fs.mkdirSync(lockPath);
                acquired = true;
            } catch (error) {
                if (error.code === 'EEXIST') {
                    // Lock exists, check for staleness (e.g., > 10 seconds)
                    try {
                        const stats = fs.statSync(lockPath);
                        const now = Date.now();
                        if (now - stats.mtimeMs > 10000) {
                            console.warn(`⚠️ Breaking stale lock: ${lockName}`);
                            try {
                                fs.rmdirSync(lockPath);
                                continue; // Retry immediately
                            } catch (rmError) {
                                // Race condition on removal, just retry loop
                            }
                        }
                    } catch (statError) {
                        // Lock might have been removed in between
                        continue;
                    }

                    // Wait and retry (Synchronous Sleep)
                    const delay = Math.random() * (this.retryOptions.maxTimeout - this.retryOptions.minTimeout) + this.retryOptions.minTimeout;
                    this.sleepSync(delay);
                    attempt++;
                } else {
                    throw error;
                }
            }
        }

        if (!acquired) {
            throw new Error(`Failed to acquire lock for ${lockName} after ${this.retryOptions.retries} attempts`);
        }

        try {
            // Execute operation
            return operation();
        } finally {
            // Release lock
            try {
                if (fs.existsSync(lockPath)) {
                    fs.rmdirSync(lockPath);
                }
            } catch (error) {
                console.error(`Failed to release lock ${lockName}: ${error.message}`);
            }
        }
    }

    sleepSync(ms) {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            // Busy wait to block event loop (required for sync lock)
        }
    }

    getLockName(filePath) {
        // Create a safe lock name from file path
        return crypto.createHash('md5').update(filePath).digest('hex') + '.lock';
    }

    computeHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * @ai-context Circuit Breaker: Record a failure
     */
    recordFailure(component = 'workflow') {
        const cbFile = 'circuit-breaker.json';
        let state = { failures: 0, lastFailure: null, isOpen: false };

        try {
            const content = this.read(cbFile);
            if (content) state = JSON.parse(content);
        } catch (e) { }

        state.failures++;
        state.lastFailure = new Date().toISOString();

        // Threshold: 3 failures in 1 hour
        if (state.failures >= 3) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const firstFailure = state.firstFailure ? new Date(state.firstFailure) : new Date();

            if (firstFailure > oneHourAgo) {
                state.isOpen = true;
                console.error('🔥 CIRCUIT BREAKER OPENED: Too many failures in short period.');
            } else {
                // Reset if failures were spread out
                state.failures = 1;
                state.firstFailure = new Date().toISOString();
                state.isOpen = false;
            }
        } else if (state.failures === 1) {
            state.firstFailure = new Date().toISOString();
        }

        this.write(cbFile, JSON.stringify(state, null, 2));
        return state;
    }

    /**
     * @ai-context Circuit Breaker: Reset failures (on success)
     */
    resetFailure(component = 'workflow') {
        const cbFile = 'circuit-breaker.json';
        this.write(cbFile, JSON.stringify({ failures: 0, lastFailure: null, isOpen: false, firstFailure: null }, null, 2));
    }

    /**
     * @ai-context Circuit Breaker: Check status
     */
    isCircuitOpen(component = 'workflow') {
        const cbFile = 'circuit-breaker.json';
        try {
            const content = this.read(cbFile);
            if (content) {
                const state = JSON.parse(content);
                return state.isOpen === true;
            }
        } catch (e) { }
        return false;
    }
}

module.exports = ContextManager;
