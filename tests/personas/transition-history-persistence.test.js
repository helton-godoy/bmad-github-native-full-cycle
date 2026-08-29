/**
 * @ai-context Property-Based Test for Transition History Persistence
 * @ai-invariant All persona transitions must be persisted to state cache with accurate timestamps
 * **Validates: Requirements 1.3**
 *
 * Property 2: Transition History Persistence
 * For any persona transition, the system should persist the transition record with
 * timestamp in the state cache for loop detection purposes.
 *
 * This test validates:
 * - Transition records are persisted with source and target personas
 * - Timestamps are recorded with millisecond accuracy
 * - Records are retrievable from the history cache
 * - Multiple transitions maintain proper ordering
 * - Timestamps are in valid UTC format
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const LoopDetector = require('../../scripts/lib/loop-detector');

describe('Transition History Persistence (PBT)', () => {
  let tempDir;
  let historyFile;

  beforeEach(() => {
    // Create temporary directory for test files
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    tempDir = path.join(process.cwd(), '.github', `test-${uniqueId}`);
    historyFile = path.join(tempDir, 'transition-history.json');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        // Best effort cleanup
      }
    }
  });

  /**
   * Check 1: Single Transition Persistence
   * For any single persona transition, the transition record must be persisted
   * with correct source, target, and timestamp
   */
  test('should persist single transition record with all required fields', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/), // fromPersona
        fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/), // toPersona
        (fromPersona, toPersona) => {
          const detector = new LoopDetector({ historyFile });
          // Clear any previously loaded history
          detector.history = [];

          // Record a transition
          const beforeTimestamp = Date.now();
          const record = detector.recordTransition(fromPersona, toPersona);
          const afterTimestamp = Date.now();

          // Verify record structure
          expect(record).toBeDefined();
          expect(record.fromPersona).toBe(fromPersona.toUpperCase());
          expect(record.toPersona).toBe(toPersona.toUpperCase());
          expect(record.timestamp).toBeDefined();

          // Verify timestamp is valid ISO string
          const recordTime = new Date(record.timestamp).getTime();
          expect(recordTime).toBeGreaterThanOrEqual(beforeTimestamp);
          expect(recordTime).toBeLessThanOrEqual(afterTimestamp);

          // Verify persistence to file
          expect(fs.existsSync(historyFile)).toBe(true);
          const persistedData = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
          expect(persistedData).toHaveLength(1);
          expect(persistedData[0]).toEqual(record);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Check 2: Multiple Transitions Persistence
   * For any sequence of transitions, all records must be persisted in order
   * with correct timestamps for each transition
   */
  test('should persist multiple transitions in order with accurate timestamps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
            fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/)
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (transitions) => {
          const detector = new LoopDetector({ historyFile });
          // Clear any previously loaded history
          detector.history = [];

          // Record all transitions
          const records = [];
          const recordedTimestamps = [];

          for (const [from, to] of transitions) {
            const beforeTime = Date.now();
            const record = detector.recordTransition(from, to);
            const afterTime = Date.now();

            records.push(record);
            recordedTimestamps.push({ before: beforeTime, after: afterTime });
          }

          // Verify all transitions were persisted
          const persistedData = JSON.parse(
            fs.readFileSync(historyFile, 'utf8')
          );
          expect(persistedData).toHaveLength(transitions.length);

          // Verify ordering and timestamps
          for (let i = 0; i < transitions.length; i++) {
            const [expectedFrom, expectedTo] = transitions[i];
            const persisted = persistedData[i];
            const timeWindow = recordedTimestamps[i];

            expect(persisted.fromPersona).toBe(expectedFrom.toUpperCase());
            expect(persisted.toPersona).toBe(expectedTo.toUpperCase());

            // Verify timestamp is within the recorded time window
            const recordTime = new Date(persisted.timestamp).getTime();
            expect(recordTime).toBeGreaterThanOrEqual(timeWindow.before);
            expect(recordTime).toBeLessThanOrEqual(timeWindow.after);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Check 3: Millisecond Timestamp Accuracy
   * Timestamps must be accurate to the millisecond for precise loop detection
   */
  test('should record timestamps with millisecond accuracy', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
            fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/)
          ),
          { minLength: 2, maxLength: 5 }
        ),
        (transitions) => {
          const detector = new LoopDetector({ historyFile });
          detector.history = [];

          // Record transitions with small delays
          const records = [];
          for (const [from, to] of transitions) {
            records.push(detector.recordTransition(from, to));
            // Small artificial delay to ensure different timestamps
            const end = Date.now() + 1;
            while (Date.now() < end) {
              // Busy wait for at least 1ms
            }
          }

          // Verify millisecond granularity
          for (let i = 0; i < records.length - 1; i++) {
            const time1 = new Date(records[i].timestamp).getTime();
            const time2 = new Date(records[i + 1].timestamp).getTime();

            // Timestamps should be able to distinguish between transitions
            // Verify both are valid timestamps
            expect(Number.isInteger(time1)).toBe(true);
            expect(Number.isInteger(time2)).toBe(true);

            // Earlier transition should have earlier or equal timestamp
            expect(time2).toBeGreaterThanOrEqual(time1);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Check 4: Timestamp Format Validation
   * All timestamps must be valid ISO 8601 UTC format strings
   */
  test('should store timestamps in valid ISO 8601 UTC format', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
        fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
        (fromPersona, toPersona) => {
          const detector = new LoopDetector({ historyFile });
          detector.history = [];

          // Record transition
          const record = detector.recordTransition(fromPersona, toPersona);

          // Verify timestamp format
          const timestamp = record.timestamp;
          expect(typeof timestamp).toBe('string');

          // ISO 8601 format check (should be parseable)
          const parsedDate = new Date(timestamp);
          expect(parsedDate.toString()).not.toBe('Invalid Date');

          // Verify it's in UTC (contains Z or ±00:00)
          expect(timestamp.match(/Z$|[\+\-]00:00$/)).toBeTruthy();

          // Verify round-trip conversion
          const reconstructed = parsedDate.toISOString();
          expect(new Date(timestamp).getTime()).toBe(
            new Date(reconstructed).getTime()
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Check 5: Transition Count Retrieval
   * Transition counts should be accurately maintained and retrievable
   * for loop detection purposes
   */
  test('should accurately track and retrieve transition counts for loop detection', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
          fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/)
        ),
        fc.integer({ min: 1, max: 5 }),
        (personas, repeatCount) => {
          const detector = new LoopDetector({ historyFile });
          detector.history = [];

          const [fromPersona, toPersona] = personas;

          // Record the same transition multiple times
          for (let i = 0; i < repeatCount; i++) {
            detector.recordTransition(fromPersona, toPersona);
          }

          // Verify count is accurate
          const count = detector.getTransitionCount(fromPersona, toPersona);
          expect(count).toBe(repeatCount);

          // Verify persistence is maintained across new detector instance
          const newDetector = new LoopDetector({ historyFile });
          const countAfterReload = newDetector.getTransitionCount(
            fromPersona,
            toPersona
          );
          expect(countAfterReload).toBe(repeatCount);
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Check 6: Persona Normalization
   * Persona names should be normalized to uppercase for consistent comparison
   */
  test('should normalize persona names to uppercase in persisted records', () => {
    fc.assert(
      fc.property(
        fc
          .stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
          .filter((s) => s.length > 0),
        fc
          .stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
          .filter((s) => s.length > 0),
        (fromPersona, toPersona) => {
          const detector = new LoopDetector({ historyFile });
          detector.history = [];

          // Record with mixed case
          const record = detector.recordTransition(fromPersona, toPersona);

          // Verify normalization
          expect(record.fromPersona).toBe(fromPersona.toUpperCase());
          expect(record.toPersona).toBe(toPersona.toUpperCase());

          // Verify persistence maintains normalization
          const persistedData = JSON.parse(
            fs.readFileSync(historyFile, 'utf8')
          );
          expect(persistedData[0].fromPersona).toBe(fromPersona.toUpperCase());
          expect(persistedData[0].toPersona).toBe(toPersona.toUpperCase());
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Check 7: Data Persistence Across Instances
   * Transition history must persist across detector instances to enable
   * reliable loop detection even after process interruptions
   */
  test('should maintain transition history across detector instances', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
            fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/)
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (transitions) => {
          // Record transitions with first instance
          const detector1 = new LoopDetector({ historyFile });
          detector1.history = [];

          const records1 = [];

          for (const [from, to] of transitions) {
            records1.push(detector1.recordTransition(from, to));
          }

          // Load with new instance
          const detector2 = new LoopDetector({ historyFile });

          // Verify history is loaded
          expect(detector2.history).toHaveLength(transitions.length);

          // Record additional transitions with unique markers
          const uniqueMarker = `UNQ${Math.random().toString(36).substr(2, 5)}`;
          detector2.recordTransition(uniqueMarker, 'TO');
          detector2.recordTransition('FROM', uniqueMarker);

          // Verify total history
          const persistedData = JSON.parse(
            fs.readFileSync(historyFile, 'utf8')
          );
          expect(persistedData).toHaveLength(transitions.length + 2);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Check 8: Loop Detection Using Persisted History
   * Transition history should enable accurate loop detection
   */
  test('should use persisted history for accurate loop detection', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
        fc.stringMatching(/^[A-Z][a-zA-Z0-9_-]*$/),
        fc.integer({ min: 0, max: 5 }),
        (fromPersona, toPersona, additionalCount) => {
          const maxTransitions = 3;
          const detector = new LoopDetector({
            historyFile,
            maxTransitions,
          });
          detector.history = [];

          // Record transitions
          const totalRecordings = maxTransitions + additionalCount;
          for (let i = 0; i < totalRecordings; i++) {
            detector.recordTransition(fromPersona, toPersona);
          }

          // Check loop detection
          const isLoopDetected = detector.detectLoop(fromPersona, toPersona);
          const actualCount = detector.getTransitionCount(
            fromPersona,
            toPersona
          );

          // Loop should be detected when count >= maxTransitions
          expect(isLoopDetected).toBe(actualCount >= maxTransitions);
        }
      ),
      { numRuns: 50 }
    );
  });
});
