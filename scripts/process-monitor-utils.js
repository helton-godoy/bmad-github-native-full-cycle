#!/usr/bin/env node

/**
 * Process Monitor Utilities
 * Collection of utility functions for process monitoring
 */

const fs = require('fs');
const path = require('path');

class ProcessMonitorUtils {
  /**
   * Analyze existing log files
   */
  static async analyzeLogs(logPath) {
    if (!fs.existsSync(logPath)) {
      throw new Error(`Log file not found: ${logPath}`);
    }

    const logContent = fs.readFileSync(logPath, 'utf8');
    const logLines = logContent
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    const analysis = {
      totalEntries: logLines.length,
      processEvents: {
        created: 0,
        destroyed: 0,
        alerts: 0,
      },
      timeRange: {
        start: null,
        end: null,
      },
      processTypes: {},
      alerts: [],
      errors: [],
    };

    for (const line of logLines) {
      try {
        const entry = JSON.parse(line);

        // Update time range
        if (
          !analysis.timeRange.start ||
          entry.timestamp < analysis.timeRange.start
        ) {
          analysis.timeRange.start = entry.timestamp;
        }
        if (
          !analysis.timeRange.end ||
          entry.timestamp > analysis.timeRange.end
        ) {
          analysis.timeRange.end = entry.timestamp;
        }

        // Count events
        switch (entry.type) {
          case 'process_created': {
            analysis.processEvents.created++;
            const processType = entry.processType || 'unknown';
            analysis.processTypes[processType] =
              (analysis.processTypes[processType] || 0) + 1;
            break;
          }
          case 'process_destroyed':
            analysis.processEvents.destroyed++;
            break;
          case 'alert':
            analysis.processEvents.alerts++;
            analysis.alerts.push(entry);
            break;
        }
      } catch (error) {
        analysis.errors.push(
          `Failed to parse line: ${line.substring(0, 100)}...`
        );
      }
    }

    return analysis;
  }

