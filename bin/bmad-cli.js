#!/usr/bin/env node
/**
 * @ai-context BMAD CLI Tool for Operations
 */
const fs = require('fs');
const path = require('path');
const CacheManager = require('../scripts/lib/cache-manager');
const ContextManager = require('../scripts/lib/context-manager');

const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function printUsage() {
    console.log(`
${colors.blue}BMAD CLI Tool v1.0.0${colors.reset}

Usage:
  bmad-cli <command> [param]

Commands:
  ${colors.yellow}status <issue-number>${colors.reset}    Show workflow status for an issue
  ${colors.yellow}reset <issue-number>${colors.reset}     Reset workflow state for an issue
  ${colors.yellow}cache-clear${colors.reset}              Clear API cache
  ${colors.yellow}validate${colors.reset}                 Run project validation
`);
}

async function main() {
    switch (command) {
        case 'status':
            if (!param) {
                console.error(`${colors.red}Error: Issue number required${colors.reset}`);
                return;
            }
            showStatus(param);
            break;
        case 'reset':
            if (!param) {
                console.error(`${colors.red}Error: Issue number required${colors.reset}`);
                return;
            }
            resetState(param);
            break;
        case 'cache-clear':
            clearCache();
            break;
        case 'validate':
            runValidation();
            break;
        default:
            printUsage();
    }
}

function showStatus(issueNumber) {
    const stateFile = `.github/workflow-state-${issueNumber}.json`;
    if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        console.log(`${colors.blue}Workflow Status for Issue #${issueNumber}:${colors.reset}`);
        console.log(JSON.stringify(state, null, 2));
    } else {
        console.log(`${colors.yellow}No active workflow found for Issue #${issueNumber}${colors.reset}`);
    }
}

function resetState(issueNumber) {
    const stateFile = `.github/workflow-state-${issueNumber}.json`;
    const handoverFile = '.github/BMAD_HANDOVER.md';

    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
        console.log(`${colors.green}✅ Workflow state reset for Issue #${issueNumber}${colors.reset}`);
    } else {
        console.log(`${colors.yellow}No state file found to reset.${colors.reset}`);
    }

    // Also reset handover if it matches the issue
    if (fs.existsSync(handoverFile)) {
        const content = fs.readFileSync(handoverFile, 'utf-8');
        if (content.includes(`Issue: #${issueNumber}`)) {
            fs.unlinkSync(handoverFile);
            console.log(`${colors.green}✅ Handover state reset.${colors.reset}`);
        }
    }
}

function clearCache() {
    const cacheManager = new CacheManager();
    cacheManager.clear();
    console.log(`${colors.green}✅ API Cache cleared.${colors.reset}`);
}

function runValidation() {
    console.log(`${colors.blue}Running Validation...${colors.reset}`);
    try {
        require('child_process').execSync('npm run validate', { stdio: 'inherit' });
    } catch (e) {
        console.error(`${colors.red}❌ Validation Failed${colors.reset}`);
        process.exit(1);
    }
}

main();
