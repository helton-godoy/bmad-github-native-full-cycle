# Story: Commit Handler Property Tests

**Epic:** BMAD Critical Fixes — Property Tests
**Status:** ready-for-dev
**Story Key:** 1.2-commit-handler

## Context

All commit handler implementation is complete (CommitHandler class, staging validation, empty commit handling, retry logic, message format validation, post-commit verification). This story writes property tests.

## Requirements

- Property 7: Commit Retry Logic — validates exponential backoff on failure
- Property 5: Commit Staging Validation — validates staged files check
- Property 6: Empty Commit Handling — validates skip on no changes
- Property 9: Commit Verification — validates post-commit git state
- Property 8: Commit Message Format — validates `[PERSONA] [STEP-ID]` pattern

## Implementation Notes

- Test files go in `tests/unit/` following existing patterns
- Mock git operations (spawn/exec) for deterministic testing
- Each property test validates one specific behavior

## Acceptance Criteria

- [ ] Property 7 test passes
- [ ] Property 5 test passes
- [ ] Property 6 test passes
- [ ] Property 9 test passes
- [ ] Property 8 test passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes
