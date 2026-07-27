const fs = require('fs');
const os = require('os');
const path = require('path');

const ConfigLoader = require('../../scripts/lib/config-loader');
const ProductContextValidator = require('../../scripts/bmad/product-context-validator');

describe('ConfigLoader and ProductContextValidator coverage', () => {
  let root;
  let originalEnv;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-config-loader-'));
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(root, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('loads defaults when the file is absent and exposes sections', () => {
    const loader = new ConfigLoader(path.join(root, 'missing.json'));

    expect(loader.getComponentConfig('loopDetector')).toMatchObject({
      enabled: true,
      maxTransitions: 3,
    });
    expect(loader.getComponentConfig('unknown')).toEqual({});
    expect(loader.getIntegrationConfig()).toHaveProperty('orchestrator');
    expect(loader.getMonitoringConfig()).toMatchObject({ enabled: true });
    expect(loader.getDevelopmentConfig()).toMatchObject({
      bypassEnabled: false,
    });
    expect(loader.isComponentEnabled('unknown')).toBe(true);
    expect(loader.isComponentEnabled('loopDetector')).toBe(true);
    expect(loader.getFullConfig()).toBe(loader.config);
    expect(loader.validate()).toEqual({ valid: true, errors: [] });
  });

  test('deep-merges file configuration and applies typed environment overrides', () => {
    const configPath = path.join(root, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        components: {
          loopDetector: { enabled: false, maxTransitions: 7 },
          commitHandler: { validateFormat: false },
        },
        monitoring: { logLevel: 'debug' },
        customArray: [1, 2],
      })
    );
    process.env.BMAD_LOOP_DETECTION_ENABLED = 'true';
    process.env.BMAD_MAX_RETRIES = '6';
    process.env.BMAD_EXPONENTIAL_BACKOFF_MULTIPLIER = '1.5';
    process.env.BMAD_STATE_FILE = 'custom-state.json';
    process.env.BMAD_SKIP_VALIDATION = 'false';
    process.env.DEBUG = 'verbose';

    const loader = new ConfigLoader(configPath);

    expect(loader.getComponentConfig('loopDetector')).toMatchObject({
      enabled: true,
      maxTransitions: 7,
    });
    expect(loader.getComponentConfig('errorRecoveryManager')).toMatchObject({
      maxRetries: 6,
      backoffConfig: expect.objectContaining({ multiplier: 1.5 }),
    });
    expect(loader.getComponentConfig('stateCacheManager').stateFile).toBe(
      'custom-state.json'
    );
    expect(loader.getDevelopmentConfig()).toMatchObject({
      skipValidation: false,
      debugMode: 'verbose',
    });
    expect(loader.getMonitoringConfig().logLevel).toBe('debug');
    expect(loader.getFullConfig().customArray).toEqual([1, 2]);
    expect(loader.isComponentEnabled('loopDetector')).toBe(true);
  });

  test('covers merge, nested property creation and environment parsing branches', () => {
    const loader = new ConfigLoader(path.join(root, 'missing.json'));

    expect(loader.parseEnvValue('true')).toBe(true);
    expect(loader.parseEnvValue('false')).toBe(false);
    expect(loader.parseEnvValue('42')).toBe(42);
    expect(loader.parseEnvValue('2.75')).toBe(2.75);
    expect(loader.parseEnvValue('-2')).toBe('-2');
    expect(loader.parseEnvValue('text')).toBe('text');

    const target = { nested: { keep: 1 }, scalar: 1, list: [1] };
    expect(
      loader.deepMerge(target, {
        nested: { add: 2 },
        scalar: { replacement: true },
        list: [2],
        nil: null,
      })
    ).toEqual({
      nested: { keep: 1, add: 2 },
      scalar: { replacement: true },
      list: [2],
      nil: null,
    });

    const object = { blocked: 'value' };
    loader.setNestedProperty(object, 'blocked.child.value', 3);
    loader.setNestedProperty(object, 'new.path', 4);
    expect(object).toEqual({
      blocked: { child: { value: 3 } },
      new: { path: 4 },
    });
    expect(loader.getNestedProperty(object, 'blocked.child.value')).toBe(3);
    expect(loader.getNestedProperty(object, 'missing.path')).toBeUndefined();
  });

  test('falls back after malformed JSON and reloads a repaired file', () => {
    const configPath = path.join(root, 'config.json');
    fs.writeFileSync(configPath, '{invalid');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = new ConfigLoader(configPath);

    expect(warn).toHaveBeenCalled();
    expect(loader.getFullConfig().version).toBe('1.0.0');

    fs.writeFileSync(
      configPath,
      JSON.stringify({ monitoring: { enabled: false } })
    );
    expect(loader.reload().monitoring.enabled).toBe(false);
  });

  test('reports all invalid configuration boundaries', () => {
    const loader = new ConfigLoader(path.join(root, 'missing.json'));
    loader.config = {
      components: {
        errorRecoveryManager: { maxRetries: 0 },
        stateCacheManager: { lockTimeout: 999 },
        loopDetector: { maxTransitions: 21 },
      },
    };

    const result = loader.validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(5);

    loader.config.components.errorRecoveryManager.maxRetries = '3';
    loader.config.components.stateCacheManager.lockTimeout = 300001;
    loader.config.components.loopDetector.maxTransitions = null;
    expect(loader.validate().errors).toHaveLength(5);
  });

  test('validates a complete context and reports short or multi-stack warnings', () => {
    const validator = new ProductContextValidator();
    const filePath = path.join(root, 'productContext.md');
    const longText = 'A'.repeat(60);
    fs.writeFileSync(
      filePath,
      [
        '## Project Overview',
        longText,
        '## Technical Stack',
        `${longText} Node.js Python Rust`,
        '## Core Requirements',
        longText,
        '## Success Metrics',
        longText,
      ].join('\n')
    );

    const result = validator.validate(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toContain('Multiple technology stacks');
    expect(validator.generateReport(result)).toContain('Status**: VALID');
    expect(validator.detectTechStack('NodeJS and Golang and Java')).toEqual([
      'nodejs',
      'go',
      'golang',
      'java',
    ]);
    expect(validator.extractSection('## One\nvalue\n## Two\nnext', 'One')).toBe(
      'value'
    );
    expect(validator.extractSection('no sections', 'One')).toBe('');
  });

  test('reports missing sections, absent stacks, short content and missing files', () => {
    const validator = new ProductContextValidator();
    const filePath = path.join(root, 'productContext.md');

    expect(() => validator.validate(filePath)).toThrow(
      'productContext.md not found'
    );

    fs.writeFileSync(filePath, '## Technical Stack\nunknown\n');
    const result = validator.validate(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Missing required section: ## Project Overview',
        'No valid technology stack detected in ## Technical Stack',
      ])
    );
    expect(result.warnings.some((warning) => warning.includes('very short'))).toBe(
      true
    );
    const report = validator.generateReport(result);
    expect(report).toContain('Status**: INVALID');
    expect(report).toContain('## Errors');
    expect(report).toContain('## Warnings');
  });
});
