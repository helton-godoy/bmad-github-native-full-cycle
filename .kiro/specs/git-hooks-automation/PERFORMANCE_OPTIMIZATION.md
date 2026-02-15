# Otimizações de Performance para Git Hooks

## Problema Identificado

Durante a execução da tarefa 6 (Implement pre-push hook system), o sistema apresentou travamentos progressivos causados por:

1. **Execução Excessiva de Testes**
   - Múltiplos timeouts (ETIMEDOUT) em execuções de teste
   - Tempos de execução chegando a 200+ segundos por hook
   - 20 arquivos de teste com 2.729 linhas sendo executados repetidamente

2. **Falta de Cache**
   - Cada commit/push re-executa todos os testes
   - Sem verificação de mudanças para otimizar execução

3. **Configurações Agressivas**
   - Timeout de 30s para "fast tests"
   - Timeout de 5min para "full test suite"
   - Sem limite de workers do Jest

## Otimizações Implementadas

### 1. Redução de Timeouts

- **Fast tests**: 30s → 15s
- **Full test suite**: 5min → 2min
- **Test timeout**: 10s → 5s

### 2. Limitação de Workers

- Adicionado `--maxWorkers=2` para limitar paralelismo
- Reduz consumo de CPU e memória

### 3. Sistema de Cache

- Cache baseado em git hash + arquivos staged
- Validade de 5 minutos
- Máximo de 10 entradas no cache
- Armazenado em `.git/hooks-cache.json`

## Estratégias Adicionais Recomendadas

### 1. Desabilitar Hooks Durante Desenvolvimento

```bash
# Temporariamente desabilitar hooks
git config core.hooksPath /dev/null

# Reabilitar hooks
git config --unset core.hooksPath
```

### 2. Usar Bypass para Commits Rápidos

```bash
# Pular validação de hooks (use com cuidado!)
git commit --no-verify -m "mensagem"
git push --no-verify
```

### 3. Executar Apenas Testes Afetados

Modificar `runFastTests()` para executar apenas testes relacionados aos arquivos modificados:

```javascript
// Obter arquivos modificados
const changedFiles = execSync('git diff --cached --name-only', {
  encoding: 'utf8',
})
  .trim()
  .split('\n');

// Executar apenas testes relacionados
const testCommand = `npm test -- --findRelatedTests ${changedFiles.join(' ')}`;
```

### 4. Configurar Modo de Desenvolvimento

Adicionar ao `.env`:

```
BMAD_DEV_MODE=true
BMAD_SKIP_TESTS=true
BMAD_SKIP_AUDIT=true
```

### 5. Otimizar Jest Configuration

Em `jest.config.js`:

```javascript
module.exports = {
  // ... configurações existentes
  maxWorkers: 2,
  testTimeout: 5000,
  bail: 1, // Para na primeira falha
  cache: true,
  cacheDirectory: '.jest-cache',
};
```

### 6. Usar lint-staged Eficientemente

Em `package.json`:

```json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "jest --bail --findRelatedTests"]
  }
}
```

## Monitoramento

### Verificar Performance dos Hooks

```bash
# Ver logs de execução
tail -f .github/logs/bmad-hookorchestrator.json.log | grep duration

# Limpar cache se necessário
rm .git/hooks-cache.json
```

### Métricas Esperadas

- **Pre-commit**: < 15s
- **Commit-msg**: < 1s
- **Pre-push**: < 2min
- **Post-commit**: < 5s (não-bloqueante)

## Troubleshooting

### Sistema Travando

1. Verificar processos Node.js rodando:

   ```bash
   ps aux | grep -E "(node|npm|jest)" | grep -v grep
   ```

2. Matar processos travados:

   ```bash
   pkill -f "npm test"
   pkill -f "jest"
   ```

3. Limpar cache:
   ```bash
   rm -rf .jest-cache
   rm .git/hooks-cache.json
   npm cache clean --force
   ```

### Hooks Muito Lentos

1. Desabilitar temporariamente:

   ```bash
   mv .husky .husky.bak
   ```

2. Executar testes manualmente:

   ```bash
   npm test
   ```

3. Reabilitar após confirmar que testes passam:
   ```bash
   mv .husky.bak .husky
   ```

## Próximos Passos

1. **Implementar execução seletiva de testes** (apenas arquivos modificados)
2. **Adicionar modo de desenvolvimento** com validações reduzidas
3. **Criar dashboard de métricas** para monitorar performance dos hooks
4. **Implementar circuit breaker** para prevenir execuções em cascata
5. **Adicionar health check** antes de executar hooks pesados

## Referências

- [Jest Performance](https://jestjs.io/docs/cli#--maxworkersnumstring)
- [Husky Best Practices](https://typicode.github.io/husky/)
- [lint-staged Optimization](https://github.com/okonet/lint-staged#configuration)
