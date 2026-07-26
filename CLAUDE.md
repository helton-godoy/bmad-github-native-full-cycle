# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BMAD-GitHub Native Full Cycle** implements an autonomous AI-driven development workflow integrating the **BMAD Method** (Breakthrough Method for Agile AI-Driven Development) with GitHub native features. AI agents operate continuously through specialized personas, managing the complete SDLC from planning to release.

### Key Concepts

- **Autonomous Operation:** AI agent operates continuously without manual intervention via the BMAD Orchestrator
- **Persona Pipeline:** 8 personas (PM, Architect, Developer, QA, DevOps, Security, Release Manager) execute sequentially
- **State Machine:** `.github/BMAD_HANDOVER.md` tracks persona transitions and workflow phase
- **Safety Protocol:** Micro-commits with indexed IDs (`[PERSONA] [STEP-XXX] Description`) for granular rollback
- **Memory Bank:** `productContext.md` (persistent knowledge) + `activeContext.md` (session state) for context management
- **Gatekeeper:** Pre-commit validation enforcing conventional commits, context updates, and quality gates

## Commands

### Setup
```bash
npm run setup          # Install dependencies and make scripts executable
npm run setup:enhanced # Enhanced setup with additional configuration
cp .env.example .env   # Configure environment variables (GITHUB_TOKEN required)
```

### Development Server
```bash
npm start              # Start Express server on port 3000
npm run dev            # Generate docs + start server
```

### Testing
```bash
npm test               # Run all Jest tests (single worker, stops on first failure)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report (threshold: 80%)
npm run test:serial    # Run tests serially (--runInBand)
npm run test:fast      # Fast test run (bail=1, 3s timeout)
npm run test:minimal   # Run with minimal config
npm run test:ci        # Run with CI config
npm run test:dev       # Run with development config
```

### BMAD Workflows
```bash
npm run bmad:workflow          # Run full enhanced BMAD workflow
npm run bmad:workflow:original # Run original (non-enhanced) workflow
npm run bmad:workflow:single   # Run single persona workflow
npm run bmad:gatekeeper        # Pre-commit validation gate
npm run bmad:docs              # Generate documentation
npm run bmad:health            # Check system health
npm run bmad:state             # View workflow state storage stats
npm run bmad:search "query"    # Vector search across project memory
npm run bmad:monitor           # Run process monitor
npm run bmad:config            # Show full configuration
npm run bmad:config:validate   # Validate configuration
```

### Code Quality
```bash
npm run lint              # ESLint on src/, scripts/, personas/
npm run lint:fix          # ESLint with --fix
npm run format            # Prettier write
npm run format:check      # Prettier check
npm run validate          # Lint + test
```

### Git Hooks
```bash
npm run hooks:setup       # Set up git hooks
npm run hooks:test        # Test hook configuration
npm run hooks:validate    # Validate hook config
npm run hooks:report      # Generate hook report
```

### Monitoring
```bash
npm run monitor:analyze   # Analyze process monitoring data
npm run monitor:html      # Generate HTML report from monitoring data
npm run monitor:clean     # Clean monitoring data
npm run monitor:kill      # Kill monitored processes
```

## Architecture

### High-Level Structure

