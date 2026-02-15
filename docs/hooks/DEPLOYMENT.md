# Git Hooks Deployment Guide

Guide for deploying and managing BMAD Git Hooks Automation in production and team environments.

## Deployment Checklist

### Pre-deployment

- [ ] Review configuration requirements
- [ ] Ensure Node.js >= 18.0.0 is installed
- [ ] Verify Husky is in package.json
- [ ] Test hooks in development environment
- [ ] Document any custom configurations
- [ ] Prepare team communication

### Deployment

- [ ] Install hooks: `npm run hooks:install`
- [ ] Validate configuration: `npm run hooks:validate`
- [ ] Test with sample commit
- [ ] Verify all hooks execute correctly
- [ ] Document deployment date and version

### Post-deployment

- [ ] Monitor hook execution
- [ ] Collect team feedback
- [ ] Address any issues
- [ ] Update documentation as needed
- [ ] Schedule regular maintenance

## Team Deployment

### Initial Setup

1. **Add to repository**
   ```bash
   # Ensure configuration is in version control
   git add .husky/hooks-config.json
   git add scripts/hooks/
   git add docs/hooks/
   git commit -m "chore: add git hooks automation"
   git push
   ```

2. **Team communication**
   - Announce deployment to team
   - Share documentation links
   - Provide training if needed
   - Set up support channel

3. **Team member setup**
   ```bash
   # Each team member runs:
   git pull
   npm install
   npm run hooks:install
   ```

### Configuration Management

#### Version Control
```bash
# Always commit configuration changes
git add .husky/hooks-config.json
git commit -m "chore: update hook configuration"
git push
```

#### Team Synchronization
```bash
# Team members update configuration
git pull
npm run hooks:validate
```

#### Custom Configurations
```bash
# Document custom settings
echo "# Custom Hook Configuration" >> .husky/hooks-config.local.json
echo "See docs/hooks/README.md for details" >> .husky/hooks-config.local.json
```

## Environment-Specific Configuration

### Development Environment

```json
{
  "developmentMode": {
    "enabled": true,
    "bypassPrefixes": ["WIP:", "TEMP:", "DEV:"]
  },
  "preCommit": {
    "linting": true,
    "testing": true,
    "contextValidation": false,
    "gatekeeper": false
  },
  "prePush": {
    "fullTests": false,
    "security": false
  }
}
```

### Staging Environment

```json
{
  "developmentMode": {
    "enabled": false
  },
  "preCommit": {
    "linting": true,
    "testing": true,
    "contextValidation": true,
    "gatekeeper": true
  },
  "prePush": {
    "fullTests": true,
    "security": true,
    "bmadSync": true
  }
}
```

### Production Environment

```json
{
  "developmentMode": {
    "enabled": false
  },
  "preCommit": {
    "linting": true,
    "testing": true,
    "contextValidation": true,
    "gatekeeper": true
  },
  "prePush": {
    "fullTests": true,
    "build": true,
    "security": true,
    "bmadSync": true
  },
  "githubActionsSync": {
    "enabled": true,
    "monitorConsistency": true,
    "reportInconsistencies": true
  }
}
```

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run hooks:validate
      - run: npm run lint
      - run: npm test
      - run: npm run validate
```

### Pre-commit CI

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: validate-hooks
        name: Validate Git Hooks Configuration
        entry: npm run hooks:validate
        language: system
        pass_filenames: false
```

## Monitoring & Maintenance

### Health Checks

```bash
# Daily health check
npm run hooks:validate

# Weekly detailed check
npm run hooks:report

# Monthly review
npm run hooks:config > config-backup-$(date +%Y%m%d).json
```

### Performance Monitoring

```bash
# Check hook execution times
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
console.log(JSON.stringify(orchestrator.getMetrics(), null, 2));
"

# Monitor test execution
npm test -- --verbose

# Check system resources
top
df -h
```

### Log Management

```bash
# View recent logs
tail -f .husky/logs/*.log

# Archive old logs
mkdir -p .husky/logs/archive
mv .husky/logs/*.log.old .husky/logs/archive/

# Clean old logs
find .husky/logs/archive -mtime +30 -delete
```

## Rollback Procedures

### Emergency Rollback

```bash
# Disable hooks immediately
export HUSKY=0

# Or uninstall
npm run hooks:uninstall

# Restore from backup
git checkout HEAD~1 -- .husky/
npm run hooks:install
```

### Gradual Rollback

```bash
# Disable specific validations
# Edit .husky/hooks-config.json
{
  "preCommit": {
    "linting": false,
    "testing": false
  }
}

# Validate and commit
npm run hooks:validate
git add .husky/hooks-config.json
git commit -m "chore: temporarily disable validations"
```

### Version Rollback

```bash
# Restore previous version
git log --oneline -- .husky/hooks-config.json
git checkout <commit-hash> -- .husky/hooks-config.json

# Validate and apply
npm run hooks:validate
npm run hooks:install
```

## Upgrade Procedures

### Minor Updates

```bash
# Backup current configuration
cp .husky/hooks-config.json .husky/hooks-config.json.backup

# Update scripts
git pull

# Validate configuration
npm run hooks:validate

# Test with sample commit
git commit --allow-empty -m "test: validate hooks"
```

