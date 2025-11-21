#!/bin/bash
# bmad/bin/setup-tools.sh
# Instala ferramentas essenciais (gh, act) localmente em .bin/ se não existirem no sistema.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN_DIR="$PROJECT_ROOT/.bin"
mkdir -p "$BIN_DIR"

# Adiciona .bin ao PATH para a sessão atual
export PATH="$BIN_DIR:$PATH"

echo "🔧 [BMAD] Verificando ferramentas de desenvolvimento..."

# 0. Ferramentas Base (Essenciais)
REQUIRED_TOOLS=("git" "curl" "jq" "unzip")
MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        MISSING_TOOLS+=("$tool")
    else
        echo "✅ $tool detectado: $(which $tool)"
    fi
done

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo "❌ Ferramentas base ausentes: ${MISSING_TOOLS[*]}"
    echo "👉 Por favor, instale-as via gerenciador de pacotes do sistema (apt, brew, etc)."
    # Não falha o script, mas avisa
fi

# 0.1 Docker (Dependência Crítica do act)
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo "✅ Docker detectado e rodando."
    else
        echo "⚠️  Docker instalado, mas o daemon parece não estar rodando."
        echo "👉 Inicie o Docker para usar o 'act'."
    fi
else
    echo "❌ Docker não encontrado."
    echo "👉 O 'act' requer Docker. Instale via: https://docs.docker.com/get-docker/"
fi

# 1. GitHub CLI (gh)
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI (gh) detectado: $(which gh)"
else
    echo "❌ GitHub CLI (gh) não encontrado."
    echo "👉 Instalação recomendada via gerenciador de pacotes do sistema."
    echo "   Ubuntu/Debian: sudo apt install gh"
    echo "   MacOS: brew install gh"
    echo "   Docs: https://cli.github.com/"
fi

# 2. act (Local GitHub Actions)
if command -v act &> /dev/null; then
    echo "✅ act detectado: $(which act)"
else
    if [ -f "$BIN_DIR/act" ]; then
        echo "✅ act detectado em .bin/act"
    else
        echo "⬇️  act não encontrado. Tentando instalação local em $BIN_DIR..."
        # Tenta instalar act localmente usando o script oficial (Pinned version v0.2.70 for security)
        ACT_VERSION="v0.2.70"
        if curl -s https://raw.githubusercontent.com/nektos/act/$ACT_VERSION/install.sh | bash -s -- -b "$BIN_DIR" $ACT_VERSION; then
            echo "✅ act instalado com sucesso em $BIN_DIR/act"
        else
            echo "❌ Falha ao instalar act automaticamente."
            echo "👉 Instale manualmente: https://github.com/nektos/act"
        fi
    fi
fi

echo "🏁 [BMAD] Setup de ferramentas concluído."
echo "ℹ️  Para usar as ferramentas locais, execute: export PATH=\"$BIN_DIR:\$PATH\""
