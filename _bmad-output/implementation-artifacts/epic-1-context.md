# Epic 1 Context: BMAD Critical Fixes — Property Tests

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Complete the BMAD Critical Fixes epic by writing 17 property tests that validate correctness of loop detection, commit handling, gatekeeper, error recovery, and state persistence implementations. All implementation tasks are done; only property tests remain.

## Stories

- Story 1.1: Loop Detection Property Tests
- Story 1.2: Commit Handler Property Tests
- Story 1.3: Gatekeeper Property Tests
- Story 1.4: Error Recovery Property Tests
- Story 1.5: State Cache Property Tests

## Requirements & Constraints

- All implementation code for critical fixes is complete and deployed. Only property-based tests remain.
- Property tests must use fast-check library.
- Tests go in `tests/unit/` following existing naming patterns.
- Use mock data for git operations and file system interactions.
- Each property test validates one specific behavior.
- Must maintain >=80% test coverage threshold.
- All tests must pass with `npm test`.

## Technical Decisions

- **LoopDetector class** (`scripts/lib/loop-detector.js`): Tracks persona transitions with max 3 per cycle. Records from/to persona and timestamp. Persists history to `.github/transition-history.json`. Clears history on workflow success.
- **ExponentialBackoff** (`scripts/lib/exponential-backoff.js`): Configurable initial delay (default 1000ms), max delay (5000ms), multiplier (default 2), max retries (default 3), jitter factor (0.1). Used by ErrorRecoveryManager.
- **ErrorRecoveryManager** (`scripts/lib/error-recovery-manager.js`): Handles persona errors with retry via ExponentialBackoff, escalates to recovery persona after max retries exhausted.
- **Test framework**: Jest with fast-check for property-based testing.
- **Existing test patterns**: Tests use `fc.assert` with `fc.asyncProperty`, generate randomized inputs for personas, transitions, and configurations.

## UX & Interaction Patterns

Not applicable — this is a backend testing epic with no user-facing changes.

## Cross-Story Dependencies

- Story 1.1 (loop detection) provides the pattern for other property test stories.
- Stories share the same fast-check testing approach and mock infrastructure.
- All stories are independent and can be implemented in any order.
