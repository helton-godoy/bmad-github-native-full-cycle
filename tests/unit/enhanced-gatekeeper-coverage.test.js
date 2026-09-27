const mockExecSync = jest.fn();

jest.mock('child_process', () => ({ execSync: mockExecSync }));
jest.mock('../../scripts/lib/logger', () =>
  jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
);

const EnhancedGatekeeper = require('../../scripts/lib/enhanced-gatekeeper');

const result = () => ({
  gate: 'FAIL',
  timestamp: '2026-01-01T00:00:00.000Z',
  validations: [],
  errors: [],
  warnings: [],
  waiver: { active: false },
  hookSpecific: {},
});

describe('EnhancedGatekeeper focused coverage', () => {
  let gatekeeper;
  let consoleSpy;

  beforeEach(() => {
    mockExecSync.mockReset();
    gatekeeper = new EnhancedGatekeeper({
      requireContextUpdate: false,
      skipTests: true,
      developmentMode: false,
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  test('validates fixture, bypass and runtime phase boundaries', async () => {
    const fixture = await gatekeeper.validatePhaseBoundary('qa', {
      useFixtures: true,
      fixture: { passed: 3, failed: 0 },
    });
    expect(fixture).toMatchObject({ gate: 'PASS', status: 'PASSED' });

    gatekeeper.config.developmentMode = true;
    gatekeeper.config.bypassEnabled = true;
    await expect(
      gatekeeper.validatePhaseBoundary('qa', { validations: ['tests'] })
    ).resolves.toMatchObject({
      gate: 'WAIVED',
      skippedValidations: ['tests'],
    });

    gatekeeper.config.developmentMode = false;
    gatekeeper.config.bypassEnabled = false;
    const spy = jest
      .spyOn(gatekeeper, 'validateWorkflowConditions')
      .mockResolvedValue({ gate: 'FAIL' });
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await expect(gatekeeper.validatePhaseBoundary('qa')).resolves.toMatchObject({
      status: 'FAILED',
    });
    process.env.NODE_ENV = oldNodeEnv;
    expect(spy).toHaveBeenCalled();
  });

  test('validates workflow pass, bypass and thrown validation', async () => {
    const normal = await gatekeeper.validateWorkflowConditions({
      commitMessage: 'feat: valid',
    });
    expect(normal.gate).toBe('WAIVED');

    gatekeeper.config.developmentMode = true;
    gatekeeper.config.bypassEnabled = true;
    await expect(gatekeeper.validateWorkflowConditions()).resolves.toMatchObject({
      gate: 'WAIVED',
    });

    gatekeeper.config.bypassEnabled = false;
    jest.spyOn(gatekeeper, 'validateCommitMessage').mockRejectedValue(new Error('boom'));
    const failed = await gatekeeper.validateWorkflowConditions();
    expect(failed.errors[0]).toMatchObject({ type: 'VALIDATION_ERROR' });
  });

  test('validates commit message variants', async () => {
    const target = result();
    await gatekeeper.validateCommitMessage(undefined, target);
    await gatekeeper.validateCommitMessage('[QA] [STEP-1] done', target);
    await gatekeeper.validateCommitMessage('fix(core): done', target);
    await gatekeeper.validateCommitMessage('bad', target);
    expect(target.validations.map((v) => v.status)).toEqual([
      'skipped',
      'passed',
      'passed',
      'failed',
    ]);
  });

  test('validates context update branches', async () => {
    const disabled = result();
    await gatekeeper.validateContextUpdate(disabled);
    expect(disabled.validations[0].status).toBe('skipped');

    gatekeeper.config.requireContextUpdate = true;
    mockExecSync.mockReturnValue('src/a.js\n');
    const missing = result();
    await gatekeeper.validateContextUpdate(missing);
    expect(missing.errors[0].type).toBe('CONTEXT_UPDATE_ERROR');

    mockExecSync.mockReturnValue('src/a.js\nactiveContext.md\n');
    const valid = result();
    await gatekeeper.validateContextUpdate(valid);
    expect(valid.validations[0].status).toBe('passed');

    mockExecSync.mockImplementation(() => {
      throw new Error('git unavailable');
    });
    const warning = result();
    await gatekeeper.validateContextUpdate(warning);
    expect(warning.warnings[0].type).toBe('GIT_WARNING');
  });

  test('executes skipped, passing and failing test suites', async () => {
    const skipped = result();
    await gatekeeper.executeTestSuite(skipped);
    expect(skipped.waiver.active).toBe(true);

    gatekeeper.config.skipTests = false;
    mockExecSync.mockReturnValue('PASS');
    const passed = result();
    await gatekeeper.executeTestSuite(passed);
    expect(passed.validations[0].status).toBe('passed');

    const failure = new Error('tests failed');
    failure.stdout = 'named failure';
    mockExecSync.mockImplementation(() => {
      throw failure;
    });
    const failed = result();
    await gatekeeper.executeTestSuite(failed);
    expect(failed.errors[0]).toMatchObject({ type: 'TEST_FAILURE' });
  });

  test('evaluates compact and detailed contracts', () => {
    expect(gatekeeper.evaluateResults({ passed: 1, failed: 0 })).toMatchObject({
      status: 'PASSED',
    });
    expect(gatekeeper.evaluateResults({ passed: 0, failed: 1 })).toMatchObject({
      status: 'FAILED',
    });
    expect(gatekeeper.evaluateResults(result()).gate).toBe('PASS');
    expect(
      gatekeeper.evaluateResults({
        ...result(),
        errors: [{ type: 'X' }],
      }).gate
    ).toBe('FAIL');
  });

  test('builds remediation, severity and impact for all known failures', () => {
    const failures = [
      { type: 'COMMIT_FORMAT_ERROR' },
      { type: 'CONTEXT_UPDATE_ERROR' },
      { type: 'TEST_FAILURE' },
      { type: 'VALIDATION_ERROR' },
      { type: 'UNKNOWN' },
    ];
    const report = gatekeeper.generateErrorReport(failures);
    expect(report.severity).toBe('HIGH');
    expect(report.impact).toMatchObject({ riskLevel: 'High' });
    expect(report.remediationSuggestions.length).toBeGreaterThan(0);
    expect(gatekeeper.calculateSeverity([{ type: 'COMMIT_FORMAT_ERROR' }])).toBe(
      'MEDIUM'
    );
    expect(gatekeeper.calculateSeverity([])).toBe('LOW');
  });

  test('renders success/error reports and status colors', () => {
    const success = {
      ...result(),
      gate: 'WAIVED',
      validations: [{ name: 'tests', status: 'passed', message: 'ok' }],
      warnings: [{ message: 'warning' }],
      waiver: { active: true, reason: 'dev', approved_by: 'tester' },
    };
    expect(gatekeeper.logSuccessValidation(success)).toBe(true);
    expect(gatekeeper.reportDetailedError({ ...success, errors: [] })).toBe(true);

    const failed = {
      ...result(),
      errors: [{ type: 'TEST_FAILURE', message: 'bad', details: 'suite' }],
    };
    expect(gatekeeper.reportDetailedError(failed)).toBe(false);
    expect(gatekeeper.logValidationResults(failed)).toBe(false);
    ['PASS', 'passed', 'FAIL', 'failed', 'WAIVED', 'waived', 'warning', 'x'].forEach(
      (status) => expect(gatekeeper.getStatusColor(status)).toBeDefined()
    );
  });

  test('controls development bypass and audit trail', () => {
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(gatekeeper.enableDevelopmentMode()).toBe(false);
    process.env.NODE_ENV = 'test';
    expect(gatekeeper.enableDevelopmentMode(true, 'coverage')).toBe(true);
    expect(gatekeeper.checkBypass('workflow')).toBe(true);
    expect(gatekeeper.getBypassAuditTrail().count).toBeGreaterThan(1);
    const target = result();
    expect(gatekeeper.applyDevelopmentBypass(target)).toBe(true);
    process.env.NODE_ENV = old;

    gatekeeper.config.developmentMode = false;
    expect(gatekeeper.checkBypass('workflow')).toBe(false);
    expect(gatekeeper.applyDevelopmentBypass(result())).toBe(false);
  });

  test('covers pre-commit and commit-msg hook outcomes', async () => {
    mockExecSync.mockReturnValue('src/a.js\nactiveContext.md');
    gatekeeper.config.requireContextUpdate = true;
    const passed = await gatekeeper.validateHookContext('pre-commit', {
      stagedFiles: ['a.js'],
      lintingResults: { success: true },
      testResults: { success: true },
    });
    expect(passed.gate).toBe('PASS');

    const failed = await gatekeeper.validateHookContext('pre-commit', {
      stagedFiles: [],
      lintingResults: { success: false, errors: ['lint'] },
      testResults: { success: false, output: 'tests' },
    });
    expect(failed.errors).toHaveLength(2);

    const missing = await gatekeeper.validateHookContext('commit-msg', {});
    expect(missing.errors[0].type).toBe('MISSING_COMMIT_MESSAGE');
    const valid = await gatekeeper.validateHookContext('commit-msg', {
      message: '[QA] [STEP-1] done',
      parsedMessage: { persona: 'QA', stepId: 'STEP-1' },
    });
    expect(valid.hookSpecific).toEqual({ persona: 'QA', stepId: 'STEP-1' });
  });

  test('covers pre-push pass, warning and failure combinations', async () => {
    const pass = await gatekeeper.validateHookContext('pre-push', {
      branch: 'main',
      remote: 'origin',
      testResults: { success: true, coverage: { lines: 90 } },
      buildResults: { success: true },
      securityResults: { vulnerabilities: 0 },
    });
    expect(pass.gate).toBe('PASS');

    const fail = await gatekeeper.validateHookContext('pre-push', {
      testResults: { success: true, coverage: { lines: 10 } },
      buildResults: { success: false, output: 'build' },
      securityResults: {
        vulnerabilities: 2,
        severity: 'critical',
        details: 'CVE',
      },
    });
    expect(fail.errors.map((e) => e.type)).toEqual(
      expect.arrayContaining(['COVERAGE_ERROR', 'BUILD_ERROR', 'SECURITY_ERROR'])
    );

    const warnings = await gatekeeper.validateHookContext('pre-push', {
      testResults: { success: false, output: 'test' },
      securityResults: { vulnerabilities: 1, severity: 'low' },
    });
    expect(warnings.warnings.length).toBeGreaterThan(0);
  });

  test('covers post hooks, rebase, checkout and receive hooks', async () => {
    const postCommit = await gatekeeper.validateHookContext('post-commit', {
      commitHash: 'abcdef123456',
      metricsUpdated: true,
      docsGenerated: false,
    });
    expect(postCommit.warnings[0].type).toBe('DOCS_WARNING');
    const postCommitMissing = await gatekeeper.validateHookContext('post-commit', {
      metricsUpdated: false,
      docsGenerated: true,
    });
    expect(postCommitMissing.warnings.length).toBe(2);

    const merge = await gatekeeper.validateHookContext('post-merge', {
      mergeType: 'merge',
      workflowExecuted: false,
      workflowError: 'no',
      repositoryStateValid: false,
      stateError: 'dirty',
    });
    expect(merge.errors).toHaveLength(2);
    const mergePass = await gatekeeper.validateHookContext('post-merge', {
      workflowExecuted: true,
      repositoryStateValid: true,
    });
    expect(mergePass.validations).toHaveLength(2);

    const rebaseMissing = await gatekeeper.validateHookContext('pre-rebase', {});
    expect(rebaseMissing.errors[0].type).toBe('MISSING_REBASE_INFO');
    const rebaseUnsafe = await gatekeeper.validateHookContext('pre-rebase', {
      sourceBranch: 'a',
      targetBranch: 'b',
      safetyCheck: { safe: false, reason: 'conflict' },
    });
    expect(rebaseUnsafe.errors[0].type).toBe('REBASE_SAFETY_ERROR');
    const rebaseSafe = await gatekeeper.validateHookContext('pre-rebase', {
      sourceBranch: 'a',
      targetBranch: 'b',
      safetyCheck: { safe: true },
    });
    expect(rebaseSafe.gate).toBe('PASS');

    const checkout = await gatekeeper.validateHookContext('post-checkout', {
      contextRestored: false,
    });
    expect(checkout.warnings).toHaveLength(2);
    const checkoutPass = await gatekeeper.validateHookContext('post-checkout', {
      newBranch: 'feature',
      contextRestored: true,
    });
    expect(checkoutPass.validations).toHaveLength(2);

    const receiveMissing = await gatekeeper.validateHookContext('pre-receive', {});
    expect(receiveMissing.errors[0].type).toBe('MISSING_RECEIVE_INFO');
    const receive = await gatekeeper.validateHookContext('pre-receive', {
      oldCommit: '111111111',
      newCommit: '222222222',
      refName: 'refs/heads/main',
      commitsValid: false,
      invalidCommits: ['x'],
      branchProtected: true,
      protectionRules: ['PR'],
    });
    expect(receive.errors).toHaveLength(2);
    const receivePass = await gatekeeper.validateHookContext('pre-receive', {
      oldCommit: '111111111',
      newCommit: '222222222',
      refName: 'refs/heads/topic',
      commitsValid: true,
    });
    expect(receivePass.gate).toBe('PASS');
  });

  test('handles unknown hooks, validator errors and bypassed hooks', async () => {
    const unknown = await gatekeeper.validateHookContext('unknown');
    expect(unknown.warnings[0].type).toBe('UNKNOWN_HOOK_TYPE');

    jest
      .spyOn(gatekeeper, 'validatePreCommitContext')
      .mockRejectedValue(new Error('validator crashed'));
    const crashed = await gatekeeper.validateHookContext('pre-commit');
    expect(crashed.errors[0].type).toBe('HOOK_VALIDATION_ERROR');

    gatekeeper.config.developmentMode = true;
    gatekeeper.config.bypassEnabled = true;
    const bypassed = await gatekeeper.validateHookContext('pre-push');
    expect(bypassed.gate).toBe('WAIVED');
  });

  test('generates hook reports, summaries and recommendations', () => {
    const validation = {
      ...result(),
      hookType: 'pre-commit',
      gate: 'FAIL',
      validations: [
        { name: 'a', status: 'passed' },
        { name: 'b', status: 'passed' },
        { name: 'c', status: 'failed' },
        { name: 'd', status: 'warning' },
        { name: 'e', status: 'skipped' },
      ],
      errors: [
        { type: 'LINTING_ERROR' },
        { type: 'TEST_FAILURE' },
        { type: 'CONTEXT_UPDATE_ERROR' },
      ],
      warnings: [{ type: 'W' }, { type: 'W2' }],
    };
    const report = gatekeeper.generateHookReport(validation);
    expect(report.validations.passed).toHaveLength(2);
    expect(report.recommendations).toHaveLength(4);
    expect(gatekeeper.generateHookSummary(validation)).toContain('2 checks');

    expect(
      gatekeeper.generateHookRecommendations({
        ...result(),
        hookType: 'commit-msg',
        errors: [{ type: 'COMMIT_FORMAT_ERROR' }],
      })
    ).toHaveLength(2);
    expect(
      gatekeeper.generateHookRecommendations({
        ...result(),
        hookType: 'pre-push',
        errors: [{ type: 'COVERAGE_ERROR' }, { type: 'SECURITY_ERROR' }],
      })
    ).toHaveLength(3);
    expect(
      gatekeeper.generateHookRecommendations({
        ...result(),
        hookType: 'post-merge',
        errors: [{ type: 'WORKFLOW_ERROR' }],
      })
    ).toHaveLength(2);
  });
});
