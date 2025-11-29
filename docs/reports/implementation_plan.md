# Implementation Plan - Enhanced BMAD Framework

## Goal Description

Enhance the BMAD framework to achieve full autonomy by implementing smart orchestration, robust error recovery, and continuous workflow loops. This phase addresses critical gaps preventing the system from handling special tasks (like audits) and maintaining continuity without manual intervention.

## User Review Required
>
> [!IMPORTANT]
> This phase modifies the core orchestration logic. Existing workflows might be reset.

## Proposed Changes

### Core Orchestration

#### [MODIFY] [bmad-orchestrator.js](file:///home/helton/git/bmad-github-native-full-cycle/scripts/bmad/bmad-orchestrator.js)

- Implement `detectIssueType(issue)` to classify tasks (Feature, Bug, Audit).
- Add logic to handle `[Audit]` issues by triggering a specific PM flow.
- Implement `resetState(issueNumber)` to clear stale `BMAD_HANDOVER.md` when starting a new distinct task.
- Refine `determineNextAction` to support branching logic based on issue type.

### Workflow Engine

#### [MODIFY] [bmad-workflow-enhanced.js](file:///home/helton/git/bmad-github-native-full-cycle/scripts/bmad/bmad-workflow-enhanced.js)

- Ensure `issueNumber` is passed to Orchestrator for context awareness.
- Improve the main loop to handle "idle" states more gracefully (e.g., check for new sub-issues created by PM).

## Verification Plan

### Automated Tests

- Create a mock issue with `[Audit]` title.
- Run `npm run bmad:workflow <audit-issue-id>`.
- Verify that PM is activated and `MASTER_PLAN.md` is created.
- Verify that the workflow continues to the next phase (Architect) automatically.

### Manual Verification

- User runs the workflow on the actual Audit Issue #48 in `shantilly-cli`.

## Fase 8: Foundation Hardening (Relatório Consolidado - Fase 1)

### Objetivo

Implementar validações server-side e automação de recovery para garantir que as regras de segurança sejam aplicadas independentemente do ambiente local.

### Mudanças Propostas

#### [NEW] `.github/workflows/ci-validate.yml`

Workflow de GitHub Actions que executa:

1. `npm install`
2. `npm run validate` (Lint + Tests)
3. `node scripts/bmad/product-context-validator.js`

#### [MODIFY] `scripts/bmad/bmad-monitor.js`

- Adicionar listener para webhook de falha de CI.
- Invocar `RecoveryPersona` quando detectada falha no branch `main`.

#### [MODIFY] `scripts/bmad/bmad-workflow-enhanced.js`

- Adicionar estados explícitos: `TIMEOUT`, `RECOVERY_ACTIVE`, `RECOVERY_SUCCESS`, `RECOVERY_FAILED`.
- Implementar lógica de retomada (resume) baseada no último estado salvo.

## Fase 9: Reliability Enhancement (Relatório Consolidado - Fase 2)

### Objetivo

Centralizar o gerenciamento de estado e contexto para eliminar race conditions e inconsistências.

### Mudanças Propostas

#### [NEW] `lib/context-manager.js`

- Classe singleton para gerenciar leitura/escrita de arquivos de contexto.
- Implementar locking atômico (ex: usando diretórios `.lock` ou Git refs).
- Validar schemas JSON/Markdown na escrita.

#### [MODIFY] `personas/base-persona-enhanced.js`

- Substituir chamadas diretas de `fs` e `getContextHash` pelo `ContextManager`.

#### [NEW] `.github/workflows/security-scan.yml`

- Implementar `npm audit` ou ferramenta similar.
- Configurar segredos no repositório.

## Fase 10: Performance & Testing (Relatório Consolidado - Fase 3)

### Objetivo

Garantir escalabilidade e confiança através de testes automatizados e otimizações.

### Mudanças Propostas

#### [NEW] `tests/orchestrator.test.js`

- Testes unitários para `bmad-orchestrator.js` usando Jest.
- Mocks para `fs` e `octokit`.

#### [MODIFY] `personas/base-persona-enhanced.js`

- Implementar cache simples (in-memory ou file-based) para chamadas `octokit.rest.issues.get` repetitivas.

## Fase 11: Production Readiness (Relatório Consolidado - Fase 4)

### Objetivo

Preparar o sistema para operação em produção com documentação e ferramentas de suporte.

### Mudanças Propostas

#### [NEW] `docs/operations/RUNBOOK.md`

- Procedimentos para: Reset manual, Recovery forçado, Restore de backup.

#### [NEW] `bin/bmad-cli.js`

- Ferramenta CLI para operadores: `bmad status`, `bmad resume`, `bmad reset`.
