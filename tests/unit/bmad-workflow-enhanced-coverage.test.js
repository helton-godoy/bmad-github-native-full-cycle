const fs = require('fs');
const EnhancedBMADWorkflow = require('../../scripts/bmad/bmad-workflow-enhanced');

describe('EnhancedBMADWorkflow behavioral coverage', () => {
  let workflow;

  beforeEach(() => {
    workflow = Object.create(EnhancedBMADWorkflow.prototype);
    workflow.personas = {
      pm: { execute: jest.fn().mockResolvedValue({ ok: true }) },
      qa: { execute: jest.fn().mockRejectedValue(new Error('qa failed')) },
    };
    workflow.workflowMetrics = {
      startTime: new Date(),
      phases: {},
      errors: [],
      successes: [],
    };
    workflow.logWorkflow = jest.fn();
    workflow.delay = jest.fn().mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  test('executes successful and failed individual phases', async () => {
    await workflow.executePhase('pm', 'Planning', 1);
    expect(workflow.workflowMetrics.phases.pm.status).toBe('completed');
    expect(workflow.workflowMetrics.successes).toHaveLength(1);

    await expect(workflow.executePhase('qa', 'Quality', 1)).rejects.toThrow('qa failed');
    expect(workflow.workflowMetrics.phases.qa.status).toBe('failed');
    expect(workflow.workflowMetrics.errors).toHaveLength(1);
  });

  test('generates JSON and markdown workflow reports', async () => {
    workflow.workflowMetrics.phases.pm = {
      name: 'Planning',
      duration: 1000,
      status: 'completed',
    };
    workflow.workflowMetrics.phases.qa = {
      name: 'Quality',
      duration: 500,
      status: 'failed',
      error: 'bad',
    };
    workflow.workflowMetrics.successes.push({});
    workflow.workflowMetrics.errors.push({});
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    await workflow.generateWorkflowReport('wf-1', 10);
    expect(write).toHaveBeenCalledTimes(2);
    const markdown = workflow.generateMarkdownReport({
      workflowId: 'wf',
      issueNumber: 1,
      totalDuration: 1,
      startTime: 'start',
      endTime: 'end',
      phases: workflow.workflowMetrics.phases,
      metrics: {
        successRate: '50.00',
        totalPhases: 2,
        successfulPhases: 1,
        failedPhases: 1,
      },
    });
    expect(markdown).toContain('Planning');
    expect(markdown).toContain('bad');
  });

  test('generates error reports and derives current phase', async () => {
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    expect(workflow.getCurrentPhase()).toBe('initialization');
    workflow.workflowMetrics.phases.pm = { status: 'completed' };
    expect(workflow.getCurrentPhase()).toBe('pm');
    await workflow.generateErrorReport('wf', 1, new Error('boom'));
    expect(write).toHaveBeenCalledWith(
      '.github/reports/error-wf.json',
      expect.stringContaining('boom')
    );
  });

  test('provides IDs, status, logging and direct persona execution', async () => {
    jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
    expect(workflow.generateWorkflowId()).toMatch(/^bmad-\d+-/);
    workflow.logWorkflow = EnhancedBMADWorkflow.prototype.logWorkflow;
    workflow.logWorkflow('message', 'WARN');
    expect(fs.appendFileSync).toHaveBeenCalled();

    expect(workflow.getWorkflowStatus()).toEqual(
      expect.objectContaining({ running: true, completedPhases: 0, totalPhases: 7 })
    );
    workflow.workflowMetrics.phases = {
      a: {}, b: {}, c: {}, d: {}, e: {}, f: {}, g: {},
    };
    expect(workflow.getWorkflowStatus().running).toBe(false);
    await expect(workflow.executePersona('pm', 1)).resolves.toEqual({ ok: true });
    await expect(workflow.executePersona('missing', 1)).rejects.toThrow('Unknown persona');
  });

  test('loads cache variants, saves and clears state through isolated mocks', async () => {
    const cache = {
      restoreState: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: 'reset' })
        .mockResolvedValueOnce({
          currentPersona: 'PM',
          stepId: 'STEP',
          context: { workflowState: { workflowId: 'wf' } },
        }),
      persistState: jest.fn().mockResolvedValue({}),
    };
    workflow.createStateCache = jest.fn().mockReturnValue(cache);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(workflow.loadState(1)).resolves.toBeNull();
    await expect(workflow.loadState(1)).resolves.toBeNull();
    await expect(workflow.loadState(1)).resolves.toEqual({ workflowId: 'wf' });
    await workflow.saveState({ issueNumber: 1, workflowId: 'wf' });
    expect(cache.persistState).toHaveBeenCalled();

    fs.existsSync.mockReturnValue(true);
    const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    await workflow.clearState(1);
    expect(unlink).toHaveBeenCalledWith('.github/workflow-state-1.json');
  });
});
