const fs = require('fs');
const os = require('os');
const path = require('path');

const GitHubActionsSync = require('../../scripts/hooks/github-actions-sync');
const TestExecutionManager = require('../../scripts/lib/test-execution-manager');

describe('GitHub Actions synchronization and serialized test execution', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-tests-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  function sync() {
    return new GitHubActionsSync({
      workflowsDir: path.join(root, 'workflows'),
      hooksConfigFile: path.join(root, 'hooks.json'),
      syncReportFile: path.join(root, 'reports', 'sync.json'),
    });
  }

  test('synchronizes complete local and workflow configurations', () => {
    fs.mkdirSync(path.join(root, 'workflows'));
    fs.writeFileSync(
      path.join(root, 'hooks.json'),
      JSON.stringify({
        preCommit: { linting: true, testing: true },
        prePush: { build: true, security: true },
      })
    );
    fs.writeFileSync(
      path.join(root, 'workflows', 'ci.yml'),
      `jobs:
  validate:
    steps:
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
      - name: Security audit
        run: npm audit
`
    );
    fs.writeFileSync(path.join(root, 'workflows', 'ignore.txt'), 'ignored');
    const instance = sync();
    const report = instance.synchronizeConfiguration();
    expect(report).toMatchObject({ consistent: true, inconsistencies: [] });
    expect(fs.existsSync(instance.config.syncReportFile)).toBe(true);
    expect(instance.validateRemoteCoordination('main').recommendation.level).toBe('standard');
    expect(instance.validateRemoteCoordination('feature/x').willRunRemote).toBe(true);
  });

  test('defaults safely and reports every missing remote validation', () => {
    const instance = sync();
    expect(instance.getLocalHooksConfig()).toMatchObject({
      preCommit: { linting: true, testing: true },
    });
    expect(instance.getGitHubWorkflows()).toEqual({});
    expect(instance.compareConfigurations({}, [])[0].type).toBe('missing_workflows');

    const issues = instance.compareConfigurations(
      {
        preCommit: { linting: true, testing: true },
        prePush: { build: true, security: true },
      },
      { 'ci.yml': { linting: false, testing: false, build: false, security: false } }
    );
    expect(issues.map((item) => item.validation)).toEqual([
      'linting', 'testing', 'build', 'security',
    ]);
    const coordination = instance.validateRemoteCoordination('local/topic');
    expect(coordination).toMatchObject({
      willRunRemote: false,
      recommendation: { level: 'comprehensive' },
    });
  });

  test('extracts workflow steps across jobs and handles absent jobs/steps', () => {
    const instance = sync();
    expect(instance.extractValidationSteps({})).toEqual({
      linting: false, testing: false, build: false, security: false,
    });
    const result = instance.extractValidationSteps({
      jobs: {
        empty: {},
        checks: {
          steps: [
            { run: 'npm run lint && npm run test' },
            { name: 'Build project' },
            { name: 'Security scan' },
          ],
        },
      },
    });
    expect(result).toEqual({
      linting: true, testing: true, build: true, security: true,
    });
  });

  test('consistency history is bounded and recommendations cover inconsistent sync', () => {
    const instance = sync();
    expect(instance.generateConsistencyReport()).toMatchObject({
      totalValidations: 0,
      consistencyRate: 0,
    });
    for (let index = 0; index < 105; index++) {
      instance.monitorConsistency({ local: index % 2 === 0, remote: index % 3 === 0 });
    }
    const report = instance.generateConsistencyReport();
    expect(report.totalValidations).toBe(100);
    expect(report.recentHistory).toHaveLength(10);
    expect(instance.getValidationRecommendation(true, { consistent: false }).level)
      .toBe('comprehensive');
  });

  test('workflow/config/report IO errors are contained', () => {
    const instance = sync();
    fs.writeFileSync(instance.config.hooksConfigFile, '{bad');
    expect(instance.getLocalHooksConfig().preCommit).toBeDefined();
    fs.mkdirSync(instance.config.workflowsDir);
    fs.writeFileSync(path.join(instance.config.workflowsDir, 'bad.yml'), 'jobs: [');
    expect(instance.getGitHubWorkflows()).toEqual({});
    instance.config.syncReportFile = root;
    expect(() => instance.saveSyncReport({ ok: true })).not.toThrow();
    jest.spyOn(instance, 'getLocalHooksConfig').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(instance.synchronizeConfiguration()).toMatchObject({
      consistent: false,
      error: 'unavailable',
    });
  });

  function manager(options = {}) {
    const gitDir = path.join(root, '.git');
    fs.mkdirSync(gitDir, { recursive: true });
    return new TestExecutionManager({
      lockFile: path.join(gitDir, 'test.lock'),
      retryDelay: 0,
      ...options,
    });
  }

  test('acquires/releases a lock and removes stale or dead ownership', async () => {
    const instance = manager();
    expect(await instance.acquireLock('one')).toBe(true);
    expect(fs.existsSync(instance.lockFile)).toBe(true);
    instance.releaseLock('one');
    expect(fs.existsSync(instance.lockFile)).toBe(false);

    fs.writeFileSync(instance.lockFile, JSON.stringify({
      processId: 'stale', timestamp: 0, pid: 999,
    }));
    expect(await instance.acquireLock('two')).toBe(true);
    instance.releaseLock('two');

    fs.writeFileSync(instance.lockFile, JSON.stringify({
      processId: 'dead', timestamp: Date.now(), pid: 999,
    }));
    jest.spyOn(instance, 'isProcessRunning').mockReturnValue(false);
    expect(await instance.acquireLock('three')).toBe(true);
  });

  test('lock contention retries deterministically and reports exhaustion', async () => {
    const instance = manager({ maxRetries: 2 });
    fs.writeFileSync(instance.lockFile, JSON.stringify({
      processId: 'busy', timestamp: Date.now(), pid: 123,
    }));
    jest.spyOn(instance, 'isProcessRunning').mockReturnValue(true);
    jest.spyOn(instance, 'sleep').mockResolvedValue();
    await expect(instance.acquireLock('waiter')).rejects.toThrow(
      'after 2 attempts'
    );
    expect(instance.sleep).toHaveBeenCalledTimes(2);

    fs.unlinkSync(instance.lockFile);
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      const error = new Error('race');
      error.code = 'EEXIST';
      throw error;
    });
    await expect(instance.acquireLock('race')).rejects.toThrow('after 2 attempts');
    write.mockRestore();
  });

  test('release refuses foreign lock and contains malformed lock errors', () => {
    const instance = manager();
    fs.writeFileSync(instance.lockFile, JSON.stringify({ pid: process.pid + 1 }));
    expect(() => instance.releaseLock('foreign')).not.toThrow();
    expect(fs.existsSync(instance.lockFile)).toBe(true);
    fs.writeFileSync(instance.lockFile, '{bad');
    expect(() => instance.releaseLock('bad')).not.toThrow();
  });

  test('builds all optimized Jest command variants', () => {
    const instance = manager();
    const full = instance.buildOptimizedTestCommand('npm test', {
      maxWorkers: 2,
      testTimeout: 10,
      bail: true,
      silent: true,
      coverage: true,
      findRelatedTests: ['a.js', 'b.js'],
      testPathPattern: 'unit',
    });
    expect(full).toContain('-- --maxWorkers=2');
    expect(full).toContain('--coverage');
    expect(full).toContain('--findRelatedTests a.js b.js');
    expect(full).toContain('--testPathPattern="unit"');
    const minimal = instance.buildOptimizedTestCommand('jest --runInBand', {
      bail: false, silent: false,
    });
    expect(minimal).not.toContain('--bail');
    expect(minimal).toContain('jest --runInBand --maxWorkers');
  });

  test('executes tests through injected command runner and always releases lock', async () => {
    const execSync = jest.fn().mockReturnValue('ok');
    const instance = manager({ execSync });
    const result = await instance.executeTestsWithLock('npm test', {
      processId: 'success',
      timeout: 10,
    });
    expect(result).toMatchObject({ success: true, output: 'ok' });
    expect(fs.existsSync(instance.lockFile)).toBe(false);

    execSync.mockImplementation(() => {
      const error = new Error('failed');
      error.stdout = 'failure output';
      throw error;
    });
    const failed = await instance.executeTestsWithLock('npm test');
    expect(failed).toMatchObject({
      success: false,
      output: 'failure output',
    });
  });

  test('executes batches serially with deterministic pauses', async () => {
    const instance = manager();
    jest.spyOn(instance, 'executeTestsWithLock').mockResolvedValue({ success: true });
    jest.spyOn(instance, 'sleep').mockResolvedValue();
    const results = await instance.executeTestsInBatches(
      ['a.test.js', 'b.test.js', 'c.test.js'],
      { batchSize: 2 }
    );
    expect(results).toHaveLength(2);
    expect(results[0].files).toEqual(['a.test.js', 'b.test.js']);
    expect(instance.sleep).toHaveBeenCalledTimes(1);
  });

  test('process and resource checks cover success, failure and thresholds', () => {
    const instance = manager();
    const kill = jest.spyOn(process, 'kill')
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => { throw new Error('dead'); });
    expect(instance.isProcessRunning(1)).toBe(true);
    expect(instance.isProcessRunning(2)).toBe(false);
    kill.mockRestore();

    const read = jest.spyOn(fs, 'readFileSync')
      .mockReturnValueOnce('MemTotal: 100\nMemAvailable: 20')
      .mockReturnValueOnce('5 2 1');
    expect(instance.getSystemResources().memory.usagePercent).toBe(80);
    read.mockImplementation(() => { throw new Error('missing'); });
    expect(instance.getSystemResources()).toBeNull();
    read.mockRestore();

    jest.spyOn(instance, 'getSystemResources').mockReturnValue(null);
    expect(instance.hasEnoughResources()).toBe(true);
    instance.getSystemResources.mockReturnValue({
      memory: { usagePercent: 90 },
      load: { load1: 5 },
    });
    expect(instance.hasEnoughResources()).toBe(false);
    instance.getSystemResources.mockReturnValue({
      memory: { usagePercent: 10 },
      load: { load1: 1 },
    });
    expect(instance.hasEnoughResources()).toBe(true);
  });
});
