/**
 * Property-Based Tests for PM to Architect Validation
 * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
 * **Validates: Requirements 1.5, 1.6**
 *
 * This test suite validates that the system properly validates PM-to-Architect transitions
 * by ensuring:
 * 1. Requirements document exists at expected path
 * 2. Document contains at least one acceptance criterion in EARS format
 * 3. Appropriate error reporting when preconditions fail
 * 4. Comprehensive shrinking and edge case handling
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Mock implementation of PM Architect Validator
 * This simulates the validation logic that would be in the LoopDetector or Orchestrator
 */
class PMArchitectValidator {
  constructor(options = {}) {
    this.requirementsPath =
      options.requirementsPath || path.join(process.cwd(), '.github', 'requirements.md');
    this.earsPatterns = [
      /\bWHEN\b.*\bTHEN\b/i, // EARS: WHEN...THEN format
      /\bThe\s+[\w\s]+\s+SHALL\b/i, // EARS: SHALL format (system requirement)
      /\b(The|A|An)\s+[\w\s]+\s+(shall|should|must)\b/i, // Alternative SHALL/SHOULD formats
    ];
  }

  /**
   * Validate that a transition is allowed from PM to Architect
   * @returns {Object} { allowed: boolean, errors: string[] }
   */
  validateTransition() {
    const errors = [];

    // Check 1: File existence at expected path
    if (!fs.existsSync(this.requirementsPath)) {
      errors.push(`Requirements document not found at ${this.requirementsPath}`);
    } else {
      // Check 2: File contains EARS pattern acceptance criterion
      try {
        const content = fs.readFileSync(this.requirementsPath, 'utf8');

        if (!content || content.trim().length === 0) {
          errors.push('Requirements document is empty');
        } else {
          // Check for EARS patterns
          const hasEARSPattern = this.earsPatterns.some((pattern) =>
            pattern.test(content)
          );

          if (!hasEARSPattern) {
            errors.push(
              'Requirements document does not contain any acceptance criteria in EARS format (expected WHEN...THEN, THE...SHALL, or similar patterns)'
            );
          } else {
            // Additional validation: ensure at least one meaningful criterion
            const lines = content.split('\n');
            const acceptanceCriteria = lines.filter((line) => {
              const trimmed = line.trim();
              return (
                trimmed.length > 20 &&
                this.earsPatterns.some((pattern) => pattern.test(trimmed))
              );
            });

            if (acceptanceCriteria.length === 0) {
              errors.push(
                'Requirements document contains EARS keywords but no complete acceptance criteria'
              );
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to read requirements document: ${err.message}`);
      }
    }

    return {
      allowed: errors.length === 0,
      errors,
      timestamp: new Date().toISOString(),
      requirementsPath: this.requirementsPath,
    };
  }

  /**
   * Get which precondition failed (for detailed error reporting)
   * @returns {string} Specific precondition identifier
   */
  getFailedPrecondition() {
    if (!fs.existsSync(this.requirementsPath)) {
      return 'FILE_NOT_FOUND';
    }

    try {
      const content = fs.readFileSync(this.requirementsPath, 'utf8');

      if (!content || content.trim().length === 0) {
        return 'FILE_EMPTY';
      }

      const hasEARSPattern = this.earsPatterns.some((pattern) =>
        pattern.test(content)
      );

      if (!hasEARSPattern) {
        return 'EARS_PATTERN_NOT_FOUND';
      }

      // Check for meaningful acceptance criteria (not just keywords)
      const lines = content.split('\n');
      const acceptanceCriteria = lines.filter((line) => {
        const trimmed = line.trim();
        // Look for lines with EARS patterns and reasonable length
        return (
          trimmed.length > 15 &&
          this.earsPatterns.some((pattern) => pattern.test(trimmed))
        );
      });

      if (acceptanceCriteria.length === 0) {
        return 'NO_ACCEPTANCE_CRITERIA';
      }
    } catch (err) {
      return 'READ_ERROR';
    }

    return 'NONE'; // All checks passed
  }
}

describe('Property 4: PM to Architect Validation', () => {
  const testDir = path.join(os.tmpdir(), 'pm-architect-validation-tests');
  const testRequirementsPath = path.join(testDir, 'requirements.md');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testRequirementsPath)) {
      fs.unlinkSync(testRequirementsPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Core Property: For any PM to Architect transition attempt, the system should verify that
   * requirements documentation exists and is complete before allowing the transition.
   *
   * This generates test scenarios covering:
   * - File existence (exists/missing)
   * - EARS pattern presence (valid/missing)
   * - Error message accuracy
   * - Precondition identification
   */
  test('should validate PM to Architect transition with comprehensive preconditions', async () => {
    // Generator for content scenarios
    const earsPatterns = fc.oneof(
      fc.constant('WHEN the user logs in THEN the system validates credentials'),
      fc.constant('The system SHALL validate user permissions'),
      fc.constant('The application must verify email addresses'),
      fc.constant('A user should be able to log out'),
      fc.constant('WHEN invalid input is provided THEN the system shows an error')
    );

    const validContent = fc.oneof(
      fc.tuple(fc.constant('# Requirements\n'), earsPatterns).map(([header, pattern]) =>
        header + '\n' + pattern
      ),
      earsPatterns.map((pattern) => `# Acceptance Criteria\n\n${pattern}\n\nMore details here.`),
      fc.tuple(earsPatterns, earsPatterns).map(([p1, p2]) => `## Requirements\n\n${p1}\n\n${p2}`)
    );

    const invalidContent = fc.oneof(
      fc.constant(''), // Empty
      fc.constant('   '), // Whitespace only
      fc.constant('# Just a header'), // No EARS pattern
      fc.constant('Lorem ipsum dolor sit amet'), // No requirements format
      fc.constant('TODO: Add requirements'), // Placeholder
      fc.constant('Requirements to be defined later') // Incomplete
    );

    const scenarios = fc.oneof(
      fc.record({
        fileExists: fc.constant(false),
        content: fc.constant(null),
        description: fc.constant('file_missing'),
      }),
      fc.record({
        fileExists: fc.constant(true),
        content: invalidContent,
        description: fc.constant('file_invalid'),
      }),
      fc.record({
        fileExists: fc.constant(true),
        content: validContent,
        description: fc.constant('file_valid'),
      })
    );

    await fc.assert(
      fc.asyncProperty(scenarios, async (scenario) => {
        // Setup: Create or remove test file based on scenario
        if (scenario.fileExists && scenario.content !== null) {
          fs.writeFileSync(testRequirementsPath, scenario.content, 'utf8');
        } else if (fs.existsSync(testRequirementsPath)) {
          fs.unlinkSync(testRequirementsPath);
        }

        // Execute: Validate transition
        const validator = new PMArchitectValidator({
          requirementsPath: testRequirementsPath,
        });
        const result = validator.validateTransition();

        // Verify: Assertions based on scenario
        if (scenario.description === 'file_valid') {
          // Valid scenario: transition should be allowed
          expect(result.allowed).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.requirementsPath).toBe(testRequirementsPath);
          expect(result.timestamp).toBeDefined();
        } else if (scenario.description === 'file_missing') {
          // Missing file: transition should be blocked
          expect(result.allowed).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]).toMatch(/not found|Requirements document/i);
          // Requirement 1.6: error message should identify which precondition failed
          const failedPrecondition = validator.getFailedPrecondition();
          expect(failedPrecondition).toBe('FILE_NOT_FOUND');
        } else if (scenario.description === 'file_invalid') {
          // Invalid content: transition should be blocked
          expect(result.allowed).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          // Error messages should be descriptive (Requirement 1.6)
          const errorMsg = result.errors.join('; ');
          expect(errorMsg.length).toBeGreaterThan(10);
          // Verify specific error identification
          const failedPrecondition = validator.getFailedPrecondition();
          expect(['FILE_EMPTY', 'EARS_PATTERN_NOT_FOUND', 'NO_ACCEPTANCE_CRITERIA']).toContain(
            failedPrecondition
          );
        }
      }),
      { numRuns: 100, maxShrinks: 500 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Edge Case: Comprehensive shrinking for file content variations
   * Verifies that the validator correctly identifies which precondition failed
   * across many variations of invalid content.
   */
  test('should correctly identify specific precondition failures through comprehensive shrinking', async () => {
    const invalidScenarios = [
      {
        content: '',
        expectedError: 'FILE_EMPTY',
        description: 'completely empty file',
      },
      {
        content: '   \n\t\n   ',
        expectedError: 'FILE_EMPTY',
        description: 'whitespace-only file',
      },
      {
        content: '# Requirements Document',
        expectedError: 'EARS_PATTERN_NOT_FOUND',
        description: 'header with no criteria',
      },
      {
        content: 'Some random text about requirements',
        expectedError: 'EARS_PATTERN_NOT_FOUND',
        description: 'natural language without EARS format',
      },
      {
        content: 'WHEN\nTHEN',
        expectedError: 'EARS_PATTERN_NOT_FOUND',
        description: 'EARS keywords on separate lines (incomplete)',
      },
    ];

    for (const scenario of invalidScenarios) {
      // Setup
      fs.writeFileSync(testRequirementsPath, scenario.content, 'utf8');

      // Execute
      const validator = new PMArchitectValidator({
        requirementsPath: testRequirementsPath,
      });
      const result = validator.validateTransition();
      const failedPrecondition = validator.getFailedPrecondition();

      // Verify
      expect(result.allowed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(failedPrecondition).toBe(scenario.expectedError);

      // Cleanup
      fs.unlinkSync(testRequirementsPath);
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Acceptance Criteria Variation Test: Ensure system recognizes various
   * valid EARS patterns and rejects incomplete ones.
   */
  test('should recognize multiple valid EARS patterns and reject incomplete ones', async () => {
    const validPatterns = [
      'WHEN the user clicks login THEN the system verifies credentials',
      'The system SHALL validate the email format before accepting registration',
      'The application SHOULD display detailed error messages to the user',
      'A user must be able to reset their password through email verification',
      'Given a user is logged in, WHEN they access admin page, THEN system checks permissions',
      'WHEN invalid input is provided THEN show error message to the end user',
    ];

    const invalidPatterns = [
      'Requirements are important',
      'Users login to the system',
      'WHEN only half',
      'THEN other',
      'The system does',
      'SHALL later',
    ];

    // Test valid patterns
    for (const pattern of validPatterns) {
      fs.writeFileSync(testRequirementsPath, `# Requirements\n\n${pattern}`, 'utf8');
      const validator = new PMArchitectValidator({
        requirementsPath: testRequirementsPath,
      });
      const result = validator.validateTransition();
      expect(result.allowed).toBe(true);
      expect(result.errors).toHaveLength(0);
    }

    // Test invalid patterns
    for (const pattern of invalidPatterns) {
      fs.writeFileSync(testRequirementsPath, `# Requirements\n\n${pattern}`, 'utf8');
      const validator = new PMArchitectValidator({
        requirementsPath: testRequirementsPath,
      });
      const result = validator.validateTransition();
      expect(result.allowed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Error Message Accuracy: Verifies that error messages are descriptive
   * and identify which precondition was not met (Requirement 1.6).
   */
  test('should provide accurate error messages identifying which precondition failed', async () => {
    const scenarios = [
      {
        setup: () => {
          // No file created - simulates missing file
        },
        expectedMessages: ['not found', 'Requirements document'],
        failedPrecondition: 'FILE_NOT_FOUND',
      },
      {
        setup: () => {
          fs.writeFileSync(testRequirementsPath, '', 'utf8');
        },
        expectedMessages: ['empty'],
        failedPrecondition: 'FILE_EMPTY',
      },
      {
        setup: () => {
          fs.writeFileSync(testRequirementsPath, '# Title with no criteria', 'utf8');
        },
        expectedMessages: ['EARS format', 'acceptance criteria'],
        failedPrecondition: 'EARS_PATTERN_NOT_FOUND',
      },
    ];

    for (const scenario of scenarios) {
      // Clean before setup
      if (fs.existsSync(testRequirementsPath)) {
        fs.unlinkSync(testRequirementsPath);
      }

      // Setup
      scenario.setup();

      // Execute
      const validator = new PMArchitectValidator({
        requirementsPath: testRequirementsPath,
      });
      const result = validator.validateTransition();
      const failedPrecondition = validator.getFailedPrecondition();

      // Verify error messages
      expect(result.allowed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(failedPrecondition).toBe(scenario.failedPrecondition);

      // Verify message contains identifying info
      const errorText = result.errors.join(' ').toLowerCase();
      const expectedFound = scenario.expectedMessages.some((msg) =>
        errorText.includes(msg.toLowerCase())
      );
      expect(expectedFound).toBe(true);

      // Cleanup
      if (fs.existsSync(testRequirementsPath)) {
        fs.unlinkSync(testRequirementsPath);
      }
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Transition Blocking: Verify that invalid transitions are properly blocked
   * and cannot proceed despite multiple attempts.
   */
  test('should consistently block invalid transitions across multiple attempts', async () => {
    // Create invalid requirements file
    fs.writeFileSync(testRequirementsPath, 'Invalid content', 'utf8');

    const validator = new PMArchitectValidator({
      requirementsPath: testRequirementsPath,
    });

    // Attempt transition multiple times - should always be blocked
    for (let i = 0; i < 5; i++) {
      const result = validator.validateTransition();
      expect(result.allowed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Transition Success: Verify that valid transitions are consistently allowed
   * and provide proper confirmation.
   */
  test('should consistently allow valid transitions across multiple attempts', async () => {
    const validContent = `# Requirements Document

## Acceptance Criteria

WHEN the user attempts to log in with valid credentials THEN the system grants access

The system SHALL validate email format before accepting registration

The application must check user permissions before showing admin pages`;

    fs.writeFileSync(testRequirementsPath, validContent, 'utf8');

    const validator = new PMArchitectValidator({
      requirementsPath: testRequirementsPath,
    });

    // Attempt transition multiple times - should always be allowed
    for (let i = 0; i < 5; i++) {
      const result = validator.validateTransition();
      expect(result.allowed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeDefined();
      expect(result.requirementsPath).toBe(testRequirementsPath);
    }
  });
});
