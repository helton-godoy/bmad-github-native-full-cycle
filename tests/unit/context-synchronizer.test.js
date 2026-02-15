/**
 * Property-Based Tests for Context Synchronizer
 * **Feature: git-hooks-automation, Property 15: Persona context synchronization**
 * **Validates: Requirements 5.4, 7.3**
 */

const fc = require('fast-check');
const ContextSynchronizer = require('../../scripts/hooks/context-synchronizer');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/context-manager');

describe('Context Synchronizer Property Tests', () => {
  let contextSynchronizer;
  let mockExecSync;
  let mockFs;
  let mockContextManager;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mocks
    mockExecSync = require('child_process').execSync;
    mockFs = require('fs');
    mockContextManager = require('../../scripts/lib/context-manager');

    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('# Active Context\n**Persona:** DEVELOPER\n**Step ID:** STEP-001');
    mockFs.writeFileSync.mockImplementation(() => { });
    mockExecSync.mockReturnValue('file1.js\nfile2.js');

    // Mock ContextManager
    mockContextManager.mockImplementation(() => ({
      read: jest.fn().mockResolvedValue('# Active Context\n**Persona:** DEVELOPER\n**Step ID:** STEP-001'),
      write: jest.fn().mockResolvedValue('abc123def456'),
      withLock: jest.fn().mockImplementation((lockName, operation) => operation())
    }));

    contextSynchronizer = new ContextSynchronizer({
      autoUpdate: true,
      validateConsistency: true,
      trackPersonaTransitions: true
    });
  });

  /**
   * **Feature: git-hooks-automation, Property 15: Persona context synchronization**
   * **Validates: Requirements 5.4, 7.3**
   */
  test('should synchronize persona state and update all relevant contexts for any persona transition', async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE'),
      fc.constantFrom('STEP-001', 'ARCH-042', 'TEST-123', 'DEV-005'),
      fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE'),
      async (currentPersona, stepId, newPersona) => {
        // Setup current context with current persona
        const currentContext = `# Active Context\n**Persona:** ${currentPersona}\n**Step ID:** STEP-001`;
        mockContextManager().read.mockResolvedValue(currentContext);

        // Mock git operations
        mockExecSync.mockReturnValueOnce('file1.js\nfile2.js'); // Changed files
        mockExecSync.mockReturnValueOnce(`[${currentPersona}] [STEP-001] Previous work`); // Git log

        const result = await contextSynchronizer.syncPersonaState(newPersona, stepId);

        // Property: Persona state synchronization should always attempt to complete
        expect(result).toBeDefined();
        expect(result.persona).toBe(newPersona);
        expect(result.stepId).toBe(stepId);
        expect(result.timestamp).toBeDefined();

        // Property: All synchronization components should be attempted
        expect(result.results).toBeDefined();
        expect(result.results.personaValidation).toBeDefined();
        expect(result.results.transitionValidation).toBeDefined();
        expect(result.results.contextSync).toBeDefined();
        expect(result.results.handoverSync).toBeDefined();

        // Property: Valid personas should pass validation
        const validPersonas = ['DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'];
        if (validPersonas.includes(newPersona)) {
          expect(result.results.personaValidation.valid).toBe(true);
        }

        // Property: Context synchronization should be attempted
        expect(result.results.contextSync.success).toBeDefined();
        expect(typeof result.results.contextSync.success).toBe('boolean');

        // Property: Handover synchronization should be attempted
        expect(result.results.handoverSync.success).toBeDefined();
        expect(typeof result.results.handoverSync.success).toBe('boolean');
      }
    ), { numRuns: 100 });
  });

  test('should update activeContext.md with commit information for any valid commit', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        message: fc.string({ minLength: 10, maxLength: 100 }),
        persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS'),
        stepId: fc.constantFrom('STEP-001', 'ARCH-042', 'TEST-123'),
        changedFiles: fc.array(fc.constantFrom('file1.js', 'file2.js', 'test.js'), { maxLength: 5 })
      }),
      async (commitInfo) => {
        // Mock existing context
        const existingContext = '# Active Context\n**Last Updated:** 2024-01-01T00:00:00Z\n**Persona:** DEVELOPER';
        mockContextManager().read.mockResolvedValue(existingContext);

        const result = await contextSynchronizer.updateActiveContext(commitInfo);

        // Property: Context update should always be attempted
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(typeof result.success).toBe('boolean');

        // Property: Update information should be captured
        expect(result.update).toBeDefined();
        expect(result.update.timestamp).toBeDefined();
        expect(result.update.commit).toBe(commitInfo);

        // Property: Persona should be extracted or provided
        if (commitInfo.persona) {
          expect(result.update.persona).toBe(commitInfo.persona);
        }

        // Property: Step ID should be extracted or provided
        if (commitInfo.stepId) {
          expect(result.update.stepId).toBe(commitInfo.stepId);
        }

        // Property: Workflow phase should be determined
        expect(result.update.workflowPhase).toBeDefined();
        expect(typeof result.update.workflowPhase).toBe('string');

        // Property: Summary should be generated
        expect(result.update.summary).toBeDefined();
        expect(typeof result.update.summary).toBe('string');
        expect(result.update.summary.length).toBeGreaterThan(0);
      }
    ), { numRuns: 50 });
  });

  test('should validate context consistency across all BMAD components', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        contextExists: fc.boolean(),
        contextPersona: fc.option(fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA')),
        handoverExists: fc.boolean()
      }),
      async (testScenario) => {
        // Setup context file existence
        mockFs.existsSync.mockImplementation((filePath) => {
          if (filePath.includes('activeContext.md')) {
            return testScenario.contextExists;
          }
          if (filePath.includes('BMAD_HANDOVER.md')) {
            return testScenario.handoverExists;
          }
          return true;
        });

        // Setup context content
        let contextContent = '';
        if (testScenario.contextExists && testScenario.contextPersona) {
          contextContent = `# Active Context\n**Persona:** ${testScenario.contextPersona}\n**Workflow Phase:** implementation\n**Last Updated:** 2024-01-01T00:00:00Z`;
        }
        mockContextManager().read.mockResolvedValue(contextContent);

        // Setup git operations
        mockExecSync.mockImplementation((command) => {
          if (command.includes('git log')) {
            return '[DEVELOPER] [STEP-001] Work done';
          }
          if (command.includes('git diff')) {
            return 'file1.js\nfile2.js';
          }
          return '';
        });

        const result = await contextSynchronizer.validateContextConsistency();

        // Property: Consistency validation should always complete
        expect(result).toBeDefined();
        expect(result.consistent).toBeDefined();
        expect(typeof result.consistent).toBe('boolean');
        expect(result.timestamp).toBeDefined();

        // Property: All validation components should be checked
        expect(result.results).toBeDefined();
        expect(result.results.contextFileExists).toBe(testScenario.contextExists);

        // Property: Recommendations should be provided
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    ), { numRuns: 50 });
  });
});