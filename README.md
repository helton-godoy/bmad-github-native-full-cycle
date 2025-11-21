# BMAD-GitHub Native Full Cycle

**Autonomous AI-driven development workflow integrating the BMAD Method with GitHub native features**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/helton-godoy/bmad-github-native-full-cycle)
[![BMAD Method](https://img.shields.io/badge/BMAD-Method-green)](https://github.com/bmad-code-org/BMAD-METHOD)

---

## 🎯 Project Overview

This project implements a fully autonomous software development workflow that integrates the **BMAD Method** (Breakthrough Method for Agile AI-Driven Development) with GitHub's native features. It enables AI agents to operate continuously through specialized personas, managing the complete software development lifecycle from planning to release.

### Key Features

- **🤖 Autonomous Operation:** AI agent operates continuously without manual intervention
- **🎭 Specialized Personas:** 8 distinct AI personas (PM, Architect, Developer, QA, DevOps, Security, Release Manager)
- **🔒 Safety Protocol:** Micro-commits with indexed IDs for granular rollback
- **📊 Full Traceability:** Complete history of decisions and persona transitions
- **🔄 GitHub Native:** Leverages Issues, PRs, Actions, Releases - no external tools

---

## 📁 Project Structure

```
bmad-github-native-full-cycle/
├── .clinerules                 # Agent rules and persona definitions
├── .clineignore               # Token optimization (files to exclude)
├── .github/
│   └── BMAD_HANDOVER.md       # State tracking and persona transitions
├── productContext.md          # Long-term project knowledge (Memory Bank)
├── activeContext.md           # Current session context (Memory Bank)
└── README.md                  # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **AI Agent:** Kilo Code, Roo Code, or compatible agent
- **GitHub Account:** With repository access
- **Git:** Installed locally

### Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/helton-godoy/bmad-github-native-full-cycle.git
   cd bmad-github-native-full-cycle
   npm run setup  # Installs local dependencies (gh, act)
   ```

2. **The agent will automatically:**
   - Read `.clinerules` for behavior rules
   - Load `productContext.md` for project knowledge
   - Check `BMAD_HANDOVER.md` for current state
   - Execute tasks from `task.md`

---

## 🎭 BMAD Personas

| Persona | Domain | Output | Next Persona |
|---------|--------|--------|--------------|
| **[PM]** Product Manager | Requirements | `docs/planning/PRD.md` | [ARCHITECT] |
| **[ARCHITECT]** Architect | System Design | `docs/architecture/TECH_SPEC.md` | [SCRUM] |
| **[SCRUM]** Scrum Master | Task Breakdown | GitHub Issues | [DEV] |
| **[DEV]** Developer | Implementation | Code + Commits | [QA] |
| **[QA]** Quality Assurance | Testing | PR Reviews | [RELEASE] |
| **[DEVOPS]** DevOps Engineer | CI/CD | `.github/workflows/*.yml` | On-demand |
| **[SECURITY]** Security Engineer | Security | `SECURITY.md`, CodeQL | On-demand |
| **[RELEASE]** Release Manager | Deployment | GitHub Releases | [ORCHESTRATOR] |

---

## 🔄 Workflow Example

```
1. [ORCHESTRATOR] Reads task.md → Identifies new feature
2. [PM] Creates PRD.md → Commit [PM] [STEP-001]
3. [ARCHITECT] Creates TECH_SPEC.md → Commit [ARCHITECT] [STEP-002]
4. [SCRUM] Creates GitHub Issue #1 → Commit [SCRUM] [STEP-003]
5. [DEV] Implements in branch feature/1 → Commits [DEV] [STEP-004-010]
6. [QA] Reviews PR → Tests pass → Merge → Commit [QA] [STEP-011]
7. [RELEASE] Creates tag v1.0.0 → Release → Commit [RELEASE] [STEP-012]
8. [ORCHESTRATOR] Updates task.md → Feature complete
```

---

## 🔒 Safety Protocol

Every action generates a micro-commit with the format:

```
[PERSONA] [STEP-XXX] Description
```

**Example:**

```
[DEV] [STEP-042] Implement user authentication service
```

**Rollback:**

```bash
git reset --hard [STEP-ID]
```

---

## 📊 Current Status

### Phase 1: Foundation ✅ COMPLETE

- ✅ `.clinerules` - Agent rules
- ✅ `.github/BMAD_HANDOVER.md` - State tracker
- ✅ `.clineignore` - Token optimizer
- ✅ Memory Bank (`productContext.md`, `activeContext.md`)

### Phase 2: Infrastructure 🚧 PENDING

- ⏳ GitHub Actions workflows
- ⏳ Issue templates
- ⏳ Security policies

### Phase 3: Validation ⏳ PLANNED

- ⏳ Complete cycle test
- ⏳ Autonomy validation

---

## 🧠 Memory Bank

The project uses a **Memory Bank** system for efficient context management:

- **`productContext.md`** - Persistent project knowledge (read every session)
- **`activeContext.md`** - Current work context (updated frequently)
- **`.clineignore`** - Excludes irrelevant files to save tokens
- **Hybrid RAG** - Combines vector search (`codebase_search`) + keyword search (`grep`)

---

## 📚 Documentation

- **[BMAD Method Official](https://github.com/bmad-code-org/BMAD-METHOD)** - Original framework
- **[Task List](task.md)** - Current roadmap (in brain directory)
- **[Product Context](productContext.md)** - Full project knowledge
- **[Active Context](activeContext.md)** - Current session state

---

## 🤝 Contributing

This is a reference implementation of the BMAD-GitHub Native workflow. Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Follow the BMAD commit format: `[PERSONA] [STEP-XXX] Description`
4. Open a Pull Request

---

## 📝 License

This project is open source and available under the MIT License.

---

## 🙏 Acknowledgments

- **BMAD Method** - Original framework by [bmad-code-org](https://github.com/bmad-code-org)
- **Kilo Code** - AI agent platform
- **GitHub** - Native features and infrastructure

---

**Repository:** <https://github.com/helton-godoy/bmad-github-native-full-cycle>  
**Created:** 2025-11-21  
**Status:** Phase 1 Complete ✅
