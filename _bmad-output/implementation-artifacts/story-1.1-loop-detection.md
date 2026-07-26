# Story: Loop Detection Property Tests

**Epic:** BMAD Critical Fixes — Property Tests
**Status:** ready-for-dev
**Story Key:** 1.1-loop-detection

## Context

All loop detection implementation is complete (LoopDetector class, transition history persistence, cache cleanup, PM-to-Architect validation). This story writes property tests to validate correctness.

## Requirements

- Property 15: Persona Error Retry — validates retry logic fires correctly
- Property 1: Transition Loop Prevention — validates loops break after threshold
- Property 2: Transition History Persistence — validates history survives restart
- Property 3: Cache Cleanup on Success — validates cache clears after workflow
- Property 4: PM to Architect Validation — validates requirements doc check

## Implementation Notes

- Test files go in `tests/unit/` following existing patterns
- Use property-based testing (fast-check or similar)
- Mock git operations and file system as needed
- Each property test validates one specific behavior

## Acceptance Criteria

- [ ] Property 15 test passes
- [ ] Property 1 test passes
- [ ] Property 2 test passes
- [ ] Property 3 test passes
- [ ] Property 4 test passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes
