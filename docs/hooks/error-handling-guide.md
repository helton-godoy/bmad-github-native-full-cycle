# Git Hooks Error Handling Guide

## Overview

The Git Hooks Automation system includes a comprehensive error handling framework that provides:

- **Error Classification**: Automatic categorization of errors into blocking, warning, and non-blocking types
- **Automatic Recovery**: Smart recovery mechanisms for common issues
- **Detailed Reporting**: Clear error messages with actionable remediation guidance
- **Bypass Mechanisms**: Controlled bypass options with full audit trails

## Error Classification System

### Blocking Errors

Errors that prevent the Git operation from completing. These require immediate attention and resolution.

**Categories:**
- `TEST_FAILURE` - Test suite failures
- `BUILD_FAILURE` - Build/compilation errors
- `SECURITY_VULNERABILITY` - Security issues detected
- `INVALID_COMMIT_MESSAGE` - Commit message format violations
- `LINT_ERROR` - Code linting errors
- `SYNTAX_ERROR` - Code syntax errors

**Behavior:**
- Operation is blocked until error is resolved
- Auto-recovery attempted if available
- Detailed remediation guidance provided

### Warning Errors

Errors that allow the operation to proceed with warnings. May require follow-up action.

**Categories:**
- `MISSING_CONTEXT_UPDATE` - activeContext.md not updated
- `PERFORMANCE_THRESHOLD` - Hook execution time exceeded
- `DEPRECATED_USAGE` - Use of deprecated features
- `LOW_COVERAGE` - Test coverage below threshold

**Behavior:**
- Operation proceeds with warning
- Bypass options available
- Recommendations provided

### Non-Blocking Errors

Errors that are logged but don't prevent the operation. Typically occur in post-hooks.

**Categories:**
- `NOTIFICATION_FAILURE` - Failed to send notifications
- `DOCUMENTATION_FAILURE` - Documentation generation failed
- `METRICS_FAILURE` - Metrics update failed
- `CACHE_ERROR` - Cache operation failed

**Behavior:**
- Operation completes normally
- Error logged for troubleshooting
- No user intervention required

## Automatic Recovery Mechanisms

### Lint Error Recovery

**Trigger:** `LINT_ERROR` classification

**Action:**
1. Runs `eslint --fix` on staged files
2. Runs `prettier --write` on staged files
3. Reports fixed files

**Example:**
```javascript
const result = await errorHandler.handleHookError('pre-commit', error, {
  hookType: 'pre-commit',
  stagedFiles: ['src/file1.js', 'src/file2.js']
});

if (result.recovery.successful) {
  console.log('Auto-fixed:', result.recovery.filesFixed);
}
```

### Missing Context Recovery

**Trigger:** `MISSING_CONTEXT_UPDATE` classification

**Action:**
1. Checks if activeContext.md exists
2. Generates basic context entry with timestamp
3. Appends entry to context file

**Example:**
```javascript
const result = await errorHandler.handleHookError('pre-commit', error, {
  hookType: 'pre-commit',
  commitMessage: 'Add feature',
  persona: 'DEVELOPER'
});
```

### Performance Issue Recovery

**Trigger:** `PERFORMANCE_THRESHOLD` classification

**Action:**
1. Checks if lint-staged is enabled
2. Checks if parallel tests are enabled
3. Provides optimization recommendations

### Low Coverage Recovery

**Trigger:** `LOW_COVERAGE` classification

**Action:**
1. Analyzes coverage gaps
2. Generates specific recommendations
3. Provides improvement guidance

**Example:**
```javascript
const result = await errorHandler.handleHookError('pre-push', error, {
  hookType: 'pre-push',
  coverage: { branches: 70, functions: 75, lines: 78, statements: 76 },
  threshold: 80
});

console.log('Coverage gaps:', result.recovery.gaps);
console.log('Recommendations:', result.recovery.recommendations);
```

### Cache Error Recovery

**Trigger:** `CACHE_ERROR` classification

**Action:**
1. Removes corrupted cache directory
2. Recreates cache directory
3. Reports successful rebuild

## Error Reporting

### Report Structure

Every error generates a comprehensive report with:

```javascript
{
  hookType: 'pre-commit',
  timestamp: '2024-01-01T00:00:00Z',
  error: {
    message: 'Error message',
    code: 1,
    category: 'TEST_FAILURE',
    severity: 'blocking',
    blockingType: 'hard'
  },
  recovery: {
    successful: false,
    reason: 'Not recoverable'
  },
  remediation: {
    steps: ['Step 1', 'Step 2', ...],
    commands: ['npm test', ...],
    autoRecovery: { status: 'failed', reason: '...' }
  },
  bypassOptions: {
    available: true,
    methods: [...]
  },
  impact: {
    workflow: 'Blocks current operation',
    team: 'Prevents commit/push from completing',
    project: 'May delay development progress'
  }
}
```

### Remediation Guidance

Each error category includes specific remediation steps:

#### Test Failure
```
Steps:
1. Review test output for specific failures
2. Run tests locally: npm test
3. Fix failing tests or update test expectations
4. Ensure all dependencies are installed

Commands:
- npm test
- npm test -- --verbose
```

#### Build Failure
```
Steps:
1. Check build logs for compilation errors
2. Verify all dependencies are installed: npm install
3. Check for syntax errors in recent changes
4. Run build locally: npm run build

Commands:
- npm install
- npm run build
```

