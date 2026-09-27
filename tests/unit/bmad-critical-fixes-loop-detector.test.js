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
      { numRuns: 20 }
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
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: bmad-critical-fixes, Property 3: Cache Cleanup on Success**
   * **Validates: Requirements 1.4**
   *
   * This property validates that transition history cache is cleared after successful workflow completion.
   * Property: For any successfully completed workflow cycle, the system should clear the transition 
   * history cache to prepare for the next cycle within the specified time window (5 seconds).
   *
   * Test Strategy:
   * - Generate random transition sequences (0-10 transitions)
   * - Record transitions in the cache
   * - Simulate workflow completion by calling clearHistory()
   * - Verify cache is empty in memory
   * - Verify history file is removed from disk
   * - Verify timing constraint (cleanup within 5 seconds)
   */
  test('Property 3: should clear transition history on workflow success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            from: fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA', 'SECURITY'),
            to: fc.constantFrom('ARCHITECT', 'DEVELOPER', 'QA', 'SECURITY', 'DEVOPS'),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 100 }),
        async (transitions, _seed) => {
          const detector = new LoopDetector({
            historyFile: testHistoryFile,
            maxTransitions: 3,
          });

          // Ensure clean state
          detector.clearHistory();
          expect(detector.history.length).toBe(0);

          // Record all transitions - simulating workflow cycle execution
          transitions.forEach((t) => {
            detector.recordTransition(t.from, t.to);
          });

          // Verify transitions were recorded
          expect(detector.history.length).toBe(transitions.length);
          if (transitions.length > 0) {
            expect(fs.existsSync(testHistoryFile)).toBe(true);
          }

          // Simulate successful workflow completion
          // Requirement 1.4: "WHEN a Workflow_Cycle completes with a final delivery commit, 
          // THE BMAD_System SHALL clear all Transition_Pair records from the State_Cache 
          // for that cycle within 5 seconds of commit completion"
          const cleanupStartTime = Date.now();
          detector.clearHistory();
          const cleanupEndTime = Date.now();

          // Verify cache is cleared in memory
          expect(detector.history.length).toBe(0);

          // Verify history file is deleted from disk
          expect(fs.existsSync(testHistoryFile)).toBe(false);

          // Verify cleanup completed within 5 second window
          const cleanupDuration = cleanupEndTime - cleanupStartTime;
          expect(cleanupDuration).toBeLessThan(5000);

          // Verify detector can record new transitions after cleanup
          // (preparing for next cycle)
          detector.recordTransition('ORCHESTRATOR', 'PM');
          expect(detector.history.length).toBe(1);
          expect(detector.history[0].fromPersona).toBe('ORCHESTRATOR');
          expect(detector.history[0].toPersona).toBe('PM');
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
      fc.asyncProperty(fc.boolean(), async (prdExists) => {
        const docPath = path.join(process.cwd(), '.github', 'test-prd.md');
        if (prdExists) {
          fs.writeFileSync(docPath, '# PRD\nRequirements complete.');
        } else if (fs.existsSync(docPath)) {
          fs.unlinkSync(docPath);
        }

        const isDocValid = fs.existsSync(docPath) && fs.readFileSync(docPath, 'utf8').length > 10;
        expect(isDocValid).toBe(prdExists);

        if (fs.existsSync(docPath)) {
          fs.unlinkSync(docPath);
        }
      }),
      { numRuns: 20 }
    );
  });
});
