const fs = require('fs');
const os = require('os');
const path = require('path');
const EnhancedBasePersona = require('../../personas/base-persona-enhanced');

describe('EnhancedBasePersona behavioral coverage', () => {
  let persona;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-persona-'));
    persona = Object.create(EnhancedBasePersona.prototype);
    persona.name = 'Test Agent';
    persona.role = 'QA';
    persona.startTime = new Date();
    persona.metrics = { issuesCreated: 0, commitsMade: 0, filesModified: 0, errors: 0 };
    persona.context = { activeContext: '', productContext: 'p', architectureSpec: 'a' };
    persona.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    persona.contextManager = {
      read: jest.fn(),
      write: jest.fn(),
      computeHash: jest.fn().mockReturnValue('hash'),
    };
    persona.cacheManager = { get: jest.fn(), set: jest.fn() };
    persona.octokit = {
      rest: { issues: { get: jest.fn(), create: jest.fn() } },
    };
    persona.commitHandler = {
      prepareCommit: jest.fn(),
      executeCommit: jest.fn(),
    };
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('loads context, fallback, files and routes log levels', () => {
    persona.contextManager.read
      .mockReturnValueOnce('active')
      .mockReturnValueOnce('product')
      .mockReturnValueOnce('architecture')
      .mockReturnValueOnce('handover');
    expect(persona.loadContext()).toEqual(expect.objectContaining({ contextHash: 'hash' }));
    persona.contextManager.read.mockImplementation(() => {
      throw new Error('read');
    });
    expect(persona.loadContext().activeContext).toBe('');

    const file = path.join(tempDir, 'value.txt');
    fs.writeFileSync(file, 'value');
    expect(persona.safeReadFile(file)).toBe('value');
    expect(persona.safeReadFile(path.join(tempDir, 'missing'), 'fallback')).toBe('fallback');
    persona.log('i');
    persona.log('w', 'WARNING');
    persona.log('e', 'ERROR');
    expect(persona.logger.info).toHaveBeenCalled();
    expect(persona.logger.warn).toHaveBeenCalled();
    expect(persona.logger.error).toHaveBeenCalled();
  });

  test('gets cached and remote issues and propagates remote failures', async () => {
    persona.cacheManager.get.mockReturnValueOnce({ number: 1 }).mockReturnValue(undefined);
    await expect(persona.getIssue(1)).resolves.toEqual({ number: 1 });
    persona.octokit.rest.issues.get.mockResolvedValueOnce({ data: { number: 2 } });
    await expect(persona.getIssue(2)).resolves.toEqual({ number: 2 });
    expect(persona.cacheManager.set).toHaveBeenCalled();
    persona.octokit.rest.issues.get.mockRejectedValueOnce(new Error('network'));
    await expect(persona.getIssue(3)).rejects.toThrow('network');
  });

  test('creates issues and records failures', async () => {
    persona.octokit.rest.issues.create.mockResolvedValueOnce({ data: { number: 7 } });
    await expect(persona.createIssue('title', 'body', ['bug'])).resolves.toEqual({ number: 7 });
    expect(persona.metrics.issuesCreated).toBe(1);
    persona.octokit.rest.issues.create.mockRejectedValueOnce(new Error('denied'));
    await expect(persona.createIssue('x', 'y')).rejects.toThrow('denied');
    expect(persona.metrics.errors).toBe(1);
  });

  test('skips, completes and reports commit failures', async () => {
    jest.spyOn(persona, 'getNextStepId').mockReturnValue('001');
    persona.commitHandler.prepareCommit.mockResolvedValueOnce(false);
    await expect(persona.commit('skip')).resolves.toBeNull();

    persona.commitHandler.prepareCommit.mockResolvedValueOnce(true);
    persona.commitHandler.executeCommit.mockResolvedValueOnce('abc');
    await expect(persona.commit('ok', ['a.js'])).resolves.toBe('abc');
    expect(persona.metrics.commitsMade).toBe(1);

    persona.commitHandler.prepareCommit.mockRejectedValueOnce(new Error('git'));
    await expect(persona.commit('bad')).rejects.toThrow('git');
    expect(persona.metrics.errors).toBe(1);
  });

  test('updates handover/context, writes micro files, and exposes summary helpers', async () => {
    persona.generateHandoverContent = jest.fn().mockReturnValue('handover');
    persona.updateHandover('PM', ['a'], 'done');
    expect(persona.contextManager.write).toHaveBeenCalledWith(
      '.github/BMAD_HANDOVER.md',
      'handover'
    );
    persona.contextManager.write.mockImplementationOnce(() => {
      throw new Error('write');
    });
    expect(() => persona.updateHandover('PM', [], 'failed')).toThrow('write');

    persona.contextManager.read.mockReturnValue('# Active');
    persona.updateActiveContext('new');
    expect(persona.context.activeContext).toContain('new');
    persona.contextManager.read.mockImplementationOnce(() => {
      throw new Error('context');
    });
    expect(() => persona.updateActiveContext('ignored')).not.toThrow();

    persona.commit = jest.fn().mockResolvedValue('hash');
    const file = path.join(tempDir, 'nested', 'artifact.txt');
    await expect(
      persona.microCommit('micro', [{ path: file, content: 'data' }])
    ).resolves.toBe('hash');
    expect(fs.readFileSync(file, 'utf8')).toBe('data');
    await persona.microCommit('paths', ['a.js']);
    expect(persona.commit).toHaveBeenLastCalledWith('paths', ['a.js']);

    persona.generateHandoverContent = EnhancedBasePersona.prototype.generateHandoverContent;
    expect(persona.generateHandoverContent('PM', ['a'], 'done')).toContain('Next Persona: PM');
    expect(persona.getSummary()).toEqual(expect.objectContaining({ persona: 'Test Agent' }));
  });

  test('validates environment prerequisites', () => {
    const previous = process.env.GITHUB_OWNER;
    delete process.env.GITHUB_OWNER;
    expect(() => persona.validatePrerequisites()).toThrow('GITHUB_OWNER');
    process.env.GITHUB_OWNER = previous || 'owner';
    expect(persona.validatePrerequisites()).toBe(true);
  });

  test('covers micro-commit boundaries and context-status variants', async () => {
    persona.commit = jest.fn().mockResolvedValue('hash');
    await persona.microCommit('empty object', [{ path: '', content: '' }]);
    expect(persona.commit).toHaveBeenCalledWith('empty object', ['']);
    persona.context = { activeContext: 'a', productContext: '', architectureSpec: '' };
    persona.generateHandoverContent = EnhancedBasePersona.prototype.generateHandoverContent;
    const handover = persona.generateHandoverContent('QA', [], 'running');
    expect(handover).toContain('Product Context: ❌ Missing');
    expect(handover).toContain('Architecture Spec: ❌ Missing');
  });

  test('executes shell commands through success and failure callbacks', async () => {
    const childProcess = require('child_process');
    jest.spyOn(childProcess, 'exec')
      .mockImplementationOnce((_command, callback) => callback(null, ' output \n'))
      .mockImplementationOnce((_command, callback) => callback(new Error('command failed'), ''));
    await expect(persona.execCommand('ok')).resolves.toBe('output');
    await expect(persona.execCommand('bad')).rejects.toThrow('command failed');
  });
});
