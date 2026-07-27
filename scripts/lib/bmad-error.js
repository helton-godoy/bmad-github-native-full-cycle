/**
 * @ai-context Custom Error classes for BMAD system error categorization
 */

class ErrorContext {
  constructor(metadata = {}) {
    this.persona = metadata.persona || 'UNKNOWN';
    this.operation = metadata.operation || 'UNKNOWN';
    this.stepId = metadata.stepId || null;
    this.timestamp = metadata.timestamp || new Date().toISOString();
    this.retryCount = metadata.retryCount || 0;
    this.additionalContext = metadata.additionalContext || {};
  }
}

class BMADError extends Error {
  constructor(message, category = 'SYSTEM_ERROR', metadata = {}) {
    super(message);
    this.name = 'BMADError';
    this.category = category;
    this.context = new ErrorContext(metadata);
  }
}

class RetryableError extends BMADError {
  constructor(message, category = 'TRANSIENT_ERROR', metadata = {}) {
    super(message, category, metadata);
    this.name = 'RetryableError';
    this.isRetryable = true;
  }
}

class NonRetryableError extends BMADError {
  constructor(message, category = 'FATAL_ERROR', metadata = {}) {
    super(message, category, metadata);
    this.name = 'NonRetryableError';
    this.isRetryable = false;
  }
}

module.exports = {
  BMADError,
  RetryableError,
  NonRetryableError,
  ErrorContext,
};
