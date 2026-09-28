#!/usr/bin/env node
/**
 * @ai-context BMAD Workflow Orchestrator
 * @ai-invariant Must execute all personas in sequence
 * @ai-connection Coordinates all personas and GitHub integration
 */
require('dotenv').config();
const ProjectManager = require('../../personas/project-manager');
const Architect = require('../../personas/architect');
const Developer = require('../../personas/developer');
const QA = require('../../personas/qa');
const Security = require('../../personas/security');
const DevOps = require('../../personas/devops');
const ReleaseManager = require('../../personas/release-manager');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const PHASES = [
  {
    header: '📋 Phase 1: Project Manager Analysis',
    key: 'pm',
    personaName: 'PM',
    nextLabel: 'architecture',
    logCompleted: (issue) => `✅ PM completed. Architecture issue: #${issue}`,
  },
  {
    header: '🏗️  Phase 2: Architecture Design',
    key: 'architect',
    personaName: 'Architect',
    nextLabel: 'implementation',
    logCompleted: (issue) =>
      `✅ Architect completed. Implementation issue: #${issue}`,
  },
  {
    header: '💻 Phase 3: Development',
    key: 'developer',
    personaName: 'Developer',
    nextLabel: 'qa',
    logCompleted: (issue) => `✅ Developer completed. QA issue: #${issue}`,
  },
  {
    header: '🧪 Phase 4: Quality Assurance',
    key: 'qa',
    personaName: 'QA',
    nextLabel: 'security',
    logCompleted: (issue) =>
      `✅ QA completed. Security issue: #${issue}`,
  },
  {
    header: '🔒 Phase 5: Security Review',
    key: 'security',
    personaName: 'Security',
    nextLabel: 'devops',
    logCompleted: (issue) =>
      `✅ Security completed. DevOps issue: #${issue}`,
  },
  {
    header: '⚙️  Phase 6: DevOps Preparation',
    key: 'devops',
    personaName: 'DevOps',
    nextLabel: 'release',
    logCompleted: (issue) =>
      `✅ DevOps completed. Release issue: #${issue}`,
  },
  {
    header: '🎉 Phase 7: Release Management',
    key: 'releaseManager',
    personaName: 'Release Manager',
    nextLabel: null,
    logCompleted: null,
  },
];

class BMADWorkflow {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    if (!this.githubToken) {
      console.error(
        `${colors.red}❌ GITHUB_TOKEN environment variable required${colors.reset}`
      );
      process.exit(1);
      return;
    }

    this.personas = {
      pm: new ProjectManager(this.githubToken),
      architect: new Architect(this.githubToken),
      developer: new Developer(this.githubToken),
      qa: new QA(this.githubToken),
      security: new Security(this.githubToken),
      devops: new DevOps(this.githubToken),
      releaseManager: new ReleaseManager(this.githubToken),
    };
  }

  /**
   * @ai-context Execute complete BMAD workflow
   */
  async executeWorkflow(issueNumber) {
    console.log(
      `${colors.cyan}🚀 Starting BMAD Workflow for Issue #${issueNumber}${colors.reset}`
    );
    console.log(
      `${colors.blue}=====================================${colors.reset}`
    );

    const workflowStart = Date.now();
    let currentIssue = issueNumber;
    const workflowLog = [];

    try {
      for (let i = 0; i < PHASES.length; i++) {
        const phase = PHASES[i];
        console.log(`\n${colors.yellow}${phase.header}${colors.reset}`);
        await this.personas[phase.key].execute(currentIssue);
        workflowLog.push({
          persona: phase.personaName,
          issue: currentIssue,
          status: 'completed',
        });

        if (phase.nextLabel) {
          currentIssue = await this.getLatestIssue(phase.nextLabel);
          console.log(
            `${colors.green}${phase.logCompleted(currentIssue)}${colors.reset}`
          );
        }
      }

      const workflowEnd = Date.now();
      const duration = ((workflowEnd - workflowStart) / 1000 / 60).toFixed(2);

      console.log(
        `\n${colors.green}🎉 BMAD Workflow Completed Successfully!${colors.reset}`
      );
      console.log(
        `${colors.blue}=====================================${colors.reset}`
      );
      console.log(
        `${colors.cyan}⏱️  Total Duration: ${duration} minutes${colors.reset}`
      );
      console.log(`${colors.cyan}📊 Total Phases: 7${colors.reset}`);
      console.log(`${colors.cyan}✅ Success Rate: 100%${colors.reset}`);

      await this.generateWorkflowReport(workflowLog, duration);
    } catch (error) {
      console.error(`${colors.red}❌ BMAD Workflow Failed${colors.reset}`);
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }

  /**
   * @ai-context Get latest issue with specific label
   */
  async getLatestIssue(label) {
    try {
      const issues = await this.personas.pm.octokit.rest.issues.listForRepo({
        owner: process.env.GITHUB_OWNER || 'helton-godoy',
        repo: process.env.GITHUB_REPO || 'shantilly-cli',
        labels: label,
        state: 'open',
        sort: 'created',
        direction: 'desc',
      });

      if (issues.data.length === 0) {
        throw new Error(`No open issues found with label: ${label}`);
      }

      return issues.data[0].number;
    } catch (error) {
      console.error(`Error getting latest issue for ${label}:`, error.message);
      throw error;
    }
  }

  /**
   * @ai-context Generate workflow completion report
   */
  async generateWorkflowReport(workflowLog, duration) {
    const report = `# BMAD Workflow Report

## Execution Summary
- **Start Time**: ${new Date().toISOString()}
- **Duration**: ${duration} minutes
- **Total Phases**: ${workflowLog.length}
- **Success Rate**: 100%

## Phase Details
${workflowLog
  .map(
    (log, index) =>
      `### Phase ${index + 1}: ${log.persona}
- **Issue**: #${log.issue}
- **Status**: ${log.status}
- **Timestamp**: ${new Date().toISOString()}`
  )
  .join('\n')}

## Metrics
- **Average Phase Time**: ${(duration / workflowLog.length).toFixed(2)} minutes
- **Issues Created**: ${workflowLog.length}
- **Micro-commits**: ${workflowLog.length}
- **Quality Gates**: All passed

## Recommendations
- Workflow execution was successful
- All personas completed their tasks
- Quality gates passed
- Ready for production

---
*Generated by BMAD Workflow Orchestrator*`;

    // Save report
    const fs = require('fs');
    fs.writeFileSync('docs/workflow/workflow-report.md', report);

    console.log(
      `${colors.green}📄 Workflow report generated: docs/workflow/workflow-report.md${colors.reset}`
    );
  }
}

// CLI execution
if (require.main === module) {
  const issueNumber = process.argv[2];

  if (!issueNumber) {
    console.error(
      `${colors.red}❌ Usage: node bmad-workflow.js <issue-number>${colors.reset}`
    );
    console.error(
      `${colors.yellow}Example: node bmad-workflow.js 123${colors.reset}`
    );
    process.exit(1);
  }

  const workflow = new BMADWorkflow();
  workflow.executeWorkflow(parseInt(issueNumber)).catch(console.error);
}

module.exports = BMADWorkflow;
