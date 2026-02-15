# Git Hooks Quick Reference

Quick reference guide for common hook operations and commands.

## Installation & Setup

```bash
# Install hooks
npm run hooks:install

# Force reinstall (overwrites existing)
npm run hooks:install:force

# Uninstall hooks
npm run hooks:uninstall
```

## Configuration Management

```bash
# View current configuration
npm run hooks:config

# Validate configuration
npm run hooks:validate

# Auto-fix configuration issues
npm run hooks:validate:fix

# Reset to default configuration
npm run hooks:config:reset

# Generate validation report
npm run hooks:report
```

## Common Commands

### Development Workflow

```bash
# Normal commit (full validation)
git commit -m "[DEVELOPER] [DEV-001] Add feature"

# Work in progress (bypass validation)
git commit -m "WIP: testing feature"

# Emergency fix (bypass validation)
git commit -m "emergency: fix critical bug"

# Skip hooks entirely (use sparingly)
git commit --no-verify -m "message"
```

### Testing Hooks

```bash
# Test pre-commit manually
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.executePreCommit([]).then(console.log);
"

# Test commit-msg manually
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.executeCommitMsg('[DEVELOPER] [DEV-001] Test').then(console.log);
"

# Test pre-push manually
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.executePrePush('main', 'origin').then(console.log);
"
```

## Configuration Options

### Enable/Disable Features

Edit `.husky/hooks-config.json`:

```json
{
  "preCommit": {
    "linting": true,      // ESLint validation
    "testing": true,      // Fast tests
    "contextValidation": true,  // BMAD context
    "gatekeeper": true    // Workflow conditions
  },
  "commitMsg": {
    "bmadPattern": true,  // [PERSONA] [STEP-ID] format
    "conventionalCommits": true  // type(scope): format
  },
  "prePush": {
    "fullTests": true,    // Complete test suite
    "build": false,       // Build validation
    "security": true,     // npm audit
    "bmadSync": true      // BMAD workflow sync
  }
}
```

## Bypass Mechanisms

### Development Mode Prefixes

```bash
git commit -m "WIP: work in progress"
git commit -m "TEMP: temporary change"
git commit -m "DEV: development experiment"
```

### Emergency Keywords

```bash
git commit -m "emergency: critical production fix"
git commit -m "hotfix: urgent security patch"
```

### Environment Variables

```bash
# Bypass commit message validation
BMAD_BYPASS_COMMIT_MSG=true git commit -m "any message"

# Enable development mode
export BMAD_DEV_MODE=true

# Skip all hooks
HUSKY=0 git commit -m "message"
```

## Troubleshooting Quick Fixes

### Hook Not Running

```bash
# Reinstall hooks
npm run hooks:install:force

# Fix permissions
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push

# Reinitialize Husky
npx husky install
```

### Linting Errors

```bash
# Auto-fix linting
npm run lint:fix

# Or bypass temporarily
git commit -m "WIP: fixing linting"
```

### Test Failures

```bash
# Run tests locally
npm test

# Skip tests temporarily
git commit -m "WIP: fixing tests"
```

### Configuration Errors

```bash
# Auto-fix configuration
npm run hooks:validate:fix

# Reset to defaults
npm run hooks:config:reset
```

## Hook Execution Flow

### Pre-commit
1. Linting (ESLint on staged files)
2. Fast tests (affected code only)
3. Context validation (BMAD consistency)
4. Gatekeeper (workflow conditions)

### Commit-msg
1. Format validation (BMAD or conventional)
2. Persona validation (if BMAD format)
3. Step ID validation (if BMAD format)
4. Context consistency check

### Pre-push
1. Full test suite with coverage
2. Build validation (if enabled)
3. Security audit (npm audit)
4. BMAD workflow synchronization

### Post-commit
1. Update project metrics
2. Regenerate documentation
3. Send notifications
4. Update BMAD context

### Post-merge
1. Execute BMAD workflow
2. Validate repository state
3. Generate merge analysis
4. Synchronize persona state

## Performance Tips

```json
{
  "performance": {
    "testCaching": true,        // Cache test results
    "parallelExecution": true,  // Run tests in parallel
    "timeoutMs": 300000        // 5 minute timeout
  }
}
```

## Validation Patterns

### BMAD Commit Pattern

```
[PERSONA] [STEP-ID] Description

Examples:
[DEVELOPER] [DEV-001] Implement user authentication
[QA] [QA-002] Add integration tests
[ARCHITECT] [ARCH-001] Design system architecture
```

### Conventional Commits

```
type(scope): description

Examples:
feat(auth): add user login
fix(api): resolve timeout issue
docs(readme): update installation guide
```

## Environment Variables

```bash
# Development mode
export BMAD_DEV_MODE=true

# Bypass commit message validation
export BMAD_BYPASS_COMMIT_MSG=true

# Skip tests
export BMAD_SKIP_TESTS=true

# Skip security audit
export BMAD_SKIP_SECURITY=true

# Debug mode
export BMAD_HOOKS_DEBUG=true

# Disable all hooks
export HUSKY=0
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# Quick commit with BMAD pattern
alias gcb='git commit -m "[DEVELOPER] [DEV-$(date +%s)]"'

# WIP commit
alias gcw='git commit -m "WIP:"'

# Validate hooks
alias hv='npm run hooks:validate'

# View hook config
alias hc='npm run hooks:config'

# Fix hook config
alias hf='npm run hooks:validate:fix'
```

## Status Checks

```bash
# Check hook installation
ls -la .husky/ | grep -E "(pre-commit|commit-msg|pre-push)"

# Validate configuration
npm run hooks:validate

# View configuration
npm run hooks:config

# Check Git hooks path
git config core.hooksPath

# View hook metrics
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
console.log(JSON.stringify(orchestrator.getMetrics(), null, 2));
"
```

## Emergency Procedures

### Complete Bypass

```bash
# Single commit bypass
git commit --no-verify -m "emergency fix"

# Disable hooks temporarily
export HUSKY=0
git commit -m "emergency fix"
git push
unset HUSKY
```

### Rollback Hooks

```bash
# Uninstall hooks
npm run hooks:uninstall

# Restore from git
git checkout HEAD -- .husky/

# Reinstall
npm run hooks:install
```

## Documentation Links

- **Full Guide**: `docs/hooks/README.md`
- **Troubleshooting**: `docs/hooks/TROUBLESHOOTING.md`
- **Configuration**: `.husky/hooks-config.json`
- **Template**: `scripts/hooks/hooks-config.template.json`

## Support Commands

```bash
# Generate diagnostic report
npm run hooks:report

# View recent logs
cat .husky/logs/*.log

# Check system health
npm run bmad:health

# Validate BMAD state
npm run bmad:state
```

## Best Practices

1. ✅ Always validate after config changes: `npm run hooks:validate`
2. ✅ Use WIP commits for work in progress
3. ✅ Run tests locally before pushing
4. ✅ Keep configuration in version control
5. ✅ Document custom configurations
6. ❌ Don't use `--no-verify` unless emergency
7. ❌ Don't disable security audits in production
8. ❌ Don't bypass hooks without audit trail

## Quick Diagnostics

```bash
# One-line diagnostic
node -e "const v=require('./scripts/hooks/config-validator');new v().validate().valid?console.log('✅ Valid'):console.log('❌ Invalid')"

# Full diagnostic
npm run hooks:validate && \
ls -la .husky/ && \
git config core.hooksPath && \
echo "✅ Hooks OK"
```
