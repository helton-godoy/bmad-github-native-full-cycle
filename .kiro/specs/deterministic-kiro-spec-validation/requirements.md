# Requirements Document

## Introduction

This specification defines the deterministic Kiro specification quality system implemented in BMAD GitHub Native Full Cycle. The system preserves Kiro's canonical `requirements.md`, `design.md`, and `tasks.md` artifacts while adding machine-enforced quality gates and bounded task context generation for reliable execution by models with small context windows.

## Glossary

- **Canonical_Spec**: A Kiro specification directory containing `requirements.md`, `design.md`, and `tasks.md`
- **Spec_Validator**: The deterministic parser and validation engine implemented by `KiroSpecValidator`
- **Acceptance_Criterion_ID**: A stable positional identifier such as `2.4`, composed of requirement number and criterion number
- **Correctness_Property**: A universal behavior declared in `design.md` and traced to one or more acceptance criteria
- **Task_Trace**: An explicit relationship from a task to acceptance criteria and, for verification tasks, correctness properties
- **Context_Packet**: A bounded JSON projection containing one task and only its traced implementation context
- **Derived_Artifact**: A report or context packet generated from canonical Markdown without becoming a source of truth
- **Strict_Mode**: Validation mode in which optional quality-critical tasks are errors
- **EARS**: Easy Approach to Requirements Syntax using keywords such as WHEN, IF, WHERE, WHILE, and SHALL

## Requirements

### Requirement 1: Native Kiro Specification Structure

**User Story:** As a Kiro IDE user, I want specifications to retain Kiro's canonical file structure, so that the IDE can interpret them as native Kiro specs.

#### Acceptance Criteria

1. WHEN a specification is initialized, THE Spec_Validator SHALL create it under `.kiro/specs/<kebab-name>`
2. WHEN initialization completes, THE Spec_Validator SHALL ensure that `requirements.md`, `design.md`, and `tasks.md` exist in the specification directory
3. WHEN an existing canonical file is present, THE Spec_Validator SHALL preserve the file without overwriting its contents
4. IF a specification name is not lowercase kebab-case, THEN THE Spec_Validator SHALL reject initialization with a non-zero result
5. WHEN Markdown and a Derived_Artifact disagree, THE system SHALL treat the three canonical Markdown files as the source of truth

### Requirement 2: Deterministic Parsing and Traceability

**User Story:** As a project maintainer, I want specification relationships reconstructed deterministically, so that quality does not depend on an LLM's interpretation.

#### Acceptance Criteria

1. WHEN `requirements.md` is parsed, THE Spec_Validator SHALL extract numbered requirements and numbered acceptance criteria with stable Acceptance_Criterion_ID values
2. WHEN `design.md` is parsed, THE Spec_Validator SHALL extract numbered Correctness_Property entries and their `Validates: Requirements` references
3. WHEN `tasks.md` is parsed, THE Spec_Validator SHALL extract checkbox status, hierarchical task ID, title, optional marker, requirement references, property references, and explicit dependencies
4. WHEN current or legacy Kiro headings omit a title or use bold property headings, THE Spec_Validator SHALL parse the structure without changing the canonical files
5. WHEN duplicate references occur within one artifact, THE Spec_Validator SHALL normalize them to unique references in its in-memory model

### Requirement 3: Automatic Quality Gates

**User Story:** As a development orchestrator, I want invalid specifications blocked automatically, so that weak models cannot proceed from incomplete or contradictory plans.

#### Acceptance Criteria

1. WHEN any canonical file is missing or empty, THE Spec_Validator SHALL return an invalid report identifying the file
2. WHEN a recognized incomplete-work marker or template token remains, THE Spec_Validator SHALL return an invalid report
3. WHEN a requirement has no acceptance criteria, THE Spec_Validator SHALL return an invalid report identifying the requirement
4. WHEN a property or task references an unknown Acceptance_Criterion_ID, THE Spec_Validator SHALL return an invalid report identifying the source item and reference
5. WHEN a task references an unknown correctness property, THE Spec_Validator SHALL return an invalid report identifying the task and property
6. WHEN an acceptance criterion has no traced task, THE Spec_Validator SHALL return an invalid report identifying the uncovered criterion
7. WHEN a correctness property has no explicit test or verification task, THE Spec_Validator SHALL return an invalid report identifying the property
8. WHERE Strict_Mode is enabled, WHEN a test, verification, validation, security, migration, or rollback task is optional, THE Spec_Validator SHALL return an invalid report
9. WHEN direct required children and their parent have contradictory completion status, THE Spec_Validator SHALL return an invalid report identifying the parent
10. WHEN validation finishes, THE Spec_Validator SHALL report counts and acceptance-criterion trace coverage independently of the LLM

### Requirement 4: Dependency Integrity

**User Story:** As a task executor, I want dependencies validated before implementation, so that a small model receives an executable task order.

#### Acceptance Criteria

1. WHEN a task declares `_Depends on:`, THE Spec_Validator SHALL extract each referenced task ID
2. WHEN a dependency references a missing task, THE Spec_Validator SHALL return an invalid report
3. WHEN a task depends on itself, THE Spec_Validator SHALL return an invalid report
4. WHEN the dependency graph contains a cycle, THE Spec_Validator SHALL return an invalid report containing the detected cycle
5. WHEN the dependency graph is acyclic, THE Spec_Validator SHALL preserve the declared dependency list in the task model

### Requirement 5: Bounded Context for Small Models

**User Story:** As an operator of a small-context model, I want a minimal verified task packet, so that the model can execute with frontier-model-like discipline without loading the entire specification.

#### Acceptance Criteria

1. WHEN context is requested for an invalid specification, THE Spec_Validator SHALL refuse to generate a Context_Packet
2. WHEN context is requested for an unknown task ID, THE Spec_Validator SHALL return an error identifying the missing task
3. WHEN context is requested for a valid task, THE Spec_Validator SHALL include only the selected task, its traced acceptance criteria, relevant correctness properties, and declared dependencies
4. WHEN a Context_Packet is generated, THE Spec_Validator SHALL include deterministic instructions limiting implementation to the traced scope and requiring objective evidence
5. WHEN a Context_Packet is generated, THE Spec_Validator SHALL include a SHA-256 fingerprint derived from all three canonical files

### Requirement 6: CLI, Reporting, and Kiro Guidance

**User Story:** As a BMAD and Kiro user, I want consistent commands and project guidance, so that deterministic validation is part of the normal specification workflow.

#### Acceptance Criteria

1. WHEN `spec:init`, `spec:validate`, or `spec:context` is invoked through npm, THE system SHALL route the command to the specification CLI
2. WHEN `spec-init`, `spec-validate`, or `spec-context` is invoked through the BMAD CLI, THE system SHALL preserve the child command exit status
3. WHEN `--json` is supplied to validation, THE system SHALL output a machine-readable report without the internal parsed model
4. WHEN `--write-report` is supplied, THE system SHALL atomically write `validation-report.json` as a Derived_Artifact
5. WHEN Kiro loads the project, THE system SHALL provide steering and skill instructions that require validation before implementation and bounded context during task execution
