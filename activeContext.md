## Architect Prompt
Design the system.

## Current Implementation

BMAD critical fixes are integrated across orchestration, workflow state,
personas, commits, gatekeeping, loop detection, and error recovery.

- Workflow state is atomic, validated, issue-scoped, resumable, and lock-protected.
- Transitions enforce loop limits and PM-to-Architect EARS prerequisites.
- Persona commits use validation, shell-safe Git arguments, retry, and hash verification.
- Gatekeeper phase boundaries support structured fixtures, reports, and development-only bypass.
- Property tests 1–24 run with 100 generated cases each.
- Global coverage thresholds remain 80% and are satisfied by the full suite.

Implementation specification:
`_bmad-output/implementation-artifacts/spec-complete-bmad-critical-fixes.md`.
