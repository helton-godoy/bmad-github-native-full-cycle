# Guia de Monitoramento de Processos

## Visão Geral

Sistema completo de monitoramento de processos filhos durante execução de testes, com rastreamento em tempo real, logging detalhado, alertas configuráveis e relatórios consolidados.

## Componentes do Sistema

### 1. ProcessMonitor (Core)

- **Arquivo**: `scripts/lib/process-monitor.js`
- **Função**: Monitor principal com rastreamento em tempo real
- **Recursos**:
  - Detecção automática de processos relevantes
  - Logging estruturado em JSON
  - Sistema de alertas configurável
  - Estatísticas de lifetime e recursos
  - Relatórios consolidados

### 2. JestProcessMonitor (Integração)

- **Arquivo**: `scripts/lib/jest-process-monitor.js`
- **Função**: Wrapper específico para Jest
- **Recursos**:
  - Hook automático em child_process
  - Detecção de workers Jest
  - Estatísticas específicas do Jest
  - Integração com lifecycle do Jest

### 3. Monitor Standalone

- **Arquivo**: `scripts/monitor-test-processes.js`
- **Função**: Execução independente com qualquer comando
- **Recursos**:
  - Interface CLI completa
  - Configuração flexível via argumentos
  - Monitoramento de comandos arbitrários
  - Relatórios em tempo real

### 4. Utilitários

- **Arquivo**: `scripts/process-monitor-utils.js`
- **Função**: Ferramentas de análise e manutenção
- **Recursos**:
  - Análise de logs existentes
  - Geração de relatórios HTML
  - Limpeza de logs antigos
  - Informações do sistema

## Modos de Uso

### 1. Integração Automática com Jest

#### Setup Básico

```javascript
// Em jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/tests/setup-process-monitor.js'],
  // ... outras configurações
};
```

#### Execução

```bash
# Habilitar monitoramento
ENABLE_PROCESS_MONITORING=true npm test

# Com configurações personalizadas
ENABLE_PROCESS_MONITORING=true \
MAX_PROCESSES=15 \
MAX_MEMORY_MB=512 \
ENABLE_ALERTS=true \
npm test
```

### 2. Monitoramento Standalone

#### Uso Básico

```bash
# Monitorar npm test
node scripts/monitor-test-processes.js

# Monitorar Jest diretamente
node scripts/monitor-test-processes.js --command "npx jest"

# Com limites personalizados
node scripts/monitor-test-processes.js \
  --max-processes 20 \
  --max-memory 1024 \
  --max-cpu 70 \
  --alerts
```

#### Opções Avançadas

```bash
# Monitoramento com duração limitada (5 minutos)
node scripts/monitor-test-processes.js \
  --duration 300000 \
  --output ./custom-report.json

# Monitoramento silencioso
node scripts/monitor-test-processes.js \
  --no-realtime \
  --output /dev/null
```

### 3. Scripts NPM Pré-configurados

```bash
# Testes com monitoramento automático
npm run test:monitor

# Monitoramento standalone
npm run test:monitor-standalone

# Monitoramento específico do Jest
npm run test:monitor-jest
```

## Configuração de Alertas

### Thresholds Padrão

```javascript
const alertThresholds = {
  maxProcesses: 50, // Máximo de processos simultâneos
  maxMemoryMB: 2048, // Máximo de memória em MB
  maxCpuPercent: 80, // Máximo de CPU em %
  processLifetimeMs: 300000, // 5 minutos máximo por processo
};
```

### Personalização

```bash
# Via variáveis de ambiente
export MAX_PROCESSES=20
export MAX_MEMORY_MB=1024
export MAX_CPU_PERCENT=60
export ENABLE_ALERTS=true

# Via argumentos CLI
node scripts/monitor-test-processes.js \
  --max-processes 20 \
  --max-memory 1024 \
  --max-cpu 60 \
  --alerts
```

## Tipos de Alertas

### 1. Excesso de Processos

```json
{
  "type": "max_processes_exceeded",
  "timestamp": "2025-12-20T23:30:00.000Z",
  "data": {
    "current": 55,
    "threshold": 50
  }
}
```

### 2. Uso Excessivo de Memória

```json
{
  "type": "max_memory_exceeded",
  "timestamp": "2025-12-20T23:30:00.000Z",
  "data": {
    "current": 2560,
    "threshold": 2048
  }
}
```

### 3. Processo de Longa Duração

```json
{
  "type": "long_running_process",
  "timestamp": "2025-12-20T23:30:00.000Z",
  "data": {
    "pid": 12345,
    "lifetime": 350000,
    "command": "node jest-worker"
  }
}
```

## Estrutura dos Logs

### Entrada de Criação de Processo

```json
{
  "type": "process_created",
  "timestamp": "2025-12-20T23:30:00.000Z",
  "pid": 12345,
  "command": "node",
  "args": ["jest-worker", "--config", "jest.config.js"],
  "parentPid": 12340,
  "processType": "jest",
  "existing": false,
  "activeProcesses": 5
}
```

### Entrada de Destruição de Processo

```json
{
  "type": "process_destroyed",
  "timestamp": "2025-12-20T23:30:15.000Z",
  "pid": 12345,
  "lifetime": 15000,
  "exitCode": 0,
  "processType": "jest",
  "activeProcesses": 4
}
```

## Relatórios Gerados

### 1. Relatório JSON

