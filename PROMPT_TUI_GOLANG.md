# 🚀 Prompt BMAD - Shantilly-CLI TUI (Golang + Charmbracelet)

## 📋 Contexto do Teste

**Projeto:** Desenvolver Shantilly-CLI como alternativa moderna a dialog/whiptail  
**Stack:** Golang + Charmbracelet (bubbletea, lipgloss)  
**Orquestrador:** BMAD-GitHub-Native-Full-Cycle  
**Objetivo:** Criar TUI funcional para shell scripts

---

## 🎯 Missão BMAD

Você é o **BMAD Orchestrator** e deve executar o workflow autônomo completo para implementar a **Shantilly-CLI TUI** em **Golang + Charmbracelet**.

## 📋 Escopo da Feature

### Shantilly-CLI - TUI Tool
**Objetivo:** Criar interface terminal moderna para shell scripts alternando a dialog/whiptail

### Requisitos Técnicos:
1. **Linguagem:** Golang 1.21+
2. **Framework TUI:** Charmbracelet (bubbletea, lipgloss)
3. **Comandos:** Interface para shell scripts
4. **Cross-platform:** Linux, macOS, Windows
5. **Distribuição:** Binário único executável

### Funcionalidades Mínimas:
1. **Dialog Boxes** - Menus interativos
2. **Forms** - Coleta de dados
3. **Progress Bars** - Indicadores de progresso
4. **File Selectors** - Seleção de arquivos
5. **Confirmations** - Diálogos sim/não

## 🔧 Configuração Ambiente

### Repositório Alvo:
- **Nome:** shantilly-cli
- **Owner:** helton-godoy  
- **Branch:** main
- **GitHub:** https://github.com/helton-godoy/shantilly-cli
- **Stack:** Golang + Charmbracelet

### Estrutura Esperada:
```
shantilly-cli/
├── cmd/
│   └── shantilly/
│       └── main.go
├── pkg/
│   ├── tui/
│   │   ├── dialog.go
│   │   ├── form.go
│   │   ├── progress.go
│   │   └── selector.go
│   └── config/
│       └── config.go
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## 🎭 Workflow BMAD - Personas Adaptadas

### FASE 1: PROJECT MANAGER [PM]
**Tarefa:** Definir requisitos da TUI
- Analisar alternativas (dialog, whiptail, zenity)
- Definir comandos e interfaces
- Criar `docs/pt-br/planning/PRD-shantilly-tui.md`
- Gerar issue de planejamento
- **Commit:** `[PM] [STEP-001] Create PRD for Shantilly-CLI TUI`

### FASE 2: ARCHITECT [ARCHITECT]  
**Tarefa:** Design arquitetura Go
- Definir estrutura de pacotes Go
- Design da arquitetura Charmbracelet
- Criar `docs/pt-br/architecture/TECH_SPEC-shantilly-tui.md`
- Definir interfaces e structs
- **Commit:** `[ARCHITECT] [STEP-002] Complete Go architecture design`

### FASE 3: DEVELOPER [DEV]
**Tarefa:** Implementar código Go
- Setup projeto Golang (`go mod init`)
- Implementar comandos TUI com bubbletea
- Criar interfaces com lipgloss
- Implementar funcionalidades principais
- **Commits:** `[DEV] [STEP-003-010] Implement Shantilly-CLI TUI in Go`

### FASE 4: QA [QUALITY ASSURANCE]
**Tarefa:** Testes em Go
- Criar testes unitários (`*_test.go`)
- Testar interfaces TUI
- Validar cross-platform
- Testar integração com shell scripts
- **Commit:** `[QA] [STEP-011] Validate TUI functionality`

### FASE 5: SECURITY [SECURITY ENGINEER]
**Tarefa:** Análise de segurança
- Review de inputs da TUI
- Validar sanitização de dados
- Análise de dependências Go
- Criar políticas de segurança
- **Commit:** `[SECURITY] [STEP-012] Security validation completed`

### FASE 6: DEVOPS [DEVOPS ENGINEER]
**Tarefa:** Build e distribuição
- Configurar Makefile para builds
- Setup CI/CD com GitHub Actions
- Criar releases multi-plataforma
- Configurar distribuição
- **Commit:** `[DEVOPS] [STEP-013] Configure Go build pipeline`

### FASE 7: RELEASE MANAGER [RELEASE MANAGER]
**Tarefa:** Release e distribuição
- Versionamento semântico (v1.0.0)
- Criar GitHub Release
- Publicar binários multi-plataforma
- Atualizar documentação
- **Commit:** `[RELEASE] [STEP-014] Release Shantilly-CLI v1.0.0`

## 🔄 Execução do Workflow

### Instruções para o Agente:

1. **INICIAR:** Execute `npm run bmad:workflow <issue-number>`
2. **LINGUAGEM:** Desenvolver em Golang (não Node.js)
3. **FRAMEWORK:** Usar Charmbracelet para TUI
4. **SEQUÊNCIA:** 7 fases em ordem
5. **COMUNICAÇÃO:** Issues do GitHub
6. **QUALIDADE:** Testes Go e validação

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

## 📊 Métricas de Sucesso

### KPIs do Teste:
- **✅ 7/7 personas executadas**
- **✅ Projeto Go criado do zero**
- **✅ TUI Charmbracelet funcional**
- **✅ Binário executável gerado**
- **✅ GitHub Release multi-plataforma**
- **✅ Testes Go passando**
- **✅ Documentação completa**

## 🎯 Resultado Esperado

Ao final, Shantilly-CLI terá:

### Estrutura Go Completa:
```
shantilly-cli/
├── cmd/shantilly/main.go          # Entry point
├── pkg/tui/                       # Componentes TUI
│   ├── dialog.go                  # Caixas de diálogo
│   ├── form.go                    # Formulários
│   ├── progress.go                # Barras de progresso
│   └── selector.go                # Seletores
├── pkg/config/config.go           # Configurações
├── go.mod/go.sum                  # Dependências
├── Makefile                       # Builds
└── README.md                      # Documentação
```

### Funcionalidades TUI:
```bash
# Menu interativo
shantilly dialog --title "Menu" --options "Op1,Op2,Op3"

# Formulário
shantilly form --fields "name,email,age"

# Progress bar
shantilly progress --steps "Step1,Step2,Step3"

# Seletor de arquivos
shantilly select --path "/home/user" --filter "*.go"

# Confirmação
shantilly confirm --message "Deseja continuar?"
```

### Dependências Charmbracelet:
```go
// go.mod
require (
    github.com/charmbracelet/bubbletea v0.25.0
    github.com/charmbracelet/lipgloss v0.9.1
    github.com/charmbracelet/bubbles v0.17.0
)
```

## 🚀 Começar o Teste

### 1. Criar Issue no GitHub:
- **Título:** `Implement Shantilly-CLI TUI in Golang + Charmbracelet`
- **Labels:** `bmad`, `golang`, `tui`, `charmbracelet`
- **Descrição:** Copiar e colar este prompt

### 2. Executar Workflow:
```bash
npm run bmad:workflow <numero-da-issue>
```

### 3. Acompanhar Execução:
- 7 personas BMAD adaptadas para Go
- Desenvolvimento completo em Golang
- TUI funcional com Charmbracelet
- ~60 minutos de execução autônoma

---

**STATUS:** 🚀 **READY FOR GOLANG TUI DEVELOPMENT**  
**EXPECTED DURATION:** 60-75 minutos  
**PERSONAS:** 7 BMAD Specialists (Go-adapted)  
**OUTCOME:** Shantilly-CLI TUI completa em Golang

🎉 **Let's build a modern TUI with Go + Charmbracelet!**
