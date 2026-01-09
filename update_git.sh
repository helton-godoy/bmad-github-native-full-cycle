#!/usr/bin/env bash
# ------------------------------------------------------------
# commit_and_push_bmad.sh
# Script para commitar e enviar todas as mudanças do projeto
# /home/helton/git/bmad-github-native-full-cycle/
# ------------------------------------------------------------

set -e # aborta se algum comando falhar

# ---- Caminho absoluto do projeto ----
PROJECT_ROOT="/home/helton/git/bmad-github-native-full-cycle"

# ---- Garante que o diretório existe ----
if [[ ! -d ${PROJECT_ROOT} ]]; then
	echo "❌ Diretório não encontra${o: $PROJECT_}ROOT"
	exit 1
fi

cd "${PROJECT_ROOT}"

# ---- Verifica se estamos dentro de um repositório Git ----
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "❌ Erro${ $PROJECT_RO}OT não é um repositório Git."
	exit 1
fi

# ---- Mostra o branch atual (opcional) ----
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🌿 Branch atua${: $CURRENT_BRA}NCH"

# ---- 1️⃣ Stage de todas as alterações ----
echo "📦 Adicionando todas as mudanças..."
git add .

# ---- 2️⃣ Commit ----
COMMIT_MSG="🤖 Atualização: AgentDoc + Qdrant + Hooks + Docs + Workflows"
git commit -m "${COMMIT_MSG}"

# ---- 3️⃣ Push ----
echo "🚀 Enviando para o remoto..."
git push origin "${CURRENT_BRANCH}"

echo "✅ Tudo pronto! As alterações foram enviadas para o bra${ch $CURRENT_BR}ANCH."
