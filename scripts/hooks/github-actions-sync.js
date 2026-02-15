/**
 * GitHub Actions Synchronization Module
 * Maintains consistency between local Git hooks and GitHub Actions workflows
 * Requirements: 7.2
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class GitHubActionsSync {
  constructor(config = {}) {
    this.config = {
      workflowsDir: path.join(process.cwd(), '.github', 'workflows'),
      hooksConfigFile: path.join(process.cwd(), '.husky', 'hooks-config.json'),
      syncReportFile: path.join(
        process.cwd(),
        '.git',
        'github-actions-sync-report.json'
      ),
      ...config,
    };

    this.consistencyHistory = [];
  }

  /**
   * Synchronize local hook configuration with GitHub Actions workflows
   * Requirements: 7.2
   */
  synchronizeConfiguration() {
    try {
      // Read local hooks configuration
      const localConfig = this.getLocalHooksConfig();

      // Read GitHub Actions workflows
      const githubWorkflows = this.getGitHubWorkflows();

      // Compare and identify inconsistencies
      const inconsistencies = this.compareConfigurations(
        localConfig,
        githubWorkflows
      );

      // Generate synchronization report
      const syncReport = {
        timestamp: new Date().toISOString(),
        localConfig,
        githubWorkflows: Object.keys(githubWorkflows),
        inconsistencies,
        consistent: inconsistencies.length === 0,
      };

      // Save report
      this.saveSyncReport(syncReport);

      return syncReport;
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        consistent: false,
      };
    }
  }

  /**
   * Get local hooks configuration
   */
  getLocalHooksConfig() {
    try {
      if (fs.existsSync(this.config.hooksConfigFile)) {
        return JSON.parse(fs.readFileSync(this.config.hooksConfigFile, 'utf8'));
      }
    } catch (error) {
      // Fallback to default configuration
    }

    // Default configuration based on package.json scripts
    return {
      preCommit: {
        linting: true,
        testing: true,
        contextValidation: true,
      },
      prePush: {
        fullTests: true,
        build: false,
        security: true,
      },
    };
  }

  /**
   * Get GitHub Actions workflows configuration
   */
  getGitHubWorkflows() {
    const workflows = {};

    try {
      if (!fs.existsSync(this.config.workflowsDir)) {
        return workflows;
      }

      const workflowFiles = fs
        .readdirSync(this.config.workflowsDir)
        .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));

      for (const file of workflowFiles) {
        const filePath = path.join(this.config.workflowsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const workflow = yaml.load(content);

        workflows[file] = this.extractValidationSteps(workflow);
      }
    } catch (error) {
      // Return empty workflows on error
    }

    return workflows;
  }

  /**
   * Extract validation steps from GitHub Actions workflow
   */
  extractValidationSteps(workflow) {
    const validationSteps = {
      linting: false,
      testing: false,
      build: false,
      security: false,
    };

    if (!workflow.jobs) {
      return validationSteps;
    }

    // Check all jobs for validation steps
    for (const jobName in workflow.jobs) {
      const job = workflow.jobs[jobName];
      if (!job.steps) continue;

      for (const step of job.steps) {
        const stepName = (step.name || '').toLowerCase();
        const stepRun = (step.run || '').toLowerCase();

        if (stepName.includes('lint') || stepRun.includes('npm run lint')) {
          validationSteps.linting = true;
        }
        if (
          stepName.includes('test') ||
          stepRun.includes('npm test') ||
          stepRun.includes('npm run test')
        ) {
          validationSteps.testing = true;
        }
        if (stepName.includes('build') || stepRun.includes('npm run build')) {
          validationSteps.build = true;
        }
        if (
          stepName.includes('audit') ||
          stepName.includes('security') ||
          stepRun.includes('npm audit')
        ) {
          validationSteps.security = true;
        }
      }
    }

    return validationSteps;
  }

  /**
   * Compare local and GitHub Actions configurations
   */
  compareConfigurations(localConfig, githubWorkflows) {
    const inconsistencies = [];

    // Check if any GitHub Actions workflow exists
    if (Object.keys(githubWorkflows).length === 0) {
      inconsistencies.push({
        type: 'missing_workflows',
        message: 'No GitHub Actions workflows found',
        severity: 'warning',
      });
      return inconsistencies;
    }

    // Aggregate all validation steps from all workflows
    const aggregatedGitHub = {
      linting: false,
      testing: false,
      build: false,
      security: false,
    };

    for (const workflowName in githubWorkflows) {
      const workflow = githubWorkflows[workflowName];
      aggregatedGitHub.linting = aggregatedGitHub.linting || workflow.linting;
      aggregatedGitHub.testing = aggregatedGitHub.testing || workflow.testing;
      aggregatedGitHub.build = aggregatedGitHub.build || workflow.build;
      aggregatedGitHub.security =
        aggregatedGitHub.security || workflow.security;
    }

    // Compare pre-commit validations
    if (localConfig.preCommit) {
      if (localConfig.preCommit.linting && !aggregatedGitHub.linting) {
        inconsistencies.push({
          type: 'missing_remote_validation',
          validation: 'linting',
          message: 'Linting enabled locally but not in GitHub Actions',
          severity: 'warning',
        });
      }
      if (localConfig.preCommit.testing && !aggregatedGitHub.testing) {
        inconsistencies.push({
          type: 'missing_remote_validation',
          validation: 'testing',
          message: 'Testing enabled locally but not in GitHub Actions',
          severity: 'warning',
        });
      }
    }

    // Compare pre-push validations
    if (localConfig.prePush) {
      if (localConfig.prePush.build && !aggregatedGitHub.build) {
        inconsistencies.push({
          type: 'missing_remote_validation',
          validation: 'build',
          message: 'Build validation enabled locally but not in GitHub Actions',
          severity: 'warning',
        });
      }
      if (localConfig.prePush.security && !aggregatedGitHub.security) {
        inconsistencies.push({
          type: 'missing_remote_validation',
          validation: 'security',
          message: 'Security audit enabled locally but not in GitHub Actions',
          severity: 'warning',
        });
      }
    }

    return inconsistencies;
  }

  /**
   * Save synchronization report
   */
  saveSyncReport(report) {
    try {
      const reportDir = path.dirname(this.config.syncReportFile);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(
        this.config.syncReportFile,
        JSON.stringify(report, null, 2)
      );
    } catch (error) {
      // Ignore save errors
    }
  }

  /**
   * Monitor validation consistency over time
   * Requirements: 7.2
   */
  monitorConsistency(validationResult) {
    const entry = {
      timestamp: new Date().toISOString(),
      local: validationResult.local || false,
      remote: validationResult.remote || false,
      consistent: validationResult.local === validationResult.remote,
    };

    this.consistencyHistory.push(entry);

    // Keep only last 100 entries
    if (this.consistencyHistory.length > 100) {
      this.consistencyHistory.shift();
    }

    return this.generateConsistencyReport();
  }

  /**
   * Generate consistency monitoring report
   */
  generateConsistencyReport() {
    if (this.consistencyHistory.length === 0) {
      return {
        totalValidations: 0,
        consistencyRate: 0,
        message: 'No validation history available',
      };
    }

    const totalValidations = this.consistencyHistory.length;
    const consistentCount = this.consistencyHistory.filter(
      (e) => e.consistent
    ).length;
    const consistencyRate = consistentCount / totalValidations;

    return {
      totalValidations,
      consistentCount,
      inconsistentCount: totalValidations - consistentCount,
      consistencyRate,
      recentHistory: this.consistencyHistory.slice(-10),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate remote coordination
   * Requirements: 7.2
   */
  validateRemoteCoordination(branch) {
    const syncReport = this.synchronizeConfiguration();

    // Determine if GitHub Actions will run for this branch
    const protectedBranches = ['main', 'develop', 'master'];
    const willRunRemote =
      protectedBranches.includes(branch) || branch.startsWith('feature/');

    return {
      willRunRemote,
      syncReport,
      recommendation: this.getValidationRecommendation(
        willRunRemote,
        syncReport
      ),
    };
  }

  /**
   * Get validation recommendation based on remote coordination
   */
  getValidationRecommendation(willRunRemote, syncReport) {
    if (!willRunRemote) {
      return {
        level: 'comprehensive',
        reason:
          'GitHub Actions will not run for this branch - comprehensive local validation required',
      };
    }

    if (!syncReport.consistent) {
      return {
        level: 'comprehensive',
        reason:
          'Configuration inconsistencies detected - comprehensive local validation recommended',
      };
    }

    return {
      level: 'standard',
      reason:
        'GitHub Actions will run and configurations are consistent - standard validation sufficient',
    };
  }
}

module.exports = GitHubActionsSync;
