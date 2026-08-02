---
name: bmad-kiro-spec
description: Create or repair a deterministic Kiro implementation spec using requirements.md, design.md, and tasks.md. Use for task generation, Kiro specs, or small-model implementation planning.
---

# Deterministic Kiro Specification

Create `.kiro/specs/<kebab-name>/requirements.md`, `design.md`, and `tasks.md`. These exact filenames and Kiro Markdown structures are mandatory.

## Workflow

1. Run `npm run spec:init -- <kebab-name>` only when the spec directory does not exist.
2. Replace every scaffold sentence with project-specific content. Never leave placeholders or generic examples.
3. In `requirements.md`, define numbered `### Requirement N:` sections. Give every requirement a user story and atomic, measurable EARS acceptance criteria under `#### Acceptance Criteria`.
4. In `design.md`, describe boundaries, existing components to reuse, interfaces, data, errors, security, performance, observability, migrations, rollback, and test strategy when relevant.
5. Define correctness properties as `### Property N:`. Each property must trace exact acceptance-criterion IDs with `**Validates: Requirements N.M**`.
6. In `tasks.md`, create Kiro checkbox tasks in dependency order. Every task traces exact criterion IDs. Every property has a non-optional test or verification task. Use `_Depends on: ..._` for non-hierarchical dependencies.
7. Keep each leaf task executable in one bounded model session. State concrete behavior, files or components, verification, and objective completion evidence.
8. Run `npm run spec:validate -- .kiro/specs/<kebab-name> --write-report`.
9. Fix every error. Do not implement and do not mark the spec ready while validation fails.
10. For execution, generate one bounded packet with `npm run spec:context -- .kiro/specs/<kebab-name> <task-id>`. Give a small model that packet instead of the whole spec.

## Deterministic rules

- Markdown is canonical; sidecars are derived.
- Never use “all requirements”; enumerate stable IDs.
- Never make tests, validation, security, migrations, rollback, or verification optional.
- Parent status must equal completion of all required direct children.
- A task cannot depend on itself, a missing task, or a future cycle.
- Every acceptance criterion must be covered by work and every correctness property by verification.
- Completion requires evidence, not an LLM assertion.
