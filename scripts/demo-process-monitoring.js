#!/usr/bin/env node

/**
 * Process Monitoring Demo
 * Demonstrates the process monitoring capabilities
 */

const ProcessMonitor = require('./lib/process-monitor');
const { spawn } = require('child_process');

async function runDemo() {
    console.log('🎬 Process Monitoring Demo Starting...\n');

    // Initialize monitor with demo settings
    const monitor = new ProcessMonitor({
        logFile: 'demo-process-monitor.json',
        enableAlerts: true,
        enableRealTimeLogging: true,
        alertThresholds: {
            maxProcesses: 5,  // Low threshold for demo
            maxMemoryMB: 100,
            maxCpuPercent: 50,
            processLifetimeMs: 10000 // 10 seconds
        }
    });

    // Setup event listeners for demo
    monitor.on('process_created', (processData) => {
        console.log(`✅ Process created: PID ${processData.pid} (${processData.type})`);
    });

    monitor.on('process_destroyed', (processData) => {
        const lifetime = processData.lifetime ? `${(processData.lifetime / 1000).toFixed(2)}s` : 'unknown';
        console.log(`❌ Process destroyed: PID ${processData.pid} - lifetime: ${lifetime}`);
    });

    monitor.on('alert', (alert) => {
        console.log(`🚨 ALERT: ${alert.type} - ${JSON.stringify(alert.data)}`);
    });

    try {
        // Start monitoring
        await monitor.startMonitoring();
        console.log('📊 Monitoring started\n');

        // Simulate some test processes
        console.log('🧪 Simulating test processes...\n');

        // Spawn multiple Node processes to trigger alerts
        const processes = [];
        for (let i = 0; i < 7; i++) {
            const proc = spawn('node', ['-e', `
                console.log('Demo process ${i} started');
                setTimeout(() => {
                    console.log('Demo process ${i} finished');
                    process.exit(0);
                }, ${2000 + Math.random() * 8000});
            `], { stdio: 'pipe' });

            processes.push(proc);

            // Small delay between spawns
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Wait for processes to complete
        await Promise.all(processes.map(proc => new Promise(resolve => {
            proc.on('exit', resolve);
        })));

        // Wait a bit more for monitoring to catch up
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Stop monitoring and get report
        console.log('\n🛑 Stopping monitoring...');
        const report = await monitor.stopMonitoring();

        // Display summary
        console.log('\n📊 DEMO SUMMARY');
        console.log('='.repeat(40));
        console.log(`Total Processes Created: ${report.summary.totalProcessesCreated}`);
        console.log(`Peak Processes: ${report.summary.peakProcesses}`);
        console.log(`Alerts Triggered: ${report.summary.alertsTriggered}`);
        console.log(`Monitoring Duration: ${(report.summary.monitoringDuration / 1000).toFixed(2)}s`);

        if (report.alerts.length > 0) {
            console.log('\n🚨 Alerts:');
            report.alerts.forEach((alert, index) => {
                console.log(`  ${index + 1}. ${alert.type}: ${JSON.stringify(alert.data)}`);
            });
        }

        console.log('\n✅ Demo completed successfully!');
        console.log('📄 Detailed log: .github/logs/demo-process-monitor.json');

    } catch (error) {
        console.error(`❌ Demo failed: ${error.message}`);
        process.exit(1);
    }
}

// Run demo if called directly
if (require.main === module) {
    runDemo().catch(error => {
        console.error(`Demo error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = runDemo;