# 🚀 Guia Rápido - Teste BMAD Shantilly-CLI TUI (Golang)

## ⚡ Início Imediato (5 minutos)

### 1️⃣ Criar Issue no GitHub

- **Repositório:** helton-godoy/shantilly-cli
- **Título:** `Implement Shantilly-CLI TUI in Golang + Charmbracelet`
- **Labels:** `bmad`, `golang`, `tui`, `charmbracelet`
- **Descrição:** Copiar conteúdo de `PROMPT_TUI_GOLANG.md`

### 2️⃣ Executar Workflow BMAD

```bash
cd /home/helton/git/bmad-github-native-full-cycle
npm run bmad:workflow <numero-da-issue>
```

### 3️⃣ Acompanhar Desenvolvimento

- 7 personas BMAD adaptadas para Go
- Projeto criado do zero em Golang
- TUI Charmbracelet implementada
- ~60-75 minutos de execução

---

## 🎯 O que Acontecerá (Autônomo)

### Fases do Workflow BMAD:

| Fase | Persona       | Duração | O que faz                                |
| ---- | ------------- | ------- | ---------------------------------------- |
| 1️⃣   | **PM**        | ~8 min  | Define requisitos TUI vs dialog/whiptail |
| 2️⃣   | **Architect** | ~10 min | Design arquitetura Go + Charmbracelet    |
| 3️⃣   | **Developer** | ~25 min | Implementa código Go completo            |
| 4️⃣   | **QA**        | ~12 min | Testes unitários e TUI                   |
| 5️⃣   | **Security**  | ~8 min  | Análise de segurança de inputs           |
| 6️⃣   | **DevOps**    | ~10 min | Build e distribuição multi-plataforma    |
| 7️⃣   | **Release**   | ~7 min  | GitHub Release com binários              |

**Total:** ~80 minutos de execução autônoma

---

## 📊 Estrutura Esperada (Pós-BMAD)

```
shantilly-cli/
├── cmd/
│   └── shantilly/
│       └── main.go              # Entry point CLI
├── pkg/
│   ├── tui/
│   │   ├── dialog.go             # Caixas de diálogo
│   │   ├── form.go               # Formulários interativos
│   │   ├── progress.go           # Barras de progresso
│   │   └── selector.go           # Seletores de arquivos
│   └── config/
│       └── config.go             # Configurações
├── go.mod                        # Dependências Go
├── go.sum                        # Lock de versões
├── Makefile                      # Builds multi-plataforma
├── README.md                     # Documentação
└── LICENSE                       # Licença
```

---

## 🔧 Comandos TUI Esperados

### Menu Interativo:

```bash
shantilly dialog --title "Escolha uma opção:" --options "Criar,Listar,Sair"
```

### Formulário:

```bash
shantilly form --fields "nome:text,email:email,idade:number"
```

### Progress Bar:

```bash
shantilly progress --steps "Build,Test,Deploy" --current 2
```

### Seletor de Arquivos:

```bash
shantilly select --path "/home/user" --filter "*.go" --multi
```

### Confirmação:

```bash
shantilly confirm --message "Deseja continuar?" --default yes
```

---

## 📈 Logs do Workflow (Exemplo)

