#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('\x1b[36m🚀 A instalar BMAD Full-Cycle Agent Core...\x1b[0m');

const targetDir = process.cwd();
const packageDir = path.join(__dirname, '..');
const templateDir = path.join(packageDir, 'agent-core');

// Funções Utilitárias
const copy = (src, dest) => {
  try {
    fs.copyFileSync(src, dest);
    console.log(`✅ Criado: ${path.relative(targetDir, dest)}`);
  } catch (err) {
    console.error(`❌ Erro ao copiar ${src} para ${dest}: ${err.message}`);
  }
};

// 1. Criar Estrutura de Pastas
const dirs = [
  '.cline',
  'scripts',
  'docs/planning',
  'docs/architecture',
  'docs/testing',
];

dirs.forEach((dir) => {
  const fullPath = path.join(targetDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Pasta criada: ${dir}`);
  }
});

// 2. Copiar Regras e Scripts
const rulesSrc = path.join(templateDir, 'clinerules.template.md');
const rulesDestDir = path.join(targetDir, '.clinerules');
const rulesDestFile = path.join(rulesDestDir, 'README.md');
const hooksDestDir = path.join(rulesDestDir, 'hooks');

if (!fs.existsSync(rulesDestDir)) {
  fs.mkdirSync(rulesDestDir);
  console.log('📁 Pasta criada: .clinerules');
}

if (!fs.existsSync(hooksDestDir)) {
  fs.mkdirSync(hooksDestDir);
  console.log('📁 Pasta criada: .clinerules/hooks');
}

if (fs.existsSync(rulesSrc)) {
  copy(rulesSrc, rulesDestFile);
} else {
  console.error(`❌ Template não encontrado: ${rulesSrc}`);
}

// Copiar Hooks
const hooksSrcDir = path.join(templateDir, 'hooks');
if (fs.existsSync(hooksSrcDir)) {
  const hooks = fs.readdirSync(hooksSrcDir);
  hooks.forEach((hook) => {
    const src = path.join(hooksSrcDir, hook);
    const dest = path.join(hooksDestDir, hook);
    copy(src, dest);
    fs.chmodSync(dest, '755'); // Tornar executável
  });
  console.log(`✅ Hooks instalados: ${hooks.join(', ')}`);
}

const gatekeeperSrc = path.join(templateDir, 'gatekeeper.js');
const gatekeeperDest = path.join(targetDir, 'scripts/bmad-gatekeeper.js');
if (fs.existsSync(gatekeeperSrc)) {
  copy(gatekeeperSrc, gatekeeperDest);
} else {
  console.error(`❌ Script Gatekeeper não encontrado: ${gatekeeperSrc}`);
}

// Instalar AgentDoc
const agentDocSrc = path.join(templateDir, 'scripts/agent-doc.js');
const agentDocDest = path.join(targetDir, 'scripts/agent-doc.js');
if (fs.existsSync(agentDocSrc)) {
  copy(agentDocSrc, agentDocDest);
} else {
  // Tenta caminho alternativo se estiver rodando do próprio repo
  const altSrc = path.join(packageDir, 'agent-core/scripts/agent-doc.js');
  if (fs.existsSync(altSrc)) {
    copy(altSrc, agentDocDest);
  } else {
    console.error(`❌ Script AgentDoc não encontrado.`);
  }
}

// Instalar Search Memory
const searchSrc = path.join(templateDir, 'scripts/search-memory.js');
const searchDest = path.join(targetDir, 'scripts/search-memory.js');
if (fs.existsSync(searchSrc)) {
  copy(searchSrc, searchDest);
} else {
  const altSrc = path.join(packageDir, 'agent-core/scripts/search-memory.js');
  if (fs.existsSync(altSrc)) {
    copy(altSrc, searchDest);
  }
}

// 3. Inicializar Contexto
const contextPath = path.join(targetDir, 'activeContext.md');
if (!fs.existsSync(contextPath)) {
  fs.writeFileSync(
    contextPath,
    '# Active Context\n\n## Status Atual\nProjeto inicializado com BMAD Framework.\n\n## Próximos Passos\n- [ ] Definir objetivo inicial (PO)'
  );
  console.log('✅ Criado: activeContext.md');
}

// 4. Configurar package.json do destino
const pkgPath = path.join(targetDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = require(pkgPath);
    pkg.scripts = pkg.scripts || {};
    // Adiciona o script do gatekeeper e doc
    pkg.scripts['bmad:gatekeeper'] = 'node scripts/bmad-gatekeeper.js';
    pkg.scripts['bmad:doc'] = 'node scripts/agent-doc.js --qdrant';
    pkg.scripts['bmad:search'] = 'node scripts/search-memory.js';

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log(
      '🔧 package.json atualizado com scripts de segurança e documentação.'
    );
  } catch (err) {
    console.error(`❌ Erro ao atualizar package.json: ${err.message}`);
  }
} else {
  console.log(
    "⚠️  Aviso: package.json não encontrado. Execute 'npm init' e rode o setup novamente."
  );
}

console.log(
  '\n\x1b[32m🎉 Instalação Concluída! O Cline está pronto para operar este projeto.\x1b[0m'
);