  /**
   * Generate HTML report from JSON report
   */
  static generateHtmlReport(jsonReport, outputPath) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Process Monitor Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .card h3 { margin: 0 0 10px 0; color: #333; }
        .card .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .section { margin-bottom: 30px; }
        .section h2 { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .alert.error { background-color: #f8d7da; border-color: #f5c6cb; }
        .chart { height: 300px; background: #f8f9fa; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #666; }
        .process-list { max-height: 400px; overflow-y: auto; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Process Monitor Report</h1>
            <p class="timestamp">Generated: ${new Date().toISOString()}</p>
        </div>

        <div class="summary">
            <div class="card">
                <h3>Total Processes</h3>
                <div class="value">${jsonReport.summary.totalProcessesCreated}</div>
            </div>
            <div class="card">
                <h3>Peak Processes</h3>
                <div class="value">${jsonReport.summary.peakProcesses}</div>
            </div>
            <div class="card">
                <h3>Duration</h3>
                <div class="value">${(jsonReport.summary.monitoringDuration / 1000).toFixed(1)}s</div>
            </div>
            <div class="card">
                <h3>Alerts</h3>
                <div class="value">${jsonReport.summary.alertsTriggered}</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 Process Types Distribution</h2>
            <table>
                <thead>
                    <tr>
                        <th>Process Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(jsonReport.processTypes)
                      .map(
                        ([type, data]) => `
                        <tr>
                            <td>${type}</td>
                            <td>${data.count}</td>
                            <td>${data.percentage}%</td>
                        </tr>
                    `
                      )
                      .join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>⏱️ Lifetime Statistics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value (seconds)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Average Lifetime</td>
                        <td>${(jsonReport.lifetimeStatistics.average / 1000).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Median Lifetime</td>
                        <td>${(jsonReport.lifetimeStatistics.median / 1000).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Minimum Lifetime</td>
                        <td>${(jsonReport.lifetimeStatistics.min / 1000).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Maximum Lifetime</td>
                        <td>${(jsonReport.lifetimeStatistics.max / 1000).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${
          jsonReport.alerts.length > 0
            ? `
        <div class="section">
            <h2>🚨 Alerts</h2>
            ${jsonReport.alerts
              .map(
                (alert) => `
                <div class="alert ${alert.type.includes('error') ? 'error' : ''}">
                    <strong>${alert.type}</strong> - ${alert.timestamp}<br>
                    ${JSON.stringify(alert.data, null, 2)}
                </div>
            `
              )
              .join('')}
        </div>
        `
            : ''
        }

        <div class="section">
            <h2>📋 Detailed Process List</h2>
            <div class="process-list">
                <table>
                    <thead>
                        <tr>
                            <th>PID</th>
                            <th>Type</th>
                            <th>Command</th>
                            <th>Lifetime (s)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${jsonReport.detailedProcesses
                          .map(
                            (process) => `
                            <tr>
                                <td>${process.pid}</td>
                                <td>${process.type}</td>
                                <td title="${process.command}">${process.command.substring(0, 50)}${process.command.length > 50 ? '...' : ''}</td>
                                <td>${process.lifetime ? (process.lifetime / 1000).toFixed(2) : 'N/A'}</td>
                                <td>${process.status}</td>
                            </tr>
                        `
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
        </div>

        ${
          jsonReport.jestSpecific
            ? `
        <div class="section">
            <h2>🧪 Jest-Specific Statistics</h2>
            <div class="summary">
                <div class="card">
                    <h3>Jest Processes</h3>
                    <div class="value">${jsonReport.jestSpecific.totalJestProcesses}</div>
                </div>
                <div class="card">
                    <h3>Avg Jest Lifetime</h3>
                    <div class="value">${(jsonReport.jestSpecific.averageJestProcessLifetime / 1000).toFixed(1)}s</div>
                </div>
                <div class="card">
                    <h3>Jest Memory</h3>
                    <div class="value">${jsonReport.jestSpecific.jestMemoryUsage.toFixed(1)}%</div>
                </div>
                <div class="card">
                    <h3>Jest CPU</h3>
                    <div class="value">${jsonReport.jestSpecific.jestCpuUsage.toFixed(1)}%</div>
                </div>
            </div>
        </div>
        `
            : ''
        }
    </div>
</body>
</html>`;

    fs.writeFileSync(outputPath, html);
    return outputPath;
  }

  /**
   * Clean old log files
   */
  static cleanOldLogs(logDir, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    // 7 days default
    if (!fs.existsSync(logDir)) {
      return { cleaned: 0, errors: [] };
    }

    const files = fs.readdirSync(logDir);
    const now = Date.now();
    let cleaned = 0;
    const errors = [];

    for (const file of files) {
      if (!file.includes('process-monitor') || !file.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(logDir, file);
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (error) {
        errors.push(`Failed to process ${file}: ${error.message}`);
      }
    }

    return { cleaned, errors };
  }

  /**
   * Get system process information
   */
  static async getSystemProcessInfo() {
    const { exec } = require('child_process');

    return new Promise((resolve, reject) => {
      exec('ps aux --no-headers | wc -l', (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const totalProcesses = parseInt(stdout.trim());

        exec(
          'ps aux --no-headers | grep -E "(node|npm|jest)" | wc -l',
          (error2, stdout2) => {
            if (error2) {
              reject(error2);
              return;
            }

            const nodeProcesses = parseInt(stdout2.trim());

            resolve({
              totalSystemProcesses: totalProcesses,
              nodeRelatedProcesses: nodeProcesses,
              timestamp: new Date().toISOString(),
            });
          }
        );
      });
    });
  }

  /**
   * Kill processes by pattern
   */
  static async killProcessesByPattern(pattern, signal = 'SIGTERM') {
    const { exec } = require('child_process');

    return new Promise((resolve) => {
      exec(
        `pkill -${signal.replace('SIG', '')} -f "${pattern}"`,
        (error, stdout, stderr) => {
          // pkill returns non-zero if no processes found, which is not an error
          resolve({
            success: true,
            pattern,
            signal,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      );
    });
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'analyze':
      if (args.length === 0) {
        console.error(
          'Usage: node process-monitor-utils.js analyze <log-file>'
        );
        process.exit(1);
      }
      ProcessMonitorUtils.analyzeLogs(args[0])
        .then((analysis) => console.log(JSON.stringify(analysis, null, 2)))
        .catch((error) => {
          console.error(`Analysis failed: ${error.message}`);
          process.exit(1);
        });
      break;

    case 'html-report':
      if (args.length < 2) {
        console.error(
          'Usage: node process-monitor-utils.js html-report <json-report> <output-html>'
        );
        process.exit(1);
      }
      try {
        const jsonReport = JSON.parse(fs.readFileSync(args[0], 'utf8'));
        const htmlPath = ProcessMonitorUtils.generateHtmlReport(
          jsonReport,
          args[1]
        );
        console.log(`HTML report generated: ${htmlPath}`);
      } catch (error) {
        console.error(`HTML report generation failed: ${error.message}`);
        process.exit(1);
      }
      break;

    case 'clean': {
      const logDir = args[0] || '.github/logs';
      const maxAge = args[1] ? parseInt(args[1]) : undefined;
      const result = ProcessMonitorUtils.cleanOldLogs(logDir, maxAge);
      console.log(`Cleaned ${result.cleaned} old log files`);
      if (result.errors.length > 0) {
        console.error('Errors:', result.errors);
      }
      break;
    }

    case 'system-info':
      ProcessMonitorUtils.getSystemProcessInfo()
        .then((info) => console.log(JSON.stringify(info, null, 2)))
        .catch((error) => {
          console.error(`System info failed: ${error.message}`);
          process.exit(1);
        });
      break;

    case 'kill':
      if (args.length === 0) {
        console.error(
          'Usage: node process-monitor-utils.js kill <pattern> [signal]'
        );
        process.exit(1);
      }
      ProcessMonitorUtils.killProcessesByPattern(args[0], args[1])
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((error) => {
          console.error(`Kill failed: ${error.message}`);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Process Monitor Utilities

Usage: node process-monitor-utils.js <command> [args]

Commands:
  analyze <log-file>                    Analyze process monitor log file
  html-report <json-report> <output>    Generate HTML report from JSON
  clean [log-dir] [max-age-ms]         Clean old log files
  system-info                          Get current system process info
  kill <pattern> [signal]              Kill processes matching pattern

Examples:
  node process-monitor-utils.js analyze .github/logs/process-monitor.json
  node process-monitor-utils.js html-report report.json report.html
  node process-monitor-utils.js clean .github/logs 604800000
  node process-monitor-utils.js kill "jest" SIGTERM
            `);
      break;
  }
}

module.exports = ProcessMonitorUtils;
