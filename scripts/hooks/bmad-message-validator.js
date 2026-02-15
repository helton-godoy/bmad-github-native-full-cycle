/**
 * @ai-context BMAD Message Validator for Git Hooks Automation
 * @ai-invariant All commit messages must follow BMAD pattern or conventional commits format
 * @ai-connection Integrates with Hook Orchestrator for commit message validation
 */

const Logger = require('../lib/logger');

/**
 * BMAD Message Validator
 * Validates commit messages against BMAD patterns and conventional commits fallback
 * Provides clear error messaging for invalid formats
 */
class BMADMessageValidator {
    constructor(options = {}) {
        this.logger = new Logger('BMADMessageValidator');

        // Configuration options
        this.strictMode = options.strictMode !== false; // Default true
        this.allowConventionalFallback = options.allowConventionalFallback !== false; // Default true
        this.requireUppercasePersona = options.requireUppercasePersona !== false; // Default true

        // BMAD pattern: [PERSONA] [STEP-ID] Description
        // Persona: Uppercase letters and underscores
        // Step-ID: Letters and numbers with hyphens
        // Description: Any non-empty text
        this.bmadRegex = /^\[([A-Z_]+)\] \[([A-Z]+-\d+)\] (.+)$/;

        // Conventional commits pattern as fallback
        // type(scope): description
        this.conventionalRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?: .+/;

        // Valid BMAD personas
        this.validPersonas = [
            'DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS',
            'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'
        ];
    }

    /**
     * Validate BMAD pattern format
     * @param {string} message - Commit message to validate
     * @returns {boolean} - True if message matches BMAD pattern
     */
    validateBMADPattern(message) {
        if (!message || typeof message !== 'string') {
            return false;
        }

        return this.bmadRegex.test(message.trim());
    }

    /**
     * Validate conventional commits format
     * @param {string} message - Commit message to validate
     * @returns {boolean} - True if message matches conventional commits pattern
     */
    validateConventionalCommits(message) {
        if (!message || typeof message !== 'string') {
            return false;
        }

        return this.conventionalRegex.test(message.trim());
    }

    /**
     * Comprehensive message validation with detailed results
     * @param {string} message - Commit message to validate
     * @returns {Object} - Detailed validation result
     */
    validateMessage(message) {
        const result = {
            valid: false,
            format: null, // 'bmad', 'conventional', or null
            errors: [],
            warnings: [],
            parsed: null
        };

        try {
            if (!message || typeof message !== 'string') {
                result.errors.push('Commit message is required and must be a string');
                return result;
            }

            const trimmedMessage = message.trim();

            if (trimmedMessage.length === 0) {
                result.errors.push('Commit message cannot be empty');
                return result;
            }

            // First, try BMAD pattern validation
            const bmadValidation = this._validateBMADFormat(trimmedMessage);
            if (bmadValidation.valid) {
                result.valid = true;
                result.format = 'bmad';
                result.parsed = bmadValidation.parsed;
                result.warnings = bmadValidation.warnings;
                return result;
            }

            // Try conventional commits as fallback if enabled
            if (this.allowConventionalFallback) {
                const conventionalValidation = this._validateConventionalFormat(trimmedMessage);
                if (conventionalValidation.valid) {
                    result.valid = true;
                    result.format = 'conventional';
                    result.parsed = conventionalValidation.parsed;
                    result.warnings.push('Using conventional commits format as fallback');
                    return result;
                }

                // If both failed, collect errors from both
                result.errors.push(...bmadValidation.errors);
                result.errors.push(...conventionalValidation.errors.map(err => `Conventional format: ${err}`));
            } else {
                // Only BMAD format allowed, collect BMAD errors
                result.errors.push(...bmadValidation.errors);
            }

            return result;

        } catch (error) {
            result.errors.push(`Validation error: ${error.message}`);
            return result;
        }
    }

