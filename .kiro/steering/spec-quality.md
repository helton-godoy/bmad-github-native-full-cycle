# Deterministic Kiro Spec Quality Contract

All implementation specifications MUST remain directly compatible with Kiro and live at `.kiro/specs/<spec-name>/requirements.md`, `design.md`, and `tasks.md`.

## Canonical structure

- `requirements.md` uses `### Requirement N:` and numbered acceptance criteria under `#### Acceptance Criteria`.
- Acceptance criteria use EARS (`WHEN`, `IF`, `WHERE`, `WHILE`, `THE ... SHALL`) and receive stable IDs from their position, such as `2.4`.
- `design.md` uses `### Property N:` and every property includes `**Validates: Requirements 2.4**`.
- `tasks.md` uses Kiro checkboxes such as `- [ ] 2.1 Task title`.
- Every task includes `_Requirements: ..._` or `**Validates: Requirements ...**`.
- Property verification tasks include `**Property N: ...**`.
- Explicit dependencies use `_Depends on: 1.2, 2.1_`.

## Non-negotiable gate

Before implementation, run `npm run spec:validate -- .kiro/specs/<spec-name>`. Implementation MUST NOT begin while it fails.

A spec is invalid when a canonical file is missing, a placeholder remains, a trace points to an unknown item, an acceptance criterion lacks a task, a correctness property lacks a verification task, a quality-critical task is optional, dependencies are invalid or cyclic, or a parent checkbox disagrees with its required direct children.

## Small-context execution

Models SHOULD NOT load the complete spec to execute one task. Run `npm run spec:context -- .kiro/specs/<spec-name> <task-id>` and use only the resulting packet. It contains the task, traced criteria, relevant properties, dependencies, fingerprint, and execution invariants.

The model must implement only the packet scope and return objective evidence: changed files, commands, and results. Markdown remains canonical; JSON reports and context packets are derived and never override the three Kiro files.
