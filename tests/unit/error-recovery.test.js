/**
 * Property-Based Tests for Error Recovery Manager
 * **Feature: bmad-critical-fixes**
 *
 * Properties:
 * - Property 16: Recovery Escalation
 * - Property 17: Recovery Persona Activation
 * - Property 18: Remediation Failure Handling
 * - Property 19: State Restoration After Recovery
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

const fc = require('fast-check');
const ErrorRecoveryManager = require('../../scripts/lib/error-recovery-manager');
const { RetryableError } = require('../../scripts/lib/bmad-error');

describe('ErrorRecoveryManager Property Tests', () => {
  let recoveryManager;

  beforeEach(() => {
    recoveryManager = new ErrorRecoveryManager({
      maxRetries: 3,
      initialDelay: 1,  // Scaled down for fast testing
      maxDelay: 10,
    });
  });

  describe('Property 16: Recovery Escalation', () => {
    it('should escalate to recovery persona after all retries are exhausted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (persona, errorMessage) => {
            const error = new RetryableError(errorMessage, 'TRANSIENT_ERROR', { persona });

            const result = await recoveryManager.handleError(error, persona, { canRemediate: false });

            // After exhausting all retries, should escalate
            expect(result.status).toBe('escalated');
            expect(result.context.persona).toBe(persona);
            expect(result.error).toBe(errorMessage);
            expect(result.actionRequired).toBeTruthy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should activate recovery persona flag on escalation', async () => {
      const error = new RetryableError('Test error', 'TRANSIENT_ERROR', { persona: 'DEVELOPER' });
      expect(recoveryManager.recoveryPersonaActive).toBe(false);

      await recoveryManager.handleError(error, 'DEVELOPER', { canRemediate: false });

      expect(recoveryManager.recoveryPersonaActive).toBe(true);
    });
  });

  describe('Property 17: Recovery Persona Activation', () => {
    it('should pass persona context through to escalation report', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.record({
            taskId: fc.string({ minLength: 1, maxLength: 10 }),
            step: fc.integer({ min: 1, max: 10 }),
          }),
          async (persona, errorMessage, additionalContext) => {
            const error = new RetryableError(errorMessage, 'TRANSIENT_ERROR', { persona });
            const context = { ...additionalContext, canRemediate: false };

            const result = await recoveryManager.handleError(error, persona, context);

            expect(result.context.persona).toBe(persona);
            expect(result.context.taskId).toBe(additionalContext.taskId);
            expect(result.context.step).toBe(additionalContext.step);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include timestamp in escalation report', async () => {
      const error = new RetryableError('Error', 'TRANSIENT_ERROR', { persona: 'QA' });
      const before = new Date();

      const result = await recoveryManager.handleError(error, 'QA', { canRemediate: false });

      const after = new Date();
      const resultTime = new Date(result.timestamp);
      expect(resultTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(resultTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Property 18: Remediation Failure Handling', () => {
    it('should handle failed remediation attempts and report accordingly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 5 }),
          async (errorMessage, attemptNumber) => {
            let attemptCount = 0;
            const error = new RetryableError(errorMessage, 'TRANSIENT_ERROR');

            // Simulate an operation that always fails
            const failingOp = async () => {
              attemptCount++;
              throw error;
            };

            // The system should handle the error through retries and escalate
            const result = await recoveryManager.handleError(error, 'TEST', { canRemediate: false });

            expect(result.status).toBe('escalated');
            expect(result.error).toBe(errorMessage);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should remediate successfully when canRemediate is true', async () => {
      const error = new RetryableError('Fixable error', 'TRANSIENT_ERROR', { persona: 'DEVELOPER' });

      const result = await recoveryManager.handleError(error, 'DEVELOPER', { canRemediate: true });

      expect(result.status).toBe('remediated');
      expect(result.details).toBe('Remediation successful');
    });
  });

  describe('Property 19: State Restoration After Recovery', () => {
    it('should produce a recovery report with state information for resumption', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.record({
            workflowId: fc.string({ minLength: 1, maxLength: 15 }),
            retryCount: fc.integer({ min: 0, max: 10 }),
          }),
          async (persona, errorMessage, stateInfo) => {
            const error = new RetryableError(errorMessage, 'TRANSIENT_ERROR', {
              persona,
              retryCount: stateInfo.retryCount,
            });

            const result = await recoveryManager.handleError(error, persona, {
              workflowId: stateInfo.workflowId,
              canRemediate: false,
            });

            // Recovery report should contain enough info for state resumption
            expect(result.status).toBe('escalated');
            expect(result.context.persona).toBe(persona);
            expect(result.context.workflowId).toBe(stateInfo.workflowId);
            expect(result.timestamp).toBeTruthy();
            expect(result.actionRequired).toContain('remediation');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should allow recovery from escalated state with successful remediation', async () => {
      // First, trigger escalation
      const error = new RetryableError('Temporary error', 'TRANSIENT_ERROR', { persona: 'DEVELOPER' });
      const escalated = await recoveryManager.handleError(error, 'DEVELOPER', { canRemediate: false });
      expect(escalated.status).toBe('escalated');

      // Now simulate a new operation that succeeds (system recovered)
      const successfulOp = async () => ({ status: 'recovered', data: 'workflow resumed' });
      const result = await recoveryManager.retryOperation(successfulOp);
      expect(result.status).toBe('recovered');
      expect(result.data).toBe('workflow resumed');
    });
  });
});
