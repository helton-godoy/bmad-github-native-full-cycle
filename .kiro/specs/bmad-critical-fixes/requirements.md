# Requirements Document

## Introduction

This specification addresses critical issues identified in the BMAD-GitHub Native Full Cycle system that prevent autonomous operation. The system currently experiences infinite loops in persona transitions, failed automatic commits, and gatekeeper blocking issues that must be resolved to achieve the core objective of fully autonomous development workflow.

## Glossary

- **BMAD_System**: The Breakthrough Method for Agile AI-Driven Development orchestration system
- **Orchestrator**: The top-level coordination component that manages persona sequencing and workflow state
- **Persona_Manager**: Component responsible for managing transitions between AI personas
- **Commit_Handler**: Component responsible for executing automatic git commits
- **Gatekeeper**: Validation system that controls workflow progression between phases
- **Loop_Detector**: System component that identifies infinite loops in persona transitions by counting repeated transition pairs
- **State_Cache**: Persistent, atomic storage for workflow state information
- **Recovery_Persona**: Dedicated persona activated to handle unrecoverable errors and coordinate remediation
- **Transition_Pair**: A directed pair (fromPersona → toPersona) representing one persona handoff
- **Workflow_Cycle**: A single complete execution from initial orchestrator activation to final delivery commit
- **Development_Mode**: A runtime configuration flag that enables test-only bypass behaviors not available in production

## Requirements

### Requirement 1: Infinite Loop Prevention

**User Story:** As a BMAD orchestrator, I want to prevent infinite loops between personas, so that the system can progress through the development workflow autonomously.

#### Acceptance Criteria

1. WHEN a persona attempts a transition to another persona, THE Loop_Detector SHALL verify that the same Transition_Pair has not been recorded 3 or more times in the current Workflow_Cycle
2. IF the Loop_Detector detects that a Transition_Pair has reached the 3-occurrence threshold, THEN THE BMAD_System SHALL block the transition, record the blocked transition attempt with a 'blocked' status, and activate the Recovery_Persona
3. WHEN a persona transition is executed, THE State_Cache SHALL persist a Transition_Pair record containing the source persona, target persona, and UTC timestamp accurate to the millisecond
4. WHEN a Workflow_Cycle completes with a final delivery commit, THE BMAD_System SHALL clear all Transition_Pair records from the State_Cache for that cycle within 5 seconds of commit completion
5. WHEN the PM persona attempts to transition to the Architect persona, THE BMAD_System SHALL verify that a requirements document file exists at the expected path and contains at least one acceptance criterion formatted as an EARS pattern before allowing the transition
6. IF the PM-to-Architect precondition check fails, THEN THE BMAD_System SHALL block the transition and return an error message to the PM persona identifying which precondition was not met

---

### Requirement 2: Reliable Automatic Commits

**User Story:** As a BMAD orchestrator, I want automatic commits to execute successfully, so that code changes are properly versioned and tracked.

#### Acceptance Criteria

1. WHEN the Commit_Handler prepares a commit operation, THE Commit_Handler SHALL verify that at least one file has been staged via `git add` before invoking `git commit`
2. WHEN the Commit_Handler detects no staged changes in the working directory, THE Commit_Handler SHALL skip the commit operation and write a skip event to the workflow log containing the current step identifier and the reason "no staged changes found"
3. WHEN a `git commit` invocation exits with a non-zero status code, THE Commit_Handler SHALL retry the operation up to 2 additional times using exponential backoff with a base delay of 1 second and a 2x multiplier per attempt before declaring the commit failed
4. IF all retry attempts are exhausted without a successful commit, THEN THE Commit_Handler SHALL emit a commit-failure event to the workflow log containing the step identifier, the number of attempts made, and the last error message received
5. WHEN the Commit_Handler creates a commit, THE Commit_Handler SHALL format the commit message as `[PERSONA] [STEP-ID] Description` where PERSONA is the active persona identifier, STEP-ID is the current workflow step identifier, and Description is a non-empty string of 1–72 characters
6. WHEN a commit operation completes with exit code 0, THE Commit_Handler SHALL verify that the resulting commit hash is resolvable in the local git repository before reporting success
7. IF the resulting commit hash is not resolvable in the local git repository, THEN THE Commit_Handler SHALL report a commit-verification-failure event and transition to the error recovery flow

---

### Requirement 3: Gatekeeper Workflow Progression

