# Product Context - BMAD-GitHub Native Full Cycle

**Last Updated:** 2025-11-21T04:19:30-04:00  
**Project:** BMAD-GitHub Native Full Cycle  
**Repository:** <https://github.com/helton-godoy/bmad-github-native-full-cycle>

---

## Project Overview

### Mission

Implementar um fluxo de desenvolvimento de software completamente autônomo que integra o **BMAD Method** (Breakthrough Method for Agile AI-Driven Development) com recursos nativos do GitHub, permitindo que agentes de IA operem continuamente através de personas especializadas.

### Core Concept

Um sistema de desenvolvimento onde um agente de IA (Antigravity/Kilo Code) atua como **BMAD Orchestrator**, coordenando personas especializadas (PM, Architect, Developer, QA, DevOps, Security, Release Manager) para executar o ciclo completo de desenvolvimento de software de forma autônoma, segura e rastreável.

---

## Architecture

### Orchestration Model

- **Meta-Persona:** BMAD Orchestrator (coordenador central)
- **Specialized Personas:** 8 personas com responsabilidades específicas
- **State Machine:** `.github/BMAD_HANDOVER.md` (rastreamento de transições)
- **Safety Protocol:** Micro-commits indexados (`[PERSONA] [STEP-ID] Description`)

### GitHub Native Integration

| BMAD Component | GitHub Feature |
|----------------|----------------|
| PRD/Specs | Wiki ou `docs/` |
| Tasks | GitHub Issues |
| Implementation | Branches + PRs |
| Testing | GitHub Actions |
| Release | GitHub Releases + Tags |

---

## Technology Stack

### Core Framework

- **BMAD Method:** Agentic Agile framework oficial
- **Agent Platform:** Antigravity (Kilo Code / Roo Code fork)
- **Version Control:** Git + GitHub
- **CI/CD:** GitHub Actions

### Memory Management (Native)

- **Context Condensing:** Automatic (native Kilo Code feature)
- **Memory Bank:** Markdown files (`productContext.md`, `activeContext.md`)
- **Token Optimization:** `.clineignore` + Hybrid RAG
- **Hybrid RAG:** `codebase_search` (Vector) + `grep` (Keyword)

---

## Project Goals

### Primary Objectives

1. **Autonomia:** Eliminar pausas desnecessárias e intervenções manuais
2. **Segurança:** Rollback granular via micro-commits indexados
3. **Rastreabilidade:** Histórico completo de decisões e transições
4. **Integração:** Uso exclusivo de recursos nativos do GitHub

### Success Metrics

- ✅ Ciclo completo (Plan → Code → Test → Release) sem intervenção manual
- ✅ Todos os commits seguem padrão `[PERSONA] [STEP-ID]`
- ✅ Handovers documentados automaticamente
- ✅ Workflows do GitHub Actions executam automaticamente

---

## Development Phases

### Phase 1: Foundation (Governance) ✅ COMPLETE

- `.clinerules` - Agent rules and persona definitions
- `.github/BMAD_HANDOVER.md` - State tracking
- `.clineignore` - Token optimization
- Memory Bank files (this file + `activeContext.md`)

### Phase 2: Infrastructure (Skeleton) 🚧 PENDING

- GitHub Actions workflows (CI, Linter, Security)
- Issue templates (User Story, Epic, Bug)
- Security policies (`SECURITY.md`, CodeQL)

### Phase 3: Validation (Pulse) ⏳ PLANNED

- Complete cycle test (Plan → Code → Test → Release)
- Autonomy validation
- Rollback testing

---

## Key Decisions

### Why New Repository Instead of Fork?

- **Decisão:** Criar repositório novo (`bmad-github-native-full-cycle`)
- **Razão:** O fork do BMAD-METHOD original contém templates e estrutura genérica. Nosso projeto é uma **implementação específica** do BMAD adaptada para GitHub Native, não uma extensão do framework original.
- **Benefício:** Liberdade para estruturar o repositório de acordo com nossas necessidades sem conflitos com upstream.

### Why Native Tools Over ContextGuard Scripts?

