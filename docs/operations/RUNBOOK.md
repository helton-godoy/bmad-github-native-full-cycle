# BMAD Operations Runbook

Este documento descreve os procedimentos operacionais padrão para manutenção e recuperação do framework BMAD.

## 🆘 Procedimentos de Emergência

### 1. Reset Manual do Estado

Se o workflow travar em um estado inconsistente e o recovery automático falhar:

**Sintoma:** Workflow preso em `running` por > 30min sem progresso.
**Ação:**

1. Execute o comando de reset:

   ```bash
   node bin/bmad-cli.js reset <issue-number>
   ```

2. Verifique se o arquivo `.github/workflow-state-<issue>.json` foi removido.

### 2. Limpeza de Cache

Se houver suspeita de dados corrompidos ou desatualizados nas respostas da API:

**Sintoma:** Erros de validação JSON ou dados antigos persistindo.
**Ação:**

1. Limpe o cache:

   ```bash
   node bin/bmad-cli.js cache-clear
   ```

### 3. Forçar Resume

Para retomar um workflow que foi interrompido ou marcado como `timeout`:

**Ação:**

1. Execute com a flag de força:

   ```bash
   BMAD_FORCE_RESUME=true node scripts/bmad/bmad-workflow-enhanced.js <issue-number>
   ```

## 🛡️ Manutenção Preventiva

### 1. Auditoria de Segurança

Rodar semanalmente para identificar vulnerabilidades:

```bash
npm run audit
```

### 2. Verificação de Integridade

Validar a estrutura dos arquivos de contexto:

```bash
node scripts/bmad/product-context-validator.js
```

## 📦 Backup e Restore

### Backup

O estado do sistema reside principalmente em arquivos Markdown e JSON no repositório.
Para backup, garanta que o repositório git esteja sincronizado com o remote:

```bash
git push origin main
```

### Restore

Para restaurar o estado anterior:

1. Identifique o commit desejado: `git log`
2. Reverter para o commit: `git checkout <commit-hash>`
3. Limpar estado local: `node bin/bmad-cli.js reset-all`
