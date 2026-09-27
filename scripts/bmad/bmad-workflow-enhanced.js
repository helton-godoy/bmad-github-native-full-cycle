#!/usr/bin/env node
/**
 * @ai-context Enhanced BMAD Workflow Orchestrator with advanced features
 * @ai-invariant Must execute all personas in sequence with enhanced coordination
 * @ai-connection Coordinates all personas, GitHub integration, and advanced monitoring
 */
/* global setTimeout */
require('dotenv').config();
const EnhancedProjectManager = require('../../personas/project-manager');
const EnhancedArchitect = require('../../personas/architect');
const EnhancedDeveloper = require('../../personas/developer-enhanced');
const EnhancedQA = require('../../personas/qa');
const EnhancedSecurity = require('../../personas/security');
const EnhancedDevOps = require('../../personas/devops');
const EnhancedReleaseManager = require('../../personas/release-manager');
const RecoveryPersona = require('../../personas/recovery');
const StateCacheManager = require('../lib/state-cache-manager');
const ErrorRecoveryManager = require('../lib/error-recovery-manager');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
};

class EnhancedBMADWorkflow {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    if (!this.githubToken) {
      console.error(
        `${colors.red}❌ GITHUB_TOKEN environment variable required${colors.reset}`
      );
      process.exit(1);
    }

    this.personas = {
      pm: new EnhancedProjectManager(this.githubToken),
      architect: new EnhancedArchitect(this.githubToken),
      developer: new EnhancedDeveloper(this.githubToken),
      qa: new EnhancedQA(this.githubToken),
      security: new EnhancedSecurity(this.githubToken),
      devops: new EnhancedDevOps(this.githubToken),
      releaseManager: new EnhancedReleaseManager(this.githubToken),
    };

    this.workflowMetrics = {
      startTime: new Date(),
      phases: {},
      errors: [],
      successes: [],
    };

