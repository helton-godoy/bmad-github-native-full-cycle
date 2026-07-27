# Epics and Stories

## Epic 1: BMAD Critical Fixes — Property Tests

**Status:** in-progress
**Description:** All implementation tasks are complete. This epic covers the remaining 17 property tests that validate correctness of loop detection, commit handling, gatekeeper, error recovery, and state persistence.

### Stories

#### Story 1.1: Loop Detection Property Tests
- **Status:** backlog
- **Acceptance Criteria:**
  - Property 15: Persona Error Retry — validates retry logic fires correctly
  - Property 1: Transition Loop Prevention — validates loops break after threshold
  - Property 2: Transition History Persistence — validates history survives restart
  - Property 3: Cache Cleanup on Success — validates cache clears after workflow
  - Property 4: PM to Architect Validation — validates requirements doc check

#### Story 1.2: Commit Handler Property Tests
- **Status:** backlog
- **Acceptance Criteria:**
  - Property 7: Commit Retry Logic — validates exponential backoff on failure
  - Property 5: Commit Staging Validation — validates staged files check
  - Property 6: Empty Commit Handling — validates skip on no changes
  - Property 9: Commit Verification — validates post-commit git state
  - Property 8: Commit Message Format — validates `[PERSONA] [STEP-ID]` pattern

#### Story 1.3: Gatekeeper Property Tests
- **Status:** backlog
- **Acceptance Criteria:**
  - Property 10: Gatekeeper Mock Usage — validates mock data generation
  - Property 11: Test Suite Execution — validates test runner integration
  - Property 13: Development Mode Bypass — validates bypass mechanism
  - Property 12: Gatekeeper Error Reporting — validates error detail output
  - Property 14: Gatekeeper Success Logging — validates success audit trail

#### Story 1.4: Error Recovery Property Tests
- **Status:** backlog
- **Acceptance Criteria:**
  - Property 16: Recovery Escalation — validates escalation after max retries
  - Property 17: Recovery Persona Activation — validates persona context passing
  - Property 18: Remediation Failure Handling — validates pause and report
  - Property 19: State Restoration After Recovery — validates state resume

#### Story 1.5: State Cache Property Tests
- **Status:** backlog
- **Acceptance Criteria:**
  - Property 20: State Persistence — validates state survives process restart
  - Property 24: Atomic State Operations — validates write atomicity
  - Property 21: State Restoration on Restart — validates reload logic
  - Property 22: State Validation — validates consistency checks
  - Property 23: Invalid State Fallback — validates reset to initial state

## Epic 2: Git Hooks Automation

**Status:** done
**Description:** All git hooks implemented, tested, and integrated. No remaining work.
