/**
 * Process Monitor - Real-time monitoring of child processes during test execution
 * Tracks process creation, lifecycle, and resource usage with detailed logging
 */

/* global setInterval, clearInterval */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const EventEmitter = require('events');
const Logger = require('./logger');

class ProcessMonitor extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            logDir: options.logDir || path.join(process.cwd(), '.github', 'logs'),
            logFile: options.logFile || 'process-monitor.json',
            alertThresholds: {
                maxProcesses: options.maxProcesses || 50,
                maxMemoryMB: options.maxMemoryMB || 2048,
                maxCpuPercent: options.maxCpuPercent || 80,
                processLifetimeMs: options.processLifetimeMs || 300000 // 5 minutes
            },
            monitoringInterval: options.monitoringInterval || 1000, // 1 second
            enableRealTimeLogging: options.enableRealTimeLogging !== false,
            enableAlerts: options.enableAlerts !== false,
            ...options
        };

        this.logger = new Logger('ProcessMonitor');
        this.processes = new Map(); // PID -> ProcessInfo
        this.statistics = {
            totalProcessesCreated: 0,
            totalProcessesDestroyed: 0,
            activeProcesses: 0,
            peakProcesses: 0,
            averageLifetime: 0,
            totalMemoryUsage: 0,
            totalCpuUsage: 0,
            processTypes: {},
            alerts: []
        };

        this.monitoringActive = false;
        this.monitoringInterval = null;
        this.startTime = null;
        this.logStream = null;

        // Bind methods
        this.handleProcessCreation = this.handleProcessCreation.bind(this);
        this.handleProcessDestruction = this.handleProcessDestruction.bind(this);
        this.monitorExistingProcesses = this.monitorExistingProcesses.bind(this);
    }

    /**
     * Start monitoring processes
     */
    async startMonitoring() {
        if (this.monitoringActive) {
            this.logger.warn('Process monitoring already active');
            return;
        }

        this.logger.info('Starting process monitoring');
        this.startTime = Date.now();
        this.monitoringActive = true;

        // Ensure log directory exists
        if (!fs.existsSync(this.options.logDir)) {
            fs.mkdirSync(this.options.logDir, { recursive: true });
        }

        // Initialize log stream
        const logPath = path.join(this.options.logDir, this.options.logFile);
        this.logStream = fs.createWriteStream(logPath, { flags: 'a' });

        // Log monitoring start
        this.writeLog({
            type: 'monitoring_start',
            timestamp: new Date().toISOString(),
            pid: process.pid,
            options: this.options
        });

        // Start periodic monitoring
        this.monitoringInterval = setInterval(this.monitorExistingProcesses, this.options.monitoringInterval);

        // Monitor current processes
        await this.scanExistingProcesses();

        this.emit('monitoring_started');
    }

    /**
     * Stop monitoring processes
     */
    async stopMonitoring() {
        if (!this.monitoringActive) {
            return;
        }

        this.logger.info('Stopping process monitoring');
        this.monitoringActive = false;

        // Clear monitoring interval
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        // Generate final report
        const report = await this.generateReport();

        // Log monitoring end
        this.writeLog({
            type: 'monitoring_end',
            timestamp: new Date().toISOString(),
            duration: Date.now() - this.startTime,
            finalReport: report
        });

        // Close log stream
        if (this.logStream) {
            this.logStream.end();
            this.logStream = null;
        }

        this.emit('monitoring_stopped', report);
        return report;
    }

    /**
     * Scan for existing processes at startup
     */
    async scanExistingProcesses() {
        try {
            const processes = await this.getSystemProcesses();
            const relevantProcesses = processes.filter(proc => this.isRelevantProcess(proc));

            for (const proc of relevantProcesses) {
                this.handleProcessCreation({
                    pid: proc.pid,
                    command: proc.command,
                    args: proc.args || [],
                    startTime: Date.now(), // Approximate
                    parentPid: proc.ppid,
                    existing: true
                });
            }

            this.logger.info(`Found ${relevantProcesses.length} existing relevant processes`);
        } catch (error) {
            this.logger.error(`Failed to scan existing processes: ${error.message}`);
        }
    }

    /**
     * Get system processes using ps command
     */
    async getSystemProcesses() {
        return new Promise((resolve, reject) => {
            exec('ps -eo pid,ppid,command,etime,pcpu,pmem --no-headers', (error, stdout, _stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                const processes = stdout.trim().split('\n').map(line => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parseInt(parts[0]);
                    const ppid = parseInt(parts[1]);
                    const command = parts.slice(2, -3).join(' ');
                    const etime = parts[parts.length - 3];
                    const pcpu = parseFloat(parts[parts.length - 2]);
                    const pmem = parseFloat(parts[parts.length - 1]);

                    return {
                        pid,
                        ppid,
                        command,
                        etime,
                        pcpu,
                        pmem
                    };
                }).filter(proc => !isNaN(proc.pid));

                resolve(processes);
            });
        });
    }

    /**
     * Check if a process is relevant for monitoring
     */
    isRelevantProcess(proc) {
        const relevantPatterns = [
            /node.*jest/i,
            /npm.*test/i,
            /jest/i,
            /mocha/i,
            /tap/i,
            /ava/i,
            /vitest/i,
            /cypress/i,
            /playwright/i,
            /puppeteer/i
        ];

        return relevantPatterns.some(pattern => pattern.test(proc.command));
    }

    /**
     * Handle process creation
     */
    handleProcessCreation(processInfo) {
        const {
            pid,
            command,
            args = [],
            startTime = Date.now(),
            parentPid,
            existing = false
        } = processInfo;

        const processData = {
            pid,
            command,
            args,
            startTime,
            parentPid,
            existing,
            memoryUsage: 0,
            cpuUsage: 0,
            status: 'running',
            type: this.classifyProcess(command, args),
            lastUpdate: Date.now()
        };

        this.processes.set(pid, processData);
        this.statistics.totalProcessesCreated++;
        this.statistics.activeProcesses++;
        this.statistics.peakProcesses = Math.max(this.statistics.peakProcesses, this.statistics.activeProcesses);

        // Update process type statistics
        const processType = processData.type;
        this.statistics.processTypes[processType] = (this.statistics.processTypes[processType] || 0) + 1;

        // Log process creation
        this.writeLog({
            type: 'process_created',
            timestamp: new Date().toISOString(),
            pid,
            command,
            args,
            parentPid,
            processType,
            existing,
            activeProcesses: this.statistics.activeProcesses
        });

        // Check alerts
        this.checkAlerts();

        this.emit('process_created', processData);
    }

    /**
     * Handle process destruction
     */
    handleProcessDestruction(pid, exitCode = null) {
        const processData = this.processes.get(pid);
        if (!processData) {
            return;
        }

        const lifetime = Date.now() - processData.startTime;
        processData.endTime = Date.now();
        processData.lifetime = lifetime;
        processData.exitCode = exitCode;
        processData.status = 'terminated';

        this.statistics.totalProcessesDestroyed++;
        this.statistics.activeProcesses--;

        // Update average lifetime
        const totalLifetime = Array.from(this.processes.values())
            .filter(p => p.lifetime)
            .reduce((sum, p) => sum + p.lifetime, 0);
        const completedProcesses = this.statistics.totalProcessesDestroyed;
        this.statistics.averageLifetime = completedProcesses > 0 ? totalLifetime / completedProcesses : 0;

        // Log process destruction
        this.writeLog({
            type: 'process_destroyed',
            timestamp: new Date().toISOString(),
            pid,
            lifetime,
            exitCode,
            processType: processData.type,
            activeProcesses: this.statistics.activeProcesses
        });

        this.emit('process_destroyed', processData);
    }

    /**
     * Monitor existing processes for updates
     */
    async monitorExistingProcesses() {
        if (!this.monitoringActive) {
            return;
        }

        try {
            const systemProcesses = await this.getSystemProcesses();

            // Update existing processes
            for (const [pid, processData] of this.processes.entries()) {
                if (processData.status === 'terminated') {
                    continue;
                }

                const systemProc = systemProcesses.find(p => p.pid === pid);
                if (systemProc) {
                    // Update process info
                    processData.cpuUsage = systemProc.pcpu;
                    processData.memoryUsage = systemProc.pmem;
                    processData.lastUpdate = Date.now();

                    // Check for long-running processes
                    const lifetime = Date.now() - processData.startTime;
                    if (lifetime > this.options.alertThresholds.processLifetimeMs) {
                        this.triggerAlert('long_running_process', {
                            pid,
                            lifetime,
                            command: processData.command
                        });
                    }
                } else {
                    // Process no longer exists
                    this.handleProcessDestruction(pid);
                }
            }

            // Check for new processes
            for (const systemProc of systemProcesses) {
                if (!this.processes.has(systemProc.pid) && this.isRelevantProcess(systemProc)) {
                    this.handleProcessCreation({
                        pid: systemProc.pid,
                        command: systemProc.command,
                        parentPid: systemProc.ppid,
                        existing: true
                    });
                }
            }

            // Update total resource usage
            this.updateResourceStatistics();

        } catch (error) {
            this.logger.error(`Error monitoring processes: ${error.message}`);
        }
    }

    /**
     * Classify process type based on command and arguments
     */
    classifyProcess(command, args = []) {
        const fullCommand = `${command} ${args.join(' ')}`.toLowerCase();

        if (fullCommand.includes('jest')) return 'jest';
        if (fullCommand.includes('mocha')) return 'mocha';
        if (fullCommand.includes('tap')) return 'tap';
        if (fullCommand.includes('ava')) return 'ava';
        if (fullCommand.includes('vitest')) return 'vitest';
        if (fullCommand.includes('cypress')) return 'cypress';
        if (fullCommand.includes('playwright')) return 'playwright';
        if (fullCommand.includes('puppeteer')) return 'puppeteer';
        if (fullCommand.includes('npm test')) return 'npm_test';
        if (fullCommand.includes('node') && fullCommand.includes('test')) return 'node_test';
        if (fullCommand.includes('eslint')) return 'eslint';
        if (fullCommand.includes('prettier')) return 'prettier';

        return 'other';
    }

    /**
     * Update resource usage statistics
     */
    updateResourceStatistics() {
        let totalMemory = 0;
        let totalCpu = 0;
        for (const processData of this.processes.values()) {
            if (processData.status === 'running') {
                totalMemory += processData.memoryUsage || 0;
                totalCpu += processData.cpuUsage || 0;
            }
        }

        this.statistics.totalMemoryUsage = totalMemory;
        this.statistics.totalCpuUsage = totalCpu;
    }

    /**
     * Check alert thresholds
     */
    checkAlerts() {
        if (!this.options.enableAlerts) {
            return;
        }

        const { alertThresholds } = this.options;

        // Check max processes
        if (this.statistics.activeProcesses > alertThresholds.maxProcesses) {
            this.triggerAlert('max_processes_exceeded', {
                current: this.statistics.activeProcesses,
                threshold: alertThresholds.maxProcesses
            });
        }

        // Check memory usage
        if (this.statistics.totalMemoryUsage > alertThresholds.maxMemoryMB) {
            this.triggerAlert('max_memory_exceeded', {
                current: this.statistics.totalMemoryUsage,
                threshold: alertThresholds.maxMemoryMB
            });
        }

        // Check CPU usage
        if (this.statistics.totalCpuUsage > alertThresholds.maxCpuPercent) {
            this.triggerAlert('max_cpu_exceeded', {
                current: this.statistics.totalCpuUsage,
                threshold: alertThresholds.maxCpuPercent
            });
        }
    }

    /**
     * Trigger an alert
     */
    triggerAlert(alertType, data) {
        const alert = {
            type: alertType,
            timestamp: new Date().toISOString(),
            data,
            acknowledged: false
        };

        this.statistics.alerts.push(alert);

        this.writeLog({
            type: 'alert',
            ...alert
        });

        this.logger.warn(`Alert triggered: ${alertType}`, data);
        this.emit('alert', alert);
    }

    /**
     * Write log entry
     */
    writeLog(entry) {
        if (!this.options.enableRealTimeLogging || !this.logStream) {
            return;
        }

        try {
            this.logStream.write(JSON.stringify(entry) + '\n');
        } catch (error) {
            this.logger.error(`Failed to write log entry: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive report
     */
    async generateReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;

        // Calculate process type distribution
        const processTypeDistribution = {};
        let totalProcesses = 0;
        for (const [type, count] of Object.entries(this.statistics.processTypes)) {
            processTypeDistribution[type] = {
                count,
                percentage: 0 // Will be calculated below
            };
            totalProcesses += count;
        }

        // Calculate percentages
        for (const type of Object.keys(processTypeDistribution)) {
            processTypeDistribution[type].percentage =
                totalProcesses > 0 ? (processTypeDistribution[type].count / totalProcesses * 100).toFixed(2) : 0;
        }

        // Calculate lifetime statistics
        const lifetimes = Array.from(this.processes.values())
            .filter(p => p.lifetime)
            .map(p => p.lifetime);

        const lifetimeStats = {
            min: lifetimes.length > 0 ? Math.min(...lifetimes) : 0,
            max: lifetimes.length > 0 ? Math.max(...lifetimes) : 0,
            average: this.statistics.averageLifetime,
            median: this.calculateMedian(lifetimes)
        };

        // Get current system resources
        const systemResources = await this.getSystemResources();

        const report = {
            summary: {
                monitoringDuration: duration,
                totalProcessesCreated: this.statistics.totalProcessesCreated,
                totalProcessesDestroyed: this.statistics.totalProcessesDestroyed,
                activeProcesses: this.statistics.activeProcesses,
                peakProcesses: this.statistics.peakProcesses,
                alertsTriggered: this.statistics.alerts.length
            },
            processTypes: processTypeDistribution,
            lifetimeStatistics: lifetimeStats,
            resourceUsage: {
                peakMemoryUsage: this.statistics.totalMemoryUsage,
                peakCpuUsage: this.statistics.totalCpuUsage,
                currentSystemResources: systemResources
            },
            alerts: this.statistics.alerts,
            detailedProcesses: Array.from(this.processes.values()),
            timestamp: new Date().toISOString()
        };

        return report;
    }

    /**
     * Calculate median of an array
     */
    calculateMedian(values) {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    /**
     * Get current system resources
     */
    async getSystemResources() {
        try {
            const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
            const loadAvg = fs.readFileSync('/proc/loadavg', 'utf8');

            const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
            const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
            const memUsed = memTotal - memAvailable;

            const [load1, load5, load15] = loadAvg.trim().split(' ').slice(0, 3).map(parseFloat);

            return {
                memory: {
                    total: memTotal,
                    used: memUsed,
                    available: memAvailable,
                    usagePercent: (memUsed / memTotal * 100).toFixed(2)
                },
                load: { load1, load5, load15 },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: `Failed to get system resources: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get current statistics
     */
    getStatistics() {
        return { ...this.statistics };
    }

    /**
     * Get active processes
     */
    getActiveProcesses() {
        return Array.from(this.processes.values()).filter(p => p.status === 'running');
    }

    /**
     * Kill all monitored processes
     */
    async killAllProcesses(signal = 'SIGTERM') {
        const activeProcesses = this.getActiveProcesses();
        const results = [];

        for (const processData of activeProcesses) {
            try {
                process.kill(processData.pid, signal);
                results.push({ pid: processData.pid, success: true });
                this.logger.info(`Killed process ${processData.pid} with signal ${signal}`);
            } catch (error) {
                results.push({ pid: processData.pid, success: false, error: error.message });
                this.logger.error(`Failed to kill process ${processData.pid}: ${error.message}`);
            }
        }

        return results;
    }
}

module.exports = ProcessMonitor;