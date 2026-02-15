#!/usr/bin/env node

/**
 * Standalone Test Process Monitor
 * Usage: node scripts/monitor-test-processes.js [options]
 * 
 * Options:
 *   --command <cmd>     Command to monitor (default: npm test)
 *   --duration <ms>     Maximum monitoring duration in ms
 *   --output <file>     Output report file path
 *   --alerts            Enable alert notifications
 *   --realtime          Enable real-time logging
 *   --max-processes <n> Maximum allowed processes
 *   --max-memory <mb>   Maximum memory usage in MB
 *   --max-cpu <pct>     Maximum CPU usage percentage
 *   --help              Show help
 */

const ProcessMonitor = require('./lib/process-monitor');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class StandaloneProcessMonitor {
    constructor() {
        this.args = this.parseArguments();
        this.monitor = null;
        this.targetProcess = null;
        this.startTime = null;
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const args = process.argv.slice(2);
        const options = {
            command: 'npm test',
            duration: null,
            output: '.github/reports/standalone-process-monitor.json',
            alerts: false,
            realtime: true,
            maxProcesses: 50,
            maxMemory: 2048,
            maxCpu: 80,
            help: false
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];

            switch (arg) {
            case '--command':
                options.command = nextArg;
                i++;
                break;
            case '--duration':
                options.duration = parseInt(nextArg);
                i++;
                break;
            case '--output':
                options.output = nextArg;
                i++;
                break;
            case '--max-processes':
                options.maxProcesses = parseInt(nextArg);
                i++;
                break;
            case '--max-memory':
                options.maxMemory = parseInt(nextArg);
                i++;
                break;
            case '--max-cpu':
                options.maxCpu = parseInt(nextArg);
                i++;
                break;
            case '--alerts':
                options.alerts = true;
                break;
            case '--realtime':
                options.realtime = true;
                break;
            case '--no-realtime':
                options.realtime = false;
                break;
            case '--help':
                options.help = true;
                break;
            default:
                if (arg.startsWith('--')) {
                    console.warn(`Unknown option: ${arg}`);
                }
                break;
            }
        }

        return options;
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
Test Process Monitor - Monitor child processes during test execution

Usage: node scripts/monitor-test-processes.js [options]

Options:
  --command <cmd>       Command to monitor (default: "npm test")
  --duration <ms>       Maximum monitoring duration in milliseconds
  --output <file>       Output report file path (default: .github/reports/standalone-process-monitor.json)
  --max-processes <n>   Maximum allowed processes (default: 50)
  --max-memory <mb>     Maximum memory usage in MB (default: 2048)
  --max-cpu <pct>       Maximum CPU usage percentage (default: 80)
  --alerts              Enable alert notifications
  --realtime            Enable real-time logging (default: true)
  --no-realtime         Disable real-time logging
  --help                Show this help message

Examples:
  # Monitor npm test with default settings
  node scripts/monitor-test-processes.js

  # Monitor Jest with custom limits
  node scripts/monitor-test-processes.js --command "npx jest" --max-processes 20 --alerts

  # Monitor for 5 minutes with custom output
  node scripts/monitor-test-processes.js --duration 300000 --output ./my-report.json

  # Monitor with strict resource limits
  node scripts/monitor-test-processes.js --max-memory 512 --max-cpu 50 --alerts
        `);
    }

    /**
     * Initialize and start monitoring
     */
    async start() {
        if (this.args.help) {
            this.showHelp();
            return;
        }

        console.log('🔍 Starting Test Process Monitor');
        console.log(`📋 Command: ${this.args.command}`);
        console.log(`⏱️  Duration: ${this.args.duration ? `${this.args.duration}ms` : 'unlimited'}`);
        console.log(`📊 Limits: ${this.args.maxProcesses} processes, ${this.args.maxMemory}MB memory, ${this.args.maxCpu}% CPU`);
        console.log(`🚨 Alerts: ${this.args.alerts ? 'enabled' : 'disabled'}`);
        console.log(`📝 Output: ${this.args.output}`);
        console.log('');

        this.startTime = Date.now();

        // Initialize process monitor
        this.monitor = new ProcessMonitor({
            logFile: 'standalone-process-monitor.json',
            enableAlerts: this.args.alerts,
            enableRealTimeLogging: this.args.realtime,
            alertThresholds: {
                maxProcesses: this.args.maxProcesses,
                maxMemoryMB: this.args.maxMemory,
                maxCpuPercent: this.args.maxCpu,
                processLifetimeMs: 300000 // 5 minutes
            }
        });

        // Setup event listeners
        this.setupEventListeners();

        // Start monitoring
        await this.monitor.startMonitoring();

        // Start target command
        await this.startTargetCommand();

        // Setup duration limit if specified
        if (this.args.duration) {
            setTimeout(() => {
                console.log(`⏰ Duration limit reached (${this.args.duration}ms), stopping...`);
                this.stop();
            }, this.args.duration);
        }

        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    /**
     * Setup event listeners for monitoring feedback
     */
    setupEventListeners() {
        this.monitor.on('process_created', (processData) => {
            console.log(`➕ Process created: PID ${processData.pid} (${processData.type}) - ${processData.command}`);
        });

        this.monitor.on('process_destroyed', (processData) => {
            const lifetime = processData.lifetime ? `${(processData.lifetime / 1000).toFixed(2)}s` : 'unknown';
            console.log(`➖ Process destroyed: PID ${processData.pid} (${processData.type}) - lifetime: ${lifetime}`);
        });

        this.monitor.on('alert', (alert) => {
            console.log(`🚨 ALERT: ${alert.type} - ${JSON.stringify(alert.data)}`);
        });

        // Periodic status updates
        setInterval(() => {
            const stats = this.monitor.getStatistics();
            console.log(`📊 Status: ${stats.activeProcesses} active, ${stats.totalProcessesCreated} total created, ${stats.alerts.length} alerts`);
        }, 10000); // Every 10 seconds
    }

    /**
     * Start the target command to monitor
     */
    async startTargetCommand() {
        return new Promise((resolve, reject) => {
            console.log(`🚀 Starting target command: ${this.args.command}`);

            const [command, ...args] = this.args.command.split(' ');
            this.targetProcess = spawn(command, args, {
                stdio: 'inherit',
                shell: true
            });

            this.targetProcess.on('spawn', () => {
                console.log(`✅ Target process started: PID ${this.targetProcess.pid}`);
                resolve();
            });

            this.targetProcess.on('error', (error) => {
                console.error(`❌ Failed to start target process: ${error.message}`);
                reject(error);
            });

            this.targetProcess.on('exit', (code, signal) => {
                console.log(`🏁 Target process exited: code ${code}, signal ${signal}`);
                setTimeout(() => this.stop(), 2000); // Wait 2 seconds for cleanup
            });
        });
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGQUIT', () => shutdown('SIGQUIT'));
    }

    /**
     * Stop monitoring and generate report
     */
    async stop() {
        console.log('🛑 Stopping process monitor...');

        // Kill target process if still running
        if (this.targetProcess && !this.targetProcess.killed) {
            console.log('🔪 Terminating target process...');
            this.targetProcess.kill('SIGTERM');

            // Force kill after 5 seconds
            setTimeout(() => {
                if (!this.targetProcess.killed) {
                    console.log('🔪 Force killing target process...');
                    this.targetProcess.kill('SIGKILL');
                }
            }, 5000);
        }

        // Stop monitoring and get report
        const report = await this.monitor.stopMonitoring();

        // Save report
        await this.saveReport(report);

        // Display summary
        this.displaySummary(report);
    }

    /**
     * Save report to file
     */
    async saveReport(report) {
        try {
            const outputDir = path.dirname(this.args.output);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Add monitoring metadata
            const enhancedReport = {
                ...report,
                monitoringConfig: {
                    command: this.args.command,
                    duration: this.args.duration,
                    limits: {
                        maxProcesses: this.args.maxProcesses,
                        maxMemory: this.args.maxMemory,
                        maxCpu: this.args.maxCpu
                    },
                    alertsEnabled: this.args.alerts,
                    realtimeLogging: this.args.realtime
                },
                executionTime: Date.now() - this.startTime
            };

            fs.writeFileSync(this.args.output, JSON.stringify(enhancedReport, null, 2));
            console.log(`📄 Report saved to: ${this.args.output}`);
        } catch (error) {
            console.error(`❌ Failed to save report: ${error.message}`);
        }
    }

    /**
     * Display summary of monitoring results
     */
    displaySummary(report) {
        console.log('\n📊 MONITORING SUMMARY');
        console.log('='.repeat(50));
        console.log(`⏱️  Total Duration: ${(report.summary.monitoringDuration / 1000).toFixed(2)}s`);
        console.log(`🔢 Processes Created: ${report.summary.totalProcessesCreated}`);
        console.log(`🔢 Processes Destroyed: ${report.summary.totalProcessesDestroyed}`);
        console.log(`📈 Peak Processes: ${report.summary.peakProcesses}`);
        console.log(`🚨 Alerts Triggered: ${report.summary.alertsTriggered}`);

        console.log('\n📋 Process Types:');
        for (const [type, data] of Object.entries(report.processTypes)) {
            console.log(`  ${type}: ${data.count} (${data.percentage}%)`);
        }

        console.log('\n⏱️  Process Lifetimes:');
        console.log(`  Average: ${(report.lifetimeStatistics.average / 1000).toFixed(2)}s`);
        console.log(`  Median: ${(report.lifetimeStatistics.median / 1000).toFixed(2)}s`);
        console.log(`  Min: ${(report.lifetimeStatistics.min / 1000).toFixed(2)}s`);
        console.log(`  Max: ${(report.lifetimeStatistics.max / 1000).toFixed(2)}s`);

        if (report.alerts.length > 0) {
            console.log('\n🚨 Alerts:');
            report.alerts.forEach((alert, index) => {
                console.log(`  ${index + 1}. ${alert.type} at ${alert.timestamp}`);
            });
        }

        console.log('\n✅ Monitoring complete!');
    }
}

// Run if called directly
if (require.main === module) {
    const monitor = new StandaloneProcessMonitor();
    monitor.start().catch(error => {
        console.error(`❌ Monitor failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = StandaloneProcessMonitor;