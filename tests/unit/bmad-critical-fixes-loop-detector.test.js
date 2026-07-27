/**
 * Property-Based Tests for Loop Detector & PM-to-Architect Validation
 * **Feature: bmad-critical-fixes**
 * Properties:
 * - Property 1: Transition Loop Prevention
 * - Property 2: Transition History Persistence
 * - Property 3: Cache Cleanup on Success
 * - Property 4: PM to Architect Validation
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const LoopDetector = require('../../scripts/lib/loop-detector');
const BMADOrchestrator = require('../../scripts/bmad/bmad-orchestrator');

describe('Loop Detector Property Tests', () => {
  const testHistoryFile = path.join(process.cwd(), '.github', 'test-transition-history.json');

  afterEach(() => {
    if (fs.existsSync(testHistoryFile)) {
      fs.unlinkSync(testHistoryFile);
    }
  });

  /**
   * **Feature: bmad-critical-fixes, Property 1: Transition Loop Prevention**
   * **Validates: Requirements 1.1, 1.2**
   */
  test('Property 1: should detect loop when transition count reaches threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA'),
        fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA'),
        fc.integer({ min: 1, max: 5 }),
        async (fromPersona, toPersona, repetitions) => {
          const detector = new LoopDetector({
            maxTransitions: 3,
            historyFile: testHistoryFile,
          });
          detector.clearHistory();

          for (let i = 0; i < repetitions; i++) {
            detector.recordTransition(fromPersona, toPersona);
          }

          const isLoop = detector.detectLoop(fromPersona, toPersona);
          if (repetitions >= 3) {
            expect(isLoop).toBe(true);
          } else {
            expect(isLoop).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 2: Transition History Persistence**
   * **Validates: Requirements 1.3**
   */
  test('Property 2: should persist transition records in file history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER'),
        fc.constantFrom('ARCHITECT', 'DEVELOPER', 'QA'),
        async (fromPersona, toPersona) => {
          const detector = new LoopDetector({
            historyFile: testHistoryFile,
          });
          detector.clearHistory();

          detector.recordTransition(fromPersona, toPersona);

          expect(fs.existsSync(testHistoryFile)).toBe(true);
          const newDetector = new LoopDetector({
            historyFile: testHistoryFile,
          });
          expect(newDetector.getTransitionCount(fromPersona, toPersona)).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 3: Cache Cleanup on Success**
   * **Validates: Requirements 1.4**
   */
  test('Property 3: should clear transition history on workflow success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            from: fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER'),
            to: fc.constantFrom('ARCHITECT', 'DEVELOPER', 'QA'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (transitions) => {
          const detector = new LoopDetector({
            historyFile: testHistoryFile,
          });

          transitions.forEach((t) => detector.recordTransition(t.from, t.to));
          expect(detector.history.length).toBe(transitions.length);

          detector.clearHistory();
          expect(detector.history.length).toBe(0);
          expect(fs.existsSync(testHistoryFile)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 4: PM to Architect Validation**
   * **Validates: Requirements 1.5**
   */
  test('Property 4: should validate requirements document existence before PM to Architect transition', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (validEars) => {
        const orchestrator = Object.create(BMADOrchestrator.prototype);
        orchestrator.contextManager = {
          read: jest.fn().mockReturnValue(
            validEars
              ? 'WHEN planning completes THE BMAD_System SHALL allow architecture.'
              : '# PRD\nRequirements complete.'
          ),
        };
        const result = orchestrator.validateRequirementsDocument('PRD.md');
        expect(result.valid).toBe(validEars);
        if (!validEars) expect(result.error).toContain('EARS');
      }),
      { numRuns: 100 }
    );
  });
});
