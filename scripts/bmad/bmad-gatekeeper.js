#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const colors = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', reset: '\x1b[0m' };

console.log(`${colors.yellow}🛡️  BMAD AGENT GUARD 🛡️${colors.reset}`);

// Configuração Básica
let config = { requireContextUpdate: true };
try {
    const pkg = require(path.join(process.cwd(), 'package.json'));
    if (pkg.bmad) config = { ...config, ...pkg.bmad };
} catch {
    // Ignore package.json errors
}

// 1. Validar Mensagem de Commit (Conventional Commits)
const commitMsg = process.argv[2];
if (commitMsg && !/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?: .+/.test(commitMsg)) {
    console.error(`${colors.red}❌ ERRO: Mensagem de commit inválida.${colors.reset}`);
    console.error('   Esperado: "type(scope): description" (ex: feat(auth): add login)');
    process.exit(1);
}

// 2. Validar Atualização de Memória (activeContext.md)
if (config.requireContextUpdate) {
    try {
        const staged = execSync('git diff --cached --name-only').toString();

        // Se houver código staged mas o activeContext não estiver lá
        // Verifica extensões comuns de código
        const hasCodeChanges = staged.match(/\.(js|ts|jsx|tsx|py|rb|go|rs|java|c|cpp|h|hpp|css|scss|html|vue|svelte)$/m);
        const hasContextUpdate = staged.includes('activeContext.md');

        if (hasCodeChanges && !hasContextUpdate) {
            console.error(`${colors.red}❌ BLOQUEIO DE PROCESSO:${colors.reset}`);
            console.error('   Detectadas alterações de código sem atualização do \'activeContext.md\'.');
            console.error('   Regra: O Agente DEVE atualizar a memória do projeto antes de finalizar.');
            process.exit(1);
        }
    } catch {
        // Ignora erro se git não estiver iniciado ou vazio, ou se o comando falhar
    }
}

// 3. Rodar Testes (Se existirem)
console.log(`${colors.yellow}🧪 A verificar integridade (testes)...${colors.reset}`);

let gateResult = {
    gate: 'FAIL',
    timestamp: new Date().toISOString(),
    waiver: { active: false }
};

if (process.env.BMAD_SKIP_TESTS === 'true') {
    console.log(`${colors.yellow}⚠️  BMAD_SKIP_TESTS ativado. Pulando execução de testes.${colors.reset}`);
    gateResult.gate = 'WAIVED';
    gateResult.waiver = {
        active: true,
        reason: 'BMAD_SKIP_TESTS environment variable set',
        approved_by: 'Developer (Local Override)'
    };
    console.log(`${colors.green}✅ Gate Status: WAIVED${colors.reset}`);
} else {
    try {
        // Verifica se existe script de teste no package.json
        const pkg = require(path.join(process.cwd(), 'package.json'));
        if (pkg.scripts && pkg.scripts.test) {
            execSync('npm test --if-present', { stdio: 'inherit' });
            console.log(`${colors.green}✅ Testes aprovados.${colors.reset}`);
            gateResult.gate = 'PASS';
        } else {
            console.log(`${colors.yellow}⚠️  Nenhum script de teste encontrado. Pulando testes.${colors.reset}`);
            gateResult.gate = 'PASS'; // Pass if no tests defined (for now, or could be CONCERNS)
            gateResult.status_reason = 'No tests defined';
        }

    } catch {
        console.error(`${colors.red}❌ Testes falharam. Commit abortado.${colors.reset}`);
        gateResult.gate = 'FAIL';
        // Log gate result before exiting
        console.log(JSON.stringify(gateResult, null, 2));
        process.exit(1);
    }
}

// Output structured result (could be saved to file in future)
console.log(JSON.stringify(gateResult, null, 2));
