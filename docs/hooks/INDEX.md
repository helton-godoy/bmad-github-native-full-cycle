# Git Hooks Documentation Index

Complete documentation for the BMAD Git Hooks Automation system.

## Documentation Structure

### 📚 Main Guides

1. **[README.md](README.md)** - Complete user guide
   - Overview and features
   - Installation instructions
   - Configuration reference
   - Hook reference
   - Development mode
   - GitHub Actions integration
   - Best practices

2. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Problem-solving guide
   - Common issues and solutions
   - Diagnostic procedures
   - Emergency procedures
   - Preventive measures
   - Diagnostic scripts

3. **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Quick command reference
   - Installation commands
   - Configuration commands
   - Common workflows
   - Bypass mechanisms
   - Troubleshooting quick fixes
   - Useful aliases

## Quick Start

### Installation
```bash
npm run hooks:install
```

### Configuration
```bash
npm run hooks:config        # View configuration
npm run hooks:validate      # Validate configuration
```

### Usage
```bash
# Normal commit
git commit -m "[DEVELOPER] [DEV-001] Add feature"

# Work in progress
git commit -m "WIP: testing feature"
```

## Documentation by Topic

### Installation & Setup
- [Installation Guide](README.md#installation)
- [Prerequisites](README.md#prerequisites)
- [Quick Install](README.md#quick-install)
- [Uninstallation](README.md#uninstallation)

### Configuration
- [Configuration File](README.md#configuration-file)
- [Configuration Validation](README.md#configuration-validation)
- [Configuration Options](README.md#configuration-options)
- [Quick Reference - Configuration](QUICK-REFERENCE.md#configuration-options)

### Hook Reference
- [Pre-commit Hook](README.md#pre-commit-hook)
- [Commit Message Hook](README.md#commit-message-hook)
- [Pre-push Hook](README.md#pre-push-hook)
- [Post-commit Hook](README.md#post-commit-hook)
- [Post-merge Hook](README.md#post-merge-hook)

### Development
- [Development Mode](README.md#development-mode)
- [Bypass Mechanisms](README.md#bypass-mechanisms)
- [Audit Trail](README.md#audit-trail)
- [Quick Reference - Bypass](QUICK-REFERENCE.md#bypass-mechanisms)

### Troubleshooting
- [Common Issues](TROUBLESHOOTING.md#common-issues)
- [Hook Not Executing](TROUBLESHOOTING.md#1-hook-not-executing)
- [Configuration Errors](TROUBLESHOOTING.md#2-configuration-validation-errors)
- [Linting Failures](TROUBLESHOOTING.md#3-linting-failures)
- [Test Failures](TROUBLESHOOTING.md#4-test-failures)
- [Emergency Procedures](TROUBLESHOOTING.md#emergency-procedures)

### Integration
- [GitHub Actions Integration](README.md#github-actions-integration)
- [Consistency Monitoring](README.md#consistency-monitoring)
- [Validation Levels](README.md#validation-levels)

## Common Tasks

### First Time Setup
1. Install hooks: `npm run hooks:install`
2. Validate configuration: `npm run hooks:validate`
3. Test with commit: `git commit -m "WIP: test hooks"`
4. Review documentation: Read [README.md](README.md)

### Daily Development
1. Normal commits: `git commit -m "[PERSONA] [STEP-ID] Description"`
2. WIP commits: `git commit -m "WIP: work in progress"`
3. Push changes: `git push` (runs pre-push validation)

### Configuration Changes
1. Edit configuration: `nano .husky/hooks-config.json`
2. Validate changes: `npm run hooks:validate`
3. Test changes: Make a test commit
4. Commit configuration: `git add .husky/hooks-config.json`

### Troubleshooting
1. Check configuration: `npm run hooks:validate`
2. View current config: `npm run hooks:config`
3. Auto-fix issues: `npm run hooks:validate:fix`
4. Consult guide: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Command Reference

### Installation Commands
```bash
npm run hooks:install              # Install hooks
npm run hooks:install:force        # Force reinstall
npm run hooks:uninstall            # Uninstall hooks
```

### Configuration Commands
```bash
npm run hooks:config               # View configuration
npm run hooks:validate             # Validate configuration
npm run hooks:validate:fix         # Auto-fix issues
npm run hooks:config:reset         # Reset to defaults
npm run hooks:report               # Generate report
```

### Testing Commands
```bash
npm run hooks:test                 # Test hooks
npm test                           # Run all tests
npm run lint                       # Run linting
npm run validate                   # Run lint + test
```

## File Locations

### Configuration Files
- `.husky/hooks-config.json` - Main configuration
- `scripts/hooks/hooks-config.template.json` - Configuration template

### Hook Scripts
- `.husky/pre-commit` - Pre-commit hook
- `.husky/commit-msg` - Commit message hook
- `.husky/pre-push` - Pre-push hook
- `.husky/post-commit` - Post-commit hook
- `.husky/post-merge` - Post-merge hook

### Implementation Files
- `scripts/hooks/hook-orchestrator.js` - Main orchestrator
- `scripts/hooks/config-validator.js` - Configuration validator
- `scripts/hooks/install-hooks.js` - Installation script
- `scripts/hooks/validate-config.js` - Validation CLI

### Documentation Files
- `docs/hooks/README.md` - Main documentation
- `docs/hooks/TROUBLESHOOTING.md` - Troubleshooting guide
- `docs/hooks/QUICK-REFERENCE.md` - Quick reference
- `docs/hooks/INDEX.md` - This file

### Test Files
- `tests/git-hooks-automation-repository-state.test.js`
- `tests/git-hooks-automation-development-bypass.test.js`
- `tests/git-hooks-automation-github-actions-consistency.test.js`

## Support Resources

### Documentation
- Main guide: [README.md](README.md)
- Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Quick reference: [QUICK-REFERENCE.md](QUICK-REFERENCE.md)

### Commands
- Validate: `npm run hooks:validate`
- View config: `npm run hooks:config`
- Generate report: `npm run hooks:report`

### Help
- Check documentation first
- Run diagnostics: `npm run hooks:validate`
- Review logs: `cat .husky/logs/*.log`
- Contact team if issues persist

## Version Information

- **System**: BMAD Git Hooks Automation
- **Version**: 2.0.1
- **Node.js**: >= 18.0.0
- **Dependencies**: Husky, Jest, ESLint

## Related Documentation

### BMAD System
- Product overview: `productContext.md`
- Active context: `activeContext.md`
- Architecture: `docs/architecture/`

### Development
- Tech stack: `.kiro/steering/tech.md`
- Project structure: `.kiro/steering/structure.md`
- Contributing: `CONTRIBUTING.md`

### Testing
- Test documentation: `tests/README.md`
- Coverage reports: `coverage/`

## Changelog

### Version 2.0.1
- Added configuration validation
- Added installation scripts
- Added comprehensive documentation
- Added troubleshooting guide
- Added quick reference guide

## License

Part of the BMAD-GitHub Native Full Cycle project.
MIT License - See LICENSE file for details.
