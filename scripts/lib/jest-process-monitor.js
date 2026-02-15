/**
 * Jest Process Monitor - Integration wrapper for Jest test runner
 * Automatically monitors child processes during Jest execution
 */

const ProcessMonitor = require('./process-monitor');
const Logger = require('./logger');

class JestProcessMonitor {
    constructor(options = {}) {
        this.options = {
            autoStart: options.autoStart !== false,
            autoStop: options.autoStop !== false,
            generateReport: options.generateReport !== false,
            reportPath: options.reportPath || '.github/reports/process-monitor-report.json',
            ...options
        };

        this.logger = new Logger('JestProcessMonitor');
        this.monitor = new ProcessMonitor({
            logFile: 'jest-process-monitor.json',
            maxProcesses: 20, // Lower threshold for Jest
            maxMemoryMB: 1024,
            maxCpuPercent: 70,
            ...options
        });

        this.originalSpawn = null;
        this.originalExec = null;
        this.isHooked = false;
    }

    /**
     * Setup Jest integration hooks
     */
    async setup() {
        if (this.options.autoStart) {
            await this.monitor.startMonitoring();
        }

        // Hook into child_process to monitor Jest spawned processes
        this.hookChildProcess();

        // Setup Jest lifecycle hooks
        this.setupJestHooks();

        this.logger.info('Jest process monitoring setup complete');
    }

    /**
     * Cleanup and generate report
     */
    async teardown() {
        if (this.isHooked) {
            this.unhookChildProcess();
        }

        if (this.options.autoStop) {
            const report = await this.monitor.stopMonitoring();

            if (this.options.generateReport && report) {
                await this.saveReport(report);
            }

            return report;
        }
    }

    /**
     * Hook into child_process module to monitor spawned processes
     */
    hookChildProcess() {
        if (this.isHooked) {
            return;
        }

        const childProcess = require('child_process');

        // Store original functions
        this.originalSpawn = childProcess.spawn;
        this.originalExec = childProcess.exec;

        // Hook spawn
        childProcess.spawn = (command, args = [], options = {}) => {
            const child = this.originalSpawn.call(childProcess, command, args, options);

            if (child.pid) {
                this.monitor.handleProcessCreation({
                    pid: child.pid,
                    command,
                    args,
                    startTime: Date.now(),
                    parentPid: process.pid
                });

                // Monitor process exit
                child.on('exit', (code, _signal) => {
                    this.monitor.handleProcessDestruction(child.pid, code);
                });
            }

            return child;
        };

        // Hook exec
        childProcess.exec = (command, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }

            const child = this.originalExec.call(childProcess, command, options, callback);

            if (child.pid) {
                this.monitor.handleProcessCreation({
                    pid: child.pid,
                    command,
                    args: [],
                    startTime: Date.now(),
                    parentPid: process.pid
                });

                child.on('exit', (code, _signal) => {
                    this.monitor.handleProcessDestruction(child.pid, code);
                });
            }

            return child;
        };

