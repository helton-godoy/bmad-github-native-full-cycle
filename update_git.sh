#!/usr/bin/env bash
# ------------------------------------------------------------
# Script de commit & push para o repositório BMAD Agent Core
# ------------------------------------------------------------
# 1️⃣ Adiciona todos os arquivos modificados
# 2️⃣ Cria um commit com mensagem resumida
# 3️⃣ Envia o commit para o branch atual no GitHub
# ------------------------------------------------------------

set -e   # aborta se algum comando falhar

# ---- Verifica se estamos dentro de um repositório Git ----
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Erro: este diretório não é um repositório Git."
  exit 1
fi

# ---- Opcional: mostra o branch atual ----
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🌿 Branch atual: $CURRENT_BRANCH"

# ---- 1️⃣ Stage de todas as alterações ----
echo "📦 Adicionando todas as mudanças..."
git add .

# ---- 2️⃣ Commit ----
# Mensagem padrão (edite se quiser algo diferente)
COMMIT_MSG="🤖 Atualização: AgentDoc + Qdrant + Hooks + Docs + Workflows"
# Se houver alterações não staged, o commit falhará; já fizemos git add acima
git commit -m "$COMMIT_MSG"

# ---- 3️⃣ Push ----
echo "🚀 Enviando para o remoto..."
git push origin "$CURRENT_BRANCH"

echo "✅ Operação concluída com sucesso!"
