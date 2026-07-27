const fs = require('fs');
const os = require('os');
const path = require('path');
const ExponentialBackoff = require('../../scripts/lib/exponential-backoff');
const LoopDetector = require('../../scripts/lib/loop-detector');
const ErrorRecoveryManager = require('../../scripts/lib/error-recovery-manager');

describe('Critical module branch coverage', () => {
  afterEach(() => jest.restoreAllMocks());

  test('covers backoff defaults, zero values, jitter bounds and terminal error', async () => {
    const defaults = new ExponentialBackoff();
    expect(defaults.calculateDelay(0)).toBeGreaterThanOrEqual(0);
    const zero = new ExponentialBackoff({
      initialDelay: 0,
      maxDelay: 0,
      multiplier: 0,
      maxRetries: 0,
      jitterFactor: 0,
    });
    expect(zero.calculateDelay(-1)).toBe(0);
    await expect(zero.execute(async () => 'ok')).resolves.toBe('ok');
    await expect(zero.execute(async () => {
      throw new Error('terminal');
    })).rejects.toThrow('terminal');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(
      new ExponentialBackoff({
        initialDelay: 10,
        maxDelay: 10,
        multiplier: 2,
        jitterFactor: 1,
      }).calculateDelay(1)
    ).toBe(0);
  });

  test('handles absent, corrupt and incompatible loop history plus delete failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-branches-'));
    const historyFile = path.join(dir, 'history.json');
    const empty = new LoopDetector({ historyFile, maxTransitions: 0 });
    expect(empty.history).toEqual([]);
    empty.clearHistory();
    fs.writeFileSync(historyFile, '{');
    const corrupt = new LoopDetector({ historyFile });
    expect(corrupt.history).toEqual([]);
    fs.writeFileSync(historyFile, JSON.stringify([]));
    const detector = new LoopDetector({ historyFile });
    jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('busy');
    });
    expect(() => detector.clearHistory()).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('covers direct remediation success/failure and thrown registered remediation', async () => {
    const stateCache = { persistState: jest.fn().mockResolvedValue({}) };
    const manager = new ErrorRecoveryManager({
      maxRetries: 0,
      initialDelay: 0,
      maxDelay: 0,
      stateCache,
    });
    await expect(manager.attemptRemediation(new Error('x'), { canRemediate: true })).resolves.toEqual(
      expect.objectContaining({ status: 'remediated' })
    );
    await expect(manager.attemptRemediation(new Error('x'), {})).rejects.toThrow('x');
    manager.registerRemediation('THROW', async () => {
      throw new Error('remediation');
    });
    const result = await manager.escalateToRecovery(new Error('failure'), {
      persona: 'PM',
      category: 'THROW',
    });
    expect(result).toEqual(expect.objectContaining({ status: 'suspended' }));
    expect(stateCache.persistState).toHaveBeenCalled();

    manager.registerRemediation('FROM_ERROR', async () => true);
    const categorized = new Error('categorized');
    categorized.category = 'FROM_ERROR';
    await expect(
      manager.escalateToRecovery(categorized, { persona: '', operation: '' })
    ).resolves.toEqual(expect.objectContaining({ status: 'remediated' }));
  });
});
