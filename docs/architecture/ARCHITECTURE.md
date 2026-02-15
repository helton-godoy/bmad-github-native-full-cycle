# Architecture Documentation

## System Invariants
- **NÃO adicione chamadas de DB aqui. A validação deve ser puramente criptográfica.** (`RFC-001-AgentDoc.md`:32)
- **Demonstrates proper commit handling patterns for BMAD system** (`commit-handler-usage.js`:1)
- **Architect must create technical specifications and system design** (`architect.js`:1)
- **All personas must extend this enhanced base class** (`base-persona-enhanced.js`:1)
- **All personas must extend this base class** (`base-persona.js`:1)
- **Developer must implement according to architecture specifications with quality checks** (`developer-enhanced.js`:1)
- **Developer must implement according to architecture specifications** (`developer.js`:1)
- **DevOps must prepare infrastructure and deployment pipeline** (`devops.js`:1)
- **PM must analyze requirements and create work plans** (`project-manager.js`:1)
- **QA must validate all implementations before release** (`qa.js`:1)
- **Recovery must detect failures and execute safe rollbacks** (`recovery.js`:1)
- **Release Manager must coordinate final release and version management** (`release-manager.js`:1)
- **Security must validate all security aspects before deployment** (`security.js`:1)
- **Must extract and document all semantic tags from codebase** (`agent-doc-enhanced.js`:1)
- **Generates DASHBOARD.md based on current project state** (`bmad-monitor.js`:1)
- **State determines Action, Content drives Context** (`bmad-orchestrator.js`:2)
- **Must execute all personas in sequence with enhanced coordination** (`bmad-workflow-enhanced.js`:2)
- **Must execute all personas in sequence** (`bmad-workflow.js`:2)
- **Must detect stalled workflows and trigger resume ONLY if safe** (`health-check.js`:1)
- **Ensures productContext.md has required structure** (`product-context-validator.js`:1)
- **All commit messages must follow BMAD pattern or conventional commits format** (`bmad-message-validator.js`:1)
- **All git operations must be validated and follow BMAD patterns** (`commit-handler.js`:1)
- **Provides centralized configuration management with environment variable overrides** (`config-loader.js`:1)
- **Ensures data integrity across concurrent processes** (`context-manager.js`:1)
- **Operations must NOT affect the current working directory or index** (`git-state-manager.js`:1)
- **All logs must be structured and sanitized** (`logger.js`:1)
- **Secrets must never be logged in plain text** (`secret-manager.js`:1)
- **Mock all GitHub API calls for testing** (`octokit.js`:1)
- **All personas must be loadable and functional** (`personas.test.js`:1)
- **Configure test environment and mocks** (`setup.js`:1)
- **Maintains in-memory state of a virtual repository** (`github-simulator.js`:1)
- **Workflow should coordinate all personas correctly** (`workflow.test.js`:1)

## Component Connections
- **Impacta diretamente o middleware `auth.middleware.js`.** (`RFC-001-AgentDoc.md`:32)
- **Architect connects to PM requirements and provides implementation guidance** (`architect.js`:1)
- **This class connects to GitHub API, context management, and advanced logging** (`base-persona-enhanced.js`:1)
- **This class connects to GitHub API and context management** (`base-persona.js`:1)
- **Developer connects to architecture design and provides production-ready code** (`developer-enhanced.js`:1)
- **Developer connects to architecture design and provides working code** (`developer.js`:1)
- **DevOps connects to security approval and provides deployment readiness** (`devops.js`:1)
- **PM connects to GitHub Issues and creates structured work items** (`project-manager.js`:1)
- **QA connects to developer implementation and provides quality validation** (`qa.js`:1)
- **Monitors CI/CD failures and reverts problematic commits** (`recovery.js`:1)
- **Release Manager connects to DevOps preparation and manages final release** (`release-manager.js`:1)
- **Security connects to QA results and provides security validation** (`security.js`:1)
- **Connects code analysis to comprehensive documentation generation** (`agent-doc-enhanced.js`:1)
- **Reads BMAD_HANDOVER.md and activeContext.md to decide next steps** (`bmad-orchestrator.js`:2)
- **Coordinates all personas, GitHub integration, and advanced monitoring** (`bmad-workflow-enhanced.js`:2)
- **Coordinates all personas and GitHub integration** (`bmad-workflow.js`:2)
- **Integrates with Hook Orchestrator for commit message validation** (`bmad-message-validator.js`:1)
- **Integrates with ExponentialBackoff for retry logic** (`commit-handler.js`:1)
- **Integrates with all BMAD components for consistent configuration** (`config-loader.js`:1)
- **Provides consistent mock responses for GitHub operations** (`octokit.js`:1)
- **Tests validate persona integration and workflow** (`personas.test.js`:1)
- **Setup consistent test environment across all tests** (`setup.js`:1)
- **Tests validate workflow execution and GitHub integration** (`workflow.test.js`:1)

## Architecture Patterns
- Demonstrates proper commit handling patterns for BMAD system
- All commit messages must follow BMAD pattern or conventional commits format
- All git operations must be validated and follow BMAD patterns

## Technology Stack
No technology stack information found.

---
*Generated by Enhanced BMAD Agent Documentation*
