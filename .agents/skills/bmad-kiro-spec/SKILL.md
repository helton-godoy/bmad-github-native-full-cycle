---
name: bmad-kiro-spec
description: Create or repair deterministic Kiro specs for reliable execution by small-context models.
---

# Deterministic Kiro Specification

Use `.kiro/specs/<name>/requirements.md`, `design.md`, and `tasks.md` as the canonical artifacts. Follow `.kiro/steering/spec-quality.md` and the full Kiro workflow in `.kiro/skills/bmad-kiro-spec/SKILL.md`.

The terminal gate is `npm run spec:validate -- .kiro/specs/<name> --write-report`. Never begin implementation while it fails. Execute individual tasks from `npm run spec:context -- .kiro/specs/<name> <task-id>` so a small-context model receives only traced requirements, properties, dependencies, and deterministic instructions.
