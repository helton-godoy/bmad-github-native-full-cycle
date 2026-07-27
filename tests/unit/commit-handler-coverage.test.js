const mockExecSync = jest.fn();

jest.mock('child_process', () => ({
  execSync: mockExecSync,
  execFileSync: mockExecSync,
}));
jest.mock('../../scripts/lib/logger', () =>
  jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
);

const fs = require('fs');
const CommitHandler = require('../../scripts/lib/commit-handler');

describe('CommitHandler focused coverage', () => {
  let handler;

  beforeEach(() => {
    mockExecSync.mockReset();
    handler = new CommitHandler({ maxRetries: 0, enableRollback: false });
  });

  afterEach(() => jest.restoreAllMocks());

  test('prepares specific/all files and propagates staging errors', async () => {
    jest.spyOn(handler, '_stageSpecificFiles').mockResolvedValue();
    jest.spyOn(handler, '_validateStaging').mockResolvedValue(true);
    await expect(handler.prepareCommit(['a.js'])).resolves.toBe(true);

    handler.validateStaging = false;
    jest.spyOn(handler, '_stageAllChanges').mockResolvedValue();
    await expect(handler.prepareCommit()).resolves.toBe(true);

    handler.validateStaging = true;
    handler._validateStaging.mockResolvedValue(false);
    await expect(handler.prepareCommit()).resolves.toBe(false);

    handler._stageAllChanges.mockRejectedValue(new Error('stage failed'));
    await expect(handler.prepareCommit()).rejects.toThrow('stage failed');
  });

  test('executes, verifies, skips, rejects invalid and failed commits', async () => {
    jest.spyOn(handler, '_hasChangesToCommit').mockResolvedValue(false);
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).resolves.toBeNull();

    handler._hasChangesToCommit.mockResolvedValue(true);
    jest.spyOn(handler, 'validateCommit').mockResolvedValue({ verified: true });
    jest.spyOn(handler.backoff, 'execute').mockResolvedValue({
      success: true,
      result: 'legacy-hash',
    });
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).resolves.toBe('legacy-hash');

    handler.backoff.execute.mockResolvedValue({ success: false, error: new Error('no') });
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).rejects.toThrow('no');

    handler.backoff.execute.mockResolvedValue('abc123');
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).resolves.toBe('abc123');

    handler.validateCommit.mockResolvedValue({ verified: false });
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).rejects.toMatchObject({ code: 'COMMIT_VERIFICATION_FAILURE' });

    jest.spyOn(handler, '_validateMessageFormat').mockReturnValue(false);
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).rejects.toThrow('Invalid commit message');
  });

  test('runs the git commit callback branches deterministically', async () => {
    jest.spyOn(handler, '_hasChangesToCommit').mockResolvedValue(true);
    jest.spyOn(handler, 'validateCommit').mockResolvedValue({ verified: true });
    handler.backoff.execute = async (operation) => operation(1);

    mockExecSync.mockReturnValue('[main abc123] message');
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).resolves.toBe('abc123');

    mockExecSync.mockImplementation(() => {
      throw new Error('index lock busy');
    });
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).rejects.toThrow('index lock busy');

    mockExecSync.mockImplementation(() => {
      throw new Error('bad author');
    });
    await expect(
      handler.executeCommit('description', 'developer', '1')
    ).rejects.toThrow('Non-retryable commit error');
  });

  test('formats descriptions and rejects empty descriptions', () => {
    expect(handler.formatCommitMessage('qa', 7, '  say "yes"\nnow  ')).toBe(
      '[QA] [STEP-007] say \\"yes\\" now'
    );
    expect(handler.formatCommitMessage('qa', 7, 'x'.repeat(90))).toHaveLength(
      '[QA] [STEP-007] '.length + 72
    );
    expect(() => handler.formatCommitMessage('qa', 1, ' ')).toThrow(
      'non-empty'
    );
  });

  test('stages existing files, skips missing files and handles errors', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((file) => file !== 'missing');
    mockExecSync.mockReturnValue('');
    await handler._stageSpecificFiles(['exists', 'missing']);
    expect(mockExecSync).toHaveBeenCalledTimes(2);

    mockExecSync.mockImplementation(() => {
      throw new Error('add failed');
    });
    await expect(handler._stageSpecificFiles(['exists'])).rejects.toThrow(
      'add failed'
    );
  });

  test('stages all changes and detects staged content', async () => {
    mockExecSync.mockReturnValueOnce('').mockReturnValue('');
    await handler._stageAllChanges();
    expect(mockExecSync).toHaveBeenCalledTimes(1);

    mockExecSync.mockReset().mockReturnValueOnce(' M a.js').mockReturnValue('');
    await handler._stageAllChanges();
    expect(mockExecSync).toHaveBeenCalledWith('git', ['add', '-A'], { stdio: 'pipe' });

    mockExecSync.mockImplementation(() => {
      throw new Error('status failed');
    });
    await expect(handler._stageAllChanges()).rejects.toThrow('status failed');

    mockExecSync.mockReturnValue('');
    await expect(handler._validateStaging()).resolves.toBe(false);
    mockExecSync.mockImplementation(() => {
      throw new Error('has diff');
    });
    await expect(handler._validateStaging()).resolves.toBe(true);
    await expect(handler._hasChangesToCommit()).resolves.toBe(true);
  });

  test('validates message components and produces useful reports', () => {
    const valid = handler.validateMessageFormat(
      '[DEVELOPER] [STEP-001] Implement feature'
    );
    expect(valid).toMatchObject({ valid: true, parsed: { persona: 'DEVELOPER' } });
    expect(handler.generateFormatErrorReport(valid)).toContain('is valid');

    const invalid = handler.validateMessageFormat('bad');
    invalid.warnings.push('warning');
    expect(handler.generateFormatErrorReport(invalid)).toContain('ERRORS:');
    expect(handler.generateFormatErrorReport(invalid)).toContain('WARNINGS:');

    expect(handler._validatePersona()).toMatchObject({ valid: false });
    expect(handler._validatePersona('developer')).toMatchObject({ valid: false });
    expect(handler._validatePersona('ROBOT').warnings).toHaveLength(1);
    expect(handler._validateStepId()).toMatchObject({ valid: false });
    expect(handler._validateStepId('1').warnings).toHaveLength(1);
    expect(handler._validateStepId('1234').warnings).toHaveLength(2);
    expect(handler._validateStepId('ABC')).toMatchObject({ valid: false });
    expect(handler._validateStepId('000').warnings).toHaveLength(1);
    expect(handler._validateDescription('')).toMatchObject({ valid: false });
    expect(handler._validateDescription('fix')).toMatchObject({
      warnings: expect.arrayContaining([expect.stringContaining('Generic')]),
    });
    expect(handler._validateDescription('update')).toMatchObject({
      warnings: expect.arrayContaining([expect.stringContaining('Generic')]),
    });
    expect(handler._validateDescription('x'.repeat(101)).warnings).toHaveLength(1);
  });

  test.each([
    ['[QA] [STEP-001] done', false, '[QA] [STEP-001] done'],
    ['[QA] [1] done', true, '[QA] [STEP-001] done'],
    ['[qa] [STEP-002] done', true, '[QA] [STEP-002] done'],
    ['QA STEP-003 done', true, '[QA] [STEP-003] done'],
  ])('corrects common format %s', (message, corrected, expected) => {
    expect(handler.correctMessageFormat(message)).toMatchObject({
      corrected,
      correctedMessage: expected,
    });
  });

  test('corrects simple format using deterministic random and leaves unknown input', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(handler.correctMessageFormat('QA: done')).toMatchObject({
      corrected: true,
      correctedMessage: '[QA] [STEP-100] done',
    });
    expect(handler.correctMessageFormat('???')).toMatchObject({
      corrected: false,
    });
  });

  test('extracts hashes with fallback and unknown result', () => {
    expect(handler._extractCommitHash('[main abc123] message')).toBe('abc123');
    mockExecSync.mockReturnValue('def456\n');
    expect(handler._extractCommitHash('other')).toBe('def456');
    mockExecSync.mockImplementation(() => {
      throw new Error('git failed');
    });
    expect(handler._extractCommitHash('other')).toBe('unknown');
  });

  test('validates commits and rollback behavior', async () => {
    jest.spyOn(handler, '_getCommitInfo').mockResolvedValue({
      message: '[QA] [STEP-001] verified commit',
      author: 'A',
      timestamp: '2026-01-01T00:00:00.000Z',
      files: ['a.js'],
    });
    jest.spyOn(handler, '_isCommitInCurrentBranch').mockResolvedValue(true);
    await expect(handler.validateCommit('abc')).resolves.toMatchObject({
      verified: true,
      hash: 'abc',
    });

    handler._isCommitInCurrentBranch.mockResolvedValue(false);
    await expect(handler.validateCommit('abc')).rejects.toThrow('not in');
    await expect(handler.validateCommit('unknown')).rejects.toThrow('Invalid');

    const rollbackHandler = new CommitHandler({ enableRollback: true });
    jest.spyOn(rollbackHandler, '_attemptRollback').mockResolvedValue();
    await expect(rollbackHandler.validateCommit()).rejects.toThrow('Invalid');
    expect(rollbackHandler._attemptRollback).toHaveBeenCalled();
  });

  test('reads commit info and branch ancestry and wraps failures', async () => {
    mockExecSync.mockReturnValue(
      'abc|Ada|ada@example.com|1704067200|[QA] [STEP-001] done\n\nfile.js\ncommit note'
    );
    await expect(handler._getCommitInfo('abc')).resolves.toMatchObject({
      hash: 'abc',
      author: 'Ada <ada@example.com>',
      files: ['file.js'],
    });
    await expect(handler._isCommitInCurrentBranch('abc')).resolves.toBe(true);

    mockExecSync.mockImplementation(() => {
      throw new Error('missing');
    });
    await expect(handler._getCommitInfo('bad')).rejects.toThrow(
      'Failed to get commit info'
    );
    await expect(handler._isCommitInCurrentBranch('bad')).resolves.toBe(false);
  });

  test('rolls back only HEAD and suppresses nested rollback failures', async () => {
    mockExecSync.mockReturnValueOnce('abc\n').mockReturnValue('');
    await expect(handler.rollbackCommit('abc')).resolves.toBeUndefined();

    mockExecSync.mockReturnValue('other\n');
    await expect(handler.rollbackCommit('abc')).rejects.toThrow('not the latest');

    jest.spyOn(handler, 'rollbackCommit').mockRejectedValue(new Error('no'));
    await expect(handler._attemptRollback('abc')).resolves.toBeUndefined();
    expect(handler._isRetryableError(new Error('network timeout'))).toBe(true);
    expect(handler._isRetryableError(new Error('bad author'))).toBe(false);
  });
});
