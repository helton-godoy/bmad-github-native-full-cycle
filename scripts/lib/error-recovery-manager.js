/**
 * @ai-context Error Recovery Manager for automated retry and escalation
 */

const Logger = require('./logger');
const ExponentialBackoff = require('./exponential-backoff');

class ErrorRecoveryManager {
  constructor(options = {}) {
    this.logger = new Logger('ErrorRecoveryManager');
    this.maxRetries = options.maxRetries || 3;
    this.backoff = new ExponentialBackoff({
      initialDelay: options.initialDelay || 100,
      maxDelay: options.maxDelay || 1000,
      multiplier: 2,
      maxRetries: this.maxRetries,
    });
    this.recoveryPersonaActive = false;
  }

  async retryOperation(operation, maxAttempts = this.maxRetries) {
    return this.backoff.execute(operation);
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
      return await this.escalateToRecovery(exhaustedError, { ...context, persona });
    }
  }

  async escalateToRecovery(error, context = {}) {
    this.recoveryPersonaActive = true;
    this.logger.info(`Escalating to recovery persona for ${context.persona || 'UNKNOWN'}`);

    const recoveryReport = {
      status: 'escalated',
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
      actionRequired: 'Automated or manual remediation needed',
    };

    return recoveryReport;
  }

  async attemptRemediation(error, context = {}) {
    if (context.canRemediate) {
      return { status: 'remediated', details: 'Remediation successful' };
    }
    throw error;
  }
}

module.exports = ErrorRecoveryManager;
