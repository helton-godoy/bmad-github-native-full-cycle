/**
 * @ai-context Loop Detector for BMAD persona transition tracking and infinite loop prevention
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class LoopDetector {
  constructor(options = {}) {
    this.logger = new Logger('LoopDetector');
    this.maxTransitions = options.maxTransitions ?? 3;
    this.workflowId = options.workflowId || 'default';
    this.historyFile =
      options.historyFile ||
      path.join(process.cwd(), '.github', 'transition-history.json');
    this.history = [];
    this.loadHistory();
  }

  recordTransition(fromPersona, toPersona, timestamp = new Date().toISOString(), status = 'executed') {
    const parsedTimestamp = new Date(timestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
      throw new Error(`Invalid transition timestamp: ${timestamp}`);
    }
    const record = {
      workflowId: this.workflowId,
      fromPersona: (fromPersona || 'UNKNOWN').toUpperCase(),
      toPersona: (toPersona || 'UNKNOWN').toUpperCase(),
      timestamp: parsedTimestamp.toISOString(),
      status,
    };
    this.history.push(record);
    this.saveHistory();
    return record;
  }

  getTransitionCount(fromPersona, toPersona) {
    const from = (fromPersona || 'UNKNOWN').toUpperCase();
    const to = (toPersona || 'UNKNOWN').toUpperCase();

    return this.history.filter(
      (rec) =>
        (rec.workflowId || 'default') === this.workflowId &&
        rec.fromPersona === from &&
        rec.toPersona === to &&
        rec.status !== 'blocked'
    ).length;
  }

  detectLoop(fromPersona, toPersona) {
    const count = this.getTransitionCount(fromPersona, toPersona);
    return count >= this.maxTransitions;
  }

  evaluateTransition(fromPersona, toPersona) {
    const blocked = this.detectLoop(fromPersona, toPersona);
    const record = this.recordTransition(
      fromPersona,
      toPersona,
      new Date().toISOString(),
      blocked ? 'blocked' : 'executed'
    );
    return { allowed: !blocked, blocked, record };
  }

  clearHistory() {
    this.history = this.history.filter(
      (record) => (record.workflowId || 'default') !== this.workflowId
    );
    if (this.history.length === 0 && fs.existsSync(this.historyFile)) {
      try {
        fs.unlinkSync(this.historyFile);
      } catch (err) {
        this.logger.warn(`Failed to delete history file: ${err.message}`);
      }
    } else if (this.history.length > 0) {
      this.saveHistory();
    }
  }

  loadHistory() {
    if (fs.existsSync(this.historyFile)) {
      try {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        this.history = JSON.parse(data);
      } catch (err) {
        this.logger.warn(`Failed to read transition history: ${err.message}`);
        this.history = [];
      }
    } else {
      this.history = [];
    }
  }

  saveHistory() {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempFile = `${this.historyFile}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.history, null, 2), 'utf8');
      fs.renameSync(tempFile, this.historyFile);
    } catch (err) {
      this.logger.error(`Failed to save transition history: ${err.message}`);
      throw new Error(`Transition history persistence failed: ${err.message}`);
    }
  }
}

module.exports = LoopDetector;
