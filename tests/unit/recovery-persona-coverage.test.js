jest.mock('../../personas/base-persona-enhanced', () => {
  return class MockBasePersona {
    constructor() {
      this.log = jest.fn();
      this.execCommand = jest.fn();
      this.commit = jest.fn();
      this.createIssue = jest.fn();
      this.updateActiveContext = jest.fn();
      this.octokit = {
        rest: {
          repos: {
            listCommits: jest.fn(),
            getCombinedStatusForRef: jest.fn(),
          },
        },
      };
    }
  };
});

const RecoveryPersona = require('../../personas/recovery');

describe('RecoveryPersona behavioral coverage', () => {
  let recovery;

  beforeEach(() => {
    recovery = new RecoveryPersona('token');
  });

  test('executes no-op and failed-CI recovery paths with context logging', async () => {
    jest.spyOn(recovery, 'checkCIStatus').mockResolvedValueOnce({ failed: false });
    await expect(recovery.execute(1, { persona: 'QA', operation: 'test' })).resolves.toEqual(
      expect.objectContaining({ status: 'completed' })
    );

    jest.spyOn(recovery, 'checkCIStatus').mockResolvedValueOnce({
      failed: true,
      failedCommit: 'abcdef1234',
      commitMessage: 'bad',
      statuses: [],
    });
    jest.spyOn(recovery, 'rollbackFailedCommit').mockResolvedValue();
    jest.spyOn(recovery, 'createRecoveryIssue').mockResolvedValue();
    await recovery.execute(2);
    expect(recovery.rollbackFailedCommit).toHaveBeenCalledWith('abcdef1234');
    expect(recovery.updateActiveContext).toHaveBeenCalled();
  });

  test('propagates execution errors', async () => {
    jest.spyOn(recovery, 'checkCIStatus').mockRejectedValue(new Error('boom'));
    await expect(recovery.execute(1)).rejects.toThrow('boom');
  });

  test('checks empty, successful, failed and API-error CI states', async () => {
    recovery.octokit.rest.repos.listCommits.mockResolvedValueOnce({ data: [] });
    await expect(recovery.checkCIStatus()).resolves.toEqual({ failed: false });

    recovery.octokit.rest.repos.listCommits.mockResolvedValue({
      data: [{ sha: 'abc', commit: { message: 'message' } }],
    });
    recovery.octokit.rest.repos.getCombinedStatusForRef
      .mockResolvedValueOnce({ data: { state: 'success', statuses: [] } })
      .mockResolvedValueOnce({ data: { state: 'failure', statuses: [{ context: 'ci' }] } });
    expect((await recovery.checkCIStatus()).failed).toBe(false);
    expect(await recovery.checkCIStatus()).toEqual(
      expect.objectContaining({ failed: true, failedCommit: 'abc' })
    );
    recovery.octokit.rest.repos.listCommits.mockRejectedValueOnce(new Error('api'));
    expect(await recovery.checkCIStatus()).toEqual(
      expect.objectContaining({ failed: false, error: 'api' })
    );
  });

  test('rolls back, commits, reports failures and creates issue body', async () => {
    await recovery.rollbackFailedCommit('abcdef1234');
    expect(recovery.execCommand).toHaveBeenCalledWith('git revert abcdef1234 --no-edit');
    expect(recovery.commit).toHaveBeenCalled();

    recovery.execCommand.mockRejectedValueOnce(new Error('revert'));
    await expect(recovery.rollbackFailedCommit('abcdef1234')).rejects.toThrow('revert');

    await recovery.createRecoveryIssue(8, {
      failedCommit: 'abcdef1234',
      commitMessage: 'bad',
      statuses: [{ context: 'unit', state: 'failure' }],
    });
    expect(recovery.createIssue).toHaveBeenCalledWith(
      expect.stringContaining('#8'),
      expect.stringContaining('unit'),
      ['recovery', 'bug', 'ci-failure']
    );
  });
});
