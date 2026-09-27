const fs = require('fs');
const os = require('os');
const path = require('path');

const CommitHandler = require('../../scripts/lib/commit-handler');
const LoopDetector = require('../../scripts/lib/loop-detector');
const StateCacheManager = require('../../scripts/lib/state-cache-manager');

describe('adversarial review hardening coverage', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hardening-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function stateManager(options = {}) {
    return new StateCacheManager({
      stateFile: path.join(root, 'state.json'),
      backupFile: path.join(root, 'state.backup.json'),
      lockFile: path.join(root, 'state.lock'),
      ...options,
    });
  }

  function validState(overrides = {}) {
    return {
      workflowId: 'issue-1',
      currentPersona: 'PM',
      persona: 'PM',
      stepId: 'PLAN-1',
      context: { value: 1 },
      status: 'running',
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  test('rejects invalid state before persistence', async () => {
    const manager = stateManager();

    await expect(manager.persistState('UNKNOWN-PERSONA', 'STEP', {})).rejects.toThrow(
      'State validation failed'
    );
    await expect(manager.persistState('PM', '   ', {})).rejects.toThrow(
      'State validation failed'
    );
  });

  test('restores a valid backup after corrupt primary state', async () => {
    const manager = stateManager();
    fs.writeFileSync(manager.stateFile, '{broken');
    fs.writeFileSync(manager.backupFile, JSON.stringify(validState()));

    await expect(manager.restoreState()).resolves.toMatchObject({
      currentPersona: 'PM',
      stepId: 'PLAN-1',
    });
  });

  test('resets after corrupt or invalid backup state', async () => {
    const malformed = stateManager();
    fs.writeFileSync(malformed.stateFile, '{broken');
    fs.writeFileSync(malformed.backupFile, '{also broken');
    await expect(malformed.restoreState()).resolves.toMatchObject({
      status: 'reset',
    });

    const invalid = stateManager();
    fs.writeFileSync(invalid.stateFile, '{broken');
    fs.writeFileSync(
      invalid.backupFile,
      JSON.stringify(validState({ currentPersona: 'NOT_REGISTERED' }))
    );
    await expect(invalid.restoreState()).resolves.toMatchObject({
      status: 'reset',
    });
  });

  test('takes over stale locks and times out on active locks', () => {
    const stale = stateManager({ staleLockMs: 0, lockTimeoutMs: 50 });
    fs.writeFileSync(stale.lockFile, 'old');
    const old = new Date(Date.now() - 1000);
    fs.utimesSync(stale.lockFile, old, old);
    const release = stale.acquireLock();
    expect(fs.existsSync(stale.lockFile)).toBe(true);
    release();
    expect(fs.existsSync(stale.lockFile)).toBe(false);

    const active = stateManager({
      lockFile: path.join(root, 'active.lock'),
      staleLockMs: 60000,
      lockTimeoutMs: 0,
    });
    fs.writeFileSync(active.lockFile, 'active');
    expect(() => active.acquireLock()).toThrow('State lock timeout');
  });

  test('handles lock release races and unexpected lock errors', () => {
    const manager = stateManager();
    const release = manager.acquireLock();
    fs.unlinkSync(manager.lockFile);
    expect(() => release()).not.toThrow();

    jest.spyOn(fs, 'openSync').mockImplementationOnce(() => {
      const error = new Error('denied');
      error.code = 'EACCES';
      throw error;
    });
    expect(() => manager.acquireLock()).toThrow('denied');
  });

  test('validates commit inputs and executes the configured validation runner', async () => {
    const validationRunner = jest.fn().mockResolvedValue();
    const handler = new CommitHandler({
      runValidation: true,
      validationRunner,
    });
    jest.spyOn(handler, '_hasChangesToCommit').mockResolvedValue(true);
    jest.spyOn(handler, 'validateCommit').mockResolvedValue({ verified: true });
    jest.spyOn(handler.backoff, 'execute').mockResolvedValue('abc1234');

    await expect(
      handler.executeCommit('description', 'DEVELOPER', '001')
    ).resolves.toBe('abc1234');
    expect(validationRunner).toHaveBeenCalledTimes(1);

    await expect(handler.executeCommit('description', null, '001')).rejects.toThrow(
      'must be strings'
    );
    await expect(handler.executeCommit('', 'DEVELOPER', '001')).rejects.toThrow(
      'non-empty'
    );
  });

  test('verifies every structured backoff result path', async () => {
    const handler = new CommitHandler({ runValidation: false });
    jest.spyOn(handler, '_hasChangesToCommit').mockResolvedValue(true);
    jest.spyOn(handler, 'validateCommit').mockResolvedValue({ verified: true });
    jest.spyOn(handler.backoff, 'execute').mockResolvedValue({
      success: true,
      result: 'structured-hash',
    });
    await expect(
      handler.executeCommit('description', 'QA', '002')
    ).resolves.toBe('structured-hash');

    handler.validateCommit.mockResolvedValueOnce({ verified: false });
    await expect(
      handler.executeCommit('description', 'QA', '002')
    ).rejects.toThrow('Commit verification failed');

    handler.backoff.execute.mockResolvedValueOnce({
      success: false,
      error: new Error('structured failure'),
    });
    await expect(
      handler.executeCommit('description', 'QA', '002')
    ).rejects.toThrow('structured failure');

    handler.backoff.execute.mockResolvedValueOnce({ success: false });
    await expect(
      handler.executeCommit('description', 'QA', '002')
    ).rejects.toThrow('Commit failed');
  });

  test('rejects invalid stage entries without invoking git', async () => {
    const handler = new CommitHandler({ runValidation: false });
    await expect(handler._stageSpecificFiles([''])).rejects.toThrow(
      'non-empty strings'
    );
    await expect(handler._stageSpecificFiles([null])).rejects.toThrow(
      'non-empty strings'
    );
  });

  test('validates timestamps and preserves other workflow histories', () => {
    const historyFile = path.join(root, 'history.json');
    fs.writeFileSync(
      historyFile,
      JSON.stringify([
        {
          workflowId: 'issue-1',
          fromPersona: 'PM',
          toPersona: 'ARCHITECT',
          timestamp: new Date().toISOString(),
          status: 'executed',
        },
        {
          workflowId: 'issue-2',
          fromPersona: 'QA',
          toPersona: 'SECURITY',
          timestamp: new Date().toISOString(),
          status: 'executed',
        },
      ])
    );
    const detector = new LoopDetector({ workflowId: 'issue-1', historyFile });

    expect(() => detector.recordTransition('PM', 'QA', 'invalid')).toThrow(
      'Invalid transition timestamp'
    );
    detector.clearHistory();
    expect(JSON.parse(fs.readFileSync(historyFile))).toEqual([
      expect.objectContaining({ workflowId: 'issue-2' }),
    ]);
  });
});
