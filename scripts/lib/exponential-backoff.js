/**
 * @ai-context Exponential Backoff utility with jitter and retry handling
 */
/* global setTimeout */

class ExponentialBackoff {
  constructor(config = {}) {
    this.initialDelay = config.initialDelay ?? 1000;
    this.maxDelay = config.maxDelay ?? 5000;
    this.multiplier = config.multiplier ?? 2;
    this.maxRetries = config.maxRetries ?? 3;
    this.jitterFactor = config.jitterFactor ?? 0.1;
  }

  calculateDelay(attempt) {
    let delay = this.initialDelay * Math.pow(this.multiplier, Math.max(0, attempt - 1));
    delay = Math.min(delay, this.maxDelay);

    if (this.jitterFactor > 0) {
      const jitter = delay * this.jitterFactor * (Math.random() * 2 - 1);
      delay = Math.max(0, Math.round(delay + jitter));
    }

    return Math.round(delay);
  }

  async execute(operation) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        if (attempt > this.maxRetries) {
          break;
        }
        const delay = this.calculateDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}

module.exports = ExponentialBackoff;