        this.isHooked = true;
        this.logger.info('Child process hooks installed');
    }

    /**
     * Restore original child_process functions
     */
    unhookChildProcess() {
        if (!this.isHooked) {
            return;
        }

        const childProcess = require('child_process');

        if (this.originalSpawn) {
            childProcess.spawn = this.originalSpawn;
        }

        if (this.originalExec) {
            childProcess.exec = this.originalExec;
        }

        this.isHooked = false;
        this.logger.info('Child process hooks removed');
    }

    /**
     * Setup Jest lifecycle hooks
     */
    setupJestHooks() {
        // Hook into Jest events if available
        if (global.jasmine) {
            // Jasmine environment
            const originalExecute = global.jasmine.getEnv().execute;
            global.jasmine.getEnv().execute = async function () {
                await originalExecute.call(this);
            };
        }

        // Monitor Jest worker processes
        this.monitorJestWorkers();
    }

    /**
     * Monitor Jest worker processes specifically
     */
    monitorJestWorkers() {
        // Jest workers are typically spawned with specific patterns
        this.monitor.on('process_created', (processData) => {
            if (this.isJestWorker(processData)) {
                this.logger.info(`Jest worker detected: PID ${processData.pid}`);

                // Add Jest-specific metadata
                processData.jestWorker = true;
                processData.workerType = this.classifyJestWorker(processData);
            }
        });
    }

    /**
     * Check if a process is a Jest worker
     */
    isJestWorker(processData) {
        const command = processData.command.toLowerCase();
        const args = processData.args.join(' ').toLowerCase();

        return command.includes('jest') ||
            args.includes('jest-worker') ||
            args.includes('jest-runner') ||
            command.includes('node') && args.includes('jest');
    }

    /**
     * Classify Jest worker type
     */
    classifyJestWorker(processData) {
        const fullCommand = `${processData.command} ${processData.args.join(' ')}`.toLowerCase();

        if (fullCommand.includes('jest-worker')) return 'worker';
        if (fullCommand.includes('jest-runner')) return 'runner';
        if (fullCommand.includes('--coverage')) return 'coverage';
        if (fullCommand.includes('--watch')) return 'watcher';

        return 'main';
    }

    /**
     * Save report to file
     */
    async saveReport(report) {
        const fs = require('fs');
        const path = require('path');

        try {
            const reportDir = path.dirname(this.options.reportPath);
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }

            // Add Jest-specific analysis
            const jestReport = this.enhanceReportWithJestData(report);

            fs.writeFileSync(this.options.reportPath, JSON.stringify(jestReport, null, 2));
            this.logger.info(`Process monitoring report saved to ${this.options.reportPath}`);
        } catch (error) {
            this.logger.error(`Failed to save report: ${error.message}`);
        }
    }

    /**
     * Enhance report with Jest-specific data
     */
    enhanceReportWithJestData(report) {
        const jestProcesses = report.detailedProcesses.filter(p =>
            p.jestWorker || this.isJestWorker(p)
        );

        const jestStats = {
            totalJestProcesses: jestProcesses.length,
            jestWorkerTypes: {},
            averageJestProcessLifetime: 0,
            jestMemoryUsage: 0,
            jestCpuUsage: 0
        };

        // Calculate Jest-specific statistics
        let totalJestLifetime = 0;
        let jestProcessesWithLifetime = 0;

        for (const process of jestProcesses) {
            const workerType = process.workerType || 'unknown';
            jestStats.jestWorkerTypes[workerType] = (jestStats.jestWorkerTypes[workerType] || 0) + 1;

            if (process.lifetime) {
                totalJestLifetime += process.lifetime;
                jestProcessesWithLifetime++;
            }

            jestStats.jestMemoryUsage += process.memoryUsage || 0;
            jestStats.jestCpuUsage += process.cpuUsage || 0;
        }

        if (jestProcessesWithLifetime > 0) {
            jestStats.averageJestProcessLifetime = totalJestLifetime / jestProcessesWithLifetime;
        }

        return {
            ...report,
            jestSpecific: jestStats,
            jestProcesses: jestProcesses
        };
    }

    /**
     * Get real-time Jest statistics
     */
    getJestStatistics() {
        const allProcesses = Array.from(this.monitor.processes.values());
        const jestProcesses = allProcesses.filter(p => this.isJestWorker(p));

        return {
            totalJestProcesses: jestProcesses.length,
            activeJestProcesses: jestProcesses.filter(p => p.status === 'running').length,
            jestMemoryUsage: jestProcesses.reduce((sum, p) => sum + (p.memoryUsage || 0), 0),
            jestCpuUsage: jestProcesses.reduce((sum, p) => sum + (p.cpuUsage || 0), 0),
            jestProcesses: jestProcesses
        };
    }

    /**
     * Kill all Jest processes
     */
    async killAllJestProcesses() {
        const jestProcesses = Array.from(this.monitor.processes.values())
            .filter(p => this.isJestWorker(p) && p.status === 'running');

        const results = [];
        for (const process of jestProcesses) {
            try {
                process.kill(process.pid, 'SIGTERM');
                results.push({ pid: process.pid, success: true });
            } catch (error) {
                results.push({ pid: process.pid, success: false, error: error.message });
            }
        }

        return results;
    }
}

module.exports = JestProcessMonitor;