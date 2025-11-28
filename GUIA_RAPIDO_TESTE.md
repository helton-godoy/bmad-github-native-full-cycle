# 🚀 Guia Rápido - Teste BMAD Shantilly-CLI

## ⚡ Início Imediato (5 minutos)

### 1️⃣ Configurar Ambiente
```bash
cd /home/helton/git/bmad-github-native-full-cycle
cp .env.example .env
# Editar .env com seu GitHub token
```

### 2️⃣ Criar Issue no GitHub
- **Repositório:** helton-godoy/shantilly-cli
- **Título:** `Implement GitHub Integration Manager`
- **Labels:** `bmad`, `enhancement`, `feature`
- **Descrição:** 
```
## Feature: GitHub Integration Manager

### Objetivo
Criar módulo de integração GitHub nativa no Shantilly-CLI

### Funcionalidades
- API REST para operações GitHub
- CLI Interface para comandos diretos  
- Web Dashboard para gestão visual
- Autenticação OAuth2 segura
- Documentação completa PT-BR/EN

### Entregáveis
- Código fonte completo
- Testes automatizados
- Documentação técnica
- GitHub Release

@bmad-workflow
```

### 3️⃣ Executar Workflow BMAD
```bash
# Substituir <numero> pelo número da issue criada
npm run bmad:workflow <numero>
```

---

## 🎯 O que Acontecerá (Automático)

O BMAD Orchestrator executará **7 personas** em sequência:

| Fase | Persona | Duração | O que faz |
|------|---------|----------|-----------|
| 1️⃣ | **PM** | ~5 min | Cria PRD com requisitos |
| 2️⃣ | **Architect** | ~8 min | Design da arquitetura |
| 3️⃣ | **Developer** | ~20 min | Implementa código |
| 4️⃣ | **QA** | ~10 min | Testa e valida |
| 5️⃣ | **Security** | ~7 min | Verifica segurança |
| 6️⃣ | **DevOps** | ~8 min | Configura deployment |
| 7️⃣ | **Release** | ~5 min | Publica release |

**Total:** ~63 minutos de execução autônoma

---

## 📊 Acompanhamento em Tempo Real

### Logs do Workflow:
```bash
# O workflow mostrará progresso em tempo real:
🚀 Starting BMAD Workflow for Issue #123
=====================================
📋 Phase 1: Project Manager Analysis
✅ PM completed. Architecture issue: #124
🏗️ Phase 2: Architecture Design  
✅ Architect completed. Implementation issue: #125
💻 Phase 3: Development
✅ Developer completed. QA issue: #126
🧪 Phase 4: Quality Assurance
✅ QA completed. Security issue: #127
🔒 Phase 5: Security Review
✅ Security completed. DevOps issue: #128
⚙️ Phase 6: DevOps Preparation
✅ DevOps completed. Release issue: #129
🎉 Phase 7: Release Management
✅ Release Manager completed. Workflow done!
```

### GitHub Issues Criadas:
- **#124** - Architecture Planning (PM → Architect)
- **#125** - Implementation (Architect → Developer)  
- **#126** - QA Review (Developer → QA)
- **#127** - Security Check (QA → Security)
- **#128** - DevOps Setup (Security → DevOps)
- **#129** - Release (DevOps → Release)

---

## 🔧 Comandos Úteis

### Durante Execução:
```bash
# Verificar status
npm run bmad:gatekeeper

# Gerar documentação
npm run bmad:doc

# Executar testes
npm test

# Verificar linting
npm run lint
```

### Se Precisar Parar:
```bash
# Ctrl+C para parar workflow
# Issue continuará de onde parou ao executar novamente
```

---

## 📈 Resultado Esperado

### ✅ Feature Completa:
- **API REST:** `/api/github/*` endpoints
- **CLI:** `shantilly github <command>`  
- **Dashboard:** Interface web em `/dashboard`
- **OAuth2:** Autenticação segura
- **Documentação:** PT-BR e EN

### ✅ GitHub Release:
- **Versão:** v1.0.0
- **Release Notes:** Completo
- **Assets:** Código e documentação

### ✅ Qualidade:
- **Testes:** 100% passando
- **Security:** Zero vulnerabilidades
- **Coverage:** >80%
- **Linting:** Sem erros

---

## 🚨 Troubleshooting

### Se GitHub Token falhar:
```bash
# Verificar token
echo $GITHUB_TOKEN
# Gerar novo token em GitHub Settings > Developer settings > Personal access tokens
```

### Se workflow parar:
```bash
# Verificar logs
cat logs/bmad-workflow.log
# Reiniciar com mesma issue
npm run bmad:workflow <numero>
```

### Se testes falharem:
```bash
# Verificar detalhes
npm test -- --verbose
# Corrigir e continuar
npm run bmad:workflow <numero>
```

---

## 🎉 Sucesso!

Ao final você terá:
1. **Feature GitHub Integration** completa
2. **Workflow BMAD** validado com sucesso
3. **7 personas** BMAD operacionais
4. **Processo autônomo** funcionando
5. **Shantilly-CLI** enriquecido com nova feature

**Ready for Production!** 🚀

---

**INÍCIO:** `npm run bmad:workflow <issue-number>`  
**DURAÇÃO:** ~1 hora  
**RESULTADO:** Feature completa + BMAD validado

Good luck! 🎯
