const fs = require('fs');
const BMADOrchestrator = require('../../scripts/bmad/bmad-orchestrator');

describe('BMADOrchestrator branch coverage', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = Object.create(BMADOrchestrator.prototype);
    orchestrator.contextManager = { read: jest.fn(), write: jest.fn() };
    orchestrator.loopDetector = {
      maxTransitions: 3,
      detectLoop: jest.fn(),
      recordTransition: jest.fn(),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  test('parses complete, partial and missing handover states', () => {
    orchestrator.contextManager.read.mockReturnValueOnce(null);
    expect(orchestrator.loadHandoverState()).toEqual(
      expect.objectContaining({ persona: 'UNKNOWN', retryCount: 0 })
    );
    orchestrator.contextManager.read.mockReturnValueOnce(
      'Current Persona: **[PM]**\nCurrent Phase\n\n**Planning**\nRetry Count: 2\nIssue: #9'
    );
    expect(orchestrator.loadHandoverState()).toEqual(
      expect.objectContaining({ persona: 'PM', phase: 'Planning', retryCount: 2, issueNumber: 9 })
    );
    orchestrator.contextManager.read.mockReturnValueOnce('content');
    expect(orchestrator.loadHandoverState()).toEqual(
      expect.objectContaining({ persona: 'UNKNOWN', phase: 'UNKNOWN', issueNumber: null })
    );
  });

  test('resolves existing and fallback dynamic artifact paths', () => {
    jest.spyOn(fs, 'existsSync')
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => true);
    expect(orchestrator.getDynamicPath('PRD', 4)).toBe('docs/planning/PRD_4.md');
    fs.existsSync.mockReturnValue(false);
    expect(orchestrator.getDynamicPath('SPEC', 4)).toBe('docs/architecture/SPEC-4.md');
  });

  test('validates missing, invalid and valid requirements', () => {
    orchestrator.contextManager.read
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('ordinary prose')
      .mockReturnValueOnce('WHEN ready THE system SHALL continue');
    expect(orchestrator.validateRequirementsDocument('p')).toEqual(
      expect.objectContaining({ valid: false })
    );
    expect(orchestrator.validateRequirementsDocument('p').error).toContain('EARS');
    expect(orchestrator.validateRequirementsDocument('p')).toEqual({ valid: true });
  });

  test('blocks loops and PM preconditions but allows valid transitions', async () => {
    orchestrator.loopDetector.detectLoop
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    orchestrator.loopDetector.recordTransition.mockReturnValue({
      status: 'blocked',
    });
    expect(await orchestrator.validateTransition({ persona: 'QA' }, { persona: 'PM' })).toEqual(
      expect.objectContaining({ allowed: false, category: 'TRANSITION_LOOP' })
    );
    jest.spyOn(orchestrator, 'validateRequirementsDocument')
      .mockReturnValueOnce({ valid: false, error: 'missing' })
      .mockReturnValueOnce({ valid: true });
    expect(
      await orchestrator.validateTransition(
        { persona: 'pm' },
        { persona: 'architect', source: 'prd' }
      )
    ).toEqual(expect.objectContaining({ allowed: false, category: 'PM_PRECONDITION' }));
    expect(
      await orchestrator.validateTransition(
        { persona: 'PM' },
        { persona: 'ARCHITECT', source: 'prd' }
      )
    ).toEqual(expect.objectContaining({ allowed: true }));
    expect(
      await orchestrator.validateTransition({ persona: 'QA' }, { persona: 'SECURITY' })
    ).toEqual(expect.objectContaining({ allowed: true }));
  });

  test('updates new and existing handover branches and retries', () => {
    orchestrator.contextManager.read.mockReturnValueOnce('');
    orchestrator.updateHandoverState(
      { persona: 'pm', nextPhase: 'Planning', incrementRetry: true },
      2
    );
    expect(orchestrator.contextManager.write).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Retry Count: 1')
    );
    orchestrator.contextManager.read.mockReturnValueOnce(
      'Current Persona: **[PM]**\nCurrent Phase\n\n**Planning**\nRetry Count: 2\nIssue: #2'
    );
    orchestrator.updateHandoverState(
      { persona: 'qa', nextPhase: 'Quality', resetRetry: true },
      3
    );
    expect(orchestrator.contextManager.write).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining('Issue: #3')
    );
  });

  test('resets only when issue changes and detects issue types', () => {
    orchestrator.contextManager.read.mockReturnValueOnce('Issue: #1');
    orchestrator.handleStateReset(2);
    expect(orchestrator.contextManager.write).toHaveBeenCalled();
    orchestrator.contextManager.write.mockClear();
    orchestrator.contextManager.read.mockReturnValueOnce('Issue: #2');
    orchestrator.handleStateReset(2);
    expect(orchestrator.contextManager.write).not.toHaveBeenCalled();
    orchestrator.contextManager.read.mockReturnValueOnce(null);
    orchestrator.handleStateReset(2);
    expect(orchestrator.detectIssueType({ title: '[AUDIT] repo' })).toBe('AUDIT');
    expect(orchestrator.detectIssueType({ title: 'fix: bug' })).toBe('BUG');
    expect(orchestrator.detectIssueType({ title: 'feature' })).toBe('FEATURE');
  });

  test('returns fallback issue on API errors', async () => {
    orchestrator.octokit = {
      rest: { issues: { get: jest.fn().mockRejectedValue(new Error('offline')) } },
    };
    await expect(orchestrator.getIssueDetails(7)).resolves.toEqual(
      expect.objectContaining({ number: 7, title: 'Unknown' })
    );
  });

  test('extracts present sections and returns null for absent sections', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      '# Document\n## Architect Prompt\nDesign it\n## Other\nValue'
    );
    expect(orchestrator.extractSection('prd.md', 'Architect Prompt')).toBe('Design it');
    expect(orchestrator.extractSection('prd.md', 'Missing')).toBeNull();
  });

  test.each([
    ['DEVELOPER', 'Implementation', 'qa'],
    ['QA', 'Quality Assurance', 'security'],
    ['SECURITY', 'Security Review', 'devops'],
    ['DEVOPS', 'Deployment', 'releasemanager'],
    ['UNKNOWN', 'UNKNOWN', 'pm'],
  ])('routes %s standard state to %s', async (persona, phase, expected) => {
    const action = await orchestrator.determineNextAction(
      { persona, phase, retryCount: 0 },
      { number: 1, title: 'feature' },
      'FEATURE'
    );
    expect(action.persona).toBe(expected);
  });

  test('stops after release and handles architect spec retry boundaries', async () => {
    await expect(
      orchestrator.determineNextAction(
        { persona: 'RELEASEMANAGER', phase: 'Release', retryCount: 0 },
        { number: 1 },
        'FEATURE'
      )
    ).resolves.toBeNull();

    jest.spyOn(orchestrator, 'getDynamicPath').mockReturnValue('spec.md');
    orchestrator.contextManager.read.mockReturnValueOnce('spec');
    expect(
      await orchestrator.determineNextAction(
        { persona: 'ARCHITECT', phase: 'Architecture', retryCount: 0 },
        { number: 1 },
        'FEATURE'
      )
    ).toEqual(expect.objectContaining({ persona: 'developer' }));

    orchestrator.contextManager.read.mockReturnValueOnce(null);
    expect(
      await orchestrator.determineNextAction(
        { persona: 'ARCHITECT', phase: 'Architecture', retryCount: 0 },
        { number: 1 },
        'FEATURE'
      )
    ).toEqual(expect.objectContaining({ persona: 'architect', incrementRetry: true }));

    orchestrator.contextManager.read.mockReturnValueOnce(null);
    await expect(
      orchestrator.determineNextAction(
        { persona: 'ARCHITECT', phase: 'Architecture', retryCount: 3 },
        { number: 1 },
        'FEATURE'
      )
    ).resolves.toBeNull();
  });
});
