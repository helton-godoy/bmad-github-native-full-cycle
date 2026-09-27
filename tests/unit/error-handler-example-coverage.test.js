const mockHandleHookError = jest.fn();
const mockRecordBypass = jest.fn();
const mockGetBypassAuditTrail = jest.fn();

jest.mock('../../scripts/hooks/hook-error-handler', () =>
  jest.fn().mockImplementation(() => ({
    handleHookError: mockHandleHookError,
    recordBypass: mockRecordBypass,
    getBypassAuditTrail: mockGetBypassAuditTrail,
  }))
);

describe('hook error handler example', () => {
  beforeEach(() => {
    mockHandleHookError
      .mockResolvedValueOnce({
        classification: { category: 'LINT', severity: 'warning' },
        recovery: { successful: true, details: 'fixed' },
        shouldBlock: false,
      })
      .mockResolvedValueOnce({
        classification: { category: 'TEST', severity: 'error' },
        shouldBlock: true,
        report: { remediation: { steps: ['fix tests', 'retry'] } },
      })
      .mockResolvedValueOnce({
        classification: { category: 'CONTEXT', severity: 'warning' },
        shouldBlock: false,
        report: {
          bypassOptions: {
            available: true,
            methods: [
              {
                name: 'development',
                description: 'local only',
                command: 'BMAD_DEV_MODE=true',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        classification: { category: 'NOTIFICATION', severity: 'info' },
        shouldBlock: false,
        report: {
          impact: { workflow: 'none', team: 'none', project: 'none' },
        },
      });
    mockRecordBypass.mockReturnValue({
      timestamp: '2026-07-27T00:00:00.000Z',
      hookType: 'pre-commit',
      errorCategory: 'MISSING_CONTEXT_UPDATE',
      bypassMethod: 'development-mode',
      reason: 'test',
    });
    mockGetBypassAuditTrail.mockReturnValue([
      {
        timestamp: '2026-07-27T00:00:00.000Z',
        hookType: 'pre-commit',
        errorCategory: 'MISSING_CONTEXT_UPDATE',
        bypassMethod: 'development-mode',
        reason: 'test',
      },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('runs every documented example using the handler contract', async () => {
    const { runExamples } = require('../../scripts/hooks/error-handler-example');

    await expect(runExamples()).resolves.toBeUndefined();

    expect(mockHandleHookError).toHaveBeenCalledTimes(4);
    expect(mockRecordBypass).toHaveBeenCalledWith(
      'pre-commit',
      expect.objectContaining({ category: 'MISSING_CONTEXT_UPDATE' }),
      'development-mode',
      expect.any(String)
    );
    expect(mockGetBypassAuditTrail).toHaveBeenCalledTimes(1);
  });

  test('covers unsuccessful recovery, unavailable bypass and empty audit trail', async () => {
    mockHandleHookError.mockReset();
    mockHandleHookError
      .mockResolvedValueOnce({
        classification: { category: 'LINT', severity: 'warning' },
        recovery: { successful: false },
        shouldBlock: true,
      })
      .mockResolvedValueOnce({
        classification: { category: 'TEST', severity: 'error' },
        shouldBlock: true,
        report: { remediation: { steps: [] } },
      })
      .mockResolvedValueOnce({
        classification: { category: 'CONTEXT', severity: 'warning' },
        shouldBlock: true,
        report: { bypassOptions: { available: false, methods: [] } },
      })
      .mockResolvedValueOnce({
        classification: { category: 'NOTIFICATION', severity: 'info' },
        shouldBlock: false,
        report: {
          impact: { workflow: 'none', team: 'none', project: 'none' },
        },
      });
    mockGetBypassAuditTrail.mockReturnValueOnce([]);
    const { runExamples } = require('../../scripts/hooks/error-handler-example');

    await expect(runExamples()).resolves.toBeUndefined();

    expect(mockHandleHookError).toHaveBeenCalledTimes(4);
    expect(mockGetBypassAuditTrail).toHaveBeenCalledTimes(1);
  });
});
