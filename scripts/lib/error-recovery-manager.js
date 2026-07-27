/**
 * @ai-context Error Recovery Manager for automated retry and escalation
 */

const Logger = require('./logger');
const ExponentialBackoff = require('./exponential-backoff');
const StateCacheManager = require('./state-cache-manager');

class ErrorRecoveryManager {
  constructor(options = {}) {
    this.logger = new Logger('ErrorRecoveryManager');
    this.maxRetries = options.maxRetries ?? 2;
    this.backoff = new ExponentialBackoff({
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 2000,
      multiplier: 2,
      maxRetries: this.maxRetries,
    });
    this.recoveryPersonaActive = false;
    this.stateCache = options.stateCache || new StateCacheManager(options.stateOptions);
    this.remediations = new Map(Object.entries(options.remediations || {}));
  }

  async retryOperation(operation, maxAttempts = this.maxRetries + 1) {
    const originalRetries = this.backoff.maxRetries;
    this.backoff.maxRetries = Math.max(0, maxAttempts - 1);
    try {
      return await this.backoff.execute(operation);
    } finally {
      this.backoff.maxRetries = originalRetries;
    }
  }

  async handleError(error, persona = 'UNKNOWN', context = {}) {
    this.logger.error(`Handling error in ${persona}: ${error.message}`);

    try {
      return await this.retryOperation(async (attempt) => {
        if (attempt > 1) {
          this.logger.info(`Retry attempt ${attempt}/${this.maxRetries} for error in ${persona}`);
        }
        return await this.attemptRemediation(error, context);
      });
    } catch (exhaustedError) {
      this.logger.error(`All retries exhausted for error in ${persona}, escalating to recovery`);
      return await this.escalateToRecovery(exhaustedError, {
        ...context,
        persona,
        operation: context.operation || 'unknown',
        retryCount: this.maxRetries,
      });
    }
  }

  async escalateToRecovery(error, context = {}) {
    this.recoveryPersonaActive = true;
    this.logger.info(`Escalating to recovery persona for ${context.persona || 'UNKNOWN'}`);

    const errorContext = {
      persona: context.persona || 'UNKNOWN',
      operation: context.operation || 'unknown',
      errorMessage: error.message,
      retryCount: context.retryCount ?? this.maxRetries,
      category: context.category || error.category || error.name || 'UNKNOWN',
      ...context,
    };
    const recoveryReport = {
      status: 'escalated',
      error: error.message,
      context: errorContext,
      timestamp: new Date().toISOString(),
      actionRequired: 'Automated or manual remediation needed',
    };

    const remediation = this.remediations.get(errorContext.category);
    if (!remediation) {
      return this.suspend(errorContext, [], 'unregistered remediation category');
    }
    const outcomes = [];
    try {
      const outcome = await remediation(errorContext);
      outcomes.push(outcome);
      if (outcome === false || (outcome && outcome.success === false)) {
        return this.suspend(errorContext, outcomes, 'remediation failed');
      }
      return { ...recoveryReport, status: 'remediated', outcomes };
    } catch (remediationError) {
      outcomes.push({ success: false, error: remediationError.message });
      return this.suspend(errorContext, outcomes, 'remediation failed');
    }
  }

  registerRemediation(category, remediation) {
    this.remediations.set(category, remediation);
  }

  async suspend(context, outcomes, reason) {
    const stepId = context.stepId || 'RECOVERY';
    await this.stateCache.persistState(
      context.persona,
      stepId,
      context.context || context,
      { workflowId: context.workflowId, status: 'suspended' }
    );
    return {
      status: 'suspended',
      reason,
      context,
      remediationSteps: outcomes,
      timestamp: new Date().toISOString(),
    };
  }

  async resume() {
    return this.stateCache.restoreState();
  }

  async attemptRemediation(error, context = {}) {
    if (context.canRemediate) {
      return { status: 'remediated', details: 'Remediation successful' };
    }
    throw error;
  }
}

module.exports = ErrorRecoveryManager;