```
🚀 Starting BMAD Workflow for Issue #456
=====================================
📋 Phase 1: Project Manager Analysis

📋 PM Agent: Analyzing TUI requirements...
📋 PM Agent: Comparing with dialog/whiptail...
📋 PM Agent: Defining Go + Charmbracelet stack...
📋 PM Agent: Creating PRD...
📋 PM Agent: Creating architecture issue...
✅ PM completed. Architecture issue: #457

🏗️ Phase 2: Architecture Design

🏗️ Architect Agent: Reading PRD...
🏗️ Architect Agent: Designing Go package structure...
🏗️ Architect Agent: Selecting Charmbracelet libraries...
🏗️ Architect Agent: Creating technical specification...
🏗️ Architect Agent: Creating implementation issue...
✅ Architect completed. Implementation issue: #458

💻 Phase 3: Development (Go)

💻 Developer Agent: Reading technical spec...
💻 Developer Agent: Initializing Go module...
💻 Developer Agent: Setting up cmd/shantilly/main.go...
💻 Developer Agent: Implementing pkg/tui/dialog.go...
💻 Developer Agent: Implementing pkg/tui/form.go...
💻 Developer Agent: Implementing pkg/tui/progress.go...
💻 Developer Agent: Implementing pkg/tui/selector.go...
💻 Developer Agent: Creating Makefile...
💻 Developer Agent: Creating tests...
💻 Developer Agent: Creating QA review issue...
✅ Developer completed. QA issue: #459

🧪 Phase 4: Quality Assurance

🧪 QA Agent: Running Go tests...
🧪 QA Agent: Testing TUI components...
🧪 QA Agent: Validating cross-platform...
🧪 QA Agent: Testing shell script integration...
🧪 QA Agent: Creating security review issue...
✅ QA completed. Security issue: #460

🔒 Phase 5: Security Review

🔒 Security Agent: Analyzing TUI inputs...
🔒 Security Agent: Validating data sanitization...
🔒 Security Agent: Reviewing Go dependencies...
🔒 Security Agent: Creating security policies...
🔒 Security Agent: Creating DevOps issue...
✅ Security completed. DevOps issue: #461

⚙️ Phase 6: DevOps Preparation

⚙️ DevOps Agent: Configuring Makefile...
⚙️ DevOps Agent: Setting up GitHub Actions...
⚙️ DevOps Agent: Creating multi-platform builds...
⚙️ DevOps Agent: Configuring releases...
⚙️ DevOps Agent: Creating release issue...
✅ DevOps completed. Release issue: #462

🎉 Phase 7: Release Management

🎉 Release Manager Agent: Version management v1.0.0...
🎉 Release Manager Agent: Creating release notes...
🎉 Release Manager Agent: Building binaries (linux, macos, windows)...
🎉 Release Manager Agent: Creating GitHub Release...
🎉 Release Manager Agent: Updating README...
🎉 Release Manager Agent: Closing workflow...

=====================================
🎉 BMAD Workflow Completed Successfully!
=====================================
⏱️  Total Duration: 76.45 minutes
📊 Total Phases: 7
✅ Success Rate: 100%
🎯 GitHub Release: v1.0.0
📦 Binaries: linux-amd64, darwin-amd64, windows-amd64
📝 Workflow Report: docs/reports/bmad-workflow-456.md
```

---

## 🔧 Comandos Úteis

### Durante Execução:

```bash
# Verificar status
npm run bmad:gatekeeper

# Gerar documentação
npm run bmad:doc

# Testar (após implementação)
cd /home/helton/git/shantilly-cli
go test ./...

# Build (após implementação)
make build
```

### Se Precisar Parar:

```bash
# Ctrl+C para parar workflow
# Issue continuará de onde parou
```

---

## 📈 Resultado Esperado

### ✅ Shantilly-CLI Completa:

- **Linguagem:** Golang 1.21+
- **Framework:** Charmbracelet (bubbletea, lipgloss)
- **Cross-platform:** Linux, macOS, Windows
- **Distribuição:** Binário único

### ✅ Funcionalidades TUI:

- **Dialog Boxes** - Menus interativos
- **Forms** - Coleta de dados
- **Progress Bars** - Indicadores visuais
- **File Selectors** - Navegação de arquivos
- **Confirmations** - Diálogos sim/não

### ✅ Qualidade:

- **Testes Go:** 100% coverage
- **Security:** Input sanitization
- **Performance:** Binário otimizado
- **Documentation:** README + exemplos

---

## 🚨 Troubleshooting

### Se Go não estiver instalado:

```bash
# Verificar instalação
go version

# Instalar (se necessário)
# Linux: sudo apt install golang-go
# macOS: brew install go
# Windows: Download from golang.org
```

### Se Charmbracelet falhar:

```bash
# Verificar dependências após implementação
cd /home/helton/git/shantilly-cli
go mod tidy
go mod download
```

### Se build falhar:

```bash
# Usar Makefile
make build
# Ou build manual
go build -o shantilly cmd/shantilly/main.go
```

---

## 🎉 Sucesso!

Ao final você terá:

1. **Shantilly-CLI** completa em Golang
2. **TUI moderna** com Charmbracelet
3. **Alternativa funcional** a dialog/whiptail
4. **Distribuição multi-plataforma**
5. **BMAD workflow** validado com sucesso

**Ready to replace dialog/whiptail!** 🚀

---

## 🔄 Status vs. Anterior

| Antes (Errado)               | Agora (Correto)              |
| ---------------------------- | ---------------------------- |
| Node.js + GitHub Integration | Golang + Charmbracelet       |
| API REST + Dashboard         | TUI + CLI Commands           |
| Gerenciar repositórios       | Interface para shell scripts |
| Web-based                    | Terminal-based               |

**AGORA SIM:** Shantilly-CLI como **alternativa TUI moderna**! 🎯

---

**INÍCIO:** Criar issue + executar workflow  
**DURAÇÃO:** ~75 minutos  
**RESULTADO:** Shantilly-CLI TUI completa em Go

Let's build the modern dialog/whiptail replacement! 🚀
