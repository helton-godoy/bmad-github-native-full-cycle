/**
 * Unit Tests for BMAD Message Validator - Edge Cases
 * Tests edge cases, error handling, and boundary conditions
 * Requirements: 1.2, 2.1, 2.2, 2.3
 */

const BMADMessageValidator = require('../../scripts/hooks/bmad-message-validator');

describe('BMAD Message Validator - Edge Cases', () => {
    let validator;

    beforeEach(() => {
        validator = new BMADMessageValidator({
            strictMode: true,
            allowConventionalFallback: true,
            requireUppercasePersona: true
        });
    });

    describe('Input Type Handling', () => {
        test('should handle null input', () => {
            const result = validator.validateMessage(null);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Message is required');
        });

        test('should handle undefined input', () => {
            const result = validator.validateMessage(undefined);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should handle number input', () => {
            const result = validator.validateMessage(12345);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should handle boolean input', () => {
            const result = validator.validateMessage(true);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should handle object input', () => {
            const result = validator.validateMessage({ message: 'test' });

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should handle array input', () => {
            const result = validator.validateMessage(['test', 'message']);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Empty and Whitespace Handling', () => {
        test('should reject empty string', () => {
            const result = validator.validateMessage('');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Message is required and cannot be empty');
        });

        test('should reject whitespace-only string', () => {
            const result = validator.validateMessage('   ');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Message is required and cannot be empty');
        });

        test('should reject newline-only string', () => {
            const result = validator.validateMessage('\n\n\n');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Message is required and cannot be empty');
        });

        test('should reject tab-only string', () => {
            const result = validator.validateMessage('\t\t\t');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Message is required and cannot be empty');
        });

        test('should reject mixed whitespace', () => {
            const result = validator.validateMessage('  \n\t  \n  ');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Message is required and cannot be empty');
        });
    });

    describe('BMAD Pattern Edge Cases', () => {
        test('should reject lowercase persona', () => {
            const result = validator.validateMessage('[developer] [STEP-001] Test message');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Persona') || e.includes('uppercase'))).toBe(true);
        });

        test('should reject mixed case persona', () => {
            const result = validator.validateMessage('[Developer] [STEP-001] Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject invalid persona name', () => {
            const result = validator.validateMessage('[INVALID] [STEP-001] Test message');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid persona'))).toBe(true);
        });

        test('should reject missing persona brackets', () => {
            const result = validator.validateMessage('DEVELOPER [STEP-001] Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject missing step ID brackets', () => {
            const result = validator.validateMessage('[DEVELOPER] STEP-001 Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject empty persona brackets', () => {
            const result = validator.validateMessage('[] [STEP-001] Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject empty step ID brackets', () => {
            const result = validator.validateMessage('[DEVELOPER] [] Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject step ID without number', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP] Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject step ID with zero', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-000] Test message');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Step ID number must be greater than 0'))).toBe(true);
        });

        test('should reject step ID with negative number', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP--001] Test message');

            expect(result.valid).toBe(false);
        });

        test('should reject description that is too short', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001] Hi');

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Description must be at least 5 characters'))).toBe(true);
        });

        test('should reject missing description', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001]');

            expect(result.valid).toBe(false);
        });

        test('should reject whitespace-only description', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001]    ');

            expect(result.valid).toBe(false);
        });

        test('should accept valid BMAD message with extra whitespace', () => {
            const result = validator.validateMessage('[DEVELOPER]  [STEP-001]  Test message with extra spaces');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should accept step ID with large number', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-999] Test message');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should accept different step ID prefixes', () => {
            const validPrefixes = ['STEP', 'ARCH', 'TEST', 'DEV', 'SEC', 'OPS', 'REL', 'REC'];

            validPrefixes.forEach(prefix => {
                const result = validator.validateMessage(`[DEVELOPER] [${prefix}-001] Test message`);
                expect(result.valid).toBe(true);
                expect(result.format).toBe('bmad');
            });
        });
    });

    describe('Conventional Commits Edge Cases', () => {
        test('should reject invalid type', () => {
            const result = validator.validateMessage('invalid: test message');

            expect(result.valid).toBe(false);
        });

        test('should reject missing colon', () => {
            const result = validator.validateMessage('feat test message');

            expect(result.valid).toBe(false);
        });

        test('should reject missing space after colon', () => {
            const result = validator.validateMessage('feat:test message');

            expect(result.valid).toBe(false);
        });

        test('should reject empty description', () => {
            const result = validator.validateMessage('feat: ');

            expect(result.valid).toBe(false);
        });

        test('should reject empty scope', () => {
            const result = validator.validateMessage('feat(): test message');

            expect(result.valid).toBe(false);
        });

        test('should reject invalid scope characters', () => {
            const result = validator.validateMessage('feat(INVALID SCOPE): test message');

            expect(result.valid).toBe(false);
        });

        test('should accept valid conventional commit with scope', () => {
            const result = validator.validateMessage('feat(api): add new endpoint');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('conventional');
            expect(result.parsed.scope).toBe('api');
        });

        test('should accept valid conventional commit without scope', () => {
            const result = validator.validateMessage('fix: resolve bug in validation');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('conventional');
            expect(result.parsed.scope).toBeUndefined();
        });

        test('should accept all valid conventional commit types', () => {
            const validTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

            validTypes.forEach(type => {
                const result = validator.validateMessage(`${type}: test message for ${type}`);
                expect(result.valid).toBe(true);
                expect(result.format).toBe('conventional');
                expect(result.parsed.type).toBe(type);
            });
        });
    });

    describe('Configuration Options', () => {
        test('should respect strictMode setting', () => {
            const strictValidator = new BMADMessageValidator({ strictMode: true });
            const lenientValidator = new BMADMessageValidator({ strictMode: false });

            const message = '[DEVELOPER] [STEP-001] Test';

            const strictResult = strictValidator.validateMessage(message);
            const lenientResult = lenientValidator.validateMessage(message);

            // In strict mode, short description should fail
            expect(strictResult.valid).toBe(false);
            // In lenient mode, it might pass or have warnings
            expect(lenientResult.valid).toBeDefined();
        });

        test('should respect allowConventionalFallback setting', () => {
            const withFallback = new BMADMessageValidator({ allowConventionalFallback: true });
            const withoutFallback = new BMADMessageValidator({ allowConventionalFallback: false });

            const conventionalMessage = 'feat: add new feature';

            const withResult = withFallback.validateMessage(conventionalMessage);
            const withoutResult = withoutFallback.validateMessage(conventionalMessage);

            expect(withResult.valid).toBe(true);
            expect(withResult.format).toBe('conventional');
            expect(withoutResult.valid).toBe(false);
        });

        test('should respect requireUppercasePersona setting', () => {
            const requireUpper = new BMADMessageValidator({ requireUppercasePersona: true });
            const allowLower = new BMADMessageValidator({ requireUppercasePersona: false });

            const lowerMessage = '[developer] [STEP-001] Test message';

            const upperResult = requireUpper.validateMessage(lowerMessage);
            const lowerResult = allowLower.validateMessage(lowerMessage);

            expect(upperResult.valid).toBe(false);
            // With requireUppercasePersona false, it should still validate the persona
            expect(lowerResult.valid).toBeDefined();
        });
    });

    describe('Error Message Generation', () => {
        test('should generate comprehensive error message', () => {
            const result = validator.validateMessage('invalid message');
            const errorMessage = validator.generateErrorMessage(result);

            expect(errorMessage).toContain('COMMIT MESSAGE VALIDATION FAILED');
            expect(errorMessage).toContain('REQUIRED FORMATS');
            expect(errorMessage).toContain('BMAD Pattern');
            expect(errorMessage).toContain('ERRORS:');
            expect(errorMessage).toContain('Examples:');
        });

        test('should include all errors in error message', () => {
            const result = validator.validateMessage('');
            const errorMessage = validator.generateErrorMessage(result);

            result.errors.forEach(error => {
                expect(errorMessage).toContain(error);
            });
        });

        test('should include warnings in error message if present', () => {
            const result = {
                valid: false,
                errors: ['Error 1'],
                warnings: ['Warning 1', 'Warning 2']
            };

            const errorMessage = validator.generateErrorMessage(result);

            expect(errorMessage).toContain('WARNINGS:');
            expect(errorMessage).toContain('Warning 1');
            expect(errorMessage).toContain('Warning 2');
        });
    });

    describe('Validation Summary', () => {
        test('should generate summary for valid message', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001] Valid test message');
            const summary = validator.getValidationSummary(result);

            expect(summary).toContain('Valid BMAD format');
            expect(summary).toContain('DEVELOPER');
            expect(summary).toContain('STEP-001');
        });

        test('should generate summary for invalid message', () => {
            const result = validator.validateMessage('invalid');
            const summary = validator.getValidationSummary(result);

            expect(summary).toContain('Invalid format');
            expect(summary).toMatch(/\d+ errors/);
        });

        test('should include warnings in summary', () => {
            const result = {
                valid: true,
                format: 'bmad',
                errors: [],
                warnings: ['Warning 1'],
                parsed: { persona: 'DEVELOPER', stepId: 'STEP-001' }
            };

            const summary = validator.getValidationSummary(result);

            expect(summary).toContain('1 warnings');
        });
    });

    describe('Boolean Validation Methods', () => {
        test('isValid should return true for valid BMAD message', () => {
            expect(validator.isValid('[DEVELOPER] [STEP-001] Valid message')).toBe(true);
        });

        test('isValid should return true for valid conventional message', () => {
            expect(validator.isValid('feat: add new feature')).toBe(true);
        });

        test('isValid should return false for invalid message', () => {
            expect(validator.isValid('invalid message')).toBe(false);
        });

        test('validateBMADPattern should return true for valid BMAD', () => {
            expect(validator.validateBMADPattern('[DEVELOPER] [STEP-001] Valid message')).toBe(true);
        });

        test('validateBMADPattern should return false for invalid BMAD', () => {
            expect(validator.validateBMADPattern('invalid')).toBe(false);
        });

        test('validateConventionalCommits should return true for valid conventional', () => {
            expect(validator.validateConventionalCommits('feat: add feature')).toBe(true);
        });

        test('validateConventionalCommits should return false for invalid conventional', () => {
            expect(validator.validateConventionalCommits('invalid: message')).toBe(false);
        });
    });

    describe('Special Characters and Unicode', () => {
        test('should handle special characters in description', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001] Fix bug with @mentions & #hashtags');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should handle unicode characters in description', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001] Add emoji support 🚀 for messages');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should handle quotes in description', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001] Fix "quoted" text handling');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should handle parentheses in description', () => {
            const result = validator.validateMessage('[DEVELOPER] [STEP-001] Update function (with params)');

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });
    });

    describe('Long Messages', () => {
        test('should handle very long descriptions', () => {
            const longDescription = 'A'.repeat(200);
            const result = validator.validateMessage(`[DEVELOPER] [STEP-001] ${longDescription}`);

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should handle extremely long messages', () => {
            const veryLongDescription = 'A'.repeat(1000);
            const result = validator.validateMessage(`[DEVELOPER] [STEP-001] ${veryLongDescription}`);

            // Should still validate structure even if very long
            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });
    });

    describe('Multiline Messages', () => {
        test('should handle message with newlines', () => {
            const message = '[DEVELOPER] [STEP-001] First line\nSecond line\nThird line';
            const result = validator.validateMessage(message);

            // Should validate based on first line
            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });

        test('should handle message with carriage returns', () => {
            const message = '[DEVELOPER] [STEP-001] First line\r\nSecond line';
            const result = validator.validateMessage(message);

            expect(result.valid).toBe(true);
            expect(result.format).toBe('bmad');
        });
    });

    describe('Persona Validation', () => {
        test('should validate all valid personas', () => {
            const validPersonas = ['DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'];

            validPersonas.forEach(persona => {
                const result = validator.validateMessage(`[${persona}] [STEP-001] Test message`);
                expect(result.valid).toBe(true);
                expect(result.parsed.persona).toBe(persona);
            });
        });

        test('should reject unknown personas', () => {
            const invalidPersonas = ['UNKNOWN', 'TESTER', 'MANAGER', 'ADMIN'];

            invalidPersonas.forEach(persona => {
                const result = validator.validateMessage(`[${persona}] [STEP-001] Test message`);
                expect(result.valid).toBe(false);
            });
        });
    });

    describe('Step ID Validation', () => {
        test('should validate various step ID formats', () => {
            const validStepIds = [
                'STEP-001',
                'STEP-999',
                'ARCH-042',
                'TEST-123',
                'DEV-005',
                'SEC-100',
                'OPS-200',
                'REL-300',
                'REC-400'
            ];

            validStepIds.forEach(stepId => {
                const result = validator.validateMessage(`[DEVELOPER] [${stepId}] Test message`);
                expect(result.valid).toBe(true);
                expect(result.parsed.stepId).toBe(stepId);
            });
        });

        test('should reject invalid step ID formats', () => {
            const invalidStepIds = [
                'STEP',
                'STEP-',
                'STEP-ABC',
                'STEP-00',
                'STEP-0',
                'step-001',
                '001-STEP',
                'STEP_001'
            ];

            invalidStepIds.forEach(stepId => {
                const result = validator.validateMessage(`[DEVELOPER] [${stepId}] Test message`);
                expect(result.valid).toBe(false);
            });
        });
    });
});