```json
{
  "summary": {
    "monitoringDuration": 45000,
    "totalProcessesCreated": 25,
    "totalProcessesDestroyed": 23,
    "activeProcesses": 2,
    "peakProcesses": 8,
    "alertsTriggered": 1
  },
  "processTypes": {
    "jest": { "count": 15, "percentage": "60.00" },
    "node_test": { "count": 8, "percentage": "32.00" },
    "eslint": { "count": 2, "percentage": "8.00" }
  },
  "lifetimeStatistics": {
    "min": 1200,
    "max": 45000,
    "average": 12500,
    "median": 8900
  },
  "resourceUsage": {
    "peakMemoryUsage": 1024.5,
    "peakCpuUsage": 65.2
  },
  "alerts": [...],
  "detailedProcesses": [...]
}
```

### 2. Relatório HTML

Gerado automaticamente com:

- Dashboard visual com gráficos
- Tabelas interativas
- Timeline de eventos
- Análise de alertas
- Lista detalhada de processos

## Análise e Manutenção

### Análise de Logs Existentes

```bash
# Analisar log específico
npm run monitor:analyze .github/logs/process-monitor.json

# Gerar relatório HTML
npm run monitor:html report.json report.html

# Informações do sistema
node scripts/process-monitor-utils.js system-info
```

### Limpeza de Logs

```bash
# Limpar logs antigos (7 dias)
npm run monitor:clean

# Limpar com idade personalizada (3 dias)
node scripts/process-monitor-utils.js clean .github/logs 259200000
```

### Gerenciamento de Processos

```bash
# Matar processos Jest travados
npm run monitor:kill "jest"

# Matar processos Node relacionados a testes
node scripts/process-monitor-utils.js kill "node.*test" SIGTERM
```

## Integração com Hooks

### Habilitação nos Hooks

```bash
# Adicionar ao .env ou configuração
export ENABLE_PROCESS_MONITORING=true

# Os hooks automaticamente usarão o monitoramento
git commit -m "test commit"  # Monitora processos durante pre-commit
git push                     # Monitora processos durante pre-push
```

### Configuração Específica para Hooks

```javascript
// Em scripts/hooks/hook-orchestrator.js
if (process.env.ENABLE_PROCESS_MONITORING === 'true') {
  this.processMonitor = new ProcessMonitor({
    logFile: 'hook-process-monitor.json',
    maxProcesses: 15, // Limite menor para hooks
    maxMemoryMB: 512, // Limite menor para hooks
    maxCpuPercent: 60, // Limite menor para hooks
    enableAlerts: true,
  });
}
```

## Troubleshooting

### Problema: Muitos Processos Detectados

```bash
# Verificar processos do sistema
node scripts/process-monitor-utils.js system-info

# Analisar padrões nos logs
npm run monitor:analyze .github/logs/process-monitor.json

# Ajustar thresholds
export MAX_PROCESSES=100
```

### Problema: Alertas Excessivos

```bash
# Desabilitar alertas temporariamente
export ENABLE_ALERTS=false

# Aumentar thresholds
export MAX_MEMORY_MB=4096
export MAX_CPU_PERCENT=90
```

### Problema: Logs Muito Grandes

```bash
# Desabilitar logging em tempo real
node scripts/monitor-test-processes.js --no-realtime

# Limpar logs antigos
npm run monitor:clean

# Configurar rotação automática
# (implementar cron job para limpeza regular)
```

### Problema: Processos Órfãos

```bash
# Identificar processos órfãos
ps aux | grep -E "(node|jest)" | grep -v grep

# Matar processos específicos
npm run monitor:kill "jest.*worker"

# Matar todos os processos Node relacionados a testes
pkill -f "node.*test"
```

## Métricas e KPIs

### Métricas Coletadas

- **Contagem de processos**: Total criados, destruídos, ativos, pico
- **Tempo de vida**: Mínimo, máximo, média, mediana
- **Uso de recursos**: Memória, CPU por processo
- **Distribuição por tipo**: Jest, Node, ESLint, etc.
- **Alertas**: Frequência, tipos, severidade

### KPIs Recomendados

- **Pico de processos** < 20 (para testes normais)
- **Tempo médio de vida** < 30s (para testes rápidos)
- **Taxa de alertas** < 5% das execuções
- **Uso de memória** < 1GB total
- **Processos órfãos** = 0

## Automação e CI/CD

### Integração com GitHub Actions

```yaml
- name: Run tests with process monitoring
  run: |
    export ENABLE_PROCESS_MONITORING=true
    export MAX_PROCESSES=30
    export ENABLE_ALERTS=true
    npm test

- name: Upload process monitoring report
  uses: actions/upload-artifact@v3
  with:
    name: process-monitor-report
    path: .github/reports/jest-process-monitor.json
```

### Alertas Automáticos

```bash
# Script para verificar alertas e notificar
#!/bin/bash
REPORT_FILE=".github/reports/jest-process-monitor.json"
if [ -f "$REPORT_FILE" ]; then
    ALERTS=$(jq '.summary.alertsTriggered' "$REPORT_FILE")
    if [ "$ALERTS" -gt 0 ]; then
        echo "⚠️ $ALERTS alerts detected in process monitoring"
        # Enviar notificação (Slack, email, etc.)
    fi
fi
```

## Próximos Passos

1. **Dashboard em Tempo Real**: Interface web para monitoramento ao vivo
2. **Integração com Métricas**: Envio para Prometheus/Grafana
3. **Machine Learning**: Detecção de padrões anômalos
4. **Otimização Automática**: Ajuste dinâmico de thresholds
5. **Integração com IDEs**: Plugin para VSCode/IntelliJ

## Referências

- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Linux Process Management](https://man7.org/linux/man-pages/man1/ps.1.html)
- [System Resource Monitoring](https://nodejs.org/api/process.html#processmemoryusage)
