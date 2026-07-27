const fs = require('fs');
const os = require('os');
const path = require('path');
const StateCacheManager = require('../../scripts/lib/state-cache-manager');

describe('StateCacheManager branch coverage', () => {
  let dir;
  let manager;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-branches-'));
    manager = new StateCacheManager({
      stateFile: path.join(dir, 'state.json'),
      backupFile: path.join(dir, 'backup.json'),
      registeredPersonas: ['PM', 'ORCHESTRATOR'],
      maxContextBytes: 20,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test.each([
    null,
    'state',
    {},
    { currentPersona: 2, stepId: 's', context: {} },
    { currentPersona: 'ALIEN', stepId: 's', context: {} },
    { currentPersona: 'PM', stepId: 2, context: {} },
    { currentPersona: 'PM', stepId: ' ', context: {} },
    { currentPersona: 'PM', stepId: 's', context: [] },
    { currentPersona: 'PM', stepId: 's', context: { long: 'x'.repeat(30) } },
  ])('rejects invalid state %#', async (state) => {
    await expect(manager.validateState(state)).resolves.toBe(false);
  });

  test('accepts persona alias and rejects unserializable context', async () => {
    expect(await manager.validateState({ persona: 'pm', stepId: 's', context: {} })).toBe(true);
    const circular = {};
    circular.self = circular;
    expect(
      await manager.validateState({ currentPersona: 'PM', stepId: 's', context: circular })
    ).toBe(false);
  });

  test('restores backup, handles missing storage and reports stats', async () => {
    expect(await manager.restoreState()).toBeNull();
    fs.writeFileSync(
      manager.backupFile,
      JSON.stringify({ currentPersona: 'PM', stepId: 's', context: {} })
    );
    expect(await manager.restoreState()).toEqual(expect.objectContaining({ stepId: 's' }));
    const stats = await manager.getStorageStats();
    expect(stats).toEqual(
      expect.objectContaining({
        stateFileExists: true,
        backupFileExists: true,
      })
    );
  });

  test('falls back for corrupt JSON and invalid state', async () => {
    fs.writeFileSync(manager.stateFile, '{');
    expect(await manager.restoreState()).toEqual(
      expect.objectContaining({ status: 'reset' })
    );
    fs.writeFileSync(
      manager.stateFile,
      JSON.stringify({ currentPersona: 'ALIEN', stepId: 's', context: {} })
    );
    expect(await manager.restoreState()).toEqual(
      expect.objectContaining({ currentPersona: 'ORCHESTRATOR' })
    );
  });

  test('preserves backup on second atomic persistence and supports compatibility wrapper', async () => {
    manager.maxContextBytes = 1024;
    await manager.persistState('PM', 'one', {});
    await manager.persistState('PM', 'two', {});
    expect(JSON.parse(fs.readFileSync(manager.backupFile, 'utf8')).stepId).toBe('one');
    await expect(manager.withAtomicWrite(async () => 'ok')).resolves.toBe('ok');
  });

  test('reports atomic failure even when temporary cleanup also fails', async () => {
    manager.maxContextBytes = 1024;
    jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('rename');
    });
    jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('cleanup');
    });
    await expect(manager.persistState('PM', 'step', {})).rejects.toThrow(
      'State persistence failed'
    );
  });
});
