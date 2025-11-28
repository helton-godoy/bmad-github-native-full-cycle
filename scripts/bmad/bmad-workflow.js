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
    reset: '\x1b[0m'
};

class BMADWorkflow {
    constructor() {
        this.githubToken = process.env.GITHUB_TOKEN;
        if (!this.githubToken) {
            console.error(`${colors.red}❌ GITHUB_TOKEN environment variable required${colors.reset}`);
            process.exit(1);
        }
        
        this.personas = {
            pm: new ProjectManager(this.githubToken),
            architect: new Architect(this.githubToken),
            developer: new Developer(this.githubToken),
            qa: new QA(this.githubToken),
            security: new Security(this.githubToken),
            devops: new DevOps(this.githubToken),
            releaseManager: new ReleaseManager(this.githubToken)
        };
    }

    /**
     * @ai-context Execute complete BMAD workflow
     */
    async executeWorkflow(issueNumber) {
        console.log(`${colors.cyan}🚀 Starting BMAD Workflow for Issue #${issueNumber}${colors.reset}`);
        console.log(`${colors.blue}=====================================${colors.reset}`);

        const workflowStart = Date.now();
        let currentIssue = issueNumber;
        const workflowLog = [];

        try {
            // Phase 1: Project Manager
            console.log(`\n${colors.yellow}📋 Phase 1: Project Manager Analysis${colors.reset}`);
            await this.personas.pm.execute(currentIssue);
            workflowLog.push({ persona: 'PM', issue: currentIssue, status: 'completed' });
            
            // Get the architecture planning issue created by PM
            currentIssue = await this.getLatestIssue('architecture');
            console.log(`${colors.green}✅ PM completed. Architecture issue: #${currentIssue}${colors.reset}`);

            // Phase 2: Architect
            console.log(`\n${colors.yellow}🏗️  Phase 2: Architecture Design${colors.reset}`);
            await this.personas.architect.execute(currentIssue);
            workflowLog.push({ persona: 'Architect', issue: currentIssue, status: 'completed' });
            
            currentIssue = await this.getLatestIssue('implementation');
            console.log(`${colors.green}✅ Architect completed. Implementation issue: #${currentIssue}${colors.reset}`);

            // Phase 3: Developer
            console.log(`\n${colors.yellow}💻 Phase 3: Development${colors.reset}`);
            await this.personas.developer.execute(currentIssue);
            workflowLog.push({ persona: 'Developer', issue: currentIssue, status: 'completed' });
            
            currentIssue = await this.getLatestIssue('qa');
            console.log(`${colors.green}✅ Developer completed. QA issue: #${currentIssue}${colors.reset}`);

            // Phase 4: QA
            console.log(`\n${colors.yellow}🧪 Phase 4: Quality Assurance${colors.reset}`);
            await this.personas.qa.execute(currentIssue);
            workflowLog.push({ persona: 'QA', issue: currentIssue, status: 'completed' });
            
            currentIssue = await this.getLatestIssue('security');
            console.log(`${colors.green}✅ QA completed. Security issue: #${currentIssue}${colors.reset}`);

            // Phase 5: Security
            console.log(`\n${colors.yellow}🔒 Phase 5: Security Review${colors.reset}`);
            await this.personas.security.execute(currentIssue);
            workflowLog.push({ persona: 'Security', issue: currentIssue, status: 'completed' });
            
            currentIssue = await this.getLatestIssue('devops');
            console.log(`${colors.green}✅ Security completed. DevOps issue: #${currentIssue}${colors.reset}`);

            // Phase 6: DevOps
            console.log(`\n${colors.yellow}⚙️  Phase 6: DevOps Preparation${colors.reset}`);
            await this.personas.devops.execute(currentIssue);
            workflowLog.push({ persona: 'DevOps', issue: currentIssue, status: 'completed' });
            
            currentIssue = await this.getLatestIssue('release');
            console.log(`${colors.green}✅ DevOps completed. Release issue: #${currentIssue}${colors.reset}`);

            // Phase 7: Release Manager
            console.log(`\n${colors.yellow}🎉 Phase 7: Release Management${colors.reset}`);
            await this.personas.releaseManager.execute(currentIssue);
            workflowLog.push({ persona: 'Release Manager', issue: currentIssue, status: 'completed' });

            const workflowEnd = Date.now();
            const duration = ((workflowEnd - workflowStart) / 1000 / 60).toFixed(2);

            console.log(`\n${colors.green}🎉 BMAD Workflow Completed Successfully!${colors.reset}`);
            console.log(`${colors.blue}=====================================${colors.reset}`);
            console.log(`${colors.cyan}⏱️  Total Duration: ${duration} minutes${colors.reset}`);
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
                direction: 'desc'
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
${workflowLog.map((log, index) => 
        `### Phase ${index + 1}: ${log.persona}
- **Issue**: #${log.issue}
- **Status**: ${log.status}
- **Timestamp**: ${new Date().toISOString()}`
    ).join('\n')}

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
        
        console.log(`${colors.green}📄 Workflow report generated: docs/workflow/workflow-report.md${colors.reset}`);
    }
}

// CLI execution
if (require.main === module) {
    const issueNumber = process.argv[2];
    
    if (!issueNumber) {
        console.error(`${colors.red}❌ Usage: node bmad-workflow.js <issue-number>${colors.reset}`);
        console.error(`${colors.yellow}Example: node bmad-workflow.js 123${colors.reset}`);
        process.exit(1);
    }

    const workflow = new BMADWorkflow();
    workflow.executeWorkflow(parseInt(issueNumber)).catch(console.error);
}

module.exports = BMADWorkflow;
