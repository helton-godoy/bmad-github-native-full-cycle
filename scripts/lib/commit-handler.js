/**
 * @ai-context Enhanced Commit Handler for BMAD System
 * @ai-invariant All git operations must be validated and follow BMAD patterns
 * @ai-connection Integrates with ExponentialBackoff for retry logic
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ExponentialBackoff = require('./exponential-backoff');
const Logger = require('./logger');

/**
 * Enhanced commit handler with robust validation, retry logic, and verification
 * Ensures reliable git operations following BMAD patterns
 */
class CommitHandler {
    constructor(options = {}) {
        this.logger = new Logger('CommitHandler');

        // Configuration
        this.maxRetries = options.maxRetries || 2;
        this.validateStaging = options.validateStaging !== false; // Default true
        this.validateFormat = options.validateFormat !== false; // Default true
        this.enableRollback = options.enableRollback !== false; // Default true

        // Initialize backoff for commit retries
        this.backoff = new ExponentialBackoff({
            initialDelay: 1000,
            maxDelay: 5000,
            multiplier: 2,
            maxRetries: this.maxRetries,
            jitterFactor: 0.1
        });

        // Commit message pattern: [PERSONA] [STEP-ID] Description
        this.messagePattern = /^\[([A-Za-z]+)\] \[STEP-([0-9A-Z]+)\] (.+)$/;
    }

    /**
     * Prepare commit by staging files and validating
     * @param {string[]} files - Array of file paths to stage
     * @returns {Promise<boolean>} - True if files were staged successfully
     */
    async prepareCommit(files = []) {
        try {
            this.logger.info('Preparing commit...');

            // Stage files
            if (files.length > 0) {
                await this._stageSpecificFiles(files);
            } else {
                await this._stageAllChanges();
            }

            // Validate staging if enabled
            if (this.validateStaging) {
                const hasStagedChanges = await this._validateStaging();
                if (!hasStagedChanges) {
                    this.logger.warn('No changes staged after git add operation');
                    return false;
                }
            }

            this.logger.info('Commit preparation completed successfully');
            return true;

        } catch (error) {
            this.logger.error(`Failed to prepare commit: ${error.message}`);
            throw error;
        }
    }

