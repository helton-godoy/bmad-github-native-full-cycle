---
title: 'Loop Detection Property Tests'
type: 'feature'
created: '2026-07-27'
baseline_revision: 'd247e95f6cf8816da7fa45975189a896d211361a'
status: 'in-review'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
final_revision: ''
---

<intent-contract>

## Intent

**Problem:** Story 1.1 requires 5 property-based tests (Properties 15, 1, 2, 3, 4) to validate loop detection correctness, but the existing stub file `tests/unit/loop-detection.test.js` imports a non-existent module and has empty test bodies. Meanwhile, the actual implementations already exist in `tests/unit/bmad-critical-fixes-loop-detector.test.js` and `tests/unit/bmad-critical-fixes-error-retry.test.js` and pass. The broken stub must be resolved.

**Approach:** Clean up the stub file by removing its empty, broken test stubs and replacing them with proper property tests that import from the correct module path (`scripts/lib/loop-detector`) and validate the five required properties, aligning with the already-working implementations in the `bmad-critical-fixes-*` test files.

## Boundaries & Constraints

**Always:**
- Property tests must use fast-check library (`fc.assert` with `fc.asyncProperty`).
- Tests must go in `tests/unit/` following existing patterns.
- Import LoopDetector from `../../scripts/lib/loop-detector` (correct path).
- Each property test validates exactly one behavior.
- The existing passing tests in `bmad-critical-fixes-loop-detector.test.js` and `bmad-critical-fixes-error-retry.test.js` must not be modified.

**Block If:**
- If the stub file cannot be fixed without breaking existing passing tests.

**Never:**
- Do not modify the existing working test files (`bmad-critical-fixes-*.test.js`).
- Do not change the LoopDetector implementation (`scripts/lib/loop-detector.js`).
- Do not add non-property-based tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Loop prevention | Same persona transition repeated >=3 times | `detectLoop()` returns `true` | N/A — deterministic threshold check |
| No loop | Transitions below threshold | `detectLoop()` returns `false` | N/A |
| History persistence | Record transition, create new detector instance | History file exists, same transition count | Corrupt/missing history file returns empty |
| Cache cleanup | Transitions recorded, then `clearHistory()` called | History array is empty, file deleted | File deletion failure logs warning |
| PM→Architect validation | PRD document exists / missing | Validation passes / fails | Missing doc returns false |

</intent-contract>

## Code Map

- `tests/unit/loop-detection.test.js` — Current broken stub file with empty tests and wrong import path; target for fix.
- `tests/unit/bmad-critical-fixes-loop-detector.test.js` — Reference implementation of Properties 1-4 (do not modify).
- `tests/unit/bmad-critical-fixes-error-retry.test.js` — Reference implementation of Property 15 (do not modify).
- `scripts/lib/loop-detector.js` — The LoopDetector class under test.
- `scripts/lib/exponential-backoff.js` — ExponentialBackoff utility used by retry logic.
- `scripts/lib/error-recovery-manager.js` — ErrorRecoveryManager used by Property 15.

## Tasks & Acceptance

**Execution:**
- [x] `tests/unit/loop-detection.test.js` — Fix import path from `../../scripts/bmad/bmad-loop-detector` to `../../scripts/lib/loop-detector` and implement property tests for Properties 15, 1, 2, 3, 4, matching the patterns in `bmad-critical-fixes-*.test.js`.

**Acceptance Criteria:**
- Given the fixed `loop-detection.test.js`, when `npx jest tests/unit/loop-detection.test.js` runs, then all property tests pass.
- Given the full test suite, when `npx jest tests/unit/bmad-critical-fixes-loop-detector.test.js tests/unit/bmad-critical-fixes-error-retry.test.js tests/unit/loop-detection.test.js` runs, then all 11+ tests pass.
- Given the project, when `npm run lint` runs, then no lint errors are reported.

## Spec Change Log

<!-- Empty until first review loopback -->

## Review Triage Log

### 2026-07-27 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1 (low 1, medium 0, high 0)
- reject: 0
- addressed_findings:
  - none

## Design Notes

The two existing test files (`bmad-critical-fixes-loop-detector.test.js` and `bmad-critical-fixes-error-retry.test.js`) already implement all 5 required properties and pass. The stub file `loop-detection.test.js` was apparently created as a template but never completed. The fix should mirror the established patterns:

- Use `fc.assert` with `fc.asyncProperty` for async property tests.
- Generate random personas from `fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA')`.
- Use a dedicated test history file to avoid polluting real state.
- Clean up test files in `afterEach` hooks.

## Verification

**Commands:**
- `npx jest tests/unit/loop-detection.test.js --no-coverage` — expected: all tests pass
- `npx jest tests/unit/bmad-critical-fixes-loop-detector.test.js tests/unit/bmad-critical-fixes-error-retry.test.js tests/unit/loop-detection.test.js --no-coverage` — expected: all 11+ tests pass
- `npm run lint` — expected: no errors
