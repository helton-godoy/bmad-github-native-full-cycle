const fs = require('fs');
const EnhancedDeveloper = require('../../personas/developer-enhanced');

describe('EnhancedDeveloper behavioral coverage', () => {
  let developer;

  beforeEach(() => {
    developer = Object.create(EnhancedDeveloper.prototype);
    developer.techStack = {
      language: 'javascript',
      framework: 'express',
      packageManager: 'npm',
      testing: 'jest',
    };
    developer.codeQuality = { coverage: 0, complexity: 0, tests: 0 };
    developer.log = jest.fn();
    developer.validatePrerequisites = jest.fn().mockReturnValue(true);
    developer.commit = jest.fn().mockResolvedValue('hash');
    developer.createIssue = jest.fn().mockResolvedValue({ number: 10 });
    developer.updateHandover = jest.fn();
    developer.getSummary = jest.fn().mockReturnValue({ persona: 'Developer' });
    developer.execCommand = jest.fn().mockResolvedValue('');
    developer.octokit = {
      rest: {
        issues: {
          get: jest.fn().mockResolvedValue({
            data: {
              title: 'Build feature',
              body: [
                'Feature: Login',
                'Technical: Node.js',
                'Constraint: No downtime',
                'Acceptance: User signs in',
              ].join('\n'),
            },
          }),
        },
      },
    };
  });

  afterEach(() => jest.restoreAllMocks());

  test.each([
    [
      { 'package.json': JSON.stringify({ dependencies: { react: true } }), 'jest.config.js': '' },
      { language: 'javascript', framework: 'react', testing: 'jest' },
    ],
    [{ 'package.json': JSON.stringify({ dependencies: { express: true } }) }, { framework: 'express' }],
    [{ 'package.json': JSON.stringify({ dependencies: { vue: true } }) }, { framework: 'vue' }],
    [{ 'go.mod': '' }, { language: 'go', packageManager: 'go' }],
    [{ 'Cargo.toml': '' }, { language: 'rust', packageManager: 'cargo' }],
    [{ 'requirements.txt': '', 'pytest.ini': '' }, { language: 'python', testing: 'pytest' }],
    [{ 'pyproject.toml': '' }, { language: 'python', testing: 'pytest' }],
    [{}, { language: 'unknown', framework: 'none', testing: 'none' }],
  ])('detects supported stacks from %j', (files, expected) => {
    jest.spyOn(fs, 'existsSync').mockImplementation((name) =>
      Object.prototype.hasOwnProperty.call(files, name)
    );
    jest.spyOn(fs, 'readFileSync').mockImplementation((name) => files[name]);
    expect(developer.detectTechStack()).toEqual(expect.objectContaining(expected));
  });

  test('detects go tests when the configured test marker exists', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((name) =>
      ['go.mod', '*_test.go'].includes(name)
    );
    expect(developer.detectTechStack()).toMatchObject({
      language: 'go',
      testing: 'go-test',
    });
  });

  test('executes the complete implementation workflow', async () => {
    jest
      .spyOn(developer, 'executePhase')
      .mockResolvedValueOnce(['setup.js'])
      .mockResolvedValueOnce(['login.js'])
      .mockResolvedValueOnce(['login.test.js'])
      .mockResolvedValueOnce(['README.md']);
    jest.spyOn(developer, 'runQualityChecks').mockResolvedValue();

    await expect(developer.execute(42)).resolves.toEqual({ persona: 'Developer' });
    expect(developer.executePhase).toHaveBeenCalledTimes(4);
    expect(developer.commit).toHaveBeenCalledTimes(4);
    expect(developer.createIssue).toHaveBeenCalledWith(
      'Implementation Complete: Build feature',
      expect.stringContaining('# Implementation Report'),
      ['implementation-complete', 'ready-for-testing']
    );
    expect(developer.updateHandover).toHaveBeenCalledWith(
      'QA',
      ['setup.js', 'login.js', 'login.test.js', 'README.md'],
      'Implementation completed'
    );
  });

  test('logs and propagates workflow failures', async () => {
    developer.octokit.rest.issues.get.mockRejectedValue(new Error('network'));
    await expect(developer.execute(42)).rejects.toThrow('network');
    expect(developer.log).toHaveBeenCalledWith(
      'Implementation failed: network',
      'ERROR'
    );
  });

  test('parses all requirement categories and creates a four-phase plan', () => {
    const requirements = developer.parseImplementationRequirements(
      'Feature: A\nFeature: B\nTechnical: T\nConstraint: C\nAcceptance: X\nAcceptance: Y'
    );
    expect(requirements).toEqual({
      features: ['A', 'B'],
      technical: ['T'],
      constraints: ['C'],
      acceptance: ['X', 'Y'],
    });
    const plan = developer.generateImplementationPlan(requirements);
    expect(plan.phases.map((phase) => phase.name)).toEqual([
      'Setup',
      'Core Implementation',
      'Testing',
      'Documentation',
    ]);
    expect(plan.phases[1].tasks).toHaveLength(2);
    expect(plan.phases[2].tasks).toHaveLength(2);
  });

  test('generates setup tasks for JavaScript, Go and unknown stacks', () => {
    expect(developer.generateSetupTasks({}).map((task) => task.path)).toEqual([
      'src',
      'tests',
      'package.json',
    ]);
    developer.techStack.language = 'go';
    expect(developer.generateSetupTasks({}).at(-1).path).toBe('go.mod');
    developer.techStack.language = 'rust';
    expect(developer.generateSetupTasks({})).toHaveLength(2);
    expect(developer.generateDocumentationTasks({})).toHaveLength(2);
  });

  test('executes phase tasks, collects non-empty artifacts and propagates errors', async () => {
    jest
      .spyOn(developer, 'executeTask')
      .mockResolvedValueOnce('a.js')
      .mockResolvedValueOnce(null);
    await expect(
      developer.executePhase({
        tasks: [{ description: 'one' }, { description: 'two' }],
      })
    ).resolves.toEqual(['a.js']);

    developer.executeTask.mockRejectedValue(new Error('task failed'));
    await expect(
      developer.executePhase({ tasks: [{ description: 'bad' }] })
    ).rejects.toThrow('task failed');
  });

  test('dispatches every task type and rejects unknown tasks', async () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdir = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(developer, 'createFile').mockResolvedValue('file');
    jest.spyOn(developer, 'implementFeature').mockResolvedValue('feature');
    jest.spyOn(developer, 'createTest').mockResolvedValue('test');
    jest.spyOn(developer, 'createDocumentation').mockResolvedValue('docs');

    await expect(
      developer.executeTask({ type: 'directory', path: 'src' })
    ).resolves.toBe('src');
    expect(mkdir).toHaveBeenCalledWith('src', { recursive: true });
    exists.mockReturnValue(true);
    await developer.executeTask({ type: 'directory', path: 'src' });
    expect(mkdir).toHaveBeenCalledTimes(1);
    await expect(developer.executeTask({ type: 'file' })).resolves.toBe('file');
    await expect(developer.executeTask({ type: 'implementation' })).resolves.toBe(
      'feature'
    );
    await expect(developer.executeTask({ type: 'test' })).resolves.toBe('test');
    await expect(developer.executeTask({ type: 'documentation' })).resolves.toBe(
      'docs'
    );
    await expect(developer.executeTask({ type: 'unknown' })).rejects.toThrow(
      'Unknown task type'
    );
  });

  test('creates files and safely merges package defaults with existing content', async () => {
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        name: 'existing',
        scripts: { lint: 'eslint .' },
        dependencies: { express: '^5' },
        devDependencies: { prettier: '^3' },
      })
    );

    const packageContent = JSON.parse(developer.generateFileContent('package.json'));
    expect(packageContent).toMatchObject({
      name: 'existing',
      scripts: { test: 'jest', lint: 'eslint .' },
      dependencies: { express: '^5' },
      devDependencies: { jest: '^29.0.0', prettier: '^3' },
    });
    await expect(
      developer.createFile({ path: 'package.json' })
    ).resolves.toBe('package.json');
    expect(write).toHaveBeenCalled();
  });

  test('falls back from malformed package JSON and generates other file types', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{bad json');
    expect(JSON.parse(developer.generateFileContent('package.json')).name).toBe(
      'bmad-enhanced-project'
    );
    expect(developer.log).toHaveBeenCalledWith(
      expect.stringContaining('Failed to merge'),
      'WARNING'
    );
    expect(developer.generateFileContent('go.mod')).toContain('go 1.21');
    expect(developer.generateFileContent('other')).toBe('// Auto-generated file\n');
  });

  test('creates implementation, tests and documentation without touching disk', async () => {
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    await expect(
      developer.implementFeature({ feature: 'User Login' })
    ).resolves.toBe('src/user-login.js');
    expect(developer.generateFeatureCode('User Login')).toContain(
      'class UserLoginFeature'
    );

    await expect(
      developer.createTest({ scenario: 'User Login' })
    ).resolves.toBe('tests/user-login.test.js');
    expect(developer.generateTestCode('User Login')).toContain(
      "describe('User Login'"
    );

    await expect(
      developer.createDocumentation({ path: 'docs/api.md' })
    ).resolves.toBe('docs/api.md');
    expect(developer.generateDocumentationContent('docs/api.md')).toContain(
      '# API Documentation'
    );
    expect(developer.generateDocumentationContent('README.md')).toContain(
      'Language: javascript'
    );
    expect(write).toHaveBeenCalledTimes(3);
  });

  test('runs JavaScript quality checks and optional linting', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    await developer.runQualityChecks();
    expect(developer.execCommand.mock.calls.map(([command]) => command)).toEqual([
      'npm test',
      'npx eslint src/',
      'npm run test:coverage',
    ]);
  });

  test('runs Go checks, skips unsupported test runners and propagates errors', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    developer.techStack.testing = 'go-test';
    await developer.runQualityChecks();
    expect(developer.execCommand).toHaveBeenCalledWith('go test ./...');

    developer.execCommand.mockClear();
    developer.techStack.testing = 'none';
    await developer.runQualityChecks();
    expect(developer.execCommand).not.toHaveBeenCalled();

    developer.techStack.testing = 'jest';
    developer.execCommand.mockRejectedValue(new Error('quality failed'));
    await expect(developer.runQualityChecks()).rejects.toThrow('quality failed');
    expect(developer.log).toHaveBeenCalledWith(
      'Quality check failed: quality failed',
      'ERROR'
    );
  });

  test('generates a complete implementation report', () => {
    const report = developer.generateImplementationReport(
      {
        features: ['a'],
        technical: ['b'],
        constraints: ['c'],
        acceptance: ['d', 'e'],
      },
      ['src/a.js', 'tests/a.test.js']
    );
    expect(report).toContain('**Features:** 1');
    expect(report).toContain('**Acceptance Criteria:** 2');
    expect(report).toContain('`src/a.js`');
    expect(report).toContain('**Files Created:** 2');
  });
});