    /**
     * Generate clear error message for invalid commit message
     * @param {Object} validationResult - Result from validateMessage
     * @returns {string} - Formatted error message
     */
    generateErrorMessage(validationResult) {
        if (validationResult.valid) {
            return null;
        }

        let errorMessage = 'COMMIT MESSAGE VALIDATION FAILED\n\n';

        // Add specific errors
        if (validationResult.errors.length > 0) {
            errorMessage += 'ERRORS:\n';
            validationResult.errors.forEach((error, index) => {
                errorMessage += `  ${index + 1}. ${error}\n`;
            });
            errorMessage += '\n';
        }

        // Add format requirements
        errorMessage += 'REQUIRED FORMATS:\n\n';

        errorMessage += '1. BMAD Pattern (Preferred):\n';
        errorMessage += '   [PERSONA] [STEP-ID] Description\n\n';
        errorMessage += '   Examples:\n';
        errorMessage += '   - [DEVELOPER] [STEP-001] Implement user authentication\n';
        errorMessage += '   - [ARCHITECT] [ARCH-042] Design database schema\n';
        errorMessage += '   - [QA] [TEST-123] Add integration tests for API\n\n';

        if (this.allowConventionalFallback) {
            errorMessage += '2. Conventional Commits (Fallback):\n';
            errorMessage += '   type(scope): description\n\n';
            errorMessage += '   Examples:\n';
            errorMessage += '   - feat(auth): add user login functionality\n';
            errorMessage += '   - fix(api): resolve validation error handling\n';
            errorMessage += '   - docs(readme): update installation instructions\n\n';
        }

        // Add rules
        errorMessage += 'BMAD PATTERN RULES:\n';
        errorMessage += '  - PERSONA: Must be uppercase (DEVELOPER, ARCHITECT, PM, QA, DEVOPS, SECURITY, RELEASE, RECOVERY, ORCHESTRATOR)\n';
        errorMessage += '  - STEP-ID: Format like STEP-001, ARCH-042, TEST-123, etc.\n';
        errorMessage += '  - Description: Must be meaningful and descriptive\n';

        return errorMessage;
    }

