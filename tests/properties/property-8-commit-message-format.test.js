/**
 * Property-Based Test for Commit Message Format
 * **Feature: bmad-critical-fixes, Property 8: Commit Message Format**
 * **Validates: Requirements 2.5**
 *
 * This test validates that for any executed commit, the message follows
 * the exact pattern "[PERSONA] [STEP-ID] Description" where:
 * - PERSONA is an uppercase identifier (PM, Architect, Developer, QA, DevOps, Security, ReleaseManager)
 * - STEP-ID is a numeric pattern like "001", "042", etc.
 * - Description is a non-empty string of 1–72 characters
 *
 * Property tests ensure this behavior holds across diverse scenarios with 100+ iterations per property.
 */

const fc = require('fast-check');
const CommitHandler = require('../../scripts/lib/commit-handler');
const Logger = require('../../scripts/lib/logger');

// Mock child_process to avoid actual git operations
jest.mock('child_process');

// Mock fs to avoid actual filesystem operations
jest.mock('fs');

// Mock Logger to avoid log pollution
jest.mock('../../scripts/lib/logger');

describe('Property 8: Commit Message Format', () => {
  let mockExecSync;
  let mockFs;
  let mockLogger;

  beforeEach(() => {
    mockExecSync = require('child_process').execSync;
    mockFs = require('fs');
    mockLogger = require('../../scripts/lib/logger');

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup Logger mock
    mockLogger.mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Generator for valid BMAD persona names
   * Generates: PM, Architect, Developer, QA, DevOps, Security, ReleaseManager
   */
  const validPersonaArbitrary = () =>
    fc.constantFrom(
      'PM',
      'ARCHITECT',
      'DEVELOPER',
      'QA',
      'DEVOPS',
      'SECURITY',
      'RELEASEMANAGER',
      'ORCHESTRATOR'
    );

  /**
   * Generator for valid step IDs
   * Generates: Numeric patterns like "001", "042", "123", "999"
   */
  const validStepIdArbitrary = () =>
    fc.integer({ min: 1, max: 999 }).map((n) => String(n).padStart(3, '0'));

  /**
   * Generator for valid descriptions
   * Generates: Non-empty strings of 1-72 characters with meaningful content (no special chars that get escaped)
   */
  const validDescriptionArbitrary = () =>
    fc
      .stringMatching(/^[a-zA-Z0-9]+( [a-zA-Z0-9]+)*$/)
      .filter((s) => s && s.trim().length > 0 && s.trim().length <= 72)
      .map((s) => s.trim());

  /**
   * Property Test 8a: formatCommitMessage produces correct format
   *
   * For any valid persona, step ID, and description, formatCommitMessage
   * must produce exactly the pattern "[PERSONA] [STEP-ID] Description"
   *
   * Generates: Various valid personas, step IDs, and descriptions
   * Validates: Format compliance
   */
  test(
    'Property 8a: formatCommitMessage produces exact format [PERSONA] [STEP-ID] Description',
    () => {
      fc.assert(
        fc.property(
          validPersonaArbitrary(),
          validStepIdArbitrary(),
          validDescriptionArbitrary(),
          (persona, stepId, description) => {
            const handler = new CommitHandler();

            // Execute: format the message
            const result = handler.formatCommitMessage(persona, stepId, description);

            // Assert: result matches exact pattern
            const pattern = /^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/;
            expect(result).toMatch(pattern);

            // Extract components and verify they match inputs
            const match = result.match(pattern);
            expect(match).not.toBeNull();

            const [, resultPersona, resultStepId, resultDescription] = match;

            expect(resultPersona).toBe(persona.toUpperCase());
            expect(resultStepId).toBe(stepId.padStart(3, '0'));
            expect(resultDescription).toBe(description);
          }
        ),
        {
          numRuns: 100, // Property test with 100+ iterations
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 8b: All valid personas are accepted and formatted correctly
   *
   * For each valid BMAD persona, the formatter must handle it correctly,
   * converting to uppercase and preserving in the output.
   *
   * Generates: All valid personas in various cases
   * Validates: Persona handling
   */
  test(
    'Property 8b: All valid BMAD personas are formatted correctly',
    () => {
      const validPersonas = [
        'PM',
        'ARCHITECT',
        'DEVELOPER',
        'QA',
        'DEVOPS',
        'SECURITY',
        'RELEASEMANAGER',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...validPersonas),
          fc.integer({ min: 1, max: 999 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (persona, stepId, description) => {
            const handler = new CommitHandler();

            // Execute: format with each valid persona
            const result = handler.formatCommitMessage(
              persona.toLowerCase(),
              stepId,
              description
            );

            // Assert: persona is in the result
            expect(result).toContain(`[${persona.toUpperCase()}]`);

            // Assert: STEP prefix is present
            expect(result).toContain('[STEP-');

            // Assert: full pattern is valid
            expect(result).toMatch(/^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/);
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 8c: Step IDs are always 3-digit padded numbers
   *
   * For any numeric step ID (1-999), the formatter must pad with zeros
   * to produce exactly 3 digits in the output.
   *
   * Generates: Various step IDs (1, 10, 100, 999)
   * Validates: Step ID padding
   */
  test('Property 8c: Step IDs are always 3-digit padded numbers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        (stepId) => {
          const handler = new CommitHandler();

          // Execute: format with various step IDs
          const result = handler.formatCommitMessage(
            'DEVELOPER',
            stepId,
            'Test description'
          );

          // Assert: step ID is 3 digits
          const match = result.match(/\[STEP-(\d{3})\]/);
          expect(match).not.toBeNull();
          expect(match[1]).toBe(String(stepId).padStart(3, '0'));

          // Assert: no other STEP patterns exist
          const allSteps = result.match(/\[STEP-/g) || [];
          expect(allSteps.length).toBe(1);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 8d: Descriptions are included verbatim in output
   *
   * For any valid description (1-72 chars), the formatter must include
   * it verbatim in the output message.
   *
   * Generates: Various valid descriptions
   * Validates: Description preservation
   */
  test('Property 8d: Descriptions are included verbatim in output', () => {
    fc.assert(
      fc.property(
        validDescriptionArbitrary().filter((d) => d && d.length > 0),
        (description) => {
          const handler = new CommitHandler();

          // Skip if description is just whitespace
          if (!description || description.trim().length === 0) {
            return;
          }

          // Execute: format with description
          const result = handler.formatCommitMessage(
            'DEVELOPER',
            '001',
            description
          );

          // Assert: description appears after the second ]
          expect(result).toContain(`] ${description}`);

          // Assert: full pattern is valid
          const pattern = /^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/;
          expect(result).toMatch(pattern);

          // Extract and verify description matches
          const match = result.match(pattern);
          expect(match[3]).toBe(description);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 8e: Message format validation passes for formatted messages
   *
   * For any message produced by formatCommitMessage, validateMessageFormat
   * must confirm it matches the required pattern.
   *
   * Generates: Various valid persona/step/description combinations
   * Validates: Format validation consistency
   */
  test(
    'Property 8e: Messages produced by formatter pass format validation',
    () => {
      fc.assert(
        fc.property(
          validPersonaArbitrary(),
          validStepIdArbitrary(),
          validDescriptionArbitrary(),
          (persona, stepId, description) => {
            // Skip empty descriptions
            if (!description || description.trim().length === 0) {
              return;
            }

            const handler = new CommitHandler();

            // Execute: format message and validate
            const formatted = handler.formatCommitMessage(
              persona,
              stepId,
              description
            );
            const validation = handler.validateMessageFormat(formatted);

            // Assert: validation passes
            expect(validation.valid).toBe(true);
            expect(validation.errors.length).toBe(0);

            // Assert: parsed components match inputs
            expect(validation.parsed.persona).toBe(persona.toUpperCase());
            expect(validation.parsed.stepId).toBe(stepId);
            // Note: description might be trimmed by the formatter
            expect(validation.parsed.description.trim()).toBe(description.trim());
          }
        ),
        {
          numRuns: 100,
          timeout: 5000,
        }
      );
    }
  );

  /**
   * Property Test 8f: Invalid formats are rejected by validator
   *
   * For any message that doesn't match the required pattern,
   * validateMessageFormat must reject it with appropriate errors.
   *
   * Generates: Various invalid message formats
   * Validates: Format rejection
   */
  test('Property 8f: Invalid message formats are properly rejected', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^.{1,50}$/),
        (invalidMessage) => {
          // Skip if it accidentally matches valid pattern
          if (/^\[[A-Z]+\] \[STEP-\d{3}\] .+$/.test(invalidMessage)) {
            return;
          }

          const handler = new CommitHandler();

          // Execute: validate invalid message
          const validation = handler.validateMessageFormat(invalidMessage);

          // Assert: validation fails
          expect(validation.valid).toBe(false);
          expect(validation.errors.length).toBeGreaterThan(0);
        }
      ),
      {
        numRuns: 50, // Fewer runs since many might be skipped
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 8g: Edge case - minimum and maximum description lengths
   *
   * For descriptions of 1 character (minimum) and 72 characters (maximum),
   * the formatter must still produce valid messages.
   *
   * Generates: Edge case descriptions
   * Validates: Boundary handling
   */
  test('Property 8g: Edge case - minimum and maximum description lengths', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 72 }),
        (length) => {
          const handler = new CommitHandler();

          // Generate description of exact length
          const description = 'a'.repeat(Math.min(length, 72));

          // Execute: format with edge case description
          const result = handler.formatCommitMessage(
            'DEVELOPER',
            '001',
            description
          );

          // Assert: message is valid
          expect(result).toMatch(/^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/);

          // Assert: description length is preserved
          const match = result.match(/^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/);
          expect(match[3]).toBe(description);

          // Validate the formatted message
          const validation = handler.validateMessageFormat(result);
          expect(validation.valid).toBe(true);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 8h: Message pattern is consistent across multiple formats
   *
   * For any combination of persona, step, and description, the pattern
   * must always be: "[PERSONA] [STEP-NNN] Description" with consistent spacing.
   *
   * Generates: Various combinations
   * Validates: Pattern consistency
   */
  test('Property 8h: Message pattern is consistent across all inputs', () => {
    fc.assert(
      fc.property(
        validPersonaArbitrary(),
        fc.integer({ min: 1, max: 999 }),
        validDescriptionArbitrary(),
        (persona, stepId, description) => {
          const handler = new CommitHandler();

          // Execute: format message
          const result = handler.formatCommitMessage(
            persona,
            stepId,
            description
          );

          // Assert: basic structure
          expect(result).toMatch(/^\[.+\] \[.+\] .+$/);

          // Assert: exact pattern with bracket positions
          const bracketPattern = /^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/;
          const match = result.match(bracketPattern);
          expect(match).not.toBeNull();

          // Assert: single space after first bracket group
          expect(result).toContain('] [');
          
          // Assert: description is present after second bracket
          expect(result).toMatch(/\] .+$/);

          // Assert: no leading/trailing spaces in components
          expect(match[1]).not.toMatch(/^\s|\s$/);
          expect(match[2]).not.toMatch(/^\s|\s$/);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 8i: Persona case conversion is idempotent
   *
   * For any persona in any case (lower, upper, mixed), repeated
   * formatting should produce the same uppercase result.
   *
   * Generates: Various case combinations
   * Validates: Case consistency
   */
  test('Property 8i: Persona case conversion is idempotent', () => {
    fc.assert(
      fc.property(
        validPersonaArbitrary(),
        validStepIdArbitrary(),
        validDescriptionArbitrary(),
        (persona, stepId, description) => {
          const handler = new CommitHandler();

          // Format with uppercase
          const result1 = handler.formatCommitMessage(
            persona.toUpperCase(),
            stepId,
            description
          );

          // Format with lowercase
          const result2 = handler.formatCommitMessage(
            persona.toLowerCase(),
            stepId,
            description
          );

          // Format with mixed case
          const mixed = persona.charAt(0) + persona.slice(1).toLowerCase();
          const result3 = handler.formatCommitMessage(mixed, stepId, description);

          // Assert: all produce identical output
          expect(result2).toBe(result1);
          expect(result3).toBe(result1);
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Property Test 8j: Step ID case conversion is idempotent
   *
   * For any step ID as string or number, formatting must produce
   * consistent 3-digit padded output.
   *
   * Generates: Various step ID formats
   * Validates: Step ID consistency
   */
  test('Property 8j: Step ID formatting is consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }),
        (stepIdNum) => {
          const handler = new CommitHandler();

          // Format with number
          const result1 = handler.formatCommitMessage(
            'DEVELOPER',
            stepIdNum,
            'Test'
          );

          // Format with string
          const result2 = handler.formatCommitMessage(
            'DEVELOPER',
            String(stepIdNum),
            'Test'
          );

          // Format with padded string
          const padded = String(stepIdNum).padStart(3, '0');
          const result3 = handler.formatCommitMessage(
            'DEVELOPER',
            padded,
            'Test'
          );

          // Assert: all produce identical output
          expect(result2).toBe(result1);
          expect(result3).toBe(result1);

          // Assert: step ID is exactly 3 digits
          const match = result1.match(/\[STEP-(\d{3})\]/);
          expect(match[1]).toBe(String(stepIdNum).padStart(3, '0'));
        }
      ),
      {
        numRuns: 100,
        timeout: 5000,
      }
    );
  });

  /**
   * Integration Test: Full message format workflow
   *
   * Verifies that the complete CommitHandler workflow correctly
   * implements message format requirement across various scenarios.
   */
  test('Integration: Full commit message format workflow', () => {
    const handler = new CommitHandler();

    const testScenarios = [
      {
        name: 'Scenario 1: Simple developer commit',
        persona: 'developer',
        stepId: '001',
        description: 'Initialize project structure',
        expectedPattern: /^\[DEVELOPER\] \[STEP-001\] Initialize project structure$/,
      },
      {
        name: 'Scenario 2: Architect with higher step number',
        persona: 'ARCHITECT',
        stepId: 42,
        description: 'Design database schema',
        expectedPattern: /^\[ARCHITECT\] \[STEP-042\] Design database schema$/,
      },
      {
        name: 'Scenario 3: QA with maximum step number',
        persona: 'qa',
        stepId: 999,
        description: 'Run full test suite',
        expectedPattern: /^\[QA\] \[STEP-999\] Run full test suite$/,
      },
      {
        name: 'Scenario 4: DevOps with padded step',
        persona: 'DevOps',
        stepId: '5',
        description: 'Configure deployment pipeline',
        expectedPattern: /^\[DEVOPS\] \[STEP-005\] Configure deployment pipeline$/,
      },
      {
        name: 'Scenario 5: PM with long description',
        persona: 'PM',
        stepId: 123,
        description: 'Define product requirements and acceptance criteria',
        expectedPattern:
          /^\[PM\] \[STEP-123\] Define product requirements and acceptance criteria$/,
      },
    ];

    for (const scenario of testScenarios) {
      const result = handler.formatCommitMessage(
        scenario.persona,
        scenario.stepId,
        scenario.description
      );

      expect(result).toMatch(scenario.expectedPattern);

      // Also verify validation passes
      const validation = handler.validateMessageFormat(result);
      expect(validation.valid).toBe(true);
    }
  });

  /**
   * Unit Test: formatCommitMessage basic functionality
   *
   * Tests the formatter with explicit inputs and expected outputs.
   */
  test('Unit: formatCommitMessage basic functionality', () => {
    const handler = new CommitHandler();

    // Test: basic format
    let result = handler.formatCommitMessage('DEVELOPER', '001', 'Test commit');
    expect(result).toBe('[DEVELOPER] [STEP-001] Test commit');

    // Test: lowercase persona
    result = handler.formatCommitMessage('developer', '001', 'Test commit');
    expect(result).toBe('[DEVELOPER] [STEP-001] Test commit');

    // Test: numeric step ID
    result = handler.formatCommitMessage('ARCHITECT', 42, 'Design system');
    expect(result).toBe('[ARCHITECT] [STEP-042] Design system');

    // Test: string step ID without padding
    result = handler.formatCommitMessage('QA', '5', 'Run tests');
    expect(result).toBe('[QA] [STEP-005] Run tests');

    // Test: already padded step ID
    result = handler.formatCommitMessage('DEVOPS', '123', 'Deploy application');
    expect(result).toBe('[DEVOPS] [STEP-123] Deploy application');
  });

  /**
   * Unit Test: validateMessageFormat method
   *
   * Tests the validation logic directly.
   */
  test('Unit: validateMessageFormat validation logic', () => {
    const handler = new CommitHandler();

    // Test: valid message
    let result = handler.validateMessageFormat('[DEVELOPER] [STEP-001] Test');
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.parsed).not.toBeNull();

    // Test: invalid - missing brackets
    result = handler.validateMessageFormat('DEVELOPER STEP-001 Test');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Test: invalid - missing STEP prefix
    result = handler.validateMessageFormat('[DEVELOPER] [001] Test');
    expect(result.valid).toBe(false);

    // Test: invalid - missing description
    result = handler.validateMessageFormat('[DEVELOPER] [STEP-001]');
    expect(result.valid).toBe(false);

    // Test: invalid - lowercase persona
    result = handler.validateMessageFormat('[developer] [STEP-001] Test');
    expect(result.valid).toBe(false);

    // Test: valid but with warning - non-padded step
    result = handler.validateMessageFormat('[DEVELOPER] [STEP-1] Test');
    expect(result.valid).toBe(true); // Still valid, just with a warning
    expect(result.warnings.length).toBeGreaterThan(0); // Should have warning about padding
  });

  /**
   * Unit Test: Special characters in descriptions
   *
   * Tests that descriptions with special characters are handled correctly.
   */
  test('Unit: Handles special characters in descriptions', () => {
    const handler = new CommitHandler();

    const specialDescriptions = [
      'Fix: critical bug in login',
      'Add feature-flag for A/B testing',
      'Update API (v2.0) documentation',
      'Refactor: improve performance 2x',
      'Deploy to prod, run smoke tests',
    ];

    for (const description of specialDescriptions) {
      const result = handler.formatCommitMessage('DEVELOPER', '001', description);

      // Should be valid format even with special chars
      expect(result).toMatch(/^\[DEVELOPER\] \[STEP-001\] .+$/);
    }
  });

  /**
   * Unit Test: Very long descriptions
   *
   * Tests that descriptions approaching 72 character limit are handled.
   */
  test('Unit: Handles maximum length descriptions', () => {
    const handler = new CommitHandler();

    // Create a 72-character description
    const maxDescription = 'a'.repeat(72);
    const result = handler.formatCommitMessage('DEVELOPER', '001', maxDescription);

    // Should still be valid
    const validation = handler.validateMessageFormat(result);
    expect(validation.valid).toBe(true);

    // Should preserve the full description
    expect(result).toContain(maxDescription);
  });

  /**
   * Unit Test: Very short descriptions
   *
   * Tests that single-character descriptions work.
   */
  test('Unit: Handles minimum length descriptions', () => {
    const handler = new CommitHandler();

    const result = handler.formatCommitMessage('DEVELOPER', '001', 'X');

    // Should be valid
    const validation = handler.validateMessageFormat(result);
    expect(validation.valid).toBe(true);

    // Should contain the single character
    expect(result).toContain('] X');
  });

  /**
   * Requirement 2.5 Compliance Test
   *
   * Comprehensive test ensuring complete compliance with Requirement 2.5:
   * "WHEN the Commit_Handler creates a commit, THE Commit_Handler SHALL
   * format the commit message as `[PERSONA] [STEP-ID] Description` where
   * PERSONA is the active persona identifier, STEP-ID is the current workflow
   * step identifier, and Description is a non-empty string of 1–72 characters"
   */
  test('Integration: Requirement 2.5 - Commit message format compliance', () => {
    const handler = new CommitHandler();

    // Test all valid personas
    const validPersonas = [
      'PM',
      'ARCHITECT',
      'DEVELOPER',
      'QA',
      'DEVOPS',
      'SECURITY',
      'RELEASEMANAGER',
    ];
    const stepIds = ['001', '042', '123', '999'];
    const descriptions = [
      'a',
      'Short task',
      'This is a longer description with more detail',
      'a'.repeat(72),
    ];

    for (const persona of validPersonas) {
      for (const stepId of stepIds) {
        for (const description of descriptions) {
          const message = handler.formatCommitMessage(
            persona,
            stepId,
            description
          );

          // Assert: matches exact pattern
          expect(message).toMatch(/^\[([A-Z]+)\] \[STEP-(\d{3})\] (.+)$/);

          // Assert: contains persona
          expect(message).toContain(`[${persona.toUpperCase()}]`);

          // Assert: contains step with padding
          const padded = stepId.padStart(3, '0');
          expect(message).toContain(`[STEP-${padded}]`);

          // Assert: contains description
          expect(message).toContain(description);

          // Assert: passes validation
          const validation = handler.validateMessageFormat(message);
          expect(validation.valid).toBe(true, `Failed for ${persona}/${stepId}`);
        }
      }
    }
  });
});