    /**
     * Execute commit with retry logic and validation
     * @param {string} message - Commit message
     * @param {string} persona - Persona name (e.g., 'DEVELOPER')
     * @param {string} stepId - Step identifier (e.g., '001')
     * @returns {Promise<string>} - Commit hash if successful
     */
    async executeCommit(message, persona, stepId) {
        try {
            // Format commit message
            const formattedMessage = this.formatCommitMessage(persona, stepId, message);

            // Validate message format if enabled
            if (this.validateFormat && !this._validateMessageFormat(formattedMessage)) {
                throw new Error(`Invalid commit message format: ${formattedMessage}`);
            }

            // Check for empty commit before attempting
            const hasChanges = await this._hasChangesToCommit();
            if (!hasChanges) {
                this.logger.warn('No changes to commit - skipping commit operation');
                return null;
            }

            // Execute commit with retry logic
            const result = await this.backoff.execute(async (attempt) => {
                this.logger.info(`Attempting commit (attempt ${attempt + 1}/${this.maxRetries + 1})`);

                try {
                    // Execute git commit
                    const output = execSync(`git commit -m "${formattedMessage}"`, {
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'pipe']
                    });

                    // Extract commit hash from output
                    const commitHash = this._extractCommitHash(output);

                    this.logger.info(`Commit successful: ${commitHash}`);
                    return commitHash;

                } catch (error) {
                    this.logger.warn(`Commit attempt ${attempt + 1} failed: ${error.message}`);

                    // Check if this is a retryable error
                    if (this._isRetryableError(error)) {
                        throw error; // Will trigger retry
                    } else {
                        // Non-retryable error, don't retry
                        throw new Error(`Non-retryable commit error: ${error.message}`);
                    }
                }
            });

            if (result.success) {
                this.logger.info(`Commit completed after ${result.attempts.length} attempts`);
                return result.result;
            } else {
                throw new Error(`Commit failed after ${result.attempts.length} attempts: ${result.error.message}`);
            }

        } catch (error) {
            this.logger.error(`Execute commit failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Format commit message according to BMAD pattern
     * @param {string} persona - Persona name
     * @param {string} stepId - Step identifier
     * @param {string} description - Commit description
     * @returns {string} - Formatted commit message
     */
    formatCommitMessage(persona, stepId, description) {
        // Ensure persona is uppercase
        const upperPersona = persona.toUpperCase();

        // Ensure stepId is properly formatted
        const formattedStepId = stepId.toString().padStart(3, '0');

        // Clean description (remove quotes and newlines)
        const cleanDescription = description
            .replace(/"/g, '\\"')
            .replace(/\n/g, ' ')
            .trim();

        return `[${upperPersona}] [STEP-${formattedStepId}] ${cleanDescription}`;
    }

    /**
     * Stage specific files
     * @private
     */
    async _stageSpecificFiles(files) {
        this.logger.info(`Staging ${files.length} specific files`);

        for (const file of files) {
            try {
                // Verify file exists
                if (!fs.existsSync(file)) {
                    this.logger.warn(`File does not exist, skipping: ${file}`);
                    continue;
                }

                execSync(`git add "${file}"`, { stdio: 'pipe' });
                this.logger.info(`Staged file: ${file}`);

            } catch (error) {
                this.logger.error(`Failed to stage file ${file}: ${error.message}`);
                throw error;
            }
        }
    }

    /**
     * Stage all changes
     * @private
     */
    async _stageAllChanges() {
        try {
            // Check if there are any changes to stage
            const status = execSync('git status --porcelain', { encoding: 'utf-8' });

            if (!status.trim()) {
                this.logger.info('No changes detected to stage');
                return;
            }

            this.logger.info('Staging all changes');
            execSync('git add .', { stdio: 'pipe' });

        } catch (error) {
            this.logger.error(`Failed to stage all changes: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate that files have been staged
     * @private
     * @returns {Promise<boolean>} - True if there are staged changes
     */
    async _validateStaging() {
        try {
            // git diff --cached --quiet returns 0 if no staged changes, 1 if there are staged changes
            execSync('git diff --cached --quiet', { stdio: 'pipe' });
            return false; // No staged changes
        } catch (error) {
            return true; // There are staged changes (git diff --cached --quiet failed)
        }
    }

    /**
     * Check if there are changes to commit
     * @private
     * @returns {Promise<boolean>} - True if there are changes to commit
     */
    async _hasChangesToCommit() {
        return await this._validateStaging();
    }

    /**
     * Validate commit message format with detailed error reporting
     * @param {string} message - Commit message to validate
     * @returns {Object} - Validation result with details
     */
    validateMessageFormat(message) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            parsed: null
        };

        try {
            // Check basic format pattern
            const match = this.messagePattern.exec(message);

            if (!match) {
                result.errors.push('Message does not match required pattern: [PERSONA] [STEP-ID] Description');
                return result;
            }

            const [fullMatch, persona, stepId, description] = match;

            // Validate persona
            const personaValidation = this._validatePersona(persona);
            if (!personaValidation.valid) {
                result.errors.push(...personaValidation.errors);
                result.warnings.push(...personaValidation.warnings);
            }

            // Validate step ID
            const stepIdValidation = this._validateStepId(stepId);
            if (!stepIdValidation.valid) {
                result.errors.push(...stepIdValidation.errors);
            }
            result.warnings.push(...stepIdValidation.warnings);

            // Validate description
            const descriptionValidation = this._validateDescription(description);
            if (!descriptionValidation.valid) {
                result.errors.push(...descriptionValidation.errors);
                result.warnings.push(...descriptionValidation.warnings);
            }

            // If no errors, mark as valid
            if (result.errors.length === 0) {
                result.valid = true;
                result.parsed = {
                    persona,
                    stepId,
                    description,
                    fullMessage: message
                };
            }

            return result;

        } catch (error) {
            result.errors.push(`Validation error: ${error.message}`);
            return result;
        }
    }

