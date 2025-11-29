/**
 * @ai-context BMAD Health Check (Watchdog)
 * @ai-invariant Must detect stalled workflows and trigger resume ONLY if safe
 */
const fs = require('fs');
const path = require('path');
const ContextManager = require('../lib/context-manager');
const Logger = require('../lib/logger');

const contextManager = new ContextManager();
const logger = new Logger('Watchdog');

async function checkHealth() {
    logger.info('🩺 Starting Health Check...');

    // 1. Check Circuit Breaker
    if (contextManager.isCircuitOpen()) {
        logger.error('⛔ Circuit Breaker is OPEN. Skipping checks to prevent error loop.');
        console.log('CIRCUIT_OPEN'); // Output for GitHub Actions
        process.exit(0);
    }

    // 2. Find active workflow state
    const workflowFiles = fs.readdirSync('.github').filter(f => f.startsWith('workflow-state-') && f.endsWith('.json'));

    if (workflowFiles.length === 0) {
        logger.info('✅ No active workflows found. System idle.');
        console.log('IDLE');
        process.exit(0);
    }

    for (const file of workflowFiles) {
        const filePath = path.join('.github', file);
        const stats = fs.statSync(filePath);
        const lastUpdate = new Date(stats.mtimeMs);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / 1000 / 60;

        logger.info(`Checking ${file}: Last update ${Math.round(diffMinutes)}m ago.`);

        // 3. Check for Stalled Workflow (> 10 minutes)
        if (diffMinutes > 10) {
            logger.warn(`⚠️ Workflow ${file} appears STALLED.`);

            // Trigger Resume
            const issueNumber = file.replace('workflow-state-', '').replace('.json', '');

            // Record this as a potential failure (if it keeps stalling, CB will open)
            contextManager.recordFailure();

            console.log(`RESUME_NEEDED:${issueNumber}`);

            // In a real scenario, we might trigger a dispatch event here.
            // For now, we output a signal that the wrapper workflow can use.
            process.exit(0);
        }
    }

    logger.info('✅ All active workflows are healthy.');
    console.log('HEALTHY');
}

checkHealth().catch(err => {
    logger.error(`Health Check Failed: ${err.message}`);
    process.exit(1);
});
