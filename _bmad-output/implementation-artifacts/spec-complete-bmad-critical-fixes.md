---
title: 'Consolidar e integrar as correções críticas do BMAD'
type: 'refactor'
created: '2026-07-26T23:55:00-03:00'
status: 'done'
review_loop_iteration: 0
baseline_commit: '4925c65a7cd1bcae3d8b3cf850888d8876951181'
context:
  - '{project-root}/.kiro/specs/bmad-critical-fixes/requirements.md'
  - '{project-root}/.kiro/specs/bmad-critical-fixes/tasks.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Os componentes de loop detection, commit, gatekeeper, recuperação e cache de estado existem isoladamente, mas não participam de forma consistente do workflow principal. A suíte contém contratos divergentes, testes duplicados ou vazios e 17 falhas, impedindo que os checkpoints do plano sejam considerados concluídos.

**Approach:** Consolidar contratos e testes, fortalecer os componentes conforme os requisitos Kiro e integrá-los ao orquestrador, workflow e personas. Remover apenas duplicações comprovadas, preservar compatibilidade pública necessária e atualizar o planejamento somente após todas as verificações passarem.

## Boundaries & Constraints

**Always:** Preservar o snapshot `4925c65`; trabalhar na branch dedicada; usar persistência atômica; bloquear transições quando estado, gatekeeper ou precondições falharem; manter contexto completo na recuperação; testar as 24 propriedades com `fast-check` e pelo menos 100 execuções; manter logs estruturados sem segredos.

**Ask First:** Mudanças incompatíveis em APIs públicas, exclusão de artefatos que não sejam testes duplicados/esqueletos, alteração do modelo de branches ou qualquer operação remota.

**Never:** Fazer push; enfraquecer testes para obter verde; mascarar falhas com mocks do próprio método sob teste; usar bypass de desenvolvimento em produção; limpar histórico antes de um commit final verificado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Transição válida | Estado válido e gate aprovado | Estado persistido atomicamente e persona executada | Abortar sem alterar estado anterior se persistência falhar |
| Loop ou PM sem EARS | Par no limite ou PRD inválido | Transição bloqueada e Recovery ativada | Registrar tentativa bloqueada e contexto completo |
| Erro transitório | Operação de persona falha | Três tentativas com atrasos de 1s e 2s | Escalar e suspender após esgotamento |
| Commit | Mudanças staged ou worktree vazio | Commit formatado e hash verificado, ou skip auditável | Retry; falha de verificação entra em recovery |
| Reinício | Cache válido, inválido ou corrompido | Retomar step salvo ou reset inicial explícito | Logar load/validation failure |
| Gatekeeper | Teste passa, falha ou não inicia | Prosseguir somente em PASS/bypass autorizado | Relatório por teste e bloqueio em startup failure |

</frozen-after-approval>

## Code Map

- `scripts/bmad/bmad-orchestrator.js` -- coordenação de transições, gates, estado e recuperação.
- `scripts/bmad/bmad-workflow-enhanced.js` -- ciclo, retomada e conclusão final.
- `personas/base-persona-enhanced.js` -- execução de commits das personas.
- `scripts/lib/{loop-detector,state-cache-manager,error-recovery-manager,commit-handler,enhanced-gatekeeper,exponential-backoff}.js` -- contratos críticos.
- `tests/unit/bmad-critical-fixes-*.test.js` -- propriedades 1–24 consolidadas.
- `.kiro/specs/bmad-critical-fixes/tasks.md` -- status final baseado em evidência.

## Tasks & Acceptance

**Execution:**
- [x] Fortalecer `state-cache-manager.js` e `loop-detector.js` com validação, limite, atomicidade, ciclo/status e erros observáveis.
- [x] Corrigir `exponential-backoff.js`, `error-recovery-manager.js` e `personas/recovery.js` para retry, escalação, suspensão e retomada.
- [x] Completar `commit-handler.js` e delegar commits de `base-persona-enhanced.js`.
- [x] Unificar o contrato do `enhanced-gatekeeper.js` e integrá-lo às fronteiras de fase.
- [x] Integrar todos os componentes em `bmad-orchestrator.js` e `bmad-workflow-enhanced.js`, incluindo `getDynamicPath`.
- [x] Consolidar testes, implementar propriedades 16–24 e eliminar esqueletos duplicados.
- [x] Atualizar tarefas Kiro e documentação somente com evidência dos checks.

