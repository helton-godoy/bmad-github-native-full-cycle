# Git Hooks Troubleshooting Guide

Comprehensive troubleshooting guide for BMAD Git Hooks Automation system.

## Quick Diagnostics

Run these commands to quickly diagnose issues:

```bash
# Validate configuration
npm run hooks:validate

# Check hook installation
ls -la .husky/

# Test hook manually
node scripts/hooks/validate-config.js show

# View recent hook logs
cat .husky/logs/*.log
```

## Common Issues

### 1. Hook Not Executing

#### Symptoms
- Git operations complete without hook running
- No hook output in terminal
- Expected validations don't occur

#### Diagnosis
```bash
# Check if hooks are installed
ls -la .husky/pre-commit .husky/commit-msg .husky/pre-push

# Check if Husky is initialized
cat .git/config | grep -A 2 "\[core\]"

# Verify hook permissions
ls -la .husky/ | grep -E "(pre-commit|commit-msg|pre-push)"
```

#### Solutions

**Solution 1: Reinstall hooks**
```bash
npm run hooks:install --force
```

**Solution 2: Fix permissions**
```bash
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
chmod +x .husky/post-commit
chmod +x .husky/post-merge
```

**Solution 3: Reinitialize Husky**
```bash
npx husky install
npm run hooks:install
```

**Solution 4: Check Git configuration**
```bash
# Ensure hooks path is correct
git config core.hooksPath

# Should output: .husky
# If not, set it:
git config core.hooksPath .husky
```

### 2. Configuration Validation Errors

#### Symptoms
- Hook fails with "Configuration error"
- Invalid JSON error
- Missing configuration section

#### Diagnosis
```bash
# Validate configuration
npm run hooks:validate

# Check configuration syntax
cat .husky/hooks-config.json | jq .

# Compare with template
diff .husky/hooks-config.json scripts/hooks/hooks-config.template.json
```

#### Solutions

**Solution 1: Auto-fix configuration**
```bash
npm run hooks:validate -- --fix
```

**Solution 2: Reset to template**
```bash
node scripts/hooks/validate-config.js reset --force
```

**Solution 3: Manual fix**
```bash
# Edit configuration
nano .husky/hooks-config.json

# Validate after editing
npm run hooks:validate
```

### 3. Linting Failures

#### Symptoms
- Pre-commit fails with linting errors
- ESLint errors prevent commit
- Formatting issues

#### Diagnosis
```bash
# Run linting manually
npm run lint

# Check specific files
npx eslint path/to/file.js

# View ESLint configuration
cat .eslintrc.js
```

#### Solutions

**Solution 1: Auto-fix linting errors**
```bash
npm run lint:fix
```

**Solution 2: Fix specific files**
```bash
npx eslint --fix path/to/file.js
```

**Solution 3: Temporarily disable linting**
```bash
# Edit .husky/hooks-config.json
{
  "preCommit": {
    "linting": false
  }
}

# Commit your changes
git commit -m "..."

# Re-enable linting
{
  "preCommit": {
    "linting": true
  }
}
```

**Solution 4: Use development mode**
```bash
# Bypass validation for WIP commits
git commit -m "WIP: fixing linting issues"
```

### 4. Test Failures

#### Symptoms
- Pre-commit or pre-push fails with test errors
- Tests pass locally but fail in hook
- Timeout errors

#### Diagnosis
```bash
# Run tests manually
npm test

# Run specific test file
npm test -- path/to/test.js

# Check test configuration
cat jest.config.js

# View test output
npm test -- --verbose
```

#### Solutions

**Solution 1: Fix failing tests**
```bash
# Run tests with coverage
npm run test:coverage

# Fix the failing tests
# Then commit
git commit -m "fix: resolve test failures"
```

**Solution 2: Increase timeout**
```bash
# Edit .husky/hooks-config.json
{
  "performance": {
    "timeoutMs": 600000
  }
}
```

**Solution 3: Skip tests temporarily**
```bash
# Edit .husky/hooks-config.json
{
  "preCommit": {
    "testing": false
  }
}

# Or use environment variable
BMAD_SKIP_TESTS=true git commit -m "..."
```

**Solution 4: Use test caching**
```bash
# Edit .husky/hooks-config.json
{
  "performance": {
    "testCaching": true
  }
}
```

### 5. Context Validation Failures

#### Symptoms
- Pre-commit fails with "Context validation failed"
- Persona mismatch errors
- Step ID progression errors

#### Diagnosis
```bash
# Check context files
cat productContext.md
cat activeContext.md

# Validate context manually
node -e "
const ContextManager = require('./scripts/lib/context-manager');
const cm = new ContextManager();
console.log(cm.validateContext());
"

# Check current persona
grep -A 5 "Current Persona" activeContext.md
```