    /**
     * Validate BMAD format with detailed parsing
     * @private
     * @param {string} message - Trimmed commit message
     * @returns {Object} - Detailed BMAD validation result
     */
    _validateBMADFormat(message) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            parsed: null
        };

        const match = this.bmadRegex.exec(message);

        if (!match) {
            result.errors.push('Message does not match BMAD pattern: [PERSONA] [STEP-ID] Description');
            return result;
        }

        const [, persona, stepId, description] = match;

        // Validate persona
        const personaValidation = this._validatePersona(persona);
        if (!personaValidation.valid) {
            result.errors.push(...personaValidation.errors);
        }
        result.warnings.push(...personaValidation.warnings);

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
        }
        result.warnings.push(...descriptionValidation.warnings);

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
    }

    /**
     * Validate conventional commits format with detailed parsing
     * @private
     * @param {string} message - Trimmed commit message
     * @returns {Object} - Detailed conventional validation result
     */
    _validateConventionalFormat(message) {
        const result = {
            valid: false,
            errors: [],
            warnings: [],
            parsed: null
        };

        const match = this.conventionalRegex.exec(message);

        if (!match) {
            result.errors.push('Message does not match conventional commits pattern: type(scope): description');
            return result;
        }

        const [, type, scopeWithParens] = match;
        const scope = scopeWithParens ? scopeWithParens.slice(1, -1) : null; // Remove parentheses
        const description = message.substring(match.index + type.length + (scopeWithParens || '').length + 2); // +2 for ': '

        // Validate type
        const validTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
        if (!validTypes.includes(type)) {
            result.errors.push(`Invalid conventional commit type: ${type}`);
        }

        // Validate description
        if (!description || description.trim().length === 0) {
            result.errors.push('Description is required in conventional commits');
        } else if (description.trim().length < 3) {
            result.warnings.push('Description is very short - consider adding more detail');
        }

        // If no errors, mark as valid
        if (result.errors.length === 0) {
            result.valid = true;
            result.parsed = {
                type,
                scope,
                description: description.trim(),
                fullMessage: message
            };
        }

        return result;
    }

    /**
     * Validate persona name
     * @private
     * @param {string} persona - Persona to validate
     * @returns {Object} - Validation result
     */
    _validatePersona(persona) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!persona) {
            result.valid = false;
            result.errors.push('Persona is required');
            return result;
        }

        if (this.requireUppercasePersona && persona !== persona.toUpperCase()) {
            result.valid = false;
            result.errors.push('Persona must be uppercase');
        }

        if (!this.validPersonas.includes(persona.toUpperCase())) {
            result.warnings.push(`Persona '${persona}' is not a standard BMAD persona. Valid personas: ${this.validPersonas.join(', ')}`);
        }

        return result;
    }

    /**
     * Validate step ID format
     * @private
     * @param {string} stepId - Step ID to validate
     * @returns {Object} - Validation result
     */
    _validateStepId(stepId) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!stepId) {
            result.valid = false;
            result.errors.push('Step ID is required');
            return result;
        }

        // Check basic format: PREFIX-NUMBER
        const stepIdPattern = /^([A-Z]+)-(\d+)$/;
        const match = stepIdPattern.exec(stepId);

        if (!match) {
            result.valid = false;
            result.errors.push('Step ID must follow format: PREFIX-NUMBER (e.g., STEP-001, ARCH-042)');
            return result;
        }

        const [, prefix, number] = match;

        // Validate prefix
        const validPrefixes = ['STEP', 'ARCH', 'TEST', 'DEV', 'SEC', 'OPS', 'REL', 'REC'];
        if (!validPrefixes.includes(prefix)) {
            result.warnings.push(`Step ID prefix '${prefix}' is not standard. Common prefixes: ${validPrefixes.join(', ')}`);
        }

        // Validate number
        const numericValue = parseInt(number, 10);
        if (numericValue < 1) {
            result.valid = false;
            result.errors.push('Step ID number must be greater than 0');
        } else if (numericValue > 9999) {
            result.warnings.push('Step ID number is very large - consider using smaller numbers');
        }

        // Check number formatting
        if (number.length < 3 && numericValue < 100) {
            result.warnings.push('Consider padding step ID numbers to 3 digits (e.g., STEP-001)');
        }

        return result;
    }

    /**
     * Validate description content
     * @private
     * @param {string} description - Description to validate
     * @returns {Object} - Validation result
     */
    _validateDescription(description) {
        const result = { valid: true, errors: [], warnings: [] };

        if (!description || !description.trim()) {
            result.valid = false;
            result.errors.push('Description is required');
            return result;
        }

        const trimmedDescription = description.trim();

        if (trimmedDescription.length < 5) {
            result.warnings.push('Description is very short - consider adding more detail');
        }

        if (trimmedDescription.length > 100) {
            result.warnings.push('Description is very long - consider shortening for better readability');
        }

        // Check for common vague descriptions
        const vaguePhrases = ['fix', 'update', 'change', 'modify', 'improve'];
        const lowerDescription = trimmedDescription.toLowerCase();

        for (const phrase of vaguePhrases) {
            if (lowerDescription === phrase || lowerDescription.startsWith(phrase + ' ')) {
                if (trimmedDescription.length < 20) {
                    result.warnings.push(`Description "${phrase}" is too generic - be more specific about what was ${phrase}ed`);
                }
            }
        }

        // Check for proper capitalization
        if (trimmedDescription[0] !== trimmedDescription[0].toUpperCase()) {
            result.warnings.push('Description should start with a capital letter');
        }

        // Check for ending punctuation (should not end with period for commit messages)
        if (trimmedDescription.endsWith('.')) {
            result.warnings.push('Commit descriptions typically do not end with a period');
        }

        return result;
    }

    /**
     * Check if message is valid (simple boolean check)
     * @param {string} message - Commit message to validate
     * @returns {boolean} - True if message is valid
     */
    isValid(message) {
        const result = this.validateMessage(message);
        return result.valid;
    }

    /**
     * Get validation summary for logging
     * @param {Object} validationResult - Result from validateMessage
     * @returns {string} - Summary string
     */
    getValidationSummary(validationResult) {
        if (validationResult.valid) {
            const format = validationResult.format === 'bmad' ? 'BMAD' : 'Conventional Commits';
            const warnings = validationResult.warnings.length > 0 ? ` (${validationResult.warnings.length} warnings)` : '';
            return `Valid ${format} format${warnings}`;
        } else {
            return `Invalid format (${validationResult.errors.length} errors)`;
        }
    }
}

module.exports = BMADMessageValidator;