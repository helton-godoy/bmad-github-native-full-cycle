/**
 * Property-Based Tests for BMAD Message Validator
 * Requirements: 1.2, 2.1, 2.2, 2.3
 */

const fc = require('fast-check');
const BMADMessageValidator = require('../../scripts/hooks/bmad-message-validator');

describe('BMAD Message Validator Property Tests', () => {
    let validator;

    beforeEach(() => {
        validator = new BMADMessageValidator({
            strictMode: true,
            allowConventionalFallback: true,
            requireUppercasePersona: true
        });
    });

    /**
     * **Feature: git-hooks-automation, Property 2: BMAD commit message validation**
     * **Validates: Requirements 1.2, 2.1, 2.3**
     */
    test('should accept messages if and only if they match BMAD pattern or conventional commit format', async () => {
        await fc.assert(fc.property(
            fc.oneof(
                // Valid BMAD messages
                fc.record({
                    persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'),
                    stepId: fc.record({
                        prefix: fc.constantFrom('STEP', 'ARCH', 'TEST', 'DEV', 'SEC', 'OPS', 'REL', 'REC'),
                        number: fc.integer({ min: 1, max: 999 })
                    }),
                    description: fc.string({ minLength: 5, maxLength: 80 }).filter(s => s.trim().length >= 5)
                }).map(({ persona, stepId, description }) => ({
                    message: `[${persona}] [${stepId.prefix}-${stepId.number.toString().padStart(3, '0')}] ${description.trim()}`,
                    expectedValid: true,
                    expectedFormat: 'bmad'
                })),

                // Valid conventional commit messages
                fc.record({
                    type: fc.constantFrom('feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'),
                    scope: fc.option(fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s))),
                    description: fc.string({ minLength: 3, maxLength: 80 }).filter(s => {
                        const trimmed = s.trim();
                        // Must start with alphanumeric and have reasonable content
                        return trimmed.length >= 3 && /^[a-zA-Z0-9].*[a-zA-Z0-9]$/.test(trimmed);
                    })
                }).map(({ type, scope, description }) => ({
                    message: `${type}${scope ? `(${scope})` : ''}: ${description.trim()}`,
                    expectedValid: true,
                    expectedFormat: 'conventional'
                })),

                // Invalid messages
                fc.oneof(
                    // Empty or whitespace
                    fc.constantFrom('', '   ', '\n', '\t'),
                    // Invalid BMAD format
                    fc.string({ minLength: 1, maxLength: 100 }).filter(s =>
                        !validator.validateBMADPattern(s) &&
                        !validator.validateConventionalCommits(s) &&
                        s.trim().length > 0
                    )
                ).map(message => ({
                    message,
                    expectedValid: false,
                    expectedFormat: null
                }))
            ),
            (testCase) => {
                const result = validator.validateMessage(testCase.message);

                // Property: Validation result should match expected validity
                expect(result.valid).toBe(testCase.expectedValid);

                if (testCase.expectedValid) {
                    // Property: Valid messages should have correct format classification
                    expect(result.format).toBe(testCase.expectedFormat);
                    expect(result.parsed).toBeDefined();
                    expect(result.errors).toHaveLength(0);

                    // Property: BMAD messages should have proper structure
                    if (testCase.expectedFormat === 'bmad') {
                        expect(result.parsed.persona).toBeDefined();
                        expect(result.parsed.stepId).toBeDefined();
                        expect(result.parsed.description).toBeDefined();
                        expect(result.parsed.fullMessage).toBe(testCase.message);
                    }

                    // Property: Conventional messages should have proper structure
                    if (testCase.expectedFormat === 'conventional') {
                        expect(result.parsed.type).toBeDefined();
                        expect(result.parsed.description).toBeDefined();
                        expect(result.parsed.fullMessage).toBe(testCase.message);
                    }
                } else {
                    // Property: Invalid messages should have errors
                    expect(result.format).toBeNull();
                    expect(result.errors.length).toBeGreaterThan(0);
                }

                // Property: Validation summary should be consistent
                const summary = validator.getValidationSummary(result);
                expect(summary).toBeDefined();
                expect(typeof summary).toBe('string');

                if (result.valid) {
                    expect(summary).toMatch(/Valid (BMAD|Conventional Commits) format/);
                } else {
                    expect(summary).toMatch(/Invalid format/);
                }
            }
        ), { numRuns: 100 });
    });

    test('should validate BMAD pattern components correctly', async () => {
        await fc.assert(fc.property(
            fc.record({
                persona: fc.string({ minLength: 1, maxLength: 20 }),
                stepPrefix: fc.string({ minLength: 1, maxLength: 10 }),
                stepNumber: fc.integer({ min: 0, max: 9999 }),
                description: fc.string({ minLength: 0, maxLength: 100 })
            }),
            (components) => {
                const message = `[${components.persona}] [${components.stepPrefix}-${components.stepNumber}] ${components.description}`;
                const result = validator.validateMessage(message);

                // Property: Validation should be consistent with individual component validation
                const isValidPersona = validator.validPersonas.includes(components.persona.toUpperCase());
                const isValidStepId = /^[A-Z]+-\d+$/.test(`${components.stepPrefix}-${components.stepNumber}`) && components.stepNumber > 0;
                const isValidDescription = components.description.trim().length >= 5;

                const shouldBeValid = isValidPersona && isValidStepId && isValidDescription;

                if (shouldBeValid) {
                    expect(result.valid).toBe(true);
                    expect(result.format).toBe('bmad');
                } else {
                    // If any component is invalid, the message should be invalid or have warnings
                    if (!result.valid) {
                        expect(result.errors.length).toBeGreaterThan(0);
                    }
                }
            }
        ), { numRuns: 50 });
    });

    test('should handle edge cases and malformed inputs gracefully', async () => {
        await fc.assert(fc.property(
            fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.integer(),
                fc.boolean(),
                fc.array(fc.string()),
                fc.object(),
                fc.string({ maxLength: 1000 }) // Very long strings
            ),
            (input) => {
                // Property: Validator should handle any input type gracefully
                expect(() => {
                    const result = validator.validateMessage(input);
                    expect(result).toBeDefined();
                    expect(typeof result.valid).toBe('boolean');
                    expect(Array.isArray(result.errors)).toBe(true);
                    expect(Array.isArray(result.warnings)).toBe(true);
                }).not.toThrow();

                // Property: Non-string inputs should be invalid
                if (typeof input !== 'string') {
                    const result = validator.validateMessage(input);
                    expect(result.valid).toBe(false);
                    expect(result.errors.length).toBeGreaterThan(0);
                }
            }
        ), { numRuns: 30 });
    });

    test('should provide consistent boolean validation methods', async () => {
        await fc.assert(fc.property(
            fc.string({ maxLength: 200 }),
            (message) => {
                const detailedResult = validator.validateMessage(message);
                const bmadResult = validator.validateBMADPattern(message);
                const conventionalResult = validator.validateConventionalCommits(message);
                const isValidResult = validator.isValid(message);

                // Property: Boolean methods should be consistent with detailed validation
                expect(isValidResult).toBe(detailedResult.valid);

                // Property: Format-specific methods should match detailed results
                if (detailedResult.valid && detailedResult.format === 'bmad') {
                    expect(bmadResult).toBe(true);
                } else if (detailedResult.valid && detailedResult.format === 'conventional') {
                    expect(conventionalResult).toBe(true);
                }

                // Property: If detailed validation fails, at least one format method should fail
                if (!detailedResult.valid) {
                    expect(bmadResult || conventionalResult).toBe(false);
                }
            }
        ), { numRuns: 50 });
    });

    test('should generate appropriate error messages for all invalid cases', async () => {
        await fc.assert(fc.property(
            fc.string({ maxLength: 100 }).filter(s => {
                const validator = new BMADMessageValidator();
                return !validator.isValid(s);
            }),
            (invalidMessage) => {
                const result = validator.validateMessage(invalidMessage);
                const errorMessage = validator.generateErrorMessage(result);

                // Property: Invalid messages should generate helpful error messages
                expect(result.valid).toBe(false);
                expect(errorMessage).toBeDefined();
                expect(typeof errorMessage).toBe('string');
                expect(errorMessage.length).toBeGreaterThan(0);

                // Property: Error message should contain format requirements
                expect(errorMessage).toMatch(/REQUIRED FORMATS/);
                expect(errorMessage).toMatch(/BMAD Pattern/);

                if (validator.allowConventionalFallback) {
                    expect(errorMessage).toMatch(/Conventional Commits/);
                }

                // Property: Error message should list specific errors
                expect(errorMessage).toMatch(/ERRORS:/);
            }
        ), { numRuns: 30 });
    });

    /**
     * **Feature: git-hooks-automation, Property 6: Commit rejection with clear errors**
     * **Validates: Requirements 2.2**
     */
    test('should prevent commits and display clear, actionable error messages for invalid formats', async () => {
        await fc.assert(fc.property(
            fc.oneof(
                // Empty or whitespace messages
                fc.constantFrom('', '   ', '\n', '\t', '    \n  \t  '),

                // Invalid BMAD patterns
                fc.record({
                    invalidPersona: fc.oneof(
                        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !validator.validPersonas.includes(s.toUpperCase())),
                        fc.constantFrom('developer', 'architect', 'pm') // lowercase
                    ),
                    stepId: fc.string({ minLength: 1, maxLength: 20 }),
                    description: fc.string({ minLength: 1, maxLength: 50 })
                }).map(({ invalidPersona, stepId, description }) =>
                    `[${invalidPersona}] [${stepId}] ${description}`
                ),

                // Malformed BMAD patterns
                fc.record({
                    persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'QA'),
                    description: fc.string({ minLength: 1, maxLength: 50 })
                }).map(({ persona, description }) => fc.oneof(
                    fc.constant(`${persona} ${description}`), // Missing brackets
                    fc.constant(`[${persona}] ${description}`), // Missing step ID
                    fc.constant(`[${persona}] [] ${description}`), // Empty step ID
                    fc.constant(`${persona} [STEP-001] ${description}`) // Missing persona brackets
                )).chain(x => x),

                // Invalid conventional commits
                fc.record({
                    invalidType: fc.string({ minLength: 1, maxLength: 20 }).filter(s =>
                        !['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'].includes(s)
                    ),
                    description: fc.string({ minLength: 1, maxLength: 50 })
                }).map(({ invalidType, description }) => `${invalidType}: ${description}`),

                // Malformed conventional commits
                fc.record({
                    type: fc.constantFrom('feat', 'fix', 'docs'),
                    description: fc.string({ minLength: 1, maxLength: 50 })
                }).map(({ type, description }) => fc.oneof(
                    fc.constant(`${type} ${description}`), // Missing colon
                    fc.constant(`${type}:${description}`), // Missing space after colon
                    fc.constant(`${type}:`), // Missing description
                    fc.constant(`${type}(): ${description}`) // Empty scope
                )).chain(x => x),

                // Random invalid strings
                fc.string({ minLength: 1, maxLength: 100 }).filter(s => {
                    const trimmed = s.trim();
                    return trimmed.length > 0 &&
                        !validator.validateBMADPattern(s) &&
                        !validator.validateConventionalCommits(s);
                })
            ),
            (invalidMessage) => {
                const result = validator.validateMessage(invalidMessage);

                // Property: Invalid messages should be rejected
                expect(result.valid).toBe(false);
                expect(result.format).toBeNull();

                // Property: Rejection should include clear error messages
                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors.every(error => typeof error === 'string' && error.length > 0)).toBe(true);

                // Property: Error message generation should provide actionable guidance
                const errorMessage = validator.generateErrorMessage(result);
                expect(errorMessage).toBeDefined();
                expect(typeof errorMessage).toBe('string');
                expect(errorMessage.length).toBeGreaterThan(0);

                // Property: Error message should contain required format information
                expect(errorMessage).toMatch(/REQUIRED FORMATS/);
                expect(errorMessage).toMatch(/BMAD Pattern/);

                // Property: Error message should list specific errors
                expect(errorMessage).toMatch(/ERRORS:/);

                // Property: Error message should provide examples
                expect(errorMessage).toMatch(/Examples:/);

                // Property: Error message should include rules
                expect(errorMessage).toMatch(/RULES:/);

                // Property: Validation summary should indicate failure
                const summary = validator.getValidationSummary(result);
                expect(summary).toMatch(/Invalid format/);
                expect(summary).toMatch(/\d+ errors/);

                // Property: Boolean validation methods should be consistent
                expect(validator.isValid(invalidMessage)).toBe(false);
            }
        ), { numRuns: 100 });
    });

    test('should provide specific error messages for different types of validation failures', async () => {
        await fc.assert(fc.property(
            fc.oneof(
                // Test specific error scenarios
                fc.record({
                    scenario: fc.constant('empty_message'),
                    message: fc.constantFrom('', '   ', '\n')
                }),
                fc.record({
                    scenario: fc.constant('invalid_step_id'),
                    message: fc.constantFrom('[DEVELOPER] [INVALID] Test', '[DEVELOPER] [] Test')
                }),
                fc.record({
                    scenario: fc.constant('missing_description'),
                    message: fc.constantFrom('[DEVELOPER] [STEP-001]', '[DEVELOPER] [STEP-001] ')
                }),
                fc.record({
                    scenario: fc.constant('malformed_structure'),
                    message: fc.constantFrom('DEVELOPER STEP-001 Test', '[DEVELOPER STEP-001] Test')
                }),
                fc.record({
                    scenario: fc.constant('invalid_conventional'),
                    message: fc.constantFrom('invalid: test', 'feat test', 'feat:', 'feat:test')
                })
            ),
            ({ scenario, message }) => {
                const result = validator.validateMessage(message);

                // Property: Each error scenario should be properly rejected
                expect(result.valid).toBe(false);

                // Property: Error messages should be specific to the failure type
                expect(result.errors.length).toBeGreaterThan(0);

                switch (scenario) {
                    case 'empty_message':
                        expect(result.errors.some(err => err.includes('empty') || err.includes('required'))).toBe(true);
                        break;
                    case 'invalid_step_id':
                        // For invalid step IDs that match the regex, we should get specific errors
                        expect(result.errors.some(err =>
                            err.includes('Step ID') ||
                            err.includes('format') ||
                            err.includes('pattern') ||
                            err.includes('required')
                        )).toBe(true);
                        break;
                    case 'missing_description':
                        expect(result.errors.some(err =>
                            err.includes('description') ||
                            err.includes('required') ||
                            err.includes('pattern')
                        )).toBe(true);
                        break;
                    case 'malformed_structure':
                        expect(result.errors.some(err =>
                            err.includes('pattern') ||
                            err.includes('format') ||
                            err.includes('BMAD')
                        )).toBe(true);
                        break;
                    case 'invalid_conventional':
                        expect(result.errors.some(err =>
                            err.includes('conventional') ||
                            err.includes('pattern') ||
                            err.includes('format')
                        )).toBe(true);
                        break;
                }

                // Property: Error message should provide clear guidance
                const errorMessage = validator.generateErrorMessage(result);
                expect(errorMessage).toContain('COMMIT MESSAGE VALIDATION FAILED');
                expect(errorMessage).toContain('REQUIRED FORMATS');
            }
        ), { numRuns: 50 });
    });

    test('should handle edge cases in error reporting gracefully', async () => {
        await fc.assert(fc.property(
            fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.integer(),
                fc.boolean(),
                fc.array(fc.string()),
                fc.object(),
                fc.string({ maxLength: 0 }), // Empty string
                fc.string({ minLength: 1000, maxLength: 2000 }) // Very long string
            ),
            (input) => {
                // Property: Error handling should never throw exceptions
                expect(() => {
                    const result = validator.validateMessage(input);
                    const errorMessage = validator.generateErrorMessage(result);
                    const summary = validator.getValidationSummary(result);

                    // All methods should return valid results
                    expect(result).toBeDefined();
                    expect(typeof result.valid).toBe('boolean');
                    expect(Array.isArray(result.errors)).toBe(true);

                    if (!result.valid) {
                        expect(errorMessage).toBeDefined();
                        expect(typeof errorMessage).toBe('string');
                        expect(summary).toMatch(/Invalid format/);
                    }
                }).not.toThrow();

                // Property: Non-string inputs should always be invalid
                if (typeof input !== 'string') {
                    const result = validator.validateMessage(input);
                    expect(result.valid).toBe(false);
                    expect(result.errors.length).toBeGreaterThan(0);
                }
            }
        ), { numRuns: 30 });
    });
});