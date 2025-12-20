# Product Overview

## BMAD-GitHub Native Full Cycle

This project implements a fully autonomous AI-driven development workflow that integrates the **BMAD Method** (Breakthrough Method for Agile AI-Driven Development) with GitHub's native features.

### Core Concept

An AI agent operates as a **BMAD Orchestrator**, coordinating specialized personas (PM, Architect, Developer, QA, DevOps, Security, Release Manager) to execute the complete software development lifecycle autonomously, safely, and with full traceability.

### Key Features

- **Autonomous Operation**: AI agent operates continuously without manual intervention
- **Specialized Personas**: 8 distinct AI personas handling different aspects of development
- **Safety Protocol**: Micro-commits with indexed IDs for granular rollback capability
- **Full Traceability**: Complete history of decisions and persona transitions
- **GitHub Native**: Leverages Issues, PRs, Actions, Releases - no external tools required

### Success Metrics

- Complete development cycles (Plan → Code → Test → Release) without manual intervention
- All commits follow the pattern `[PERSONA] [STEP-ID] Description`
- Automated handover documentation between personas
- GitHub Actions workflows execute automatically

### Memory Bank System

The project uses a Memory Bank for efficient context management:

- `productContext.md` - Persistent project knowledge
- `activeContext.md` - Current work context
- `.clineignore` - Token optimization by excluding irrelevant files
- Hybrid RAG combining vector search and keyword search