#### Solutions

**Solution 1: Update context**
```bash
# Manually update activeContext.md with correct persona and step ID
nano activeContext.md

# Ensure format is correct:
# Current Persona: DEVELOPER
# Current Step: DEV-001
```

**Solution 2: Bypass context validation**
```bash
# Use WIP prefix
git commit -m "WIP: updating context"

# Or disable temporarily
# Edit .husky/hooks-config.json
{
  "preCommit": {
    "contextValidation": false
  }
}
```

**Solution 3: Reset context**
```bash
# Backup current context
cp activeContext.md activeContext.md.backup

# Reset to clean state
node scripts/lib/context-manager.js reset
```

### 6. Security Audit Failures

#### Symptoms
- Pre-push fails with security vulnerabilities
- npm audit errors
- Dependency vulnerabilities

#### Diagnosis
```bash
# Run security audit
npm audit

# Check for high/critical vulnerabilities
npm audit --audit-level=high

# View detailed vulnerability info
npm audit --json
```

#### Solutions

**Solution 1: Fix vulnerabilities automatically**
```bash
npm audit fix

# For breaking changes
npm audit fix --force
```

**Solution 2: Update specific packages**
```bash
# Update vulnerable package
npm update package-name

# Or install specific version
npm install package-name@version
```

**Solution 3: Temporarily skip security audit**
```bash
# Edit .husky/hooks-config.json
{
  "prePush": {
    "security": false
  }
}

# Push your changes
git push

# Re-enable security audit
{
  "prePush": {
    "security": true
  }
}
```

**Solution 4: Accept risk and document**
```bash
# Create audit exception
npm audit --json > .github/security-exceptions.json

# Document why vulnerabilities are accepted
# Then disable security check for this push
BMAD_SKIP_SECURITY=true git push
```

### 7. BMAD Workflow Sync Failures

#### Symptoms
- Pre-push fails with "BMAD sync failed"
- Workflow phase mismatch
- Persona consistency errors

#### Diagnosis
```bash
# Check BMAD workflow status
npm run bmad:status

# View workflow context
cat .github/BMAD_HANDOVER.md

# Check persona consistency
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.validatePersonaConsistency('main', 'DEVELOPER').then(console.log);
"
```

#### Solutions

**Solution 1: Synchronize workflow**
```bash
# Run BMAD workflow manually
npm run bmad:workflow

# Then try pushing again
git push
```

**Solution 2: Update handover document**
```bash
# Edit .github/BMAD_HANDOVER.md
nano .github/BMAD_HANDOVER.md

# Ensure current persona and phase are correct
```

**Solution 3: Disable BMAD sync temporarily**
```bash
# Edit .husky/hooks-config.json
{
  "prePush": {
    "bmadSync": false
  }
}
```

### 8. Performance Issues

#### Symptoms
- Hooks take too long to execute
- Timeout errors
- Slow test execution

#### Diagnosis
```bash
# Check hook execution time
git commit -m "test" --dry-run

# Profile test execution
npm test -- --verbose --detectOpenHandles

# Check system resources
top
df -h
```

#### Solutions

**Solution 1: Enable performance optimizations**
```bash
# Edit .husky/hooks-config.json
{
  "performance": {
    "testCaching": true,
    "parallelExecution": true,
    "timeoutMs": 300000
  }
}
```

**Solution 2: Reduce validation scope**
```bash
# Disable non-critical checks
{
  "preCommit": {
    "gatekeeper": false
  },
  "prePush": {
    "build": false
  }
}
```

**Solution 3: Use development mode**
```bash
# Enable development mode for faster iteration
export BMAD_DEV_MODE=true

# Use WIP commits
git commit -m "WIP: work in progress"
```

**Solution 4: Optimize tests**
```bash
# Run only changed tests
npm test -- --onlyChanged

# Use test sharding
npm test -- --shard=1/4
```

### 9. Post-merge Failures

#### Symptoms
- Post-merge hook reports errors
- Workflow automation fails
- Repository validation issues

#### Diagnosis
```bash
# Check repository state
git status

# Validate repository manually
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
orchestrator.validateRepositoryState('merge-commit').then(console.log);
"

# Check merge analysis report
cat .github/reports/merge-analysis.json
```

#### Solutions

**Solution 1: Fix repository state**
```bash
# Check for uncommitted changes
git status

# Commit or stash changes
git add .
git commit -m "fix: resolve merge issues"

# Or stash
git stash
```

**Solution 2: Run workflow manually**
```bash
# Execute BMAD workflow
npm run bmad:workflow

# Check workflow status
npm run bmad:status
```