    /**
     * Generate detailed error report for commit message format issues
     * @param {Object} validationResult - Result from validateMessageFormat
     * @returns {string} - Formatted error report
     */
    generateFormatErrorReport(validationResult) {
        if (validationResult.valid) {
            return 'Commit message format is valid.';
        }

        let report = 'Commit Message Format Validation Failed:\n\n';

        if (validationResult.errors.length > 0) {
            report += 'ERRORS:\n';
            validationResult.errors.forEach((error, index) => {
                report += `  ${index + 1}. ${error}\n`;
            });
            report += '\n';
        }

        if (validationResult.warnings.length > 0) {
            report += 'WARNINGS:\n';
            validationResult.warnings.forEach((warning, index) => {
                report += `  ${index + 1}. ${warning}\n`;
            });
            report += '\n';
        }

        report += 'REQUIRED FORMAT:\n';
        report += '  [PERSONA] [STEP-ID] Description\n\n';
        report += 'EXAMPLES:\n';
        report += '  [DEVELOPER] [STEP-001] Implement user authentication\n';
        report += '  [ARCHITECT] [STEP-042] Design database schema\n';
        report += '  [QA] [STEP-123] Add integration tests for API\n\n';

        report += 'RULES:\n';
        report += '  - PERSONA: Must be uppercase, valid BMAD persona\n';
        report += '  - STEP-ID: Must be 3-digit number (001-999)\n';
        report += '  - Description: Must be meaningful and concise\n';

        return report;
    }

    /**
     * Attempt to correct common format issues
     * @param {string} message - Original commit message
     * @returns {Object} - Correction result
     */
    correctMessageFormat(message) {
        const result = {
            corrected: false,
            originalMessage: message,
            correctedMessage: message,
            corrections: []
        };

        try {
            let correctedMessage = message.trim();

            // Try to extract components from various formats
            const patterns = [
                // Already correct format
                /^\[([A-Z]+)\] \[STEP-([0-9A-Z]+)\] (.+)$/,
                // Missing STEP prefix
                /^\[([A-Z]+)\] \[([0-9]+)\] (.+)$/,
                // Lowercase persona
                /^\[([a-z]+)\] \[STEP-([0-9A-Z]+)\] (.+)$/i,
                // No brackets
                /^([A-Z]+) STEP-([0-9A-Z]+) (.+)$/,
                // Simple format
                /^([A-Z]+): (.+)$/
            ];

            for (const pattern of patterns) {
                const match = correctedMessage.match(pattern);
                if (match) {
                    let persona, stepId, description;

                    if (pattern === patterns[0]) {
                        // Already correct
                        return result;
                    } else if (pattern === patterns[1]) {
                        // Add STEP prefix
                        [, persona, stepId, description] = match;
                        correctedMessage = `[${persona.toUpperCase()}] [STEP-${stepId.padStart(3, '0')}] ${description}`;
                        result.corrections.push('Added STEP prefix to step ID');
                    } else if (pattern === patterns[2]) {
                        // Fix case
                        [, persona, stepId, description] = match;
                        correctedMessage = `[${persona.toUpperCase()}] [STEP-${stepId}] ${description}`;
                        result.corrections.push('Converted persona to uppercase');
                    } else if (pattern === patterns[3]) {
                        // Add brackets
                        [, persona, stepId, description] = match;
                        correctedMessage = `[${persona}] [STEP-${stepId}] ${description}`;
                        result.corrections.push('Added brackets around persona and step ID');
                    } else if (pattern === patterns[4]) {
                        // Generate step ID
                        [, persona, description] = match;
                        const stepId = Math.floor(Math.random() * 900) + 100;
                        correctedMessage = `[${persona}] [STEP-${stepId}] ${description}`;
                        result.corrections.push('Generated step ID and added proper formatting');
                    }

                    result.corrected = true;
                    result.correctedMessage = correctedMessage;
                    break;
                }
            }

            return result;

        } catch (error) {
            this.logger.error(`Error correcting message format: ${error.message}`);
            return result;
        }
    }

