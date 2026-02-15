# BMAD Git Hooks Automation

Complete guide for managing and troubleshooting the BMAD Git Hooks Automation system.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Hook Reference](#hook-reference)
- [Troubleshooting](#troubleshooting)
- [Development Mode](#development-mode)
- [GitHub Actions Integration](#github-actions-integration)

## Overview

The BMAD Git Hooks Automation system provides automated validation and workflow integration for the BMAD development process. It ensures code quality, maintains context consistency, and coordinates with the BMAD orchestrator.

### Key Features

- **Pre-commit validation**: Linting, testing, and context validation
- **Commit message validation**: BMAD pattern and conventional commits support
- **Pre-push checks**: Full test suite, security audit, and BMAD synchronization
- **Post-commit automation**: Metrics, documentation, and notifications
- **Post-merge integration**: Workflow automation and repository validation
- **GitHub Actions sync**: Consistency between local and remote validation

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Git repository initialized
- Husky installed (`npm install --save-dev husky`)

### Quick Install

```bash
# Install hooks
npm run hooks:install

# Or manually
node scripts/hooks/install-hooks.js install
```

### Installation Options

```bash
# Force overwrite existing hooks
node scripts/hooks/install-hooks.js install --force

# Verbose output
node scripts/hooks/install-hooks.js install --verbose

# Both options
node scripts/hooks/install-hooks.js install --force --verbose
```

### Uninstallation

```bash
# Uninstall hooks (preserves configuration)
node scripts/hooks/install-hooks.js uninstall

# Remove configuration as well
node scripts/hooks/install-hooks.js uninstall --force
```

## Configuration

### Configuration File

Hooks are configured via `.husky/hooks-config.json`:

```json
{
    "preCommit": {
        "linting": true,
        "testing": true,
        "contextValidation": true,
        "gatekeeper": true
    },
    "commitMsg": {
        "bmadPattern": true,
        "conventionalCommits": true
    },
    "prePush": {
        "fullTests": true,
        "build": false,
        "security": true,
        "bmadSync": true
    },
    "postCommit": {
        "metrics": true,
        "documentation": true,
        "notifications": true,
        "contextUpdate": true
    },
    "postMerge": {
        "workflow": true,
        "validation": true,
        "reporting": true,
        "personaSync": true
    },
    "githubActionsSync": {
        "enabled": true,
        "monitorConsistency": true,
        "reportInconsistencies": true
    }
}
```

### Configuration Validation

```bash
# Validate configuration
npm run hooks:validate

# Or manually
node scripts/hooks/validate-config.js

# Auto-fix common issues
node scripts/hooks/validate-config.js --fix
```

### Configuration Options

#### Pre-commit Options

- `linting`: Run ESLint on staged files
- `testing`: Run fast tests on affected code
- `contextValidation`: Validate BMAD context consistency
- `gatekeeper`: Run gatekeeper validation

#### Commit Message Options

- `bmadPattern`: Validate BMAD commit message pattern `[PERSONA] [STEP-ID] Description`
- `conventionalCommits`: Allow conventional commit format

#### Pre-push Options

- `fullTests`: Run complete test suite with coverage
- `build`: Validate build process
- `security`: Run npm audit for security vulnerabilities
- `bmadSync`: Synchronize with BMAD workflow state

#### Post-commit Options

- `metrics`: Update project metrics
- `documentation`: Regenerate documentation
- `notifications`: Send commit notifications
- `contextUpdate`: Update BMAD context

#### Post-merge Options

- `workflow`: Execute BMAD workflow automation
- `validation`: Validate repository state
- `reporting`: Generate merge analysis report
- `personaSync`: Synchronize persona state

#### GitHub Actions Sync Options

- `enabled`: Enable GitHub Actions synchronization
- `monitorConsistency`: Monitor validation consistency
- `reportInconsistencies`: Report inconsistencies to logs

## Hook Reference

### Pre-commit Hook

**Trigger**: Before commit is created  
**Purpose**: Validate code quality and context consistency

**Validations**:
1. Linting (ESLint)
2. Fast tests on affected code
3. Context file validation
4. Gatekeeper workflow conditions

**Bypass**: Not available (ensures code quality)

**Example output**:
```
🔍 Running pre-commit validation...
✅ linting: passed
✅ testing: passed (5 tests, 2.5s)
✅ contextValidation: passed
✅ gatekeeper: passed
✅ Pre-commit validation passed
⏱️  Completed in 3500ms
```

### Commit Message Hook

**Trigger**: After commit message is written  
**Purpose**: Validate commit message format

**Validations**:
1. BMAD pattern: `[PERSONA] [STEP-ID] Description`
2. Conventional commits: `type(scope): description`
3. Context consistency (persona and step ID)

**Bypass**: Available in development mode with prefixes:
- `WIP:` - Work in progress
- `TEMP:` - Temporary commit
- `DEV:` - Development commit
- `emergency` or `hotfix` keywords

**Example output**:
```
🔍 Validating commit message...
📝 Message: [DEVELOPER] [DEV-001] Implement user authentication
✅ Commit message validation passed
📋 Format: BMAD pattern
👤 Persona: DEVELOPER
🔢 Step ID: DEV-001
📄 Description: Implement user authentication
⏱️  Completed in 150ms
```

### Pre-push Hook

**Trigger**: Before push to remote  
**Purpose**: Comprehensive validation before sharing code

**Validations**:
1. Full test suite with coverage
2. Build validation (if enabled)
3. Security audit (npm audit)
4. BMAD workflow synchronization

**Bypass**: Not available (ensures quality before push)

**Example output**:
```
🚀 Running pre-push validation...
📍 Branch: feature/auth
🌐 Remote: origin
✅ fullTestSuite: passed
   📊 Tests: 45/45 passed
   📈 Coverage: 85.2% lines, 82.1% branches
✅ securityAudit: passed
   🔒 No security vulnerabilities found
✅ bmadWorkflowSync: passed
   👤 Persona: DEVELOPER
   📋 Phase: implementation
✅ Pre-push validation passed
⏱️  Completed in 15000ms
```

### Post-commit Hook

**Trigger**: After commit is created  
**Purpose**: Update metrics and documentation

**Operations**:
1. Update project metrics
2. Regenerate documentation
3. Send notifications
4. Update BMAD context

**Note**: Always succeeds to not block commits

**Example output**:
```
📊 Running post-commit automation...
✅ metrics: passed
✅ documentation: passed
✅ notifications: passed
✅ contextUpdate: passed
✅ Post-commit automation completed
⏱️  Completed in 2000ms
```

### Post-merge Hook

**Trigger**: After merge is completed  
**Purpose**: Integrate merge with BMAD workflow

**Operations**:
1. Execute BMAD workflow
2. Validate repository state
3. Generate merge analysis report
4. Synchronize persona state

**Note**: Always succeeds to not block merges

**Example output**:
```
🔄 Running post-merge automation...
📍 Merge type: merge-commit
✅ workflow: passed
   🔄 BMAD workflow executed successfully
✅ repositoryValidation: passed
   ✅ Repository state is valid
✅ mergeAnalysis: passed
   📊 Files changed: 12
   📈 Lines: +245 -87
   📄 Report: .github/reports/merge-analysis.json
✅ Post-merge automation completed
⏱️  Completed in 5000ms
```

## Troubleshooting

### Common Issues

#### Hook Not Executing

**Symptoms**: Hook doesn't run when expected

**Causes**:
- Hook script not executable
- Husky not initialized
- Hook script has syntax errors

**Solutions**:
```bash
# Reinstall hooks
npm run hooks:install --force

# Check hook permissions
ls -la .husky/

# Make hooks executable
chmod +x .husky/*

# Verify Husky is initialized
npx husky install
```

#### Configuration Errors

**Symptoms**: Hook fails with configuration error

**Causes**:
- Invalid JSON in configuration
- Missing required sections
- Invalid option values

**Solutions**:
```bash
# Validate configuration
npm run hooks:validate

# Auto-fix common issues
node scripts/hooks/validate-config.js --fix

# Restore from template
cp scripts/hooks/hooks-config.template.json .husky/hooks-config.json
```

#### Validation Failures

**Symptoms**: Hook fails validation checks

**Causes**:
- Linting errors
- Test failures
- Context inconsistencies
- Security vulnerabilities

**Solutions**:
```bash
# Fix linting errors
npm run lint:fix

# Run tests locally
npm test

# Check security issues
npm audit fix

# Validate context manually
node scripts/lib/context-manager.js validate
```

#### Performance Issues

**Symptoms**: Hooks take too long to execute

**Causes**:
- Large test suite
- Slow linting
- Network issues (security audit)

**Solutions**:
```bash
# Enable test caching
# Edit .husky/hooks-config.json:
{
  "performance": {
    "testCaching": true,
    "parallelExecution": true
  }
}

# Disable slow checks temporarily
# Edit .husky/hooks-config.json:
{
  "prePush": {
    "security": false  // Skip security audit
  }
}

# Use development mode for rapid iteration
export BMAD_DEV_MODE=true
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Set debug environment variable
export BMAD_HOOKS_DEBUG=true

# Run git command
git commit -m "test"

# Check hook logs
cat .husky/logs/pre-commit.log
```

### Manual Hook Execution

Test hooks manually without git:

```bash
# Test pre-commit
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.executePreCommit([]).then(console.log);
"

# Test commit-msg
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.executeCommitMsg('[DEVELOPER] [DEV-001] Test').then(console.log);
"

# Test pre-push
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.executePrePush('main', 'origin').then(console.log);
"
```

## Development Mode

### Enabling Development Mode

Development mode provides bypass mechanisms for rapid iteration:

```bash
# Enable via environment variable
export BMAD_DEV_MODE=true

# Or in configuration
# Edit .husky/hooks-config.json:
{
  "developmentMode": {
    "enabled": true
  }
}
```

### Bypass Mechanisms

#### Prefix Bypass

Use special prefixes to bypass validation:

```bash
# Work in progress
git commit -m "WIP: testing new feature"

# Temporary commit
git commit -m "TEMP: quick fix"

# Development commit
git commit -m "DEV: experiment"
```

#### Emergency Bypass

Use emergency keywords for critical fixes:

```bash
# Emergency fix
git commit -m "emergency: fix production bug"

# Hotfix
git commit -m "hotfix: critical security patch"
```

#### Environment Variable Bypass

Bypass all validation:

```bash
# Bypass commit message validation
export BMAD_BYPASS_COMMIT_MSG=true
git commit -m "any message"
```

### Audit Trail

All bypasses are logged with audit trail:

```json
{
  "bypassed": true,
  "reason": "Development mode bypass: WIP prefix",
  "auditTrail": {
    "timestamp": "2024-01-15T10:30:00Z",
    "originalMessage": "WIP: testing feature",
    "bypassType": "prefix",
    "developmentMode": true,
    "environmentBypass": false
  }
}
```

## GitHub Actions Integration

### Consistency Monitoring

The system monitors consistency between local and remote validation:

```bash
# Enable monitoring
# Edit .husky/hooks-config.json:
{
  "githubActionsSync": {
    "enabled": true,
    "monitorConsistency": true,
    "reportInconsistencies": true
  }
}
```

### Validation Levels

Validation level adapts based on GitHub Actions:

- **Minimal**: GitHub Actions will run comprehensive checks
- **Standard**: Balanced local and remote validation
- **Comprehensive**: No GitHub Actions, full local validation

### Consistency Reports

View consistency reports:

```bash
# Generate consistency report
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
console.log(orchestrator.generateConsistencyReport());
"

# Check consistency metrics
cat .github/reports/validation-consistency.json
```

## Best Practices

### Configuration Management

1. **Version control**: Commit `.husky/hooks-config.json` to repository
2. **Team alignment**: Ensure all team members use same configuration
3. **Regular validation**: Run `npm run hooks:validate` periodically
4. **Documentation**: Document any custom configuration changes

### Performance Optimization

1. **Enable caching**: Use test caching for faster execution
2. **Parallel execution**: Enable parallel test execution
3. **Selective validation**: Disable unnecessary checks in development
4. **Incremental testing**: Run only affected tests in pre-commit

### Security

1. **Keep dependencies updated**: Regularly update Husky and dependencies
2. **Enable security audits**: Always run security audits in pre-push
3. **Review bypasses**: Monitor and review bypass usage
4. **Audit trail**: Maintain audit trail for all bypasses

### Troubleshooting Workflow

1. **Check configuration**: Validate configuration first
2. **Review logs**: Check hook execution logs
3. **Manual testing**: Test hooks manually to isolate issues
4. **Debug mode**: Enable debug mode for detailed logging
5. **Reinstall**: Reinstall hooks if issues persist

## Support

For issues and questions:

1. Check this documentation
2. Review troubleshooting section
3. Check project issues on GitHub
4. Contact development team

## License

Part of the BMAD-GitHub Native Full Cycle project.