**Solution 3: Review recovery report**
```bash
# Check recovery recommendations
cat .github/reports/recovery-report.json

# Follow rollback recommendations if needed
git reset --hard HEAD~1
```

### 10. GitHub Actions Inconsistency

#### Symptoms
- Local validation passes but GitHub Actions fails
- Inconsistent validation results
- Sync errors

#### Diagnosis
```bash
# Check GitHub Actions sync status
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
console.log(orchestrator.generateConsistencyReport());
"

# View consistency report
cat .github/reports/validation-consistency.json

# Compare local and remote configurations
diff .husky/hooks-config.json .github/workflows/ci.yml
```

#### Solutions

**Solution 1: Synchronize configurations**
```bash
# Export configuration for GitHub Actions
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
console.log(JSON.stringify(orchestrator.exportConfigForGitHubActions(), null, 2));
" > .github/workflows/hooks-config.json
```

**Solution 2: Enable consistency monitoring**
```bash
# Edit .husky/hooks-config.json
{
  "githubActionsSync": {
    "enabled": true,
    "monitorConsistency": true,
    "reportInconsistencies": true
  }
}
```

**Solution 3: Run same validation locally**
```bash
# Run full validation suite
npm run validate

# Run GitHub Actions locally (if using act)
act -j test
```

## Emergency Procedures

### Complete Hook Bypass

For emergency situations only:

```bash
# Bypass all hooks temporarily
git commit --no-verify -m "emergency: critical fix"
git push --no-verify

# Or use environment variable
HUSKY=0 git commit -m "emergency: critical fix"
HUSKY=0 git push
```

### Disable Hooks Completely

```bash
# Uninstall hooks
npm run hooks:uninstall

# Or manually
rm .husky/pre-commit .husky/commit-msg .husky/pre-push

# Restore later
npm run hooks:install
```

### Rollback Hook Changes

```bash
# Restore previous hook version
git checkout HEAD~1 -- .husky/

# Or restore from backup
cp .husky.backup/* .husky/
```

## Preventive Measures

### Regular Maintenance

```bash
# Weekly: Validate configuration
npm run hooks:validate

# Monthly: Update dependencies
npm update

# Quarterly: Review and optimize configuration
node scripts/hooks/validate-config.js report
```

### Monitoring

```bash
# Enable debug logging
export BMAD_HOOKS_DEBUG=true

# Monitor hook execution
tail -f .husky/logs/*.log

# Track performance metrics
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
console.log(orchestrator.getMetrics());
"
```

### Best Practices

1. **Always validate configuration after changes**
   ```bash
   npm run hooks:validate
   ```

2. **Test hooks before committing**
   ```bash
   git commit --dry-run -m "test"
   ```

3. **Keep documentation updated**
   - Document custom configurations
   - Update troubleshooting guides
   - Share solutions with team

4. **Use version control for configuration**
   ```bash
   git add .husky/hooks-config.json
   git commit -m "chore: update hook configuration"
   ```

5. **Monitor hook performance**
   - Track execution times
   - Optimize slow validations
   - Use caching when possible

## Getting Help

If issues persist after trying these solutions:

1. **Check documentation**: `docs/hooks/README.md`
2. **Review logs**: `.husky/logs/*.log`
3. **Search issues**: GitHub repository issues
4. **Ask team**: Contact development team
5. **Create issue**: Open new issue with:
   - Error message
   - Steps to reproduce
   - Configuration file
   - System information

## Diagnostic Script

Save this as `diagnose-hooks.sh` for quick diagnostics:

```bash
#!/bin/bash

echo "=== BMAD Git Hooks Diagnostics ==="
echo ""

echo "1. Hook Installation:"
ls -la .husky/ | grep -E "(pre-commit|commit-msg|pre-push|post-commit|post-merge)"
echo ""

echo "2. Configuration:"
if [ -f .husky/hooks-config.json ]; then
    echo "✅ Configuration exists"
    node scripts/hooks/validate-config.js
else
    echo "❌ Configuration missing"
fi
echo ""

echo "3. Git Configuration:"
git config core.hooksPath
echo ""

echo "4. Node.js Version:"
node --version
echo ""

echo "5. Dependencies:"
npm list husky --depth=0
echo ""

echo "6. Recent Hook Logs:"
if [ -d .husky/logs ]; then
    tail -n 20 .husky/logs/*.log 2>/dev/null || echo "No logs found"
else
    echo "No log directory"
fi
echo ""

echo "=== End Diagnostics ==="
```

Run with:
```bash
chmod +x diagnose-hooks.sh
./diagnose-hooks.sh
```
