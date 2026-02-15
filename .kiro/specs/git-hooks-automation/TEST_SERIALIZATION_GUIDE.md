# Guia de Serialização de Testes

## Visão Geral

Este guia explica como usar o sistema de serialização de testes implementado para evitar travamentos do sistema e garantir execução controlada de recursos.

## Problema Resolvido

- **Múltiplos processos de teste simultâneos** causando travamento do IDE
- **Consumo excessivo de CPU/memória** durante execução de hooks
- **Timeouts longos** permitindo processos travados
- **Falta de controle de recursos** durante execução de testes

## Componentes Implementados

### 1. TestExecutionManager

- **Localização**: `scripts/lib/test-execution-manager.js`
- **Função**: Controla execução serializada com semáforo global
- **Recursos**: Lock exclusivo, batching, monitoramento de recursos

### 2. Resource-Aware Test Sequencer

- **Localização**: `tests/utils/resource-aware-sequencer.js`
- **Função**: Ordena testes por complexidade e uso de recursos
- **Benefício**: Executa testes leves primeiro, pesados por último

### 3. Configuração Otimizada do Jest

- **Arquivo**: `jest.config.js`
- **Mudanças**: `maxWorkers=1`, timeouts reduzidos, cache desabilitado
- **Resultado**: Execução sequencial controlada

## Modos de Execução

### Modo Development (Padrão)

```bash
npm run test:dev
```

- 1 worker máximo
- Timeout de 5s por teste
- Para na primeira falha
- Pula testes de integração pesados

### Modo Performance

```bash
npm run test:performance
```

- Timeout de 3s por teste
- Apenas testes unitários
- Memória limitada a 512MB
- Máxima velocidade

### Modo Minimal

```bash
npm run test:minimal
```

- Apenas testes essenciais
- Pula property-based tests
- Pula testes de integração
- Memória limitada a 256MB

### Modo CI

```bash
npm run test:ci
```

- Execução completa
- 2 workers máximo
- Todos os testes incluídos
- Relatórios detalhados

## Comandos Disponíveis

### Configuração de Modo

```bash
# Configurar modo específico
npm run test:mode development
npm run test:mode performance
npm run test:mode minimal
npm run test:mode ci

# Ver ajuda
node scripts/configure-test-mode.js help
```

### Execução de Testes

```bash
# Execução serializada (1 worker)
npm run test:serial

# Execução rápida (para na primeira falha)
npm run test:fast

# Execução com modo específico
npm run test:dev
npm run test:performance
npm run test:minimal
npm run test:ci
```

### Monitoramento

```bash
# Ver logs de execução
tail -f .github/logs/bmad-hookorchestrator.json.log

# Verificar lock de execução
ls -la .git/test-execution.lock

# Limpar cache
rm -rf .git/hooks-cache.json .jest-cache/
```

## Controle de Recursos

### Verificação Automática

O sistema verifica automaticamente:

- **Uso de memória** < 85% (configurável)
- **Load average** < 4.0 (configurável)
- **Processos travados** (remove locks órfãos)

### Limites Configurados

- **Memória máxima**: 256MB-2GB dependendo do modo
- **Workers máximos**: 1-2 dependendo do modo
- **Timeout por teste**: 2s-10s dependendo do modo
- **Timeout total**: 15s-2min dependendo do escopo

### Batching Inteligente

- **Lotes pequenos**: 3-5 arquivos por lote
- **Delay entre lotes**: 1s para recuperação do sistema
- **Execução sequencial**: Um lote por vez
- **Agregação de resultados**: Combina resultados de todos os lotes

## Troubleshooting

### Sistema Travando

```bash
# 1. Verificar processos Node.js
ps aux | grep -E "(node|npm|jest)" | grep -v grep

# 2. Matar processos travados
pkill -f "npm test"
pkill -f "jest"

# 3. Remover locks órfãos
rm -f .git/test-execution.lock

# 4. Limpar cache
rm -rf .jest-cache/ .git/hooks-cache.json
```

### Testes Muito Lentos

```bash
# 1. Usar modo performance
npm run test:performance

# 2. Executar apenas testes modificados
npm test -- --findRelatedTests $(git diff --name-only)

# 3. Usar modo minimal
npm run test:minimal
```

### Hooks Travando

```bash
# 1. Desabilitar temporariamente
git config core.hooksPath /dev/null

# 2. Executar testes manualmente
npm run test:fast

# 3. Reabilitar hooks
git config --unset core.hooksPath
```

### Memória Insuficiente

```bash
# 1. Usar modo minimal
npm run test:minimal

# 2. Aumentar limite de memória
export NODE_OPTIONS="--max-old-space-size=4096"

# 3. Executar em lotes menores
# (configurado automaticamente no TestExecutionManager)
```

## Monitoramento de Performance

### Métricas Coletadas

- **Tempo de execução** por hook/teste
- **Uso de memória** durante execução
- **Load average** do sistema
- **Taxa de sucesso** dos testes
- **Cache hit rate** para otimização

### Logs Estruturados

```json
{
  "timestamp": "2025-12-20T23:30:00.000Z",
  "level": "INFO",
  "component": "TestExecutionManager",
  "message": "Acquired test execution lock for fast-tests",
  "processId": "fast-tests",
  "pid": 12345,
  "resources": {
    "memory": { "usagePercent": 45.2 },
    "load": { "load1": 1.5 }
  }
}
```

## Configuração Avançada

### Personalizar Thresholds

```javascript
// Em scripts/hooks/hook-orchestrator.js
const resourceThresholds = {
  maxMemoryUsage: 75, // 75% max memory
  maxLoadAverage: 3.0, // Max load average
};
```

### Personalizar Batch Size

```javascript
// Em TestExecutionManager
const batchOptions = {
  batchSize: 3, // 3 arquivos por lote
  maxWorkers: 1, // 1 worker por lote
  timeout: 60000, // 1 minuto por lote
};
```

### Personalizar Cache

```javascript
// Cache válido por 5 minutos
const cacheValidityMs = 5 * 60 * 1000;

// Máximo 10 entradas no cache
const maxCacheEntries = 10;
```

## Integração com Hooks

### Pre-commit Hook

- Executa `runFastTests()` com serialização
- Cache baseado em arquivos staged
- Timeout de 15s máximo
- 1 worker apenas

### Pre-push Hook

- Executa `runFullTestSuite()` em lotes
- Verificação de recursos antes da execução
- Timeout de 2min máximo
- Execução em batches de 3 arquivos

### Commit-msg Hook

- Não executa testes (apenas validação)
- Execução rápida < 1s
- Sem impacto no sistema

## Próximos Passos

1. **Monitorar métricas** de performance após implementação
2. **Ajustar thresholds** baseado no uso real
3. **Implementar dashboard** para visualizar métricas
4. **Adicionar alertas** para recursos baixos
5. **Otimizar sequencer** baseado em padrões de uso

## Referências

- [Jest Performance Tuning](https://jestjs.io/docs/troubleshooting#tests-are-extremely-slow-on-docker-andor-continuous-integration-ci-server)
- [Node.js Memory Management](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes)
- [System Resource Monitoring](https://nodejs.org/api/process.html#processmemoryusage)