**User Story:** As a BMAD orchestrator, I want the gatekeeper to allow workflow progression, so that the development cycle can continue without manual intervention.

#### Acceptance Criteria

1. WHEN the Gatekeeper evaluates workflow conditions in a test environment, THE Gatekeeper SHALL use pre-defined fixture data where each fixture scenario is treated as a discrete pass/fail test case covering all required validation scenarios
2. WHEN the Gatekeeper requires automated test results for phase validation, THE Gatekeeper SHALL execute the configured test suite and evaluate the exit code and output before rendering a pass or fail decision
3. IF the test suite exits with a non-zero exit code, THEN THE Gatekeeper SHALL classify the result as a failure and proceed to error reporting
4. WHEN the Gatekeeper blocks progression due to test failures, THE Gatekeeper SHALL emit an error report that identifies each failing test by name and provides a suggested remediation action for each failure
5. WHERE Development_Mode is enabled, THE Gatekeeper SHALL provide a bypass mechanism that allows workflow progression without executing the test suite, and SHALL write a warning entry to the workflow log listing each skipped validation by name
6. WHEN the Gatekeeper completes a passing validation, THE Gatekeeper SHALL write a structured success entry to the workflow log containing the phase name, timestamp, and validation method, and signal the Orchestrator to proceed to the next phase
7. IF the configured test suite is not found or fails to start, THEN THE Gatekeeper SHALL classify the result as a failure, emit an error report identifying the startup failure, and block workflow progression

---

### Requirement 4: Comprehensive Error Recovery

**User Story:** As a BMAD orchestrator, I want comprehensive error recovery mechanisms, so that temporary failures do not halt the entire development workflow.

#### Acceptance Criteria

1. WHEN any persona encounters an error during its operation, THE BMAD_System SHALL retry the failed operation — with attempt 1 being the initial try and attempts 2 and 3 being retries — using exponential backoff with delays of 1 second then 2 seconds before each retry
2. WHEN a persona's retry attempts are exhausted without success, THE BMAD_System SHALL transition to the Recovery_Persona and pass the full error context including persona name, operation name, error message, and retry count
3. WHEN the Recovery_Persona is activated, THE Recovery_Persona SHALL log the received error context and execute the remediation procedure registered for the error category
4. IF no remediation procedure is registered for the error category, THEN THE Recovery_Persona SHALL log the unregistered category, generate a structured error report containing the error context, and suspend workflow execution pending manual review
5. WHEN the Recovery_Persona's remediation procedure exits with a failure status, THE Recovery_Persona SHALL persist the current state to the State_Cache, generate a structured error report containing the error context, remediation steps attempted, and their outcomes, then suspend workflow execution pending manual review
6. WHEN workflow execution resumes after a Recovery_Persona session, THE BMAD_System SHALL load the persisted state from the State_Cache and restart execution from the step that was active when the error occurred
7. IF the State_Cache load fails during resumption, THEN THE BMAD_System SHALL reset to the initial Orchestrator state and write a load-failure entry to the workflow log

---

### Requirement 5: State Persistence Across Interruptions

**User Story:** As a BMAD orchestrator, I want state persistence across workflow interruptions, so that the system can resume operations without losing progress.

#### Acceptance Criteria

1. WHEN a workflow state change occurs, THE State_Cache SHALL persist the active persona identifier, current step ID, and serialized context object — where the serialized context object must not exceed 1 MB — before the transition is considered complete
2. WHEN the BMAD_System initializes and detects an existing State_Cache entry from a prior run, THE BMAD_System SHALL load and apply that state rather than starting a new Workflow_Cycle, and SHALL emit a resume notification indicating the restored persona identifier and step ID
3. WHEN the BMAD_System loads a persisted state, THE BMAD_System SHALL validate that the state contains a persona identifier present in the system's registered persona list, a step ID that is a non-empty string, and a context object that can be fully deserialized without error before activating that state
4. IF the loaded state fails validation, THEN THE BMAD_System SHALL discard the invalid state, reset to the initial Orchestrator state, and write a validation-failure entry to the workflow log
5. THE State_Cache SHALL guarantee that a state entry is either fully written or left unchanged, such that no partial or corrupt state is observable after a write operation completes or is interrupted
6. IF the State_Cache fails to persist a state entry — due to a write error or storage unavailability — THEN THE BMAD_System SHALL abort the pending workflow transition and emit an error indicating that state persistence failed, leaving the prior persisted state intact
