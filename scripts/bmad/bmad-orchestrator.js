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

const HANDOVER_FILE = '.github/BMAD_HANDOVER.md';
const CONTEXT_FILE = 'activeContext.md';

class BMADOrchestrator {
    constructor() {
        this.githubToken = process.env.GITHUB_TOKEN;
        if (!this.githubToken) {
            console.error('❌ GITHUB_TOKEN environment variable required');
            process.exit(1);
        }
        this.octokit = new Octokit({ auth: this.githubToken });
    }

    /**
     * @ai-context Main execution entry point
     */
    async orchestrate() {
        console.log('🚀 BMAD Orchestrator Starting...');

        // 1. Read State
        const state = this.loadHandoverState();
        console.log(`📊 Current State: Phase=${state.phase}, Persona=${state.persona}`);

        // 2. Determine Next Action
        const action = await this.determineNextAction(state);

        if (!action) {
            console.log('✅ No pending actions detected.');
            return;
        }

        console.log(`🎯 Next Action: Execute ${action.persona} with prompt from ${action.source}`);

        // 3. Execute Persona
        await this.executePersona(action);

        // 4. Update State
        this.updateHandoverState(action);
    }

    /**
     * @ai-context Parse BMAD_HANDOVER.md to get current state
     */
    loadHandoverState() {
        if (!fs.existsSync(HANDOVER_FILE)) {
            throw new Error(`${HANDOVER_FILE} not found!`);
        }

        const content = fs.readFileSync(HANDOVER_FILE, 'utf-8');

        const personaMatch = content.match(/\*\*\[(.*?)\]\*\*/);
        const phaseMatch = content.match(/Current Phase\s*\n\s*\*\*(.*?)\*\*/);

        return {
            persona: personaMatch ? personaMatch[1] : 'UNKNOWN',
            phase: phaseMatch ? phaseMatch[1] : 'UNKNOWN',
            content: content
        };
    }

    /**
     * @ai-context Decide next action based on state and artifacts
     */
    async determineNextAction(state) {
        // Logic mapping Phase -> Next Persona
        // This is where the "Bmad-Method" logic lives

        // Example: If PM just finished PRD, next is Architect
        if (state.persona === 'PM' && state.phase.includes('Planning')) {
            const prdPath = 'docs/planning/PRD-user-authentication.md'; // TODO: Dynamic path

            if (fs.existsSync(prdPath)) {
                const prompt = this.extractSection(prdPath, 'Architect Prompt');
                if (prompt) {
                    return {
                        persona: 'architect',
                        prompt: prompt,
                        source: prdPath,
                        nextPhase: 'Architecture Design'
                    };
                }
            } else {
                // If PRD doesn't exist, we need to run the PM to create it
                return {
                    persona: 'pm',
                    prompt: "Analyze the issue and create a PRD.",
                    source: 'System Init',
                    nextPhase: 'Planning'
                };
            }
        }

        // Example: If Architect finished Spec, next is Developer
        if (state.persona === 'ARCHITECT') {
            const specPath = 'docs/architecture/SPEC-user-authentication.md'; // TODO: Dynamic path
            if (fs.existsSync(specPath)) {
                // In a real scenario, we might look for "Developer Prompt" or similar
                // For now, let's assume standard flow
                return {
                    persona: 'developer',
                    prompt: "Implement the specification defined in " + specPath,
                    source: specPath,
                    nextPhase: 'Implementation'
                };
            }
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
    async executePersona(action) {
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
        await persona.execute(1);
    }

    /**
     * @ai-context Update BMAD_HANDOVER.md with new state
     */
    updateHandoverState(action) {
        let content = fs.readFileSync(HANDOVER_FILE, 'utf-8');

        // Update Persona
        content = content.replace(
            /\*\*\[(.*?)\]\*\*/,
            `**[${action.persona.toUpperCase()}]**`
        );

        // Update Phase
        content = content.replace(
            /Current Phase\s*\n\s*\*\*(.*?)\*\*/,
            `Current Phase\n\n**${action.nextPhase}**`
        );

        fs.writeFileSync(HANDOVER_FILE, content);
        console.log('📝 Handover State Updated');
    }
}

// Run if called directly
if (require.main === module) {
    const orchestrator = new BMADOrchestrator();
    orchestrator.orchestrate().catch(console.error);
}

module.exports = BMADOrchestrator;
