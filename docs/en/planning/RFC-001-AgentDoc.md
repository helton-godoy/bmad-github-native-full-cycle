# RFC-001: AgentDoc - Documentação Semântica Viva para Agentes de IA

**Status:** Proposta (Backlog)
**Inspiração:** Godoc, JSDoc, RAG
**Objetivo:** Eliminar a "quebra de contexto" e garantir fluidez na codificação autônoma.

## 1. O Problema

Agentes de IA frequentemente refatoram código funcional porque não compreendem as conexões ocultas ou as regras de negócio implícitas. Eles "leem" o código como texto, mas perdem a "intenção". Isso causa regressões.

## 2. A Solução Proposta: "AgentDoc"

Um sistema de comentários padronizados dentro do código que servem exclusivamente para "alimentar" o contexto do agente.
Diferente do JSDoc tradicional (focado em tipos), o AgentDoc foca em **Comportamento e Dependência**.

### 2.1. O Mecanismo (Pipeline)

1. **Input:** O desenvolvedor (ou o agente) escreve comentários com tags especiais no código.
2. **Processamento:** Um script futuro varre o projeto.
3. **Output:** Gera um `docs/architecture/SYSTEM_MAP.md` (ou popula um vetor RAG).
4. **Consumo:** Antes de editar um ficheiro, o agente lê o mapa para entender o impacto.

### 2.2. A Sintaxe Sugerida (Tags Especiais)

- `@ai-invariant`: Regra absoluta. "Nunca altere o formato de saída X."
- `@ai-context`: Explicação de alto nível. "Esta função é ineficiente de propósito para evitar Race Condition."
- `@ai-connection`: Link explícito. "Se alterar isto, verifique o ficheiro Z."

## 3. Exemplo Prático

```javascript
/**
 * Valida o token do utilizador.
 * @ai-context Esta função usa uma validação "preguiçosa" para economizar recursos.
 * @ai-invariant NÃO adicione chamadas de DB aqui. A validação deve ser puramente criptográfica.
 * @ai-connection Impacta diretamente o middleware `auth.middleware.js`.
 */
function validateToken(token) { ... }
```

## 4. Benefícios Esperados

- **Fluidez:** O agente não precisa "adivinhar" o que o código faz.
- **Segurança:** As tags `@invariant` agem como guardiões contra refatorações ruins.
- **Autonomia:** Reduz a necessidade de explicação humana repetitiva.

## 5. Próximos Passos (Roadmap)

1. [x] Definir o padrão exato de tags.
2. [x] Criar script de extração (Node.js) para gerar o `SYSTEM_MAP.md`.
3. [ ] Integrar ao `git-gatekeeper` (bloquear commit se a doc estiver desatualizada).

## 6. Evolução Futura: Memória Vetorial (RAG)

Para projetos grandes, ler o `SYSTEM_MAP.md` inteiro pode estourar o contexto do Agente.
**Solução:** Integrar com **Qdrant**.

- O script `agent-doc.js` enviará os chunks de comentários para o Qdrant.
- O Agente usará ferramentas de busca semântica (ex: `search_memory "regras de autenticação"`) para recuperar apenas as tags relevantes para a tarefa atual.
