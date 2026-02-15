/**
 * Jest Setup - Process Monitor Integration
 * Automatically monitors processes during Jest test execution
 * Add to jest.config.js: setupFilesAfterEnv: ['<rootDir>/tests/setup-process-monitor.js']
 */

const JestProcessMonitor = require('../scripts/lib/jest-process-monitor');
const path = require('path');

// Check if process monitoring is enabled
const ENABLE_PROCESS_MONITORING = process.env.ENABLE_PROCESS_MONITORING === 'true' ||
    process.env.MONITOR_PROCESSES === 'true';

let jestMonitor = null;

if (ENABLE_PROCESS_MONITORING) {
    console.log('🔍 Process monitoring enabled for Jest');

    jestMonitor = new JestProcessMonitor({
        autoStart: true,
        autoStop: true,
        generateReport: true,
        reportPath: path.join(process.cwd(), '.github', 'reports', 'jest-process-monitor.json'),
        maxProcesses: parseInt(process.env.MAX_PROCESSES) || 20,
        maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB) || 1024,
        maxCpuPercent: parseInt(process.env.MAX_CPU_PERCENT) || 70,
        enableAlerts: process.env.ENABLE_ALERTS === 'true'
    });

    // Setup before all tests
    beforeAll(async () => {
        await jestMonitor.setup();
    });

    // Teardown after all tests
    afterAll(async () => {
        const report = await jestMonitor.teardown();

        if (report) {
            console.log('\n📊 Process Monitoring Summary:');
            console.log(`  Total Processes: ${report.summary.totalProcessesCreated}`);
            console.log(`  Peak Processes: ${report.summary.peakProcesses}`);
            console.log(`  Alerts: ${report.summary.alertsTriggered}`);

            if (report.jestSpecific) {
                console.log(`  Jest Processes: ${report.jestSpecific.totalJestProcesses}`);
                console.log(`  Avg Jest Lifetime: ${(report.jestSpecific.averageJestProcessLifetime / 1000).toFixed(2)}s`);
            }
        }
    });

    // Export monitor for test access
    global.__processMonitor = jestMonitor;
} else {
    console.log('ℹ️  Process monitoring disabled. Set ENABLE_PROCESS_MONITORING=true to enable.');
}

module.exports = jestMonitor;