const fs = require('fs');
const os = require('os');
const path = require('path');

const ConfigValidator = require('../../scripts/hooks/config-validator');
const ConfigCLI = require('../../scripts/hooks/validate-config');
const configure = require('../../scripts/configure-test-mode');

describe('configuration tools', () => {
  let root;
  let configPath;
  let templatePath;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'config-tools-'));
    fs.mkdirSync(path.join(root, '.husky'));
    configPath = path.join(root, '.husky', 'hooks-config.json');
    templatePath = path.join(root, 'template.json');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const validConfig = () => ({
    preCommit: { linting: true, testing: true, contextValidation: true, gatekeeper: true },
    commitMsg: { bmadPattern: true, conventionalCommits: true },
    prePush: { fullTests: true, build: true, security: true, bmadSync: true },
    postCommit: { metrics: true, documentation: true, notifications: true, contextUpdate: true },
    postMerge: { workflow: true, validation: true, reporting: true, personaSync: true },
    githubActionsSync: { enabled: true, monitorConsistency: true, reportInconsistencies: true },
  });

  function validator() {
    const instance = new ConfigValidator();
    instance.configPath = configPath;
    instance.templatePath = templatePath;
    return instance;
  }

  test('validator reports missing and malformed configuration', () => {
    expect(validator().validate()).toMatchObject({ valid: false });
    fs.writeFileSync(configPath, '{bad');
    expect(validator().validate().errors[0].type).toBe('invalid_json');
  });

  test('validator accepts a complete configuration and creates a report', () => {
    fs.writeFileSync(configPath, JSON.stringify(validConfig()));
    const instance = validator();
    expect(instance.validate()).toMatchObject({
      valid: true,
      summary: { totalIssues: 0 },
    });
    expect(instance.generateReport()).toContain('✅ Valid');
  });

  test('validator detects structure, type, deprecated and consistency issues', () => {
    const config = validConfig();
    config.preCommit = {
      linting: false,
      testing: false,
      contextValidation: false,
      fastTests: true,
      typo: true,
    };
    config.commitMsg = { bmadPattern: false, conventionalCommits: false };
    config.prePush = { fullTests: false, security: false, bmadSync: true, coverage: true };
    config.postMerge.workflow = false;
    config.githubActionsSync.monitorConsistency = false;
    config.postCommit.metrics = 'yes';
    delete config.postMerge.reporting;
    config.commitMsg.bmadPattern = 'yes';
    fs.writeFileSync(configPath, JSON.stringify(config));
    const result = validator().validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.type === 'invalid_type')).toBe(true);
    expect(result.warnings.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        'weak_validation',
        'security_disabled',
        'tests_disabled',
        'workflow_disabled',
        'unknown_option',
        'deprecated_option',
        'inconsistent_config',
        'incomplete_sync',
      ])
    );
    expect(validator().generateReport()).toContain('## Errors');
  });

  test('validator covers missing/invalid sections and disabled optional validation', () => {
    const instance = validator();
    instance.validateStructure({
      preCommit: 'invalid',
      commitMsg: {},
    });
    instance.validateCommitMsgConfig({
      bmadPattern: false,
      conventionalCommits: false,
    });
    instance.validateGitHubActionsSync({
      enabled: false,
      monitorConsistency: false,
      reportInconsistencies: false,
    });
    instance.validatePostCommitConfig();
    instance.validatePostMergeConfig();
    instance.validatePrePushConfig();
    expect(instance.errors.map((item) => item.type)).toEqual(
      expect.arrayContaining(['invalid_section', 'missing_section'])
    );
    expect(instance.warnings.map((item) => item.type)).toEqual(
      expect.arrayContaining(['no_validation', 'sync_disabled'])
    );
  });

  test('autoFix restores missing config and removes deprecated options', () => {
    fs.writeFileSync(templatePath, JSON.stringify(validConfig()));
    expect(validator().autoFix()).toMatchObject({ success: false });
    const config = validConfig();
    config.preCommit.fastTests = true;
    config.prePush.coverage = true;
    fs.writeFileSync(configPath, JSON.stringify(config));
    const result = validator().autoFix();
    expect(result.fixes).toHaveLength(2);
    expect(JSON.parse(fs.readFileSync(configPath)).preCommit.fastTests).toBeUndefined();
    expect(validator().autoFix().fixes).toHaveLength(0);
  });

  test('autoFix converts invalid boolean types', () => {
    const config = validConfig();
    config.preCommit.testing = 'yes';
    fs.writeFileSync(configPath, JSON.stringify(config));
    const result = validator().autoFix();
    expect(result.success).toBe(true);
    expect(result.fixes[0]).toContain('preCommit.testing');
    expect(JSON.parse(fs.readFileSync(configPath)).preCommit.testing).toBe(false);
  });

  test('ConfigCLI validates, reports, shows, resets and handles failures', () => {
    const cli = new ConfigCLI();
    cli.validator = validator();
    fs.writeFileSync(configPath, JSON.stringify(validConfig()));
    expect(cli.validate()).toBe(0);
    expect(cli.showConfig()).toBe(0);
    expect(cli.generateReport(path.join(root, 'report.md'))).toBe(0);
    expect(fs.existsSync(path.join(root, 'report.md'))).toBe(true);

    fs.writeFileSync(templatePath, JSON.stringify(validConfig()));
    expect(cli.resetConfig({ force: true })).toBe(0);
    expect(cli.showHelp()).toBe(0);
    expect(ConfigCLI.main(['--help'])).toBe(0);

    cli.validator.validate = () => ({
      valid: false,
      errors: [{ message: 'bad', type: 'x', remediation: 'fix' }],
      warnings: [{ message: 'warn', type: 'y', recommendation: 'check' }],
      summary: { errors: 1, warnings: 1, totalIssues: 2 },
    });
    expect(cli.validate({ fix: false })).toBe(1);
  });

  test('ConfigCLI covers warnings, fixes, missing files and command routing', () => {
    const cli = new ConfigCLI();
    cli.validator.validate = jest
      .fn()
      .mockReturnValueOnce({
        valid: true,
        errors: [],
        warnings: [{ message: 'warn', type: 'warning', recommendation: 'act' }],
        summary: { errors: 0, warnings: 1, totalIssues: 1 },
      })
      .mockReturnValue({
        valid: false,
        errors: [{ message: 'bad', type: 'error' }],
        warnings: [],
        summary: { errors: 1, warnings: 0, totalIssues: 1 },
      });
    cli.validator.autoFix = jest.fn()
      .mockReturnValueOnce({ success: true, message: 'fixed', fixes: ['one'] })
      .mockReturnValueOnce({ success: false, message: 'not fixed', fixes: [] });
    expect(cli.validate()).toBe(0);
    expect(cli.validate({ fix: true })).toBe(0);
    expect(cli.validate({ fix: true })).toBe(1);

    cli.validator.configPath = path.join(root, 'missing.json');
    cli.validator.templatePath = path.join(root, 'missing-template.json');
    expect(cli.showConfig()).toBe(1);
    expect(cli.resetConfig()).toBe(1);
    fs.writeFileSync(cli.validator.templatePath, '{}');
    fs.writeFileSync(cli.validator.configPath, '{}');
    expect(cli.resetConfig()).toBe(1);

    const proto = ConfigCLI.prototype;
    const spies = [
      jest.spyOn(proto, 'validate').mockReturnValue(2),
      jest.spyOn(proto, 'generateReport').mockReturnValue(3),
      jest.spyOn(proto, 'showConfig').mockReturnValue(4),
      jest.spyOn(proto, 'resetConfig').mockReturnValue(5),
      jest.spyOn(proto, 'showHelp').mockReturnValue(0),
    ];
    expect(ConfigCLI.main([])).toBe(2);
    expect(ConfigCLI.main(['report', 'out.md'])).toBe(3);
    expect(ConfigCLI.main(['show'])).toBe(4);
    expect(ConfigCLI.main(['reset', '--force'])).toBe(5);
    expect(ConfigCLI.main(['bad'])).toBe(1);
    spies.forEach((spy) => spy.mockRestore());
  });

  test('configure-test-mode writes config and env for modes without terminating process', () => {
    fs.writeFileSync(
      path.join(root, 'jest.config.js'),
      'module.exports = { testEnvironment: "node" };'
    );
    expect(configure.main('development', root)).toBe(0);
    expect(fs.readFileSync(path.join(root, '.env.test'), 'utf8')).toContain(
      'BMAD_DEV_MODE=true'
    );
    expect(configure.main('help', root)).toBe(0);
    expect(configure.main('--help', root)).toBe(0);
    expect(configure.main('-h', root)).toBe(0);
    expect(configure.main('unknown', root)).toBe(1);
    expect(configure.main('ci', path.join(root, 'missing'))).toBe(1);
    expect(() =>
      configure.updateJestConfig(configure.modes.ci, path.join(root, 'missing'))
    ).toThrow('jest.config.js not found');
    const original = process.argv;
    process.argv = ['node', 'script'];
    expect(configure.getCurrentMode()).toBe('development');
    process.argv = ['node', 'script', 'performance'];
    expect(configure.getCurrentMode()).toBe('performance');
    process.argv = original;
  });
});