    /**
     * Validate persona name
     * @private
     */
    _validatePersona(persona) {
        const result = { valid: true, errors: [], warnings: [] };

        const validPersonas = [
            'DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS',
            'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'
        ];

        if (!persona) {
            result.valid = false;
            result.errors.push('Persona is required');
            return result;
        }

        if (persona !== persona.toUpperCase()) {
            result.valid = false;
            result.errors.push('Persona must be uppercase');
        }

        if (!validPersonas.includes(persona.toUpperCase())) {
            result.warnings.push(`Persona '${persona}' is not a standard BMAD persona`);
        }

        return result;
    }

    /**
     * Validate step ID format
     * @private
     */
    _validateStepId(stepId) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!stepId) {
            result.valid = false;
            result.errors.push('Step ID is required');
            return result;
        }

        // Check if it's a 3-digit number
        if (!/^[0-9]{3}$/.test(stepId)) {
            if (/^[0-9]+$/.test(stepId)) {
                if (stepId.length < 3) {
                    result.warnings.push('Step ID should be 3 digits (pad with zeros)');
                } else if (stepId.length > 3) {
                    result.warnings.push('Step ID should be 3 digits (consider shortening)');
                }
            } else {
                result.valid = false;
                result.errors.push('Step ID must be a 3-digit number (001-999)');
            }
        }

        const numericValue = parseInt(stepId, 10);
        if (numericValue < 1 || numericValue > 999) {
            result.warnings.push('Step ID should be between 001 and 999');
        }

        return result;
    }

    /**
     * Validate description content
     * @private
     */
    _validateDescription(description) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!description || !description.trim()) {
            result.valid = false;
            result.errors.push('Description is required');
            return result;
        }

        const trimmedDescription = description.trim();

        if (trimmedDescription.length < 10) {
            result.warnings.push('Description is very short - consider adding more detail');
        }

        if (trimmedDescription.length > 100) {
            result.warnings.push('Description is very long - consider shortening');
        }

        // Check for common issues
        if (trimmedDescription.toLowerCase().includes('fix') && trimmedDescription.length < 20) {
            result.warnings.push('Generic "fix" description - consider being more specific');
        }

        if (trimmedDescription.toLowerCase().includes('update') && trimmedDescription.length < 25) {
            result.warnings.push('Generic "update" description - consider being more specific');
        }

        return result;
    }

    /**
     * Validate commit message format (legacy method for backward compatibility)
     * @private
     * @param {string} message - Commit message to validate
     * @returns {boolean} - True if format is valid
     */
    _validateMessageFormat(message) {
        const result = this.validateMessageFormat(message);
        return result.valid;
    }

    /**
     * Extract commit hash from git commit output
     * @private
     * @param {string} output - Git commit command output
     * @returns {string} - Commit hash
     */
    _extractCommitHash(output) {
        // Git commit output typically contains the commit hash in the first line
        // Format: "[branch hash] commit message"
        const match = output.match(/\[.+?\s+([a-f0-9]+)\]/);
        if (match) {
            return match[1];
        }

        // Alternative: try to get the hash from git log
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        } catch (error) {
            this.logger.warn('Could not extract commit hash from output or git log');
            return 'unknown';
        }
    }

    /**
     * Verify that a commit was successfully created in the git repository
     * @param {string} commitHash - Hash of the commit to verify
     * @returns {Promise<Object>} - Verification result with commit details
     */
    async validateCommit(commitHash) {
        try {
            this.logger.info(`Verifying commit: ${commitHash}`);

            if (!commitHash || commitHash === 'unknown') {
                throw new Error('Invalid commit hash provided for verification');
            }

            // Verify commit exists in repository
            const commitInfo = await this._getCommitInfo(commitHash);

            // Verify commit is in current branch
            const isInCurrentBranch = await this._isCommitInCurrentBranch(commitHash);

            if (!isInCurrentBranch) {
                throw new Error(`Commit ${commitHash} is not in the current branch`);
            }

            // Verify commit message format
            if (this.validateFormat && !this._validateMessageFormat(commitInfo.message)) {
                this.logger.warn(`Commit ${commitHash} has invalid message format: ${commitInfo.message}`);
            }

            const result = {
                hash: commitHash,
                verified: true,
                message: commitInfo.message,
                author: commitInfo.author,
                timestamp: commitInfo.timestamp,
                files: commitInfo.files
            };

            this.logger.info(`Commit verification successful: ${commitHash}`);
            return result;

        } catch (error) {
            this.logger.error(`Commit verification failed for ${commitHash}: ${error.message}`);

            // If verification fails and rollback is enabled, attempt rollback
            if (this.enableRollback) {
                await this._attemptRollback(commitHash);
            }

            throw error;
        }
    }

    /**
     * Attempt to rollback a failed commit
     * @param {string} commitHash - Hash of the commit to rollback
     * @returns {Promise<void>}
     */
    async rollbackCommit(commitHash) {
        try {
            this.logger.warn(`Attempting rollback of commit: ${commitHash}`);

            // Verify we can rollback (commit is the latest)
            const headHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();

            if (headHash !== commitHash) {
                throw new Error(`Cannot rollback commit ${commitHash} - it is not the latest commit (HEAD: ${headHash})`);
            }

            // Perform soft reset to preserve working directory changes
            execSync('git reset --soft HEAD~1', { stdio: 'pipe' });

            this.logger.info(`Successfully rolled back commit: ${commitHash}`);

        } catch (error) {
            this.logger.error(`Rollback failed for commit ${commitHash}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get detailed information about a commit
     * @private
     * @param {string} commitHash - Hash of the commit
     * @returns {Promise<Object>} - Commit information
     */
    async _getCommitInfo(commitHash) {
        try {
            // Get commit details using git show
            const output = execSync(`git show --format="%H|%an|%ae|%at|%s" --name-only ${commitHash}`, {
                encoding: 'utf-8'
            });

            const lines = output.trim().split('\n');
            const [hash, author, email, timestamp, message] = lines[0].split('|');
            const files = lines.slice(1).filter(line => line.trim() && !line.startsWith('commit'));

            return {
                hash,
                author: `${author} <${email}>`,
                timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                message,
                files
            };

        } catch (error) {
            throw new Error(`Failed to get commit info for ${commitHash}: ${error.message}`);
        }
    }

    /**
     * Check if commit is in the current branch
     * @private
     * @param {string} commitHash - Hash of the commit
     * @returns {Promise<boolean>} - True if commit is in current branch
     */
    async _isCommitInCurrentBranch(commitHash) {
        try {
            // Use git merge-base to check if commit is reachable from HEAD
            execSync(`git merge-base --is-ancestor ${commitHash} HEAD`, { stdio: 'pipe' });
            return true;
        } catch (error) {
            // If git merge-base fails, the commit is not an ancestor of HEAD
            return false;
        }
    }

    /**
     * Attempt rollback with error handling
     * @private
     * @param {string} commitHash - Hash of the commit to rollback
     */
    async _attemptRollback(commitHash) {
        try {
            await this.rollbackCommit(commitHash);
        } catch (rollbackError) {
            this.logger.error(`Rollback attempt failed: ${rollbackError.message}`);
            // Don't throw rollback errors, just log them
        }
    }

    /**
     * Determine if an error is retryable
     * @private
     * @param {Error} error - Error to check
     * @returns {boolean} - True if error is retryable
     */
    _isRetryableError(error) {
        const retryablePatterns = [
            /lock/i,
            /timeout/i,
            /network/i,
            /connection/i,
            /temporary/i,
            /busy/i
        ];

        return retryablePatterns.some(pattern => pattern.test(error.message));
    }
}

module.exports = CommitHandler;