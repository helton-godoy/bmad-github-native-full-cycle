# Configuração de Workflow do Cline (BMAD Edition)

Este documento explica como configurar os fluxos de trabalho (Workflows) e Hooks do Cline seguindo a documentação oficial.

## 1. Localização dos Workflows

Os workflows devem ser salvos como arquivos **Markdown (.md)** dentro da pasta `.clinerules/workflows/` na raiz do projeto.

Estrutura:

```
seu-projeto/
├── .clinerules/
│   ├── README.md (Regras Mestras)
│   ├── workflows/
│   │   └── bmad-daily.md
│   └── hooks/
│       └── PreToolUse
```

## 2. Workflows (.md)

O arquivo deve conter um título e uma lista numerada de passos. O Cline interpreta cada passo como uma instrução.

### Exemplo: `bmad-daily.md`

```markdown
# BMAD Daily Cycle
1. **Contextualização:** `read_file activeContext.md`
2. **Planejamento:** Verifique tarefas e crie docs.
3. **Implementação:** Code e Teste.
4. **Verificação:** O Hook `PreToolUse` validará seu commit automaticamente.
5. **Finalização:** Atualize `activeContext.md` e faça PR.
```

## 3. Hooks (Automação de Segurança)

O BMAD instala automaticamente um hook chamado `PreToolUse` em `.clinerules/hooks/`.

**O que ele faz:**
Intercepta o comando `git commit` executado pelo Cline.

1. Verifica se a mensagem segue **Conventional Commits**.
2. Verifica se o arquivo `activeContext.md` foi atualizado (se houver código novo).

**Como funciona:**
Você não precisa rodar nada manualmente. Ao tentar usar o comando:

```bash
git commit -m "feat: nova funcionalidade"
```

O Cline enviará essa intenção para o Hook. Se as regras não forem cumpridas, o Hook rejeita a ação e o Cline recebe uma mensagem de erro explicando o que corrigir.

## 4. Como Usar

- **Workflows:** Digite `/workflow bmad-daily` no chat.
- **Hooks:** Apenas trabalhe normalmente. O sistema protegerá o repositório.
