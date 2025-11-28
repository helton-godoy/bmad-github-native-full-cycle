# Estratégia de Compatibilidade Cross-Agent e Otimização de Recursos

Este documento define a estratégia para garantir que o projeto BMAD funcione eficazmente em diversos ambientes (VS Code, Cursor, Terminal) e com diferentes agentes (Cline, Roo, Windsurf, etc.), independentemente de suas capacidades nativas ou acesso a servidores MCP.

## 1. O Princípio "Shell-First" (Mínimo Denominador Comum)

A única garantia universal em agentes de codificação é a capacidade de:

1. Ler/Escrever arquivos.
2. Executar comandos no terminal (Shell).

Portanto, **a lógica crítica de negócio e automação deve residir em scripts Shell (`.sh` ou `.js`), não na "memória" ou nas "ferramentas exclusivas" do agente.**

### Estratégia de Implementação

Crie uma camada de abstração na pasta `./bmad/bin/` (ou `./scripts/`) que padronize operações complexas.

* **Em vez de:** Esperar que o agente saiba usar `mcp0_create_issue` ou `gh issue create` corretamente.
* **Faça:** Crie um script `./bmad/bin/create-issue.sh` que encapsula a lógica:
  * Verifica se `gh` está instalado.
  * Se sim, usa `gh`.
  * Se não, instrui o agente a criar um arquivo markdown `todo.md` como fallback.

## 2. Protocolo de Auto-Descoberta (Self-Discovery)

Instrua o agente a executar um diagnóstico no início da sessão para entender suas próprias capacidades.

Adicione ao `.clinerules`:

```markdown
### PHASE 0: SELF-DISCOVERY
Ao iniciar, execute: `./bmad/bin/check-capabilities.sh`
Este script retornará um JSON ou texto informando:
- [x] Git Access
- [ ] GitHub CLI Access
- [ ] Node.js Environment
- [ ] Docker Environment

Baseado nisso, ADAPTE seu fluxo:
- Sem GitHub CLI? -> Use o modo "Offline Draft" (crie arquivos locais para Issues/PRs).
- Sem Docker? -> Pule testes de container e avise o usuário.
```

## 3. Níveis de Maturidade do Agente

Classifique os agentes e defina expectativas para cada nível:

| Nível                      | Capacidades             | Comportamento Esperado                                                             |
|:-------------------------- |:----------------------- |:---------------------------------------------------------------------------------- |
| **Nível 1: Básico**        | Apenas Edição de Texto  | O agente deve apenas escrever código e pedir ao usuário para rodar comandos.       |
| **Nível 2: Intermediário** | Edição + Terminal       | O agente roda scripts de teste e git, mas não interage com APIs externas.          |
| **Nível 3: Avançado**      | Edição + Terminal + MCP | O agente usa ferramentas nativas para orquestração completa (Issues, PRs, Deploy). |

**Instrução no Prompt:**

> *"Se você não possui a ferramenta X, verifique se existe um script equivalente em `./bmad/bin/`. Se não, solicite a ação ao usuário."*

## 4. Polyfills para Agentes Limitados

Para agentes que não suportam MCP (ex: rodando em um ambiente web restrito ou IDEs mais simples), forneça "Polyfills" via código.

**Exemplo:**
Um agente sem acesso ao `mcp0_search_code` (busca semântica) deve ser instruído a usar `grep` ou `find` de forma recursiva inteligente.

```bash
# bmad/bin/smart-search.sh
# Um wrapper que usa ripgrep se disponível, ou grep padrão como fallback
if command -v rg &> /dev/null; then
    rg "$1" .
else
    grep -r "$1" .
fi
```

### 3.2 Dependências de Tooling

Para garantir a execução dos scripts BMAD, o ambiente deve fornecer um conjunto mínimo de ferramentas:

#### Base Toolset (Essencial)

- **git**: Controle de versão.
* **curl**: Transferência de dados e instalação de ferramentas.
* **jq**: Processamento de JSON (vital para scripts que interagem com APIs).
* **unzip**: Manipulação de arquivos compactados.

#### BMAD Toolset (Gerenciado pelo `setup-tools.sh`)

- **gh** (GitHub CLI): Interação com a API do GitHub.
* **act** (Local GitHub Actions): Validação local de workflows.

## 5. Validação de Pipeline Local (`act`)

Para garantir a qualidade dos workflows e permitir trabalho offline, adotamos o **[act](https://github.com/nektos/act)**.

* **Objetivo:** Rodar GitHub Actions localmente.
* **Benefício:** Feedback imediato, economia de minutos de CI, histórico de git limpo.
* **Estratégia de Uso:**
  * O agente deve verificar se `act` está instalado.
  * Se sim, executar `act -j test` antes de fazer push de alterações críticas.
  * Se não, tentar instalar localmente ou pular com aviso (dependendo do nível de rigor).

## 6. Gestão de Dependências de Ferramentas (`gh`, `act`)

Para maximizar a portabilidade, o projeto deve incluir scripts de "Bootstrapping" que baixam binários portáteis para uma pasta local (ex: `.bin/`) se não estiverem no PATH do sistema.

**Exemplo de Script de Setup (`./bmad/bin/setup-tools.sh`):**

```bash
# Verifica e instala gh e act localmente se necessário
install_local_tool "gh" "https://github.com/cli/cli/releases/..."
install_local_tool "act" "https://github.com/nektos/act/releases/..."
export PATH=$PWD/.bin:$PATH
```

## 7. Padronização de Contexto (Memory Bank Portátil)

Garanta que o "cérebro" do projeto (`productContext.md`, `activeContext.md`) seja puramente Markdown.

* Não dependa de vetores ocultos ou memória proprietária do IDE.
* Qualquer agente que consiga ler Markdown conseguirá "baixar" o contexto do projeto instantaneamente.

## Resumo da Ação

Para tornar seu projeto "Agent-Agnostic":

1. **Externalize a inteligência:** Tire as regras do prompt do sistema e coloque em arquivos (`.clinerules`).
2. **Scriptize as ferramentas:** Não dependa de plugins do IDE; dependa de scripts no repositório.
3. **Documente os Fallbacks:** Diga explicitamente ao agente o que fazer quando uma ferramenta falhar.