- **Decisão:** Usar recursos nativos do Kilo Code em vez de scripts Python externos
- **Razão:** Menor fricção, melhor integração, menos pontos de falha
- **Trade-off:** Perdemos "Token Budget Enforcement" rígido, mas ganhamos fluidez

### Why Hybrid RAG?

- **Decisão:** Combinar `codebase_search` (vetorial) + `grep` (léxico)
- **Razão:** Melhor recall e precisão para busca de código e contexto
- **Implementação:** Agentic (o Orchestrator decide quando usar cada ferramenta)

---

## Personas and Responsibilities

### [ORCHESTRATOR] - Meta-Persona

**Role:** Coordenador central  
**Responsibilities:**

- Gerenciar estado no `BMAD_HANDOVER.md`
- Invocar personas apropriadas
- Garantir cumprimento de padrões
- Otimizar uso de tokens

### [PM] Product Manager

**Domain:** Requirements  
**Output:** `docs/planning/PRD.md`  
**Next:** [ARCHITECT]

### [ARCHITECT] Architect

**Domain:** System Design  
**Output:** `docs/architecture/TECH_SPEC.md`  
**Next:** [SCRUM]

### [SCRUM] Scrum Master

**Domain:** Task Breakdown  
**Output:** GitHub Issues  
**Next:** [DEV]

### [DEV] Developer

**Domain:** Implementation  
**Output:** Code + Commits  
**Next:** [QA]

### [QA] Quality Assurance

**Domain:** Testing  
**Output:** PR Reviews + Test Reports  
**Next:** [RELEASE] or [DEV] (if issues found)

### [DEVOPS] DevOps Engineer

**Domain:** CI/CD  
**Output:** `.github/workflows/*.yml`  
**Trigger:** On-demand

### [SECURITY] Security Engineer

**Domain:** Security  
**Output:** `SECURITY.md`, CodeQL config  
**Trigger:** On-demand

### [RELEASE] Release Manager

**Domain:** Deployment  
**Output:** GitHub Releases + Tags  
**Next:** [ORCHESTRATOR]

---

## Workflow Example

```
1. [ORCHESTRATOR] Reads task.md → Identifies new feature needed
2. [PM] Creates PRD.md → Commit [PM] [STEP-001]
3. [ARCHITECT] Creates TECH_SPEC.md → Commit [ARCHITECT] [STEP-002]
4. [SCRUM] Creates GitHub Issue #1 → Commit [SCRUM] [STEP-003]
5. [DEV] Implements in branch feature/1 → Multiple commits [DEV] [STEP-004-010]
6. [QA] Reviews PR → Tests pass → Merge → Commit [QA] [STEP-011]
7. [RELEASE] Creates tag v1.0.0 → GitHub Release → Commit [RELEASE] [STEP-012]
8. [ORCHESTRATOR] Updates task.md → Feature complete
```

---

## Token Budget Guidelines (Soft Limits)

- **Planning:** ~2000 tokens (concise, key decisions)
- **Development:** ~4000 tokens (complete implementation)
- **Testing:** ~1500 tokens (objective validation)
- **Release:** ~500 tokens (changelog and versioning)

---

## Context Priority

1. `.clinerules` (always loaded - agent constitution)
2. `BMAD_HANDOVER.md` (current state)
3. `task.md` (roadmap)
4. `productContext.md` (this file - project knowledge)
5. `activeContext.md` (current work context)
6. Artifacts of current phase (PRD, SPEC, etc.)
7. Relevant code

---

## Rollback Strategy

- Each `STEP-ID` = One commit
- Rollback command: `git reset --hard [STEP-ID]`
- Update `BMAD_HANDOVER.md` with rollback status
- Re-invoke appropriate persona to continue

---

## References

- **BMAD Method Official:** <https://github.com/bmad-code-org/BMAD-METHOD>
- **Our Repository:** <https://github.com/helton-godoy/bmad-github-native-full-cycle>
- **Documentation:** See `docs/` folder (to be created in Phase 2)

---

**End of Product Context**
