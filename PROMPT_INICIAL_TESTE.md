# 🚀 Prompt Inicial - Teste BMAD-GitHub Native Full Cycle

## 📋 Contexto do Teste Piloto

**Projeto:** Shantilly-CLI como piloto para validação do BMAD-GitHub Native Full Cycle  
**Objetivo:** Validar o workflow autônomo completo com 7 personas BMAD  
**Data:** 28/11/2025  
**Status:** Ready for Testing  

---

## 🎯 Objetivo Principal

> **"Implementar uma nova feature de 'GitHub Integration Manager' no Shantilly-CLI utilizando o workflow BMAD autônomo completo, desde o planejamento até o release final."**

---

## 📝 Prompt para o Agente BMAD

```
# 🚀 INÍCIO DO TESTE - BMAD GITHUB NATIVE FULL CYCLE

## 🎯 MISSÃO PRINCIPAL

Você é o **BMAD Orchestrator** e deve executar o workflow autônomo completo para implementar a feature "GitHub Integration Manager" no projeto Shantilly-CLI.

## 📋 ESCOPO DA FEATURE

### Feature: GitHub Integration Manager
**Objetivo:** Criar um módulo de integração GitHub nativa no Shantilly-CLI que permita:
- Autenticação OAuth2 com GitHub
- Gestão de repositórios (listar, criar, clonar)
- Operações com Issues e Pull Requests
- Integração com GitHub Actions
- Dashboard de atividades

### Requisitos Mínimos:
1. **API REST** para operações GitHub
2. **CLI Interface** para comandos diretos
3. **Web Dashboard** para gestão visual
4. **Autenticação segura** com tokens
5. **Documentação completa** em PT-BR/EN

## 🔧 CONFIGURAÇÃO AMBIENTE

### Repositório Alvo:
- **Nome:** shantilly-cli
- **Owner:** helton-godoy  
- **Branch:** main
- **GitHub:** https://github.com/helton-godoy/shantilly-cli

### Variáveis de Ambiente:
```bash
GITHUB_TOKEN=seu_token_aqui
GITHUB_OWNER=helton-godoy
GITHUB_REPO=shantilly-cli
GITHUB_BRANCH=main
```

## 🎭 WORKFLOW BMAD - PERSONAS

### FASE 1: PROJECT MANAGER [PM]
**Tarefa:** Criar PRD (Product Requirements Document)
- Analisar requisitos da feature
- Definir escopo e prioridades  
- Criar `docs/pt-br/planning/PRD-github-integration.md`
- Gerar issue de planejamento no GitHub
- **Commit:** `[PM] [STEP-001] Create PRD for GitHub Integration Manager`

### FASE 2: ARCHITECT [ARCHITECT]  
**Tarefa:** Criar especificação técnica
- Design da arquitetura do módulo
- Definir APIs e componentes
- Criar `docs/pt-br/architecture/TECH_SPEC-github-integration.md`
- Gerar issue de implementação
- **Commit:** `[ARCHITECT] [STEP-002] Complete architecture specification`

### FASE 3: DEVELOPER [DEV]
**Tarefa:** Implementar código completo
- Criar estrutura de pastas `src/github-integration/`
- Implementar API REST endpoints
- Criar CLI commands
- Desenvolver web dashboard
- Implementar autenticação OAuth2
- **Commits:** `[DEV] [STEP-003-010] Implement GitHub Integration Manager`

### FASE 4: QA [QUALITY ASSURANCE]
**Tarefa:** Testes e validação
- Criar testes unitários e integração
- Validar segurança da autenticação
- Testar API endpoints
- Revisar código e documentação
- **Commit:** `[QA] [STEP-011] Validate GitHub Integration Manager`

### FASE 5: SECURITY [SECURITY ENGINEER]
**Tarefa:** Análise de segurança
- Review de tokens OAuth2
- Validar permissões e escopos
- Configurar security scan
- Criar políticas de segurança
- **Commit:** `[SECURITY] [STEP-012] Security validation completed`

### FASE 6: DEVOPS [DEVOPS ENGINEER]
**Tarefa:** Preparação deployment
- Configurar CI/CD pipeline
- Setup de ambiente de staging
- Monitoramento e logging
- Configurar GitHub Actions
- **Commit:** `[DEVOPS] [STEP-013] Configure deployment pipeline`

### FASE 7: RELEASE MANAGER [RELEASE MANAGER]
**Tarefa:** Release e deploy
- Versionamento semântico
- Criar GitHub Release
- Atualizar changelog
- Deploy para produção
- **Commit:** `[RELEASE] [STEP-014] Release GitHub Integration Manager v1.0.0`

## 🔄 EXECUÇÃO DO WORKFLOW

### Instruções para o Agente:

1. **INICIAR:** Execute `npm run bmad:workflow <issue-number>` onde `<issue-number>` é a issue criada
2. **SEQUÊNCIA:** Siga as 7 fases em ordem, cada persona deve completar sua tarefa antes de passar para a próxima
3. **COMUNICAÇÃO:** Use Issues do GitHub para comunicação entre personas
4. **DOCUMENTAÇÃO:** Mantenha `activeContext.md` e `productContext.md` atualizados
5. **QUALIDADE:** Execute `npm run bmad:gatekeeper` após cada fase

### Comandos Disponíveis:
```bash
# Executar workflow completo
npm run bmad:workflow <issue-number>