```
src/                          # Express.js API server
  ├── app.js                  # Express app setup (helmet, cors, morgan, routes)
  ├── index.js                # HTTP server entry point
  ├── controllers/            # Request handlers
  ├── middleware/             # Express middleware (auth)
  ├── routes/                # API route definitions (auth, orchestration)
  ├── services/              # Business logic (auth.service)
  ├── repositories/          # Data access layer (user.repository)
  └── utils/                 # Utilities (jwt, password, validator)

personas/                     # AI Persona implementations
  ├── base-persona.js         # Base class with GitHub integration
  ├── base-persona-enhanced.js# Enhanced base with quality gates
  ├── project-manager.js      # PM persona - creates PRDs
  ├── architect.js            # Architect persona - tech specs
  ├── developer.js            # Developer (original)
  ├── developer-enhanced.js   # Enhanced developer with code quality
  ├── qa.js                   # QA persona - testing & review
  ├── security.js             # Security persona - audits
  ├── devops.js               # DevOps persona - CI/CD
  ├── release-manager.js      # Release persona - GitHub Releases
  └── recovery.js             # Recovery persona - error recovery

scripts/
  ├── bmad/                   # BMAD orchestration engine
  │   ├── bmad-orchestrator.js          # Core orchestrator (reads state, dispatches personas)
  │   ├── bmad-workflow-enhanced.js     # Full workflow runner (all personas in sequence)
  │   ├── bmad-workflow.js             # Original workflow runner
  │   ├── bmad-gatekeeper.js           # Pre-commit validation script
  │   ├── bmad-enhanced-gatekeeper.js  # Enhanced validation with more checks
  │   ├── bmad-monitor.js              # Performance monitoring
  │   ├── agent-doc-enhanced.js        # Enhanced document generation
  │   └── health-check.js             # System health check
  ├── hooks/                  # Git hooks system
  │   ├── hook-orchestrator.js         # Central hook coordinator
  │   ├── context-synchronizer.js      # Syncs context between sessions
  │   ├── bmad-message-validator.js    # Validates commit messages
  │   ├── config-validator.js         # Validates hook configuration
  │   ├── github-actions-sync.js      # Syncs with GitHub Actions
  │   ├── hook-error-handler.js       # Error handling for hooks
  │   └── install-hooks.js            # Hook installer
  └── lib/                    # Shared libraries
      ├── context-manager.js          # Context state management
      ├── cache-manager.js            # Caching layer
      ├── performance-monitor.js      # Performance tracking
      ├── process-monitor.js          # Process monitoring
      ├── secret-manager.js           # Secret management
      ├── commit-handler.js           # Commit processing
      ├── git-state-manager.js        # Git state tracking
      ├── test-execution-manager.js   # Test orchestration
      └── logger.js                   # Logging utility

tests/
  ├── unit/                  # Unit tests for hooks, personas, monitors
  ├── integration/           # Full workflow, context-git, hook-orchestrator
  ├── mocks/                 # Octokit mock, BMAD mocks
  ├── simulation/            # GitHub simulator
  ├── personas/              # Persona-specific tests
  └── utils/                 # Test utilities (resource-aware-sequencer)

docs/                         # Documentation (en/ and pt-br/)
  ├── architecture/           # System architecture docs
  ├── planning/               # PRDs and work plans
  ├── hooks/                  # Git hooks documentation
  ├── operations/             # Runbooks
  ├── reports/                # Audit reports and metrics
  └── en/ | pt-br/            # Bilingual documentation

.github/workflows/            # GitHub Actions CI/CD
  ├── bmad-autonomous.yml     # Autonomous BMAD workflow
  ├── ci.yml                  # Continuous integration
  ├── ci-validate.yml         # CI validation
  ├── linter.yml              # Linting
  ├── release.yml             # Release automation
  ├── security.yml            # Security scanning
  ├── security-audit.yml      # Security audit
  └── watchdog.yml            # Watchdog monitoring

.clinerules/                  # AI agent behavioral rules
  ├── README.md               # BMAD Agentic Protocol v2.0
  ├── hooks/                  # PreToolUse, TaskStart hooks
  └── workflows/              # bmad-daily.md workflow
```

### Core Architecture Patterns

1. **Orchestration Model:** The `BMADOrchestrator` in `scripts/bmad/bmad-orchestrator.js` is the central coordinator. It reads the handover state (`.github/BMAD_HANDOVER.md`), determines the next persona to execute based on the current phase, dispatches the persona, and updates state upon completion.

2. **Persona Base Class:** All personas extend `base-persona.js` or `base-persona-enhanced.js`, which provide:
   - GitHub API integration via `@octokit/rest`
   - Standardized `execute()` method interface
   - Logging and error handling
   - Quality gate validation (enhanced version)

3. **State Machine:** The workflow is driven by a state machine where each phase maps to a persona:
   `Planning(PM) → Architecture(Architect) → Development(Developer) → QA(QA) → Security(Security) → DevOps(DevOps) → Release(ReleaseManager)`

4. **Gatekeeper Pattern:** Before any commit, `npm run bmad:gatekeeper` must pass. It validates:
   - Conventional commit format (`type(scope): description`)
   - `activeContext.md` is updated alongside code changes
   - Quality gates pass (tests, linting)

5. **Git Hooks System:** A comprehensive hooks framework under `scripts/hooks/` validates commits, synchronizes context, and integrates with GitHub Actions. The `.clinerules/hooks/PreToolUse` intercepts git commit commands to enforce BMAD rules at the agent level.

6. **Express API:** A lightweight Express server provides:
   - `/health` - Health check endpoint
   - `/api/auth/*` - JWT-based authentication
   - `/api/agents/status` - SSE stream for agent status
   - `/api/tasks/:id/cot` - SSE stream for chain-of-thought
   - `/api/tasks/:id/logs` - SSE stream for execution logs

### Key Configuration Files

- `.env.example` - All environment variables with documentation
- `jest.config.js` - Jest config (80% coverage threshold, single worker, custom sequencer)
- `eslint.config.js` - ESLint flat config
- `babel.config.js` - Babel config for Jest transforms
- `.prettierrc` - Prettier formatting settings
- `.clineignore` - Token optimization for agent context (excludes node_modules, build outputs, etc.)
- `package.json` - All scripts and BMAD metadata under `"bmad"` key