### Major Updates

```bash
# 1. Backup
cp -r .husky .husky.backup
cp -r scripts/hooks scripts/hooks.backup

# 2. Uninstall current version
npm run hooks:uninstall

# 3. Update code
git pull

# 4. Install new version
npm run hooks:install

# 5. Migrate configuration
node scripts/hooks/migrate-config.js

# 6. Validate
npm run hooks:validate

# 7. Test
git commit --allow-empty -m "test: validate new version"
```

## Team Training

### Training Checklist

- [ ] Overview of hook system
- [ ] Installation procedure
- [ ] Configuration options
- [ ] Common workflows
- [ ] Bypass mechanisms
- [ ] Troubleshooting basics
- [ ] Support resources

### Training Materials

1. **Quick Start Guide**: [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
2. **Full Documentation**: [README.md](README.md)
3. **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. **Hands-on Exercise**: Practice commits with different scenarios

### Training Session Outline

1. **Introduction (10 min)**
   - What are git hooks?
   - Why we use them
   - Benefits for the team

2. **Installation (15 min)**
   - Prerequisites
   - Installation steps
   - Verification

3. **Daily Usage (20 min)**
   - Normal commits
   - WIP commits
   - Push workflow
   - Common scenarios

4. **Configuration (15 min)**
   - Configuration file
   - Common options
   - Customization

5. **Troubleshooting (15 min)**
   - Common issues
   - Quick fixes
   - Support resources

6. **Q&A (15 min)**
   - Questions
   - Concerns
   - Feedback

## Support & Maintenance

### Support Channels

1. **Documentation**: `docs/hooks/`
2. **Team Chat**: #git-hooks-support
3. **Issue Tracker**: GitHub Issues
4. **Email**: dev-team@example.com

### Maintenance Schedule

- **Daily**: Monitor hook execution
- **Weekly**: Review logs and metrics
- **Monthly**: Update documentation
- **Quarterly**: Review and optimize configuration
- **Annually**: Major version updates

### Incident Response

1. **Identify issue**
   - Check logs
   - Reproduce problem
   - Document symptoms

2. **Assess impact**
   - How many users affected?
   - Is work blocked?
   - What's the severity?

3. **Immediate action**
   - Emergency bypass if needed
   - Communicate to team
   - Start investigation

4. **Resolution**
   - Fix issue
   - Test solution
   - Deploy fix
   - Verify resolution

5. **Post-mortem**
   - Document incident
   - Identify root cause
   - Implement preventive measures
   - Update documentation

## Best Practices

### Configuration Management

1. **Version control**: Always commit configuration changes
2. **Documentation**: Document custom settings
3. **Testing**: Test configuration changes before deploying
4. **Communication**: Inform team of changes

### Team Collaboration

1. **Consistency**: Use same configuration across team
2. **Communication**: Share issues and solutions
3. **Training**: Ensure all team members are trained
4. **Feedback**: Collect and act on feedback

### Security

1. **Audit**: Enable security audits in pre-push
2. **Updates**: Keep dependencies updated
3. **Monitoring**: Monitor for security issues
4. **Response**: Have incident response plan

### Performance

1. **Optimization**: Enable caching and parallel execution
2. **Monitoring**: Track execution times
3. **Tuning**: Adjust timeouts as needed
4. **Review**: Regularly review and optimize

## Metrics & KPIs

### Success Metrics

- Hook execution success rate
- Average execution time
- Number of bypasses used
- Configuration validation pass rate
- Team satisfaction score

### Monitoring Dashboard

```bash
# Generate metrics report
node -e "
const HookOrchestrator = require('./scripts/hooks/hook-orchestrator');
const orchestrator = new HookOrchestrator();
const metrics = orchestrator.getMetrics();
console.log('Hook Execution Metrics:');
console.log('Success Rate:', (metrics.successRate * 100).toFixed(2) + '%');
console.log('Average Duration:', metrics.averageDuration + 'ms');
console.log('Total Executions:', metrics.totalExecutions);
"
```

## Compliance & Auditing

### Audit Trail

All hook executions and bypasses are logged with:
- Timestamp
- User
- Action
- Result
- Bypass reason (if applicable)

### Compliance Reports

```bash
# Generate compliance report
npm run hooks:report

# View audit trail
cat .husky/logs/audit.log

# Export for compliance
node scripts/hooks/export-audit.js --format csv --output audit-report.csv
```

## Documentation Maintenance

### Update Schedule

- **After each change**: Update relevant documentation
- **Monthly**: Review and update all documentation
- **Quarterly**: Major documentation review
- **Annually**: Complete documentation overhaul

### Documentation Checklist

- [ ] README.md is up to date
- [ ] TROUBLESHOOTING.md includes recent issues
- [ ] QUICK-REFERENCE.md has current commands
- [ ] Configuration examples are accurate
- [ ] Links are working
- [ ] Screenshots are current (if any)

## Contact & Support

For deployment assistance:
- Documentation: `docs/hooks/`
- Team: dev-team@example.com
- Issues: GitHub repository

## License

Part of the BMAD-GitHub Native Full Cycle project.
MIT License - See LICENSE file for details.