# Validar qualidade
npm run bmad:gatekeeper

# Gerar documentação  
npm run bmad:doc

# Executar testes
npm test

# Verificar linting
npm run lint
```

## 📊 MÉTRICAS DE SUCESSO

### KPIs do Teste:
- **✅ 7/7 personas executadas com sucesso**
- **✅ Todos os commits seguindo padrão BMAD**
- **✅ Feature implementada e funcionando**
- **✅ GitHub Release criado**
- **✅ Documentação completa**
- **✅ Testes passando (100%)**
- **✅ Zero vulnerabilidades de segurança**

## 🎯 RESULTADO ESPERADO

Ao final deste teste, o Shantilly-CLI terá:
1. **Módulo GitHub Integration** completo e funcional
2. **API REST** para operações GitHub
3. **CLI Interface** para comandos diretos  
4. **Web Dashboard** para gestão visual
5. **Autenticação OAuth2** segura
6. **Documentação bilíngue** completa
7. **GitHub Release** v1.0.0 publicado

## 🚀 COMEÇAR O TESTE

**Execute o comando abaixo para iniciar:**

```bash
# 1. Configurar ambiente
cp .env.example .env
# Editar .env com seu GitHub token

# 2. Criar issue no GitHub com label 'bmad'
# Title: "Implement GitHub Integration Manager"
# Description: "Feature completa para integração GitHub nativa no Shantilly-CLI"

# 3. Iniciar workflow BMAD
npm run bmad:workflow <numero-da-issue>

# 4. Acompanhar execução autônoma das 7 personas
```

---

**STATUS:** 🚀 **READY FOR TESTING**  
**EXPECTED DURATION:** 45-60 minutos  
**PERSONAS:** 7 BMAD Specialists  
**OUTCOME:** GitHub Integration Manager completo

🎉 **Good luck, BMAD Orchestrator!**
```

---

## 📋 Checklist de Validação

### Pré-Teste:
- [ ] GitHub token configurado
- [ ] Issue criada com label 'bmad'
- [ ] Ambiente Node.js >=18.0.0
- [ ] Dependências instaladas (`npm install`)

### Durante Teste:
- [ ] PM cria PRD completo
- [ ] Architect define especificação técnica
- [ ] Developer implementa código funcional
- [ ] QA valida qualidade e testes
- [ ] Security aprova segurança
- [ ] DevOps configura deployment
- [ ] Release Manager publica versão

### Pós-Teste:
- [ ] Feature funcionando
- [ ] GitHub Release publicado
- [ ] Documentação atualizada
- [ ] Testes 100% passando
- [ ] Zero security issues

---

**INÍCIO DO TESTE BMAD - SHANTILLY-CLI PILOT** 🚀
