/**
 * @ai-context Context Synchronizer for BMAD Git Hooks Automation
 * @ai-invariant Maintains consistency between activeContext.md and BMAD workflow state
 * @ai-connection Integrates with Hook Orchestrator and Context Manager for context management
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('../lib/logger');
const ContextManager = require('../lib/context-manager');

/**
 * Context Synchronizer
 * Manages activeContext.md updates, persona state synchronization, and context consistency validation
 * Requirements: 4.4, 5.4, 7.3
 */
class ContextSynchronizer {
    constructor(options = {}) {
        this.logger = new Logger('ContextSynchronizer');
        this.contextManager = new ContextManager();

        // Configuration options
        this.config = {
            contextFile: 'activeContext.md',
            autoUpdate: options.autoUpdate !== false, // Default true
            validateConsistency: options.validateConsistency !== false, // Default true
            trackPersonaTransitions: options.trackPersonaTransitions !== false, // Default true
            maxContextHistory: options.maxContextHistory || 10,
            ...options
        };

        // Valid BMAD personas for validation
        this.validPersonas = [
            'DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS',
            'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'
        ];

        // Valid persona transitions in BMAD workflow
        this.validTransitions = {
            'PM': ['ARCHITECT', 'DEVELOPER', 'QA'],
            'ARCHITECT': ['DEVELOPER', 'PM', 'SECURITY'],
            'DEVELOPER': ['QA', 'ARCHITECT', 'DEVOPS'],
            'QA': ['DEVELOPER', 'DEVOPS', 'RELEASE'],
            'DEVOPS': ['DEVELOPER', 'QA', 'SECURITY', 'RELEASE'],
            'SECURITY': ['DEVELOPER', 'ARCHITECT', 'DEVOPS'],
            'RELEASE': ['PM', 'QA', 'DEVOPS'],
            'RECOVERY': ['DEVELOPER', 'ARCHITECT', 'DEVOPS'],
            'ORCHESTRATOR': ['PM', 'ARCHITECT', 'DEVELOPER', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE']
        };
    }

    /**
     * Update activeContext.md with commit information
     * Requirements: 4.4
     * @param {Object} commitInfo - Information about the commit
     * @returns {Promise<Object>} - Update result
     */
    async updateActiveContext(commitInfo) {
        this.logger.info(`Updating activeContext.md for commit: ${commitInfo.hash || 'staged'}`);

        try {
            const contextPath = path.join(process.cwd(), this.config.contextFile);
            const timestamp = new Date().toISOString();

            // Prepare context update
            const contextUpdate = {
                timestamp,
                commit: commitInfo,
                persona: commitInfo.persona || this.extractPersonaFromMessage(commitInfo.message),
                stepId: commitInfo.stepId || this.extractStepIdFromMessage(commitInfo.message),
                workflowPhase: this.determineWorkflowPhase(commitInfo),
                changedFiles: commitInfo.changedFiles || this.getChangedFiles(),
                summary: this.generateCommitSummary(commitInfo)
            };

            // Read existing context or create new
            let existingContext = '';
            let contextExists = false;

            if (fs.existsSync(contextPath)) {
                existingContext = await this.contextManager.read(this.config.contextFile);
                contextExists = true;
            }

            // Generate updated context content
            const updatedContext = this.generateUpdatedContext(existingContext, contextUpdate);

            // Write updated context using ContextManager for atomic operations
            const writeHash = await this.contextManager.write(this.config.contextFile, updatedContext);

            this.logger.info(`Context updated successfully. Hash: ${writeHash.substring(0, 8)}`);

            return {
                success: true,
                contextExists,
                contextPath,
                writeHash,
                update: contextUpdate,
                contentLength: updatedContext.length
            };

        } catch (error) {
            this.logger.error(`Failed to update activeContext.md: ${error.message}`);
            return {
                success: false,
                error: error.message,
                contextExists: false
            };
        }
    }

    /**
     * Synchronize persona state across BMAD components
     * Requirements: 5.4, 7.3
     * @param {string} persona - Current persona
     * @param {string} stepId - Current step ID
     * @returns {Promise<Object>} - Synchronization result
     */
    async syncPersonaState(persona, stepId) {
        this.logger.info(`Synchronizing persona state: ${persona} [${stepId}]`);

        try {
            const syncResults = {
                personaValidation: { valid: false },
                transitionValidation: { valid: false },
                contextSync: { success: false },
                handoverSync: { success: false }
            };

            // 1. Validate persona
            syncResults.personaValidation = this.validatePersona(persona);

            // 2. Validate persona transition
            syncResults.transitionValidation = await this.validatePersonaTransition(persona);

            // 3. Sync with activeContext.md
            syncResults.contextSync = await this.syncContextWithPersona(persona, stepId);

            // 4. Sync with BMAD handover state
            syncResults.handoverSync = await this.syncBMADHandover(persona, stepId);

            const allValid = Object.values(syncResults).every(result =>
                result.valid !== false && result.success !== false
            );

            return {
                success: allValid,
                persona,
                stepId,
                timestamp: new Date().toISOString(),
                results: syncResults,
                message: allValid ? 'Persona state synchronized successfully' : 'Persona state synchronization completed with issues'
            };

        } catch (error) {
            this.logger.error(`Persona state synchronization failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                persona,
                stepId
            };
        }
    }

    /**
     * Validate context consistency across the system
     * Requirements: 4.4, 5.4, 7.3
     * @returns {Promise<Object>} - Consistency validation result
     */
    async validateContextConsistency() {
        this.logger.info('Validating context consistency across BMAD components');

        try {
            const validationResults = {
                contextFileExists: false,
                contextContent: null,
                personaConsistency: { consistent: false },
                workflowConsistency: { consistent: false },
                handoverConsistency: { consistent: false },
                gitStateConsistency: { consistent: false }
            };

            // 1. Check if activeContext.md exists and is readable
            const contextPath = path.join(process.cwd(), this.config.contextFile);
            validationResults.contextFileExists = fs.existsSync(contextPath);

            if (validationResults.contextFileExists) {
                validationResults.contextContent = await this.contextManager.read(this.config.contextFile);
            }

            // 2. Validate persona consistency
            validationResults.personaConsistency = await this.validatePersonaConsistency(validationResults.contextContent);

            // 3. Validate workflow consistency
            validationResults.workflowConsistency = await this.validateWorkflowConsistency(validationResults.contextContent);

            // 4. Validate BMAD handover consistency
            validationResults.handoverConsistency = await this.validateHandoverConsistency(validationResults.contextContent);

            // 5. Validate git state consistency
            validationResults.gitStateConsistency = await this.validateGitStateConsistency(validationResults.contextContent);

            const overallConsistent = validationResults.contextFileExists &&
                validationResults.personaConsistency.consistent &&
                validationResults.workflowConsistency.consistent &&
                validationResults.handoverConsistency.consistent &&
                validationResults.gitStateConsistency.consistent;

            return {
                consistent: overallConsistent,
                timestamp: new Date().toISOString(),
                results: validationResults,
                recommendations: this.generateConsistencyRecommendations(validationResults)
            };

        } catch (error) {
            this.logger.error(`Context consistency validation failed: ${error.message}`);
            return {
                consistent: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                results: {}
            };
        }
    }

    /**
     * Extract persona from commit message
     * @private
     * @param {string} message - Commit message
     * @returns {string|null} - Extracted persona or null
     */
    extractPersonaFromMessage(message) {
        if (!message) return null;

        const bmadPattern = /^\[([A-Z_]+)\]/;
        const match = bmadPattern.exec(message.trim());
        return match ? match[1] : null;
    }

    /**
     * Extract step ID from commit message
     * @private
     * @param {string} message - Commit message
     * @returns {string|null} - Extracted step ID or null
     */
    extractStepIdFromMessage(message) {
        if (!message) return null;

        const stepIdPattern = /\[([A-Z]+-\d+)\]/;
        const match = stepIdPattern.exec(message.trim());
        return match ? match[1] : null;
    }

    /**
     * Determine workflow phase from commit information
     * @private
     * @param {Object} commitInfo - Commit information
     * @returns {string} - Workflow phase
     */
    determineWorkflowPhase(commitInfo) {
        const persona = commitInfo.persona || this.extractPersonaFromMessage(commitInfo.message);
        const message = commitInfo.message || '';

        // Map personas to workflow phases
        const personaPhaseMap = {
            'PM': 'planning',
            'ARCHITECT': 'design',
            'DEVELOPER': 'implementation',
            'QA': 'testing',
            'DEVOPS': 'deployment',
            'SECURITY': 'security-review',
            'RELEASE': 'release',
            'RECOVERY': 'maintenance',
            'ORCHESTRATOR': 'coordination'
        };

        // Check message content for phase indicators
        const messagePhases = [
            { pattern: /planning|requirements|analysis/i, phase: 'planning' },
            { pattern: /design|architecture|modeling/i, phase: 'design' },
            { pattern: /implementation|coding|development/i, phase: 'implementation' },
            { pattern: /testing|qa|validation/i, phase: 'testing' },
            { pattern: /deployment|release|production/i, phase: 'deployment' },
            { pattern: /security|audit|vulnerability/i, phase: 'security-review' },
            { pattern: /maintenance|support|monitoring/i, phase: 'maintenance' }
        ];

        // Check message content first
        for (const { pattern, phase } of messagePhases) {
            if (pattern.test(message)) {
                return phase;
            }
        }

        // Fallback to persona mapping
        return personaPhaseMap[persona] || 'unknown';
    }

    /**
     * Get list of changed files from git
     * @private
     * @returns {Array<string>} - List of changed files
     */
    getChangedFiles() {
        try {
            // Get staged files first
            let files = execSync('git diff --cached --name-only', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim().split('\n').filter(f => f.length > 0);

            // If no staged files, get modified files
            if (files.length === 0) {
                files = execSync('git diff --name-only', {
                    encoding: 'utf8',
                    stdio: 'pipe'
                }).trim().split('\n').filter(f => f.length > 0);
            }

            return files;
        } catch (error) {
            this.logger.warn(`Could not get changed files: ${error.message}`);
            return [];
        }
    }

    /**
     * Generate commit summary from commit information
     * @private
     * @param {Object} commitInfo - Commit information
     * @returns {string} - Generated summary
     */
    generateCommitSummary(commitInfo) {
        const persona = commitInfo.persona || this.extractPersonaFromMessage(commitInfo.message);
        const stepId = commitInfo.stepId || this.extractStepIdFromMessage(commitInfo.message);
        const changedFiles = commitInfo.changedFiles || this.getChangedFiles();
        const message = commitInfo.message || '';

        let summary = `${persona || 'Unknown'} persona`;

        if (stepId) {
            summary += ` working on ${stepId}`;
        }

        if (changedFiles.length > 0) {
            summary += ` - modified ${changedFiles.length} file(s)`;
            if (changedFiles.length <= 3) {
                summary += ` (${changedFiles.join(', ')})`;
            }
        }

        // Extract description from BMAD message
        const bmadPattern = /^\[([A-Z_]+)\] \[([A-Z]+-\d+)\] (.+)$/;
        const match = bmadPattern.exec(message.trim());
        if (match) {
            const description = match[3];
            summary += ` - ${description}`;
        }

        return summary;
    }

    /**
     * Generate updated context content
     * @private
     * @param {string} existingContext - Existing context content
     * @param {Object} contextUpdate - New context update
     * @returns {string} - Updated context content
     */
    generateUpdatedContext(existingContext, contextUpdate) {
        const timestamp = contextUpdate.timestamp;
        const header = `# Active Context - BMAD Workflow\n\n**Last Updated:** ${timestamp}\n\n`;

        // Current work section
        let currentWork = '## Current Work\n\n';
        currentWork += `**Persona:** ${contextUpdate.persona || 'Unknown'}\n`;
        currentWork += `**Step ID:** ${contextUpdate.stepId || 'N/A'}\n`;
        currentWork += `**Workflow Phase:** ${contextUpdate.workflowPhase}\n`;
        currentWork += `**Summary:** ${contextUpdate.summary}\n\n`;

        // Recent changes section
        let recentChanges = '## Recent Changes\n\n';
        if (contextUpdate.changedFiles && contextUpdate.changedFiles.length > 0) {
            recentChanges += '**Modified Files:**\n';
            contextUpdate.changedFiles.forEach(file => {
                recentChanges += `- ${file}\n`;
            });
            recentChanges += '\n';
        }

        // Commit information
        if (contextUpdate.commit && contextUpdate.commit.message) {
            recentChanges += `**Latest Commit:** ${contextUpdate.commit.message}\n`;
            if (contextUpdate.commit.hash) {
                recentChanges += `**Commit Hash:** ${contextUpdate.commit.hash}\n`;
            }
            recentChanges += '\n';
        }

        // History section (preserve some existing context)
        let historySection = '## Context History\n\n';
        if (existingContext) {
            // Extract previous entries to maintain history
            const previousEntries = this.extractPreviousEntries(existingContext);
            if (previousEntries.length > 0) {
                // Keep last few entries for history
                const entriesToKeep = previousEntries.slice(0, this.config.maxContextHistory - 1);
                entriesToKeep.forEach(entry => {
                    historySection += `- ${entry}\n`;
                });
                historySection += '\n';
            }
        }

        // Add current entry to history
        historySection += `- ${timestamp}: ${contextUpdate.summary}\n\n`;

        return header + currentWork + recentChanges + historySection;
    }

    /**
     * Extract previous entries from existing context for history
     * @private
     * @param {string} existingContext - Existing context content
     * @returns {Array<string>} - Previous context entries
     */
    extractPreviousEntries(existingContext) {
        const entries = [];

        try {
            // Look for history section
            const historyMatch = existingContext.match(/## Context History\s*\n\n([\s\S]*?)(?=\n##|$)/);
            if (historyMatch) {
                const historyContent = historyMatch[1];
                const lines = historyContent.split('\n');

                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('- ') && trimmed.includes(':')) {
                        entries.push(trimmed.substring(2)); // Remove '- ' prefix
                    }
                });
            }
        } catch (error) {
            this.logger.warn(`Could not extract previous entries: ${error.message}`);
        }

        return entries;
    }

    /**
     * Validate persona
     * @private
     * @param {string} persona - Persona to validate
     * @returns {Object} - Validation result
     */
    validatePersona(persona) {
        const result = {
            valid: false,
            persona,
            errors: [],
            warnings: []
        };

        if (!persona) {
            result.errors.push('Persona is required');
            return result;
        }

        if (!this.validPersonas.includes(persona.toUpperCase())) {
            result.warnings.push(`Persona '${persona}' is not a standard BMAD persona`);
        }

        result.valid = true;
        return result;
    }

    /**
     * Validate persona transition
     * @private
     * @param {string} newPersona - New persona
     * @returns {Promise<Object>} - Validation result
     */
    async validatePersonaTransition(newPersona) {
        const result = {
            valid: false,
            transition: null,
            errors: [],
            warnings: []
        };

        try {
            // Get current persona from context
            const contextPath = path.join(process.cwd(), this.config.contextFile);
            if (!fs.existsSync(contextPath)) {
                result.valid = true; // No previous context to validate against
                result.warnings.push('No previous context found - transition validation skipped');
                return result;
            }

            const contextContent = await this.contextManager.read(this.config.contextFile);
            const currentPersona = this.extractPersonaFromContext(contextContent);

            if (!currentPersona) {
                result.valid = true; // No current persona to validate against
                result.warnings.push('No current persona found in context - transition validation skipped');
                return result;
            }

            result.transition = {
                from: currentPersona,
                to: newPersona
            };

            // Check if transition is valid
            if (currentPersona === newPersona) {
                result.valid = true; // Same persona is always valid
                return result;
            }

            const validTransitions = this.validTransitions[currentPersona] || [];
            if (validTransitions.includes(newPersona)) {
                result.valid = true;
            } else {
                result.warnings.push(`Persona transition from ${currentPersona} to ${newPersona} is not standard in BMAD workflow`);
                result.valid = true; // Don't fail on non-standard transitions, just warn
            }

            return result;

        } catch (error) {
            result.errors.push(`Transition validation failed: ${error.message}`);
            return result;
        }
    }

    /**
     * Extract persona from context content
     * @private
     * @param {string} contextContent - Context content
     * @returns {string|null} - Extracted persona or null
     */
    extractPersonaFromContext(contextContent) {
        if (!contextContent) return null;

        // Look for persona in current work section
        const personaMatch = contextContent.match(/\*\*Persona:\*\*\s*([A-Z_]+)/);
        if (personaMatch) {
            return personaMatch[1];
        }

        // Look for BMAD commit patterns in context
        const bmadMatch = contextContent.match(/\[([A-Z_]+)\]/);
        if (bmadMatch) {
            return bmadMatch[1];
        }

        return null;
    }

    /**
     * Sync context with persona
     * @private
     * @param {string} persona - Persona
     * @param {string} stepId - Step ID
     * @returns {Promise<Object>} - Sync result
     */
    async syncContextWithPersona(persona, stepId) {
        try {
            const result = await this.updateActiveContext({
                persona,
                stepId,
                message: `[${persona}] [${stepId}] Context synchronization`
            });

            return {
                success: result.success,
                message: result.success ? 'Context synchronized with persona' : 'Context sync failed',
                error: result.error
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sync with BMAD handover state
     * @private
     * @param {string} persona - Persona
     * @param {string} stepId - Step ID
     * @returns {Promise<Object>} - Sync result
     */
    async syncBMADHandover(persona, _stepId) {
        try {
            const handoverPath = path.join(process.cwd(), '.github', 'BMAD_HANDOVER.md');

            if (!fs.existsSync(handoverPath)) {
                return {
                    success: true,
                    message: 'No BMAD handover file found - sync skipped',
                    handoverExists: false
                };
            }

            // Read handover content
            const handoverContent = fs.readFileSync(handoverPath, 'utf8');

            // Check if handover is consistent with current persona
            const handoverPersona = this.extractPersonaFromContext(handoverContent);
            const consistent = !handoverPersona || handoverPersona === persona;

            return {
                success: true,
                consistent,
                handoverExists: true,
                handoverPersona,
                currentPersona: persona,
                message: consistent ? 'Handover state is consistent' : 'Handover state may be inconsistent'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                handoverExists: false
            };
        }
    }

    /**
     * Validate persona consistency
     * @private
     * @param {string} contextContent - Context content
     * @returns {Promise<Object>} - Validation result
     */
    async validatePersonaConsistency(contextContent) {
        try {
            if (!contextContent) {
                return {
                    consistent: false,
                    reason: 'No context content to validate'
                };
            }

            const contextPersona = this.extractPersonaFromContext(contextContent);

            // Get recent commits to check consistency
            const recentCommits = execSync('git log --oneline -5', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            const commitPersonas = [];
            const bmadPattern = /\[([A-Z_]+)\]/g;
            let match;

            while ((match = bmadPattern.exec(recentCommits)) !== null) {
                commitPersonas.push(match[1]);
            }

            if (commitPersonas.length === 0) {
                return {
                    consistent: true,
                    reason: 'No BMAD commits to validate against',
                    contextPersona
                };
            }

            const recentPersona = commitPersonas[0];
            const consistent = !contextPersona || contextPersona === recentPersona ||
                this.validTransitions[recentPersona]?.includes(contextPersona);

            return {
                consistent,
                contextPersona,
                recentPersona,
                reason: consistent ? 'Persona consistency validated' : 'Persona inconsistency detected'
            };

        } catch (error) {
            return {
                consistent: false,
                error: error.message,
                reason: 'Validation failed'
            };
        }
    }

    /**
     * Validate workflow consistency
     * @private
     * @param {string} contextContent - Context content
     * @returns {Promise<Object>} - Validation result
     */
    async validateWorkflowConsistency(contextContent) {
        try {
            if (!contextContent) {
                return {
                    consistent: false,
                    reason: 'No context content to validate'
                };
            }

            // Extract workflow phase from context
            const phaseMatch = contextContent.match(/\*\*Workflow Phase:\*\*\s*([a-z-]+)/);
            const contextPhase = phaseMatch ? phaseMatch[1] : null;

            // Extract persona from context
            const contextPersona = this.extractPersonaFromContext(contextContent);

            if (!contextPhase || !contextPersona) {
                return {
                    consistent: false,
                    reason: 'Missing workflow phase or persona in context',
                    contextPhase,
                    contextPersona
                };
            }

            // Check if phase is consistent with persona
            const expectedPhase = this.determineWorkflowPhase({ persona: contextPersona });
            const consistent = contextPhase === expectedPhase || contextPhase === 'unknown';

            return {
                consistent,
                contextPhase,
                expectedPhase,
                contextPersona,
                reason: consistent ? 'Workflow phase is consistent with persona' : 'Workflow phase inconsistency detected'
            };

        } catch (error) {
            return {
                consistent: false,
                error: error.message,
                reason: 'Workflow consistency validation failed'
            };
        }
    }

    /**
     * Validate handover consistency
     * @private
     * @param {string} contextContent - Context content
     * @returns {Promise<Object>} - Validation result
     */
    async validateHandoverConsistency(contextContent) {
        try {
            const handoverPath = path.join(process.cwd(), '.github', 'BMAD_HANDOVER.md');

            if (!fs.existsSync(handoverPath)) {
                return {
                    consistent: true,
                    reason: 'No handover file to validate against',
                    handoverExists: false
                };
            }

            const handoverContent = fs.readFileSync(handoverPath, 'utf8');
            const handoverPersona = this.extractPersonaFromContext(handoverContent);
            const contextPersona = this.extractPersonaFromContext(contextContent);

            const consistent = !handoverPersona || !contextPersona || handoverPersona === contextPersona;

            return {
                consistent,
                handoverExists: true,
                handoverPersona,
                contextPersona,
                reason: consistent ? 'Handover and context personas are consistent' : 'Handover and context persona mismatch'
            };

        } catch (error) {
            return {
                consistent: false,
                error: error.message,
                reason: 'Handover consistency validation failed'
            };
        }
    }

    /**
     * Validate git state consistency
     * @private
     * @param {string} contextContent - Context content
     * @returns {Promise<Object>} - Validation result
     */
    async validateGitStateConsistency(contextContent) {
        try {
            if (!contextContent) {
                return {
                    consistent: false,
                    reason: 'No context content to validate'
                };
            }

            // Check if context reflects recent changes
            const recentFiles = execSync('git diff --name-only HEAD~3..HEAD', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim().split('\n').filter(f => f.length > 0);

            if (recentFiles.length === 0) {
                return {
                    consistent: true,
                    reason: 'No recent changes to validate against',
                    recentFiles: []
                };
            }

            // Check if context mentions any of the recent files
            const contextReflectsChanges = recentFiles.some(file =>
                contextContent.includes(file) || contextContent.includes(path.basename(file))
            );

            // Check if context has recent timestamp
            const timestampPattern = /\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2}T[\d:.-]+Z?)/;
            const timestampMatch = contextContent.match(timestampPattern);
            const hasRecentTimestamp = timestampMatch &&
                (Date.now() - new Date(timestampMatch[1]).getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours

            const consistent = contextReflectsChanges || hasRecentTimestamp;

            return {
                consistent,
                contextReflectsChanges,
                hasRecentTimestamp,
                recentFiles,
                reason: consistent ? 'Context is consistent with git state' : 'Context may be outdated relative to git state'
            };

        } catch (error) {
            return {
                consistent: false,
                error: error.message,
                reason: 'Git state consistency validation failed'
            };
        }
    }

    /**
     * Generate consistency recommendations
     * @private
     * @param {Object} validationResults - Validation results
     * @returns {Array<string>} - Recommendations
     */
    generateConsistencyRecommendations(validationResults) {
        const recommendations = [];

        if (!validationResults.contextFileExists) {
            recommendations.push('Create activeContext.md to track current work and maintain BMAD workflow state');
        }

        if (!validationResults.personaConsistency.consistent) {
            recommendations.push('Update activeContext.md to reflect the current persona and ensure consistency with recent commits');
        }

        if (!validationResults.workflowConsistency.consistent) {
            recommendations.push('Align workflow phase in activeContext.md with the current persona and work being performed');
        }

        if (!validationResults.handoverConsistency.consistent) {
            recommendations.push('Synchronize BMAD handover state with activeContext.md to maintain consistency across components');
        }

        if (!validationResults.gitStateConsistency.consistent) {
            recommendations.push('Update activeContext.md to reflect recent changes and maintain currency with git state');
        }

        if (recommendations.length === 0) {
            recommendations.push('Context consistency is good - continue maintaining regular updates');
        }

        return recommendations;
    }
}

module.exports = ContextSynchronizer;