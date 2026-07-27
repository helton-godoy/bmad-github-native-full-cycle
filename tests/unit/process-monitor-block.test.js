const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

const ProcessMonitor = require('../../scripts/lib/process-monitor');
const JestProcessMonitor = require('../../scripts/lib/jest-process-monitor');
const StandaloneProcessMonitor = require('../../scripts/monitor-test-processes');
const ProcessMonitorUtils = require('../../scripts/process-monitor-utils');
const BMADMonitor = require('../../scripts/bmad/bmad-monitor');

describe('process monitoring block', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'process-monitor-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('ProcessMonitor tracks lifecycle, resources, alerts and reports', async () => {
    const monitor = new ProcessMonitor({
      logDir: root,
      enableRealTimeLogging: false,
      maxProcesses: 1,
      maxMemoryMB: 1,
      maxCpuPercent: 1,
      processLifetimeMs: 1,
    });
    expect(monitor.isRelevantProcess({ command: 'node jest' })).toBe(true);
    expect(monitor.isRelevantProcess({ command: 'bash' })).toBe(false);
    [
      ['jest', 'jest'], ['mocha', 'mocha'], ['tap', 'tap'], ['ava', 'ava'],
      ['vitest', 'vitest'], ['cypress', 'cypress'], ['playwright', 'playwright'],
      ['puppeteer', 'puppeteer'], ['npm test', 'npm_test'],
      ['node test.js', 'node_test'], ['eslint', 'eslint'], ['prettier', 'prettier'],
      ['bash', 'other'],
    ].forEach(([command, type]) => expect(monitor.classifyProcess(command)).toBe(type));

    monitor.handleProcessCreation({
      pid: 11,
      command: 'node jest',
      startTime: Date.now() - 100,
    });
    monitor.handleProcessCreation({ pid: 12, command: 'npm test' });
    monitor.processes.get(11).memoryUsage = 4;
    monitor.processes.get(11).cpuUsage = 5;
    monitor.updateResourceStatistics();
    monitor.checkAlerts();
    expect(monitor.statistics.alerts.length).toBeGreaterThan(0);
    monitor.handleProcessDestruction(11, 0);
    monitor.handleProcessDestruction(999);
    expect(monitor.getActiveProcesses()).toHaveLength(1);
    expect(monitor.calculateMedian([])).toBe(0);
    expect(monitor.calculateMedian([3, 1, 2])).toBe(2);
    expect(monitor.calculateMedian([1, 3])).toBe(2);
    jest.spyOn(monitor, 'getSystemResources').mockResolvedValue({ ok: true });
    monitor.startTime = Date.now() - 50;
    const report = await monitor.generateReport();
    expect(report.summary.totalProcessesCreated).toBe(2);
    expect(report.processTypes.jest.percentage).toBe('50.00');
  });

  test('ProcessMonitor start/stop and scanning remain isolated', async () => {
    jest.useFakeTimers();
    jest.spyOn(fs, 'createWriteStream').mockReturnValue({
      write: jest.fn(),
      end: jest.fn(),
    });
    const monitor = new ProcessMonitor({ logDir: root, monitoringInterval: 5 });
    jest.spyOn(monitor, 'getSystemProcesses').mockResolvedValue([
      { pid: 21, ppid: 1, command: 'node jest', pcpu: 2, pmem: 3 },
      { pid: 22, ppid: 1, command: 'bash', pcpu: 0, pmem: 0 },
    ]);
    jest.spyOn(monitor, 'getSystemResources').mockResolvedValue({});
    await monitor.startMonitoring();
    await monitor.startMonitoring();
    expect(monitor.processes.has(21)).toBe(true);
    monitor.getSystemProcesses.mockResolvedValue([
      { pid: 23, ppid: 1, command: 'npx vitest', pcpu: 1, pmem: 1 },
    ]);
    await monitor.monitorExistingProcesses();
    expect(monitor.processes.get(21).status).toBe('terminated');
    expect(monitor.processes.has(23)).toBe(true);
    const report = await monitor.stopMonitoring();
    expect(report.summary).toBeDefined();
    await expect(monitor.stopMonitoring()).resolves.toBeUndefined();
  });

  test('ProcessMonitor handles resource and kill failures', async () => {
    const monitor = new ProcessMonitor({ enableRealTimeLogging: false });
    const read = jest.spyOn(fs, 'readFileSync')
      .mockReturnValueOnce('MemTotal: 100\nMemAvailable: 40')
      .mockReturnValueOnce('1.0 2.0 3.0 1/1');
    expect((await monitor.getSystemResources()).memory.used).toBe(60 * 1024);
    read.mockImplementation(() => { throw new Error('no proc'); });
    expect(await monitor.getSystemResources()).toHaveProperty('error');
    read.mockRestore();

    monitor.handleProcessCreation({ pid: 31, command: 'jest' });
    monitor.handleProcessCreation({ pid: 32, command: 'jest' });
    const kill = jest.spyOn(process, 'kill')
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => { throw new Error('denied'); });
    const results = await monitor.killAllProcesses('SIGTERM');
    expect(results.map((item) => item.success)).toEqual([true, false]);
    kill.mockRestore();
  });

  test('JestProcessMonitor classifies, hooks, reports and kills workers', async () => {
    const wrapper = new JestProcessMonitor({
      autoStart: false,
      autoStop: false,
      reportPath: path.join(root, 'report.json'),
    });
    expect(wrapper.isJestWorker({ command: 'node', args: ['jest-worker'] })).toBe(true);
    expect(wrapper.isJestWorker({ command: 'bash', args: [] })).toBe(false);
    ['jest-worker', 'jest-runner', '--coverage', '--watch', 'plain'].forEach((value, index) => {
      expect(wrapper.classifyJestWorker({ command: 'node', args: [value] })).toBe(
        ['worker', 'runner', 'coverage', 'watcher', 'main'][index]
      );
    });
    const report = {
      detailedProcesses: [
        { pid: 1, command: 'jest', args: [], workerType: 'worker', lifetime: 10, memoryUsage: 2, cpuUsage: 3, status: 'running' },
        { pid: 2, command: 'bash', args: [], status: 'terminated' },
      ],
    };
    const enhanced = wrapper.enhanceReportWithJestData(report);
    expect(enhanced.jestSpecific.totalJestProcesses).toBe(1);
    await wrapper.saveReport(report);
    expect(fs.existsSync(wrapper.options.reportPath)).toBe(true);

    wrapper.monitor.processes.set(1, report.detailedProcesses[0]);
    expect(wrapper.getJestStatistics().activeJestProcesses).toBe(1);
    const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
    expect(await wrapper.killAllJestProcesses()).toEqual([{ pid: 1, success: true }]);
    kill.mockRestore();
  });

  test('JestProcessMonitor setup/teardown uses mocked monitor methods', async () => {
    const wrapper = new JestProcessMonitor({ reportPath: path.join(root, 'jest.json') });
    jest.spyOn(wrapper.monitor, 'startMonitoring').mockResolvedValue();
    jest.spyOn(wrapper.monitor, 'stopMonitoring').mockResolvedValue({
      detailedProcesses: [],
    });
    jest.spyOn(wrapper, 'hookChildProcess').mockImplementation(() => { wrapper.isHooked = true; });
    jest.spyOn(wrapper, 'unhookChildProcess').mockImplementation(() => { wrapper.isHooked = false; });
    jest.spyOn(wrapper, 'setupJestHooks').mockImplementation(() => {});
    await wrapper.setup();
    const result = await wrapper.teardown();
    expect(result).toBeDefined();
    const disabled = new JestProcessMonitor({
      autoStart: false,
      autoStop: false,
      generateReport: false,
    });
    await disabled.setup();
    await expect(disabled.teardown()).resolves.toBeUndefined();
    disabled.unhookChildProcess();
  });

  test('Jest report and kill error branches are contained', async () => {
    const wrapper = new JestProcessMonitor({ reportPath: root });
    await expect(wrapper.saveReport({ detailedProcesses: [] })).resolves.toBeUndefined();
    const noLifetime = wrapper.enhanceReportWithJestData({
      detailedProcesses: [{ command: 'jest', args: [], memoryUsage: 0, cpuUsage: 0 }],
    });
    expect(noLifetime.jestSpecific.averageJestProcessLifetime).toBe(0);
    wrapper.monitor.processes.set(9, {
      pid: 9,
      command: 'jest',
      args: [],
      status: 'running',
    });
    const kill = jest.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('denied');
    });
    expect((await wrapper.killAllJestProcesses())[0].success).toBe(false);
    kill.mockRestore();
  });

  test('JestProcessMonitor hooks mocked child_process spawn and exec', () => {
    const childProcess = require('child_process');
    const originalSpawn = childProcess.spawn;
    const originalExec = childProcess.exec;
    const spawnChild = new EventEmitter();
    spawnChild.pid = 101;
    const execChild = new EventEmitter();
    execChild.pid = 102;
    childProcess.spawn = jest.fn(() => spawnChild);
    childProcess.exec = jest.fn(() => execChild);
    const wrapper = new JestProcessMonitor({ autoStart: false, autoStop: false });
    jest.spyOn(wrapper.monitor, 'handleProcessCreation');
    jest.spyOn(wrapper.monitor, 'handleProcessDestruction');
    try {
      wrapper.hookChildProcess();
      wrapper.hookChildProcess();
      const hookedSpawn = childProcess.spawn;
      const hookedExec = childProcess.exec;
      hookedSpawn('node', ['jest']);
      hookedExec('jest', () => {});
      hookedExec('jest', {}, () => {});
      spawnChild.emit('exit', 0, null);
      execChild.emit('exit', 1, null);
      expect(wrapper.monitor.handleProcessCreation).toHaveBeenCalled();
      wrapper.unhookChildProcess();
      wrapper.unhookChildProcess();
    } finally {
      childProcess.spawn = originalSpawn;
      childProcess.exec = originalExec;
    }
  });

  test('Jest lifecycle worker listener enriches created processes', () => {
    const wrapper = new JestProcessMonitor({ autoStart: false, autoStop: false });
    const execute = jest.fn();
    global.jasmine = { getEnv: () => ({ execute }) };
    wrapper.setupJestHooks();
    const worker = { pid: 5, command: 'node', args: ['jest-worker'] };
    wrapper.monitor.emit('process_created', worker);
    expect(worker).toMatchObject({ jestWorker: true, workerType: 'worker' });
    delete global.jasmine;
  });

  test('monitor utilities analyze, render and clean isolated files', async () => {
    const log = path.join(root, 'monitor.log');
    fs.writeFileSync(log, [
      JSON.stringify({ type: 'process_created', timestamp: '2020-01-02', processType: 'jest' }),
      JSON.stringify({ type: 'process_destroyed', timestamp: '2020-01-03' }),
      JSON.stringify({ type: 'alert', timestamp: '2020-01-01', data: {} }),
      'bad json',
    ].join('\n'));
    const analysis = await ProcessMonitorUtils.analyzeLogs(log);
    expect(analysis.processEvents).toEqual({ created: 1, destroyed: 1, alerts: 1 });
    expect(analysis.errors).toHaveLength(1);
    await expect(ProcessMonitorUtils.analyzeLogs(path.join(root, 'missing')))
      .rejects.toThrow('Log file not found');

    const jsonReport = {
      summary: { totalProcessesCreated: 1, peakProcesses: 1, monitoringDuration: 1000, alertsTriggered: 1 },
      processTypes: { jest: { count: 1, percentage: '100.00' } },
      lifetimeStatistics: { average: 10, median: 10, min: 10, max: 10 },
      alerts: [{ type: 'error_limit', timestamp: 'now', data: {} }],
      detailedProcesses: [{ pid: 1, type: 'jest', command: 'x'.repeat(60), lifetime: 10, status: 'done' }],
      jestSpecific: { totalJestProcesses: 1, averageJestProcessLifetime: 10, jestMemoryUsage: 2, jestCpuUsage: 3 },
    };
    const html = path.join(root, 'report.html');
    expect(ProcessMonitorUtils.generateHtmlReport(jsonReport, html)).toBe(html);
    expect(fs.readFileSync(html, 'utf8')).toContain('Jest-Specific');

    const old = path.join(root, 'process-monitor-old.json');
    const keep = path.join(root, 'other.json');
    fs.writeFileSync(old, '{}');
    fs.writeFileSync(keep, '{}');
    fs.utimesSync(old, new Date(0), new Date(0));
    expect(ProcessMonitorUtils.cleanOldLogs(root, 1).cleaned).toBe(1);
    expect(ProcessMonitorUtils.cleanOldLogs(path.join(root, 'missing')).cleaned).toBe(0);
    jsonReport.alerts = [];
    delete jsonReport.jestSpecific;
    jsonReport.detailedProcesses[0].command = 'short';
    jsonReport.detailedProcesses[0].lifetime = 0;
    ProcessMonitorUtils.generateHtmlReport(jsonReport, html);
  });

  test('monitor utilities use mocked exec for system information and kill', async () => {
    const childProcess = require('child_process');
    const exec = jest.spyOn(childProcess, 'exec')
      .mockImplementationOnce((command, callback) => callback(null, '10\n'))
      .mockImplementationOnce((command, callback) => callback(null, '3\n'))
      .mockImplementationOnce((command, callback) => callback(null, 'out', 'err'));
    await expect(ProcessMonitorUtils.getSystemProcessInfo()).resolves.toMatchObject({
      totalSystemProcesses: 10,
      nodeRelatedProcesses: 3,
    });
    await expect(ProcessMonitorUtils.killProcessesByPattern('jest')).resolves.toMatchObject({
      success: true,
      signal: 'SIGTERM',
    });
    exec.mockRestore();
  });

  test('utility CLI routes commands without real system calls', async () => {
    const log = path.join(root, 'log');
    fs.writeFileSync(log, '');
    expect(await ProcessMonitorUtils.main(['analyze'])).toBe(1);
    expect(await ProcessMonitorUtils.main(['analyze', 'missing'])).toBe(1);
    expect(await ProcessMonitorUtils.main(['clean', root, '1'])).toBe(0);
    expect(await ProcessMonitorUtils.main(['html-report'])).toBe(1);
    expect(await ProcessMonitorUtils.main([])).toBe(0);
    const system = jest.spyOn(ProcessMonitorUtils, 'getSystemProcessInfo').mockResolvedValue({ ok: true });
    const kill = jest.spyOn(ProcessMonitorUtils, 'killProcessesByPattern').mockResolvedValue({ ok: true });
    expect(await ProcessMonitorUtils.main(['system-info'])).toBe(0);
    expect(await ProcessMonitorUtils.main(['kill'])).toBe(1);
    expect(await ProcessMonitorUtils.main(['kill', 'jest'])).toBe(0);
    system.mockRestore();
    kill.mockRestore();
  });

  test('standalone monitor parses options, events, save and summary without spawning', async () => {
    jest.useFakeTimers();
    const standalone = new StandaloneProcessMonitor({
      argv: ['--command', 'node test', '--duration', '10', '--output', path.join(root, 'out.json'), '--max-processes', '2', '--max-memory', '3', '--max-cpu', '4', '--alerts', '--no-realtime', '--unknown'],
    });
    expect(standalone.args).toMatchObject({ command: 'node test', duration: 10, alerts: true, realtime: false });
    standalone.showHelp();
    standalone.monitor = new EventEmitter();
    standalone.monitor.getStatistics = () => ({ activeProcesses: 1, totalProcessesCreated: 2, alerts: [] });
    standalone.setupEventListeners();
    standalone.monitor.emit('process_created', { pid: 1, type: 'jest', command: 'jest' });
    standalone.monitor.emit('process_destroyed', { pid: 1, type: 'jest', lifetime: 10 });
    standalone.monitor.emit('alert', { type: 'x', data: {} });
    standalone.startTime = Date.now();
    const report = {
      summary: { monitoringDuration: 10, totalProcessesCreated: 1, totalProcessesDestroyed: 1, peakProcesses: 1, alertsTriggered: 1 },
      processTypes: { jest: { count: 1, percentage: '100' } },
      lifetimeStatistics: { average: 1, median: 1, min: 1, max: 1 },
      alerts: [{ type: 'x', timestamp: 'now' }],
    };
    await standalone.saveReport(report);
    standalone.displaySummary(report);
    expect(fs.existsSync(standalone.args.output)).toBe(true);
  });

  test('standalone start, target lifecycle and stop use only fakes', async () => {
    jest.useFakeTimers();
    const child = new EventEmitter();
    child.pid = 55;
    child.killed = false;
    child.kill = jest.fn((signal) => {
      if (signal === 'SIGKILL') child.killed = true;
    });
    const standalone = new StandaloneProcessMonitor({
      args: {
        command: 'node test.js',
        duration: null,
        output: path.join(root, 'standalone.json'),
        alerts: false,
        realtime: false,
        maxProcesses: 2,
        maxMemory: 3,
        maxCpu: 4,
        help: false,
      },
      spawn: jest.fn(() => child),
    });
    const startPromise = standalone.startTargetCommand();
    child.emit('spawn');
    await startPromise;
    expect(standalone.spawn).toHaveBeenCalled();

    standalone.monitor = {
      stopMonitoring: jest.fn().mockResolvedValue({
        summary: { monitoringDuration: 1, totalProcessesCreated: 0, totalProcessesDestroyed: 0, peakProcesses: 0, alertsTriggered: 0 },
        processTypes: {},
        lifetimeStatistics: { average: 0, median: 0, min: 0, max: 0 },
        alerts: [],
      }),
    };
    standalone.startTime = Date.now();
    await standalone.stop();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    jest.runOnlyPendingTimers();
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');

    const help = new StandaloneProcessMonitor({ args: { help: true } });
    await help.start();
  });

  test('standalone full start orchestrates mocked monitor with and without duration', async () => {
    jest.useFakeTimers();
    for (const duration of [null, 20]) {
      const standalone = new StandaloneProcessMonitor({
        args: {
          command: 'fake',
          duration,
          output: path.join(root, `start-${duration}.json`),
          alerts: duration !== null,
          realtime: true,
          maxProcesses: 1,
          maxMemory: 2,
          maxCpu: 3,
          help: false,
        },
      });
      jest.spyOn(ProcessMonitor.prototype, 'startMonitoring').mockResolvedValue();
      jest.spyOn(standalone, 'setupEventListeners').mockImplementation(() => {});
      jest.spyOn(standalone, 'startTargetCommand').mockResolvedValue();
      jest.spyOn(standalone, 'setupGracefulShutdown').mockImplementation(() => {});
      jest.spyOn(standalone, 'stop').mockResolvedValue();
      await standalone.start();
      expect(standalone.monitor).toBeInstanceOf(ProcessMonitor);
      jest.restoreAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    }
  });

  test('BMAD monitor reads project state and isolates recovery', async () => {
    fs.mkdirSync(path.join(root, '.github'));
    fs.mkdirSync(path.join(root, 'docs', 'architecture'), { recursive: true });
    fs.writeFileSync(path.join(root, '.github', 'workflow-state-1.json'), JSON.stringify({ status: 'running', workflowId: 1, phase: 'dev' }));
    fs.writeFileSync(path.join(root, '.github', 'workflow-state-2.json'), JSON.stringify({ status: 'completed', workflowId: 2 }));
    fs.writeFileSync(path.join(root, '.github', 'workflow-state-bad.json'), '{bad');
    fs.writeFileSync(path.join(root, 'docs', 'architecture', 'SYSTEM_MAP.md'), 'x');
    fs.writeFileSync(path.join(root, 'task.md'), '- [x] done\n- [ ] todo');
    const Recovery = jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ ciStatus: { failed: true } }),
    }));
    const monitor = new BMADMonitor({ rootDir: root, RecoveryPersona: Recovery });
    expect(monitor.getWorkflowStats()).toMatchObject({ active: 1, completed: 1 });
    expect(monitor.getDocStats()).toMatchObject({ coverage: 100, systemMap: true });
    expect(monitor.getTaskStats().summary).toContain('50%');
    await monitor.generateDashboard();
    expect(fs.existsSync(path.join(root, 'docs', 'DASHBOARD.md'))).toBe(true);
    const previous = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    await monitor.monitorCI();
    process.env.GITHUB_TOKEN = 'token';
    await monitor.monitorCI();
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  });

  test('BMAD monitor covers empty project, healthy CI and recovery failure', async () => {
    const Healthy = jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ ciStatus: { failed: false } }),
    }));
    const empty = new BMADMonitor({ rootDir: root, RecoveryPersona: Healthy });
    expect(empty.getWorkflowStats().details).toContain('No active');
    expect(empty.getDocStats().coverage).toBe(0);
    expect(empty.getTaskStats().summary).toContain('No task.md');
    fs.writeFileSync(path.join(root, 'task.md'), 'nothing');
    expect(empty.getTaskStats().summary).toContain('0%');
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'token';
    await empty.monitorCI();
    empty.RecoveryPersona = jest.fn(() => {
      throw new Error('recovery unavailable');
    });
    await empty.monitorCI();
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  });
});
