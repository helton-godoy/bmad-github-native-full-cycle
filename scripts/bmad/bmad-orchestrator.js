#!/usr/bin/env node
/**
 * @ai-context BMAD Context-Driven Orchestrator
 * @ai-invariant State determines Action, Content drives Context
 * @ai-connection Reads BMAD_HANDOVER.md and activeContext.md to decide next steps
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const ContextManager = require('../lib/context-manager');

const HANDOVER_FILE = '.github/BMAD_HANDOVER.md';
const CONTEXT_FILE = 'activeContext.md';

class BMADOrchestrator {
    constructor(eventEmitter = null) {
        this.githubToken = process.env.GITHUB_TOKEN;
        if (!this.githubToken) {
            console.error('❌ GITHUB_TOKEN environment variable required');
            process.exit(1);
        }
        this.octokit = new Octokit({ auth: this.githubToken });
        this.eventEmitter = eventEmitter;
        this.contextManager = new ContextManager();
    }

    /**
     * @ai-context Main execution entry point
     */
    /**
     * @ai-context Main execution entry point
     */
    async orchestrate(issueNumber) {
        console.log('🚀 BMAD Orchestrator Starting...');

        // 0. Smart State Management
        this.handleStateReset(issueNumber);

        // 1. Read State
        const state = this.loadHandoverState();
        console.log(`📊 Current State: Phase=${state.phase}, Persona=${state.persona}`);

        if (this.eventEmitter) {
            this.eventEmitter.emit('state-loaded', state);
        }

        // 1.5 Fetch Issue Details for Smart Context
        const issue = await this.getIssueDetails(issueNumber);
        const issueType = this.detectIssueType(issue);
        console.log(`🧠 Detected Issue Type: ${issueType}`);

        // 2. Determine Next Action
        const action = await this.determineNextAction(state, issue, issueType);

        if (!action) {
            console.log('✅ No pending actions detected.');
            if (this.eventEmitter) {
                this.eventEmitter.emit('workflow-idle');
            }
            return false;
        }

        console.log(`🎯 Next Action: Execute ${action.persona} with prompt from ${action.source}`);

        if (this.eventEmitter) {
            this.eventEmitter.emit('action-determined', action);
        }

        // 3. Execute Persona
        await this.executePersona(action, issueNumber);

        // 4. Update State
        this.updateHandoverState(action, issueNumber);

        if (this.eventEmitter) {
            this.eventEmitter.emit('phase-completed', {
                persona: action.persona,
                nextPhase: action.nextPhase
            });
        }

        return true;
    }

    /**
     * @ai-context Parse BMAD_HANDOVER.md to get current state
     */
    /**
     * @ai-context Parse BMAD_HANDOVER.md to get current state
     */
    loadHandoverState() {
        const content = this.contextManager.read(HANDOVER_FILE);

        if (!content) {
            // Return default initial state instead of throwing
            return {
                persona: 'UNKNOWN',
                phase: 'UNKNOWN',
                retryCount: 0,
                content: ''
            };
        }

        const personaMatch = content.match(/\*\*\[(.*?)\]\*\*/);
        const phaseMatch = content.match(/Current Phase\s*\n\s*\*\*(.*?)\*\*/);
        const retryMatch = content.match(/Retry Count:\s*(\d+)/);
        const issueMatch = content.match(/Issue:\s*#(\d+)/);

        return {
            persona: personaMatch ? personaMatch[1] : 'UNKNOWN',
            phase: phaseMatch ? phaseMatch[1] : 'UNKNOWN',
            retryCount: retryMatch ? parseInt(retryMatch[1], 10) : 0,
            issueNumber: issueMatch ? parseInt(issueMatch[1], 10) : null,
            content: content
        };
    }

    /**
     * @ai-context Decide next action based on state and artifacts
     */
    /**
     * @ai-context Decide next action based on state and artifacts
     */
    async determineNextAction(state, issue, issueType) {
        const MAX_RETRIES = 3;

        // --- SPECIAL FLOW: AUDIT ---
        if (issueType === 'AUDIT') {
            console.log('🕵️ Processing Audit Flow...');

            // 1. Audit Start: PM
            if (state.persona === 'UNKNOWN' || (state.persona === 'PM' && state.phase === 'UNKNOWN')) {
                return {
                    persona: 'pm',
                    prompt: "AUDIT_MODE: Analyze the project state against productContext.md and generate MASTER_PLAN.md.",
                    source: 'Audit Request',
                    nextPhase: 'Audit Planning',
                    resetRetry: true
                };
            }

            // 2. PM -> Architect (Audit)
            if (state.persona === 'PM' && state.phase === 'Audit Planning') {
                const masterPlanPath = 'docs/planning/MASTER_PLAN.md'; // PM output for audit

                // CRITICAL FIX: Validate MASTER_PLAN existence before transition
                if (fs.existsSync(masterPlanPath)) {
                    console.log('✅ MASTER_PLAN.md validated, transitioning to Architect');
                    return {
                        persona: 'architect',
                        prompt: "AUDIT_MODE: Read MASTER_PLAN.md and create granular GitHub issues for the roadmap.",
                        source: 'MASTER_PLAN.md',
                        nextPhase: 'Audit Breakdown',
                        resetRetry: true
                    };
                } else {
                    // PM failed to generate MASTER_PLAN - retry with limit
                    if (state.retryCount >= MAX_RETRIES) {
                        console.error(`❌ CRITICAL: PM failed to generate MASTER_PLAN.md after ${MAX_RETRIES} attempts.`);
                        throw new Error('Audit flow blocked: MASTER_PLAN.md not generated');
                    }

                    console.warn(`⚠️ MASTER_PLAN.md not found. Retrying PM (Attempt ${state.retryCount + 1}/${MAX_RETRIES})`);
                    return {
                        persona: 'pm',
                        prompt: "RETRY AUDIT_MODE: Analyze project state and generate MASTER_PLAN.md.",
                        source: 'Audit Retry',
                        nextPhase: 'Audit Planning',
                        incrementRetry: true
                    };
                }
            }

            // 3. Architect -> Done (Audit)
            if (state.persona === 'ARCHITECT' && state.phase === 'Audit Breakdown') {
                console.log('✅ Audit Breakdown completed. Issues created.');
                return null; // Audit flow ends here, ready for standard execution of new issues
            }
        }

        // --- STANDARD FLOW ---

        // 1. PM -> Architect
        if (state.persona === 'PM' && state.phase.includes('Planning')) {
            const prdPath = 'docs/planning/PRD-user-authentication.md'; // TODO: Dynamic path
            if (fs.existsSync(prdPath)) {
                const prompt = this.extractSection(prdPath, 'Architect Prompt') || "Design the system architecture based on the PRD.";
                return {
                    persona: 'architect',
                    prompt: prompt,
                    source: prdPath,
                    nextPhase: 'Architecture Design',
                    resetRetry: true
                };
            } else {
                // If PRD doesn't exist, run PM
                if (state.retryCount >= MAX_RETRIES) {
                    console.error(`❌ CRITICAL: PM Loop detected. Failed to generate PRD after ${MAX_RETRIES} attempts.`);
                    return null; // Stop execution
                }

                console.warn(`⚠️ PRD not found. Retrying PM (Attempt ${state.retryCount + 1}/${MAX_RETRIES})`);
                return {
                    persona: 'pm',
                    prompt: "Analyze the issue and create a PRD.",
                    source: 'System Init',
                    nextPhase: 'Planning',
                    incrementRetry: true
                };
            }
        }

        // 2. Architect -> Developer
        if (state.persona === 'ARCHITECT') {
            const specPath = 'docs/architecture/SPEC-user-authentication.md'; // TODO: Dynamic path
            if (fs.existsSync(specPath)) {
                return {
                    persona: 'developer',
                    prompt: "Implement the specification defined in " + specPath,
                    source: specPath,
                    nextPhase: 'Implementation',
                    resetRetry: true
                };
            }
        }

        // 3. Developer -> QA
        if (state.persona === 'DEVELOPER') {
            // Assuming Developer produces code and maybe a PR reference in context
            // For now, we transition to QA to test the implementation
            return {
                persona: 'qa',
                prompt: "Verify the implementation against the PRD and Architecture Spec.",
                source: 'Implementation',
                nextPhase: 'Quality Assurance',
                resetRetry: true
            };
        }

        // 4. QA -> Security
        if (state.persona === 'QA') {
            // Assuming QA produces a test report
            return {
                persona: 'security',
                prompt: "Perform a security review of the code and dependencies.",
                source: 'QA Report',
                nextPhase: 'Security Review',
                resetRetry: true
            };
        }

        // 5. Security -> DevOps
        if (state.persona === 'SECURITY') {
            // Assuming Security produces a security audit
            return {
                persona: 'devops',
                prompt: "Prepare the deployment pipeline and infrastructure.",
                source: 'Security Audit',
                nextPhase: 'DevOps & Deployment',
                resetRetry: true
            };
        }

        // 6. DevOps -> Release Manager
        if (state.persona === 'DEVOPS') {
            // Assuming DevOps confirms deployment readiness
            return {
                persona: 'releasemanager',
                prompt: "Coordinate the final release, close the issue, and publish release notes.",
                source: 'Deployment Readiness',
                nextPhase: 'Release Management',
                resetRetry: true
            };
        }

        // 7. Release Manager -> Done
        if (state.persona === 'RELEASEMANAGER') {
            // Workflow is complete
            return null;
        }

        // Default: Start with PM if unknown
        if (state.persona === 'UNKNOWN') {
            return {
                persona: 'pm',
                prompt: "Analyze the issue and create a PRD.",
                source: 'System Init',
                nextPhase: 'Planning',
                resetRetry: true
            };
        }

        return null;
    }

    /**
     * @ai-context Extract specific section from markdown file
     */
    extractSection(filePath, sectionTitle) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const regex = new RegExp(`## ${sectionTitle}\\s*([\\s\\S]*?)(?=##|$)`, 'i');
        const match = content.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * @ai-context Execute the determined persona
     */
    async executePersona(action, issueNumber) {
        const personaMapping = {
            'pm': 'project-manager',
            'architect': 'architect',
            'developer': 'developer-enhanced',
            'qa': 'qa',
            'security': 'security',
            'devops': 'devops',
            'releasemanager': 'release-manager'
        };

        const fileName = personaMapping[action.persona.toLowerCase()] || action.persona;
        const PersonaClass = require(`../../personas/${fileName}`);
        const persona = new PersonaClass(this.githubToken);

        console.log(`🤖 Activating Persona: ${action.persona} (${fileName}.js)`);
        // In a real implementation, we would pass the prompt to the persona
        // For now, we assume the persona knows what to do based on context or issue
        // But the Orchestrator ensures the *timing* is right.

        // Assuming personas have an 'execute' method that takes an issue number or context
        // We might need to standardize this interface.
        // For this MVP, we'll assume we are working on Issue #1 (hardcoded for now, or read from context)
        await persona.execute(issueNumber);
    }

    /**
     * @ai-context Update BMAD_HANDOVER.md with new state
     */
    updateHandoverState(action, issueNumber) {
        let content = this.contextManager.read(HANDOVER_FILE) || '';

        if (!content) {
            // Create initial content if not exists
            content = `# BMAD Handover State\n\nCurrent Persona: **[UNKNOWN]**\nCurrent Phase\n\n**UNKNOWN**\n\nRetry Count: 0\nIssue: #${issueNumber}`;
        }

        // Update Persona
        if (content.match(/\*\*\[(.*?)\]\*\*/)) {
            content = content.replace(
                /\*\*\[(.*?)\]\*\*/,
                `**[${action.persona.toUpperCase()}]**`
            );
        } else {
            content += `\nCurrent Persona: **[${action.persona.toUpperCase()}]**`;
        }

        // Update Phase
        if (content.match(/Current Phase\s*\n\s*\*\*(.*?)\*\*/)) {
            content = content.replace(
                /Current Phase\s*\n\s*\*\*(.*?)\*\*/,
                `Current Phase\n\n**${action.nextPhase}**`
            );
        } else {
            content += `\nCurrent Phase\n\n**${action.nextPhase}**`;
        }

        // Update Issue Number
        if (content.includes('Issue:')) {
            content = content.replace(/Issue:\s*#\d+/, `Issue: #${issueNumber}`);
        } else {
            content += `\nIssue: #${issueNumber}`;
        }

        // Update Retry Count
        let currentRetry = 0;
        const retryMatch = content.match(/Retry Count:\s*(\d+)/);
        if (retryMatch) {
            currentRetry = parseInt(retryMatch[1], 10);
        }

        let nextRetry = currentRetry;
        if (action.resetRetry) {
            nextRetry = 0;
        } else if (action.incrementRetry) {
            nextRetry = currentRetry + 1;
        }

        if (content.includes('Retry Count:')) {
            content = content.replace(/Retry Count:\s*\d+/, `Retry Count: ${nextRetry}`);
        } else {
            content += `\n\nRetry Count: ${nextRetry}`;
        }

        this.contextManager.write(HANDOVER_FILE, content);
        console.log('📝 Handover State Updated (Atomic)');
    }

    /**
     * @ai-context Handle state reset if issue number changes
     */
    handleStateReset(issueNumber) {
        const content = this.contextManager.read(HANDOVER_FILE);

        if (content) {
            const issueMatch = content.match(/Issue:\s*#(\d+)/);
            const storedIssue = issueMatch ? parseInt(issueMatch[1], 10) : null;

            if (storedIssue && storedIssue !== issueNumber) {
                console.log(`🔄 New Issue detected (Current: #${issueNumber}, Stored: #${storedIssue}). Resetting state.`);
                // We overwrite with empty or delete. ContextManager doesn't have delete yet, so we write empty or specific reset content.
                // Or we can just ignore it as loadHandoverState handles empty/missing.
                // But to be clean, let's write a reset state.
                const resetContent = `# BMAD Handover State\n\nCurrent Persona: **[UNKNOWN]**\nCurrent Phase\n\n**RESET**\n\nRetry Count: 0\nIssue: #${issueNumber}`;
                this.contextManager.write(HANDOVER_FILE, resetContent);
            }
        }
    }

    /**
     * @ai-context Get issue details from GitHub
     */
    async getIssueDetails(issueNumber) {
        try {
            const issue = await this.octokit.rest.issues.get({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'shantilly-cli',
                issue_number: issueNumber
            });
            return issue.data;
        } catch (error) {
            console.error(`❌ Failed to fetch issue #${issueNumber}: ${error.message}`);
            // Return dummy for robustness if offline/error
            return { title: 'Unknown', body: '', number: issueNumber };
        }
    }

    /**
     * @ai-context Detect issue type based on title/labels
     */
    detectIssueType(issue) {
        const title = issue.title.toLowerCase();
        if (title.includes('[audit]') || title.includes('audit:')) return 'AUDIT';
        if (title.includes('bug') || title.includes('fix:')) return 'BUG';
        return 'FEATURE';
    }
}

// Run if called directly
if (require.main === module) {
    const orchestrator = new BMADOrchestrator();
    orchestrator.orchestrate().catch(console.error);
}

module.exports = BMADOrchestrator;