    this.setupDirectories();
  }

  /**
   * @ai-context Setup required directories
   */
  setupDirectories() {
    const dirs = ['.github/logs', '.github/reports', '.github/metrics'];
    dirs.forEach((dir) => {
      if (!require('fs').existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * @ai-context Execute complete enhanced BMAD workflow
   */
  /**
   * @ai-context Execute complete enhanced BMAD workflow
   */
  /**
   * @ai-context Execute complete enhanced BMAD workflow
   */
  async executeWorkflow(issueNumber) {
    console.log(
      `${colors.cyan}🚀 Starting Enhanced BMAD Workflow for Issue #${issueNumber}${colors.reset}`
    );
    console.log(
      `${colors.blue}=====================================${colors.reset}`
    );

    // Try to load existing state for resume
    let state = await this.loadState(issueNumber);
    let workflowId;

    if (state) {
      if (state.status === 'completed' && !process.env.BMAD_FORCE_RESUME) {
        console.log(
          `${colors.green}✅ Workflow ${state.workflowId} for Issue #${issueNumber} is already completed.${colors.reset}`
        );
        console.log(
          `${colors.gray}Use BMAD_FORCE_RESUME=true to force execution.${colors.reset}`
        );
        return;
      }

      console.log(
        `${colors.yellow}🔄 Resuming workflow ${state.workflowId} (Status: ${state.status})...${colors.reset}`
      );
      workflowId = state.workflowId;
      this.workflowMetrics = state.metrics || this.workflowMetrics;
      this.workflowMetrics.phases = this.workflowMetrics.phases || {};
      this.workflowMetrics.errors = this.workflowMetrics.errors || [];
      this.workflowMetrics.successes = this.workflowMetrics.successes || [];
      this.workflowMetrics.startTime =
        this.workflowMetrics.startTime ? new Date(this.workflowMetrics.startTime) : new Date();

      // Track resume count
      state.resumeCount = (state.resumeCount || 0) + 1;
      await this.saveState(state);
    } else {
      workflowId = this.generateWorkflowId();
      this.logWorkflow(
        `Workflow ${workflowId} started for Issue #${issueNumber}`
      );
      state = {
        workflowId,
        issueNumber,
        status: 'running',
        resumeCount: 0,
        metrics: this.workflowMetrics,
        currentPersona: 'ORCHESTRATOR',
        stepId: 'INIT-000',
      };
      await this.saveState(state);
    }

    const EventEmitter = require('events');
    const eventEmitter = new EventEmitter();

    // Setup event listeners
    eventEmitter.on('state-loaded', (state) => {
      console.log(
        `${colors.magenta}📡 Event: State Loaded (Phase: ${state.phase})${colors.reset}`
      );
    });

    eventEmitter.on('action-determined', (action) => {
      console.log(
        `${colors.magenta}📡 Event: Action Determined -> ${action.persona}${colors.reset}`
      );
    });

    eventEmitter.on('phase-completed', (data) => {
      console.log(
        `${colors.magenta}📡 Event: Phase Completed (${data.persona} -> ${data.nextPhase})${colors.reset}`
      );
      this.workflowMetrics.phases[data.persona] = {
        status: 'completed',
        timestamp: new Date().toISOString(),
      };
      const candidatePersona = String(data.persona || 'ORCHESTRATOR').toUpperCase();
      state.currentPersona = stateCache.registeredPersonas.includes(candidatePersona)
        ? candidatePersona
        : 'ORCHESTRATOR';
      state.stepId = data.nextPhase || state.stepId || 'WORKFLOW';
    });

    const BMADOrchestrator = require('./bmad-orchestrator');
    const stateCache = this.createStateCache(issueNumber);
    const LoopDetector = require('../lib/loop-detector');
    const orchestrator = new BMADOrchestrator(eventEmitter, {
      loopDetector: new LoopDetector({
        workflowId,
        historyFile: `.github/transition-history-${issueNumber}.json`,
      }),
      stateCacheManager: stateCache,
      errorRecoveryManager: new ErrorRecoveryManager({ stateCache }),
    });

    try {
      console.log(
        `${colors.yellow}🔄 Handing over control to BMAD Orchestrator...${colors.reset}`
      );

      let stepCount = 0;
      const MAX_STEPS = 50; // Increased from 20 for complex workflows
      const WORKFLOW_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      const workflowStartTime = Date.now();
      let keepRunning = true;

      while (keepRunning && stepCount < MAX_STEPS) {
        stepCount++;

        // Check timeout
        const elapsedTime = Date.now() - workflowStartTime;
        if (elapsedTime > WORKFLOW_TIMEOUT_MS) {
          console.warn(
            `${colors.yellow}⚠️ Workflow stopped after timeout (${Math.round(elapsedTime / 1000 / 60)} minutes).${colors.reset}`
          );
          state.status = 'timeout';
          state.lastStep = new Date().toISOString();
          await this.saveState(state);
          break;
        }

        console.log(
          `${colors.blue}--- Orchestration Step ${stepCount} (Elapsed: ${Math.round(elapsedTime / 1000)}s) ---${colors.reset}`
        );

        // orchestrate() returns true if action taken, false if idle
        keepRunning = await orchestrator.orchestrate(issueNumber);

        // Update and save state after each step
        state.metrics = this.workflowMetrics; // Metrics might be updated by phases
        state.lastStep = new Date().toISOString();
        // If orchestrator signaled idle, consider workflow completed from orchestrator perspective
        if (!keepRunning) {
          state.status = state.status || 'completed';
        }
        await this.saveState(state);
      }

      if (stepCount >= MAX_STEPS && keepRunning) {
        console.warn(
          `${colors.yellow}⚠️ Workflow stopped after reaching maximum steps (${MAX_STEPS}).${colors.reset}`
        );
        state.status = 'max-steps';
        state.lastStep = new Date().toISOString();
        await this.saveState(state);
      }

      // Generate final report
      await this.generateWorkflowReport(workflowId, issueNumber);

      console.log(
        `${colors.green}✅ Enhanced BMAD Workflow cycle completed!${colors.reset}`
      );
      this.logWorkflow(`Workflow ${workflowId} cycle completed`);

      // Mark as completed if no explicit status was set (i.e., no timeout/max-steps)
      if (!state.status || state.status === 'running') {
        state.status = 'completed';
        state.lastStep = new Date().toISOString();
        await this.saveState(state);
      }

      // Clear state on successful completion
      if (state.status === 'completed') {
        await this.clearState(issueNumber, state.status);
        if (orchestrator.loopDetector) {
          orchestrator.loopDetector.clearHistory();
        }
      }
    } catch (error) {
      console.error(
        `${colors.red}❌ Workflow failed: ${error.message}${colors.reset}`
      );
      this.workflowMetrics.errors.push({
        phase: 'workflow',
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Save error state
      state.status = 'failed';
      state.error = error.message;
      await this.saveState(state);

      // Attempt automated recovery only when the orchestrator did not already do it.
      try {
        if (error.recoveryHandled) throw error;
        console.log(
          `${colors.yellow}🛟 Attempting automated recovery using RecoveryPersona...${colors.reset}`
        );
        const recovery = new RecoveryPersona(this.githubToken);
        const recoveryManager = new ErrorRecoveryManager({
          stateCache: this.createStateCache(issueNumber),
          remediations: {
            WORKFLOW_ERROR: async () => recovery.execute(issueNumber),
          },
        });
        const recoveryResult = await recoveryManager.escalateToRecovery(error, {
          persona: state.currentPersona || 'ORCHESTRATOR',
          operation: 'executeWorkflow',
          stepId: state.stepId || state.lastStep || 'WORKFLOW',
          workflowId,
          category: 'WORKFLOW_ERROR',
          context: { workflowState: state },
        });
        if (recoveryResult.status === 'suspended') {
          throw new Error(recoveryResult.reason);
        }
        this.workflowMetrics.errors.push({
          phase: 'recovery',
          error: null,
          timestamp: new Date().toISOString(),
        });
        state.status = 'recovered';
        state.lastStep = new Date().toISOString();
        await this.saveState(state);
      } catch (recoveryError) {
        console.error(
          `${colors.red}❌ Recovery workflow failed: ${recoveryError.message}${colors.reset}`
        );
        this.workflowMetrics.errors.push({
          phase: 'recovery',
          error: recoveryError.message,
          timestamp: new Date().toISOString(),
        });
        state.status = 'recovery-failed';
        state.recoveryError = recoveryError.message;
        state.lastStep = new Date().toISOString();
        await this.saveState(state);
      }

      await this.generateErrorReport(workflowId, issueNumber, error);
      throw error;
    }
  }

  /**
   * @ai-context Load workflow state from file
   */
  createStateCache(issueNumber) {
    return new StateCacheManager({
      stateFile: `.github/workflow-state-${issueNumber}.json`,
      backupFile: `.github/workflow-state-${issueNumber}.backup.json`,
    });
  }

  async loadState(issueNumber) {
    const stateFile = `.github/workflow-state-${issueNumber}.json`;
    if (require('fs').existsSync(stateFile)) {
      try {
        const legacy = JSON.parse(require('fs').readFileSync(stateFile, 'utf8'));
        if (legacy.workflowId && !legacy.currentPersona && !legacy.persona) {
          this.logWorkflow(
            `Migrating legacy workflow state ${legacy.workflowId} for Issue #${issueNumber}`
          );
          return legacy;
        }
      } catch (error) {
        this.logWorkflow(`State load failed for Issue #${issueNumber}: ${error.message}`);
      }
    }
    const restored = await this.createStateCache(issueNumber).restoreState();
    if (!restored || restored.status === 'reset') return null;
    const state = restored.context && restored.context.workflowState;
    if (state) {
      this.logWorkflow(
        `Resuming persona ${restored.currentPersona} at ${restored.stepId}`
      );
    }
    return state || null;
  }

  /**
   * @ai-context Save workflow state to file
   */
  async saveState(state) {
    const cache = this.createStateCache(state.issueNumber);
    return cache.persistState(
      state.currentPersona || 'ORCHESTRATOR',
      state.stepId || state.lastStep || 'WORKFLOW',
      { workflowState: state },
      { workflowId: state.workflowId, status: state.status || 'running' }
    );
  }

  /**
   * @ai-context Clear workflow state file
   */
  async clearState(issueNumber, status = 'completed') {
    if (status !== 'completed') return false;
    const stateFile = `.github/workflow-state-${issueNumber}.json`;
    const backupFile = `.github/workflow-state-${issueNumber}.backup.json`;
    if (require('fs').existsSync(stateFile)) {
      require('fs').unlinkSync(stateFile);
    }
    if (require('fs').existsSync(backupFile)) {
      require('fs').unlinkSync(backupFile);
    }
    return true;
  }

  /**
   * @ai-context Execute individual workflow phase
   */
  async executePhase(personaKey, phaseName, issueNumber) {
    const phaseStart = new Date();
    console.log(
      `${colors.yellow}🎯 Starting ${phaseName} Phase${colors.reset}`
    );

    try {
      const persona = this.personas[personaKey];

      // Execute persona
      const result = await persona.execute(issueNumber);

      // Record metrics
      const phaseDuration = new Date() - phaseStart;
      this.workflowMetrics.phases[personaKey] = {
        name: phaseName,
        duration: phaseDuration,
        status: 'completed',
        result: result,
      };

      this.workflowMetrics.successes.push({
        phase: personaKey,
        duration: phaseDuration,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `${colors.green}✅ ${phaseName} Phase completed in ${Math.round(phaseDuration / 1000)}s${colors.reset}`
      );
      this.logWorkflow(
        `Phase ${personaKey} completed in ${Math.round(phaseDuration / 1000)}s`
      );

      // Wait between phases for API rate limiting
      await this.delay(2000);
    } catch (error) {
      const phaseDuration = new Date() - phaseStart;
      this.workflowMetrics.phases[personaKey] = {
        name: phaseName,
        duration: phaseDuration,
        status: 'failed',
        error: error.message,
      };

      this.workflowMetrics.errors.push({
        phase: personaKey,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      console.error(
        `${colors.red}❌ ${phaseName} Phase failed: ${error.message}${colors.reset}`
      );
      this.logWorkflow(`Phase ${personaKey} failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * @ai-context Generate comprehensive workflow report
   */
  async generateWorkflowReport(workflowId, issueNumber) {
    const totalDuration = new Date() - this.workflowMetrics.startTime;
    const report = {
      workflowId,
      issueNumber,
      startTime: this.workflowMetrics.startTime.toISOString(),
      endTime: new Date().toISOString(),
      totalDuration: Math.round(totalDuration / 1000),
      phases: this.workflowMetrics.phases,
      metrics: {
        totalPhases: Object.keys(this.workflowMetrics.phases).length,
        successfulPhases: this.workflowMetrics.successes.length,
        failedPhases: this.workflowMetrics.errors.length,
        successRate: (
          (this.workflowMetrics.successes.length /
            Object.keys(this.workflowMetrics.phases).length) *
          100
        ).toFixed(2),
      },
    };

    // Save report
    const reportPath = `.github/reports/workflow-${workflowId}.json`;
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = `.github/reports/workflow-${workflowId}.md`;
    require('fs').writeFileSync(markdownPath, markdownReport);

    console.log(
      `${colors.blue}📊 Workflow report generated: ${markdownPath}${colors.reset}`
    );
  }

  /**
   * @ai-context Generate markdown workflow report
   */
  generateMarkdownReport(report) {
    return `# BMAD Workflow Report

## Overview
- **Workflow ID:** ${report.workflowId}
- **Issue:** #${report.issueNumber}
- **Duration:** ${report.totalDuration}s
- **Success Rate:** ${report.metrics.successRate}%

## Phase Summary

${Object.entries(report.phases)
  .map(
    ([_key, phase]) => `
### ${phase.name}
- **Status:** ${phase.status === 'completed' ? '✅' : '❌'}
- **Duration:** ${Math.round(phase.duration / 1000)}s
${phase.error ? `- **Error:** ${phase.error}` : ''}
`
  )
  .join('')}

## Metrics
- **Total Phases:** ${report.metrics.totalPhases}
- **Successful:** ${report.metrics.successfulPhases}
- **Failed:** ${report.metrics.failedPhases}
- **Success Rate:** ${report.metrics.successRate}%

## Timeline
- **Started:** ${report.startTime}
- **Completed:** ${report.endTime}

---
*Generated by Enhanced BMAD Workflow*
`;
  }

  /**
   * @ai-context Generate error report
   */
  async generateErrorReport(workflowId, issueNumber, error) {
    const errorReport = {
      workflowId,
      issueNumber,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      context: {
        phase: this.getCurrentPhase(),
        metrics: this.workflowMetrics,
        environment: process.env,
      },
    };

    const errorPath = `.github/reports/error-${workflowId}.json`;
    require('fs').writeFileSync(
      errorPath,
      JSON.stringify(errorReport, null, 2)
    );

    console.log(
      `${colors.red}📋 Error report generated: ${errorPath}${colors.reset}`
    );
  }

  /**
   * @ai-context Get current phase based on completed phases
   */
  getCurrentPhase() {
    const completedPhases = Object.keys(this.workflowMetrics.phases);
    if (completedPhases.length === 0) return 'initialization';
    return completedPhases[completedPhases.length - 1];
  }

  /**
   * @ai-context Generate unique workflow ID
   */
  generateWorkflowId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `bmad-${timestamp}-${random}`;
  }

  /**
   * @ai-context Log workflow events
   */
  logWorkflow(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    // Log to console
    console.log(`${colors.gray}${logEntry.trim()}${colors.reset}`);

    // Log to file
    const logPath = '.github/logs/workflow.log';
    require('fs').appendFileSync(logPath, logEntry);
  }

  /**
   * @ai-context Delay between API calls
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * @ai-context Get workflow status
   */
  getWorkflowStatus() {
    return {
      running: Object.keys(this.workflowMetrics.phases).length < 7,
      completedPhases: Object.keys(this.workflowMetrics.phases).length,
      totalPhases: 7,
      errors: this.workflowMetrics.errors.length,
      successes: this.workflowMetrics.successes.length,
    };
  }

  /**
   * @ai-context Execute single persona (for testing/debugging)
   */
  async executePersona(personaKey, issueNumber) {
    const persona = this.personas[personaKey];
    if (!persona) {
      throw new Error(`Unknown persona: ${personaKey}`);
    }

    console.log(
      `${colors.cyan}🎯 Executing ${personaKey} persona${colors.reset}`
    );
    const result = await persona.execute(issueNumber);
    console.log(`${colors.green}✅ ${personaKey} completed${colors.reset}`);

    return result;
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      `${colors.yellow}Usage: node bmad-workflow-enhanced.js <issue-number> [persona-key]${colors.reset}`
    );
    console.log(
      `${colors.gray}Available personas: pm, architect, developer, qa, security, devops, releaseManager${colors.reset}`
    );
    process.exit(1);
  }

  const issueNumber = parseInt(args[0]);
  const personaKey = args[1];

  if (isNaN(issueNumber)) {
    console.error(`${colors.red}❌ Invalid issue number${colors.reset}`);
    process.exit(1);
  }

  const workflow = new EnhancedBMADWorkflow();

  if (personaKey) {
    // Execute single persona
    workflow
      .executePersona(personaKey, issueNumber)
      .then((result) => {
        console.log(
          `${colors.green}✅ Persona execution completed${colors.reset}`
        );
        console.log(
          `${colors.blue}Result: ${JSON.stringify(result, null, 2)}${colors.reset}`
        );
      })
      .catch((error) => {
        console.error(
          `${colors.red}❌ Persona execution failed: ${error.message}${colors.reset}`
        );
        process.exit(1);
      });
  } else {
    // Execute full workflow
    workflow
      .executeWorkflow(issueNumber)
      .then(() => {
        console.log(
          `${colors.green}🎉 Enhanced BMAD Workflow completed successfully!${colors.reset}`
        );
      })
      .catch((error) => {
        console.error(
          `${colors.red}❌ Enhanced BMAD Workflow failed: ${error.message}${colors.reset}`
        );
        process.exit(1);
      });
  }
}

module.exports = EnhancedBMADWorkflow;