**Acceptance Criteria:**
- Given qualquer transição, when ela é avaliada, then loop, EARS, gate e persistência são verificados antes da execução.
- Given uma interrupção ou falha, when o workflow reinicia, then retoma o step válido ou registra reset seguro.
- Given commit final verificado, when o ciclo conclui, then o histórico do ciclo é removido em até cinco segundos.
- Given a suíte completa, when testes, lint e cobertura são executados, then não há falhas nem testes vazios das propriedades 1–24.

## Spec Change Log

## Design Notes

Usar um único objeto de estado com `workflowId`, `persona`, `stepId`, `context`, `status` e timestamp. Componentes retornam resultados estruturados; o orquestrador decide prosseguir, recuperar ou suspender. Compatibilidade legada deve ser feita por aliases finos, não por implementações paralelas.

## Verification

**Commands:**
- `npm test -- --runInBand` -- 62+ suítes sem falhas.
- `npm run lint` -- zero erros.
- `npm run test:coverage -- --runInBand` -- thresholds configurados atendidos.
- `rg "Test implementation|require\\('../../scripts/lib/(error-recovery|state-cache)'\\)|require\\('../../scripts/bmad/bmad-loop-detector'\\)" tests/unit` -- nenhuma ocorrência legada.

## Suggested Review Order

**Orquestração e ciclo**

- Entrada central coordena transição, gate, persistência e recuperação por issue.
  [`bmad-orchestrator.js:43`](../../scripts/bmad/bmad-orchestrator.js#L43)

- Validação registra bloqueios antes da execução e sucesso somente após conclusão.
  [`bmad-orchestrator.js:455`](../../scripts/bmad/bmad-orchestrator.js#L455)

- Ciclo preserva estados interrompidos e limpa somente conclusões verificadas.
  [`bmad-workflow-enhanced.js:81`](../../scripts/bmad/bmad-workflow-enhanced.js#L81)

- Limpeza remove estado primário e backup sem afetar ciclos incompletos.
  [`bmad-workflow-enhanced.js:371`](../../scripts/bmad/bmad-workflow-enhanced.js#L371)

**Persistência e recuperação**

- Restauração valida o primário e aproveita backup íntegro antes do reset.
  [`state-cache-manager.js:49`](../../scripts/lib/state-cache-manager.js#L49)

- Lock exclusivo serializa escritores e recupera travas abandonadas.
  [`state-cache-manager.js:155`](../../scripts/lib/state-cache-manager.js#L155)

- Histórico é isolado e limpo por workflow, preservando issues concorrentes.
  [`loop-detector.js:67`](../../scripts/lib/loop-detector.js#L67)

- Retry aceita somente erros recuperáveis e escala contexto estruturado.
  [`error-recovery-manager.js:24`](../../scripts/lib/error-recovery-manager.js#L24)

**Commits e gates**

- Persona delega staging, validação, retry e verificação a um único handler.
  [`base-persona-enhanced.js:172`](../../personas/base-persona-enhanced.js#L172)

- Git usa argumentos sem shell e verifica todos os formatos de resultado.
  [`commit-handler.js:84`](../../scripts/lib/commit-handler.js#L84)

- Gate de fase normaliza fixtures, bypass e falhas de inicialização.
  [`enhanced-gatekeeper.js:86`](../../scripts/lib/enhanced-gatekeeper.js#L86)

**Infraestrutura testável**

- Execução serial aceita dependências injetadas sem comandos reais nos testes.
  [`test-execution-manager.js:11`](../../scripts/lib/test-execution-manager.js#L11)

- Monitor standalone separa parsing, spawn e encerramento para isolamento.
  [`monitor-test-processes.js:25`](../../scripts/monitor-test-processes.js#L25)

- Cobertura global comprova todos os thresholds sem reduzir limites.
  [`review-hardening-coverage.test.js:1`](../../tests/unit/review-hardening-coverage.test.js#L1)
