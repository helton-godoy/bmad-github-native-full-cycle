jest.mock('../../scripts/hooks/hook-setup-manager', () =>
  jest.fn().mockImplementation(() => global.__hookManager)
);
jest.mock('../../scripts/lib/logger', () =>
  jest.fn().mockImplementation(() => ({ error: jest.fn() }))
);

const fs = require('fs');
const os = require('os');
const path = require('path');
const HookSetupCLI = require('../../scripts/hooks/setup-hooks');
const HooksInstaller = require('../../scripts/hooks/install-hooks');

describe('hook setup and installer CLIs', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-tools-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.__hookManager;
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('setup display helpers cover healthy and failing reports/results', () => {
    const cli = new HookSetupCLI();
    cli.displayConfigReport({
      configuration: { nodeVersion: 'v20', gitVersion: null, huskyVersion: null },
      projectRoot: root,
      hooks: [
        { name: 'pre-commit', exists: true, executable: true, path: 'x', lastModified: 'now' },
        { name: 'pre-push', exists: true, executable: false, path: 'y', lastModified: 'now' },
        { name: 'commit-msg', exists: false },
      ],
      validation: {
        checks: [{ passed: true, name: 'git', message: 'ok' }, { passed: false, name: 'hook', message: 'bad' }],
        errors: ['error'],
        warnings: ['warning'],
      },
      recommendations: ['fix it'],
    });
    cli.displayConfigReport({
      configuration: { nodeVersion: 'v20' },
      projectRoot: root,
      hooks: [],
    });
    cli.displayInstallationResult({ success: true, hooksCreated: ['pre-commit'] });
    cli.displayInstallationResult({ success: false, errors: ['bad'], warnings: ['warn'] });
    cli.displayUpdateResult({ success: true, hooksUpdated: ['pre-push'] });
    cli.displayUpdateResult({ success: false, errors: ['bad'], warnings: ['warn'] });
    cli.rl.close();
  });

  test('setup question parsing and result helpers cover alternate branches', async () => {
    const cli = new HookSetupCLI();
    cli.rl.question = jest.fn((prompt, callback) => callback('YES'));
    await expect(cli.askYesNo('continue?', 'n')).resolves.toBe(true);
    cli.rl.question = jest.fn((prompt, callback) => callback(''));
    await expect(cli.askYesNo('continue?', 'n')).resolves.toBe(false);
    cli.displayInstallationResult({ success: true, hooksCreated: [] });
    cli.displayInstallationResult({ success: false, errors: [], warnings: [] });
    cli.displayUpdateResult({ success: true, hooksUpdated: [] });
    cli.displayUpdateResult({ success: false, errors: [], warnings: [] });
    cli.rl.close();
  });

  test.each([
    [{ huskyInstalled: false, hasHooks: false }, 'installHooks'],
    [{ huskyInstalled: true, hasHooks: false }, 'installHooks'],
    [{ huskyInstalled: true, hasHooks: true }, 'updateHooks'],
  ])('setup run executes the selected manager action', async (existing, method) => {
    const manager = {
      generateConfigReport: () => ({
        configuration: { nodeVersion: 'v20' },
        projectRoot: root,
        hooks: [],
      }),
      detectExistingHooks: () => existing,
      validateHookInstallation: () => ({ allValid: false }),
      installHooks: jest.fn().mockResolvedValue({ success: true, hooksCreated: [] }),
      updateHooks: jest.fn().mockResolvedValue({ success: true, hooksUpdated: [] }),
    };
    global.__hookManager = manager;
    const cli = new HookSetupCLI();
    jest.spyOn(cli, 'askYesNo').mockResolvedValue(true);
    expect(await cli.run()).toBe(0);
    expect(manager[method]).toHaveBeenCalled();
  });

  test('setup can cancel and handles manager errors', async () => {
    global.__hookManager = {
      generateConfigReport: () => {
        throw new Error('boom');
      },
    };
    const failing = new HookSetupCLI();
    expect(await failing.run()).toBe(1);

    global.__hookManager = {
      generateConfigReport: () => ({
        configuration: { nodeVersion: 'v20' },
        projectRoot: root,
        hooks: [],
      }),
      detectExistingHooks: () => ({ huskyInstalled: false }),
    };
    const cancelled = new HookSetupCLI();
    jest.spyOn(cancelled, 'askYesNo').mockResolvedValue(false);
    expect(await cancelled.run()).toBeUndefined();
  });

  test('setup handles valid existing hooks with update or no-op choices', async () => {
    const manager = {
      generateConfigReport: () => ({
        configuration: { nodeVersion: 'v20' },
        projectRoot: root,
        hooks: [],
      }),
      detectExistingHooks: () => ({ huskyInstalled: true, hasHooks: true }),
      validateHookInstallation: () => ({ allValid: true }),
      updateHooks: jest.fn().mockResolvedValue({
        success: false,
        errors: [],
        warnings: [],
      }),
    };
    global.__hookManager = manager;
    const noOp = new HookSetupCLI();
    jest.spyOn(noOp, 'askYesNo').mockResolvedValue(false);
    expect(await noOp.run()).toBeUndefined();

    const update = new HookSetupCLI();
    jest.spyOn(update, 'askYesNo').mockResolvedValue(true);
    expect(await update.run()).toBe(1);
    expect(manager.updateHooks).toHaveBeenCalled();
  });

  test('installer file operations cover configuration, hooks, permissions and removal', async () => {
    fs.mkdirSync(path.join(root, '.git'));
    fs.mkdirSync(path.join(root, '.husky'));
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: { husky: '^9' } })
    );
    const installer = new HooksInstaller({ projectRoot: root, force: true, verbose: true });
    installer.templatePath = path.join(root, 'template.json');
    fs.writeFileSync(installer.templatePath, '{}');
    installer.installConfiguration();
    expect(fs.existsSync(installer.configPath)).toBe(true);
    installer.installHookScripts();
    installer.setPermissions();
    expect(installer.validateInstallation()).toHaveProperty('valid');
    installer.displaySummary();
    installer.log('verbose');

    fs.writeFileSync(path.join(installer.huskyDir, 'pre-commit'), '#!/bin/sh');
    expect((await installer.uninstall()).success).toBe(true);
    expect(fs.existsSync(installer.configPath)).toBe(false);
  });

  test('installer orchestration reports success and failure without exiting', async () => {
    const installer = new HooksInstaller({ projectRoot: root });
    jest.spyOn(installer, 'checkPrerequisites').mockImplementation(() => {});
    jest.spyOn(installer, 'initializeHusky').mockImplementation(() => {});
    jest.spyOn(installer, 'installConfiguration').mockImplementation(() => {});
    jest.spyOn(installer, 'installHookScripts').mockImplementation(() => {});
    jest.spyOn(installer, 'setPermissions').mockImplementation(() => {});
    jest.spyOn(installer, 'validateInstallation').mockReturnValue({ valid: true, issues: [] });
    jest.spyOn(installer, 'displaySummary').mockImplementation(() => {});
    await expect(installer.install()).resolves.toEqual({ success: true });
    installer.checkPrerequisites.mockImplementation(() => {
      throw new Error('missing');
    });
    await expect(installer.install()).resolves.toMatchObject({ success: false });
    expect(await HooksInstaller.main(['unknown'])).toBe(1);
  });

  test('installer prerequisites and initialization expose every failure cleanly', () => {
    const make = (execSync = jest.fn()) =>
      new HooksInstaller({ projectRoot: root, execSync });
    expect(() => make(() => { throw new Error('no git'); }).checkPrerequisites())
      .toThrow('Git is not installed');

    const installer = make();
    expect(() => installer.checkPrerequisites()).toThrow('Not a git repository');
    fs.mkdirSync(path.join(root, '.git'));
    expect(() => installer.checkPrerequisites()).toThrow('package.json not found');
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    expect(() => installer.checkPrerequisites()).toThrow('Husky is not installed');
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { husky: '9' } })
    );
    expect(() => installer.checkPrerequisites()).not.toThrow();

    const initialized = make(jest.fn());
    initialized.initializeHusky();
    expect(fs.existsSync(initialized.huskyDir)).toBe(true);
    const broken = make(() => { throw new Error('husky failed'); });
    expect(() => broken.initializeHusky()).toThrow('Failed to initialize Husky');
  });

  test('installer covers skip, missing template, validation issues and uninstall preservation', async () => {
    fs.mkdirSync(path.join(root, '.husky'));
    const installer = new HooksInstaller({ projectRoot: root });
    fs.writeFileSync(installer.configPath, '{}');
    expect(installer.installConfiguration()).toBeUndefined();
    fs.unlinkSync(installer.configPath);
    installer.templatePath = path.join(root, 'missing-template');
    expect(() => installer.installConfiguration()).toThrow('Configuration template not found');

    const validation = installer.validateInstallation();
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      'Hook configuration not found',
      'Required hook pre-commit not found',
    ]));

    fs.writeFileSync(installer.configPath, '{}');
    expect((await installer.uninstall()).success).toBe(true);
    expect(fs.existsSync(installer.configPath)).toBe(true);
    jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('denied');
    });
    fs.writeFileSync(path.join(installer.huskyDir, 'pre-commit'), 'x');
    await expect(installer.uninstall()).resolves.toMatchObject({ success: false });
  });

  test('installer covers force hook copies, permission warnings and invalid configuration', () => {
    fs.mkdirSync(path.join(root, '.husky'));
    const templateDir = path.join(root, 'templates');
    fs.mkdirSync(templateDir);
    fs.writeFileSync(path.join(templateDir, 'pre-commit'), '#!/bin/sh');
    const installer = new HooksInstaller({
      projectRoot: root,
      force: true,
      hookTemplatesDir: templateDir,
    });
    installer.installHookScripts();
    const hook = path.join(installer.huskyDir, 'pre-commit');
    fs.writeFileSync(hook, 'x');
    const chmod = jest.spyOn(fs, 'chmodSync')
      .mockImplementationOnce(() => { throw new Error('denied'); });
    installer.setPermissions();
    expect(chmod).toHaveBeenCalled();

    fs.writeFileSync(installer.configPath, '{bad');
    expect(installer.validateInstallation().valid).toBe(false);
  });
});