#### Security Vulnerability
```
Steps:
1. Review npm audit output for vulnerabilities
2. Update vulnerable dependencies: npm audit fix
3. For breaking changes, review and test updates
4. Consider using npm audit fix --force for major updates

Commands:
- npm audit
- npm audit fix
- npm audit fix --force
```

#### Invalid Commit Message
```
Steps:
1. Use BMAD pattern: [PERSONA] [STEP-ID] Description
2. Valid personas: DEVELOPER, PM, ARCHITECT, QA, DEVOPS, SECURITY, RELEASE_MANAGER
3. Step ID format: STEP-XXX where XXX is a number
4. Example: [DEVELOPER] [STEP-001] Implement user authentication

Commands:
- git commit --amend -m "[PERSONA] [STEP-ID] Description"
```

## Bypass Mechanisms

### Available Bypass Methods

#### 1. Development Mode
```bash
BMAD_DEV_MODE=true git commit -m "Message"
```
- Bypasses validation in development mode
- Requires audit trail
- Suitable for rapid iteration

#### 2. Emergency Override
```bash
BMAD_EMERGENCY_BYPASS=true git commit -m "Message"
```
- Emergency bypass with mandatory follow-up
- Requires audit trail and follow-up action
- Use only in critical situations

#### 3. Skip Hook
```bash
git commit --no-verify -m "Message"
```
- Skips all hooks completely
- Use with extreme caution
- Bypasses all validation

### Bypass Audit Trail

All bypass actions are recorded in `.git/hooks/audit.log`:

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "hookType": "pre-commit",
  "errorCategory": "MISSING_CONTEXT_UPDATE",
  "errorSeverity": "warning",
  "bypassMethod": "development-mode",
  "reason": "Testing feature",
  "user": "developer"
}
```

### Retrieving Audit Trail

```javascript
const trail = errorHandler.getBypassAuditTrail();

trail.forEach(record => {
  console.log(`${record.timestamp}: ${record.hookType} - ${record.errorCategory}`);
  console.log(`  Method: ${record.bypassMethod}`);
  console.log(`  Reason: ${record.reason}`);
});
```

## Usage Examples

### Basic Error Handling

```javascript
const HookErrorHandler = require('./hook-error-handler');

const errorHandler = new HookErrorHandler({
  enableAutoRecovery: true,
  enableBypass: process.env.BMAD_DEV_MODE === 'true',
});

try {
  // Your hook logic here
  await runTests();
} catch (error) {
  const result = await errorHandler.handleHookError('pre-commit', error, {
    hookType: 'pre-commit',
    stagedFiles: getStagedFiles()
  });

  if (result.shouldBlock) {
    console.error('Hook failed:', result.report.error.message);
    process.exit(1);
  }
}
```

### Integration with Hook Orchestrator

```javascript
const HookOrchestrator = require('./hook-orchestrator');

const orchestrator = new HookOrchestrator({
  enableAutoRecovery: true,
  developmentMode: process.env.BMAD_DEV_MODE === 'true'
});

// Error handler is automatically initialized and integrated
const result = await orchestrator.executePreCommit(stagedFiles);
```

### Custom Error Classification

```javascript
// Classify a custom error
const classification = errorHandler.classifyError(error, 'pre-commit');

console.log('Category:', classification.category);
console.log('Severity:', classification.severity);
console.log('Recoverable:', classification.recoverable);
console.log('Bypassable:', classification.bypassable);
```

### Manual Recovery Attempt

```javascript
// Attempt recovery manually
const recoveryResult = await errorHandler.attemptRecovery(error, {
  hookType: 'pre-commit',
  stagedFiles: ['file1.js', 'file2.js']
});

if (recoveryResult.successful) {
  console.log('Recovery action:', recoveryResult.action);
  console.log('Details:', recoveryResult.details);
}
```

## Configuration Options

```javascript
const errorHandler = new HookErrorHandler({
  // Enable/disable automatic recovery
  enableAutoRecovery: true,

  // Enable/disable bypass mechanisms
  enableBypass: false,

  // Path to audit log file
  auditLogPath: '.git/hooks/audit.log',

  // Maximum recovery attempts per error
  maxRecoveryAttempts: 3
});
```

## Best Practices

1. **Always handle errors**: Never let errors go unhandled in hook scripts
2. **Use appropriate severity**: Classify errors correctly for proper handling
3. **Provide context**: Include relevant context when handling errors
4. **Review audit trail**: Regularly review bypass actions
5. **Update remediation**: Keep remediation guidance current
6. **Test recovery**: Test automatic recovery mechanisms
7. **Document bypasses**: Always document why a bypass was used

## Troubleshooting

### Recovery Not Working

**Problem:** Automatic recovery fails repeatedly

**Solutions:**
1. Check recovery attempt limit (default: 3)
2. Verify error is classified as recoverable
3. Check file permissions for recovery actions
4. Review error logs for specific failure reasons

### Bypass Not Available

**Problem:** Bypass options not showing for an error

**Solutions:**
1. Check if error is non-blocking (no bypass needed)
2. Verify error is classified as bypassable
3. Check if bypass is enabled in configuration
4. Review error severity (critical errors can't be bypassed)

### Audit Log Issues

**Problem:** Bypass actions not being recorded

**Solutions:**
1. Check `.git/hooks/` directory exists
2. Verify write permissions on audit log file
3. Check disk space availability
4. Review error handler configuration

## Related Documentation

- [Hook Orchestrator Guide](./hook-orchestrator-guide.md)
- [BMAD Message Validator](./bmad-message-validator.md)
- [Performance Monitoring](./performance-monitoring.md)
- [Testing Strategy](./testing-strategy.md)
