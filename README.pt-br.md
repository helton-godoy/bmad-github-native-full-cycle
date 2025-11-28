# BMAD-GitHub Native Full Cycle

**Fluxo de desenvolvimento autônomo impulsionado por IA integrando o Método BMAD com recursos nativos do GitHub**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/helton-godoy/bmad-github-native-full-cycle)
[![BMAD Method](https://img.shields.io/badge/BMAD-Method-green)](https://github.com/bmad-code-org/BMAD-METHOD)

> 🇺🇸 **English Version:** [Click here](README.md)

---

## 🎯 Visão Geral do Projeto

Este projeto implementa um fluxo de trabalho de desenvolvimento de software totalmente autônomo que integra o **Método BMAD** (Breakthrough Method for Agile AI-Driven Development) com os recursos nativos do GitHub. Ele permite que agentes de IA operem continuamente por meio de personas especializadas, gerenciando o ciclo de vida completo do desenvolvimento de software, desde o planejamento até o lançamento.

### Principais Recursos

- **🤖 Operação Autônoma:** O agente de IA opera continuamente sem intervenção manual
- **🎭 Personas Especializadas:** 8 personas de IA distintas (PM, Arquiteto, Desenvolvedor, QA, DevOps, Segurança, Gerente de Release)
- **🔒 Protocolo de Segurança:** Micro-commits com IDs indexados para rollback granular
- **📊 Rastreabilidade Total:** Histórico completo de decisões e transições de personas
- **🔄 GitHub Native:** Aproveita Issues, PRs, Actions, Releases - sem ferramentas externas

---

## 📁 Estrutura do Projeto

```
bmad-github-native-full-cycle/
├── .clinerules                 # Regras do agente e definições de persona
├── .clineignore               # Otimização de tokens (arquivos a excluir)
├── .github/
│   └── BMAD_HANDOVER.md       # Rastreamento de estado e transições de persona
├── productContext.md          # Conhecimento do projeto a longo prazo (Memory Bank)
├── activeContext.md           # Contexto da sessão atual (Memory Bank)
└── README.pt-br.md            # Este arquivo
```

---

## 🚀 Início Rápido

### Pré-requisitos

- **Agente de IA:** Kilo Code, Roo Code ou agente compatível
- **Conta GitHub:** Com acesso ao repositório
- **Git:** Instalado localmente

### Configuração

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/helton-godoy/bmad-github-native-full-cycle.git
   cd bmad-github-native-full-cycle
   npm run setup  # Instala dependências locais (gh, act)
   ```

2. **O agente irá automaticamente:**
   - Ler `.clinerules` para regras de comportamento
   - Carregar `productContext.md` para conhecimento do projeto
   - Verificar `BMAD_HANDOVER.md` para o estado atual
   - Executar tarefas do `task.md`

---

## 🎭 Personas BMAD

| Persona | Domínio | Saída | Próxima Persona |
|---------|--------|--------|--------------|
| **[PM]** Product Manager | Requisitos | `docs/pt-br/planning/PRD.md` | [ARCHITECT] |
| **[ARCHITECT]** Architect | Design de Sistema | `docs/pt-br/architecture/TECH_SPEC.md` | [SCRUM] |
| **[SCRUM]** Scrum Master | Quebra de Tarefas | GitHub Issues | [DEV] |
| **[DEV]** Developer | Implementação | Código + Commits | [QA] |
| **[QA]** Quality Assurance | Testes | PR Reviews | [RELEASE] |
| **[DEVOPS]** DevOps Engineer | CI/CD | `.github/workflows/*.yml` | Sob demanda |
| **[SECURITY]** Security Engineer | Segurança | `SECURITY.md`, CodeQL | Sob demanda |
| **[RELEASE]** Release Manager | Deploy | GitHub Releases | [ORCHESTRATOR] |

---

## 🔄 Exemplo de Fluxo

```
1. [ORCHESTRATOR] Lê task.md → Identifica nova feature
2. [PM] Cria PRD.md → Commit [PM] [STEP-001]
3. [ARCHITECT] Cria TECH_SPEC.md → Commit [ARCHITECT] [STEP-002]
4. [SCRUM] Cria GitHub Issue #1 → Commit [SCRUM] [STEP-003]
5. [DEV] Implementa na branch feature/1 → Commits [DEV] [STEP-004-010]
6. [QA] Revisa PR → Testes passam → Merge → Commit [QA] [STEP-011]
7. [RELEASE] Cria tag v1.0.0 → Release → Commit [RELEASE] [STEP-012]
8. [ORCHESTRATOR] Atualiza task.md → Feature concluída
```

---

## 🔒 Protocolo de Segurança

Cada ação gera um micro-commit com o formato:

```
[PERSONA] [STEP-XXX] Descrição
```

**Exemplo:**

```
[DEV] [STEP-042] Implementar serviço de autenticação de usuário
```

**Rollback:**

```bash
git reset --hard [STEP-ID]
```

---

## 📊 Status Atual

### Fase 1: Fundação ✅ CONCLUÍDA

- ✅ `.clinerules` - Regras do agente
- ✅ `.github/BMAD_HANDOVER.md` - Rastreador de estado
- ✅ `.clineignore` - Otimizador de tokens
- ✅ Memory Bank (`productContext.md`, `activeContext.md`)

### Fase 2: Infraestrutura 🚧 PENDENTE

- ⏳ Workflows do GitHub Actions
- ⏳ Templates de Issue
- ⏳ Políticas de segurança

### Fase 3: Validação ⏳ PLANEJADA

- ⏳ Teste de ciclo completo
- ⏳ Validação de autonomia

---

## 🧠 Memory Bank

O projeto usa um sistema de **Memory Bank** para gerenciamento eficiente de contexto:

- **`productContext.md`** - Conhecimento persistente do projeto (lido a cada sessão)
- **`activeContext.md`** - Contexto de trabalho atual (atualizado frequentemente)
- **`.clineignore`** - Exclui arquivos irrelevantes para economizar tokens
- **Hybrid RAG** - Combina busca vetorial (`codebase_search`) + busca por palavra-chave (`grep`)

---

## 📚 Documentação

- **[BMAD Method Oficial](https://github.com/bmad-code-org/BMAD-METHOD)** - Framework original
- **[Lista de Tarefas](task.md)** - Roadmap atual (no diretório brain)
- **[Contexto do Produto](productContext.md)** - Conhecimento completo do projeto
- **[Contexto Ativo](activeContext.md)** - Estado da sessão atual

---

## 🤝 Contribuindo

Esta é uma implementação de referência do fluxo de trabalho BMAD-GitHub Native. Contribuições são bem-vindas!

1. Faça um Fork do repositório
2. Crie uma branch de feature
3. Siga o formato de commit BMAD: `[PERSONA] [STEP-XXX] Descrição`
4. Abra um Pull Request

---

## 📝 Licença

Este projeto é open source e está disponível sob a Licença MIT.

---

## 🙏 Agradecimentos

- **BMAD Method** - Framework original por [bmad-code-org](https://github.com/bmad-code-org)
- **Kilo Code** - Plataforma de agente de IA
- **GitHub** - Recursos nativos e infraestrutura

---

**Repositório:** <https://github.com/helton-godoy/bmad-github-native-full-cycle>
**Criado:** 21/11/2025
**Status:** Fase 1 Concluída ✅
