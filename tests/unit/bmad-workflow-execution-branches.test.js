const mockOrchestrate = jest.fn();
const mockClearHistory = jest.fn();
const mockRecoveryExecute = jest.fn();
const mockEscalate = jest.fn();

jest.mock('../../scripts/bmad/bmad-orchestrator', () => {
  return class MockOrchestrator {
    constructor() {
      this.loopDetector = { clearHistory: mockClearHistory };
    }
    orchestrate(issueNumber) {
      return mockOrchestrate(issueNumber);
    }
  };
});

jest.mock('../../personas/recovery', () => {
  return class MockRecovery {
    execute(...args) {
      return mockRecoveryExecute(...args);
    }
  };
});

jest.mock('../../scripts/lib/error-recovery-manager', () => {
  return class MockRecoveryManager {
    escalateToRecovery(...args) {
      return mockEscalate(...args);
    }
  };
});

const EnhancedBMADWorkflow = require('../../scripts/bmad/bmad-workflow-enhanced');

describe('EnhancedBMADWorkflow execution branches', () => {
  let workflow;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'token';
    delete process.env.BMAD_FORCE_RESUME;
    workflow = new EnhancedBMADWorkflow();
    workflow.logWorkflow = jest.fn();
    workflow.saveState = jest.fn().mockResolvedValue();
    workflow.clearState = jest.fn().mockResolvedValue();
    workflow.generateWorkflowReport = jest.fn().mockResolvedValue();
    workflow.generateErrorReport = jest.fn().mockResolvedValue();
    jest.clearAllMocks();
  });

  test('returns immediately for a completed workflow', async () => {
    workflow.loadState = jest.fn().mockResolvedValue({
      workflowId: 'done',
      issueNumber: 1,
      status: 'completed',
      metrics: workflow.workflowMetrics,
    });
    await expect(workflow.executeWorkflow(1)).resolves.toBeUndefined();
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  test('starts a new workflow and completes when orchestrator becomes idle', async () => {
    workflow.loadState = jest.fn().mockResolvedValue(null);
    mockOrchestrate.mockResolvedValueOnce(false);
    await workflow.executeWorkflow(2);
    expect(workflow.saveState).toHaveBeenCalled();
    expect(workflow.clearState).toHaveBeenCalledWith(2, 'completed');
    expect(mockClearHistory).toHaveBeenCalled();
  });

  test('resumes a workflow and honors force resume for completed state', async () => {
    process.env.BMAD_FORCE_RESUME = 'true';
    workflow.loadState = jest.fn().mockResolvedValue({
      workflowId: 'resume',
      issueNumber: 3,
      status: 'completed',
      resumeCount: 1,
      metrics: workflow.workflowMetrics,
    });
    mockOrchestrate.mockResolvedValueOnce(false);
    await workflow.executeWorkflow(3);
    expect(workflow.saveState).toHaveBeenCalledWith(
      expect.objectContaining({ resumeCount: 2 })
    );
  });

  test('records successful automated recovery and rethrows workflow error', async () => {
    workflow.loadState = jest.fn().mockResolvedValue(null);
    mockOrchestrate.mockRejectedValueOnce(new Error('workflow failed'));
    mockRecoveryExecute.mockResolvedValue({ status: 'completed' });
    mockEscalate.mockResolvedValue({ status: 'remediated' });
    await expect(workflow.executeWorkflow(4)).rejects.toThrow('workflow failed');
    expect(workflow.generateErrorReport).toHaveBeenCalled();
    expect(workflow.saveState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'recovered' })
    );
  });

  test('records suspended recovery as recovery failure', async () => {
    workflow.loadState = jest.fn().mockResolvedValue(null);
    mockOrchestrate.mockRejectedValueOnce(new Error('workflow failed'));
    mockEscalate.mockResolvedValue({ status: 'suspended', reason: 'manual review' });
    await expect(workflow.executeWorkflow(5)).rejects.toThrow('workflow failed');
    expect(workflow.saveState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'recovery-failed' })
    );
  });
});
