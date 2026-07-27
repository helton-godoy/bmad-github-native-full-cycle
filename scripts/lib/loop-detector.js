/**
 * @ai-context Loop Detector for BMAD persona transition tracking and infinite loop prevention
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class LoopDetector {
  constructor(options = {}) {
    this.logger = new Logger('LoopDetector');
    this.maxTransitions = options.maxTransitions || 3;
    this.historyFile =
      options.historyFile ||
      path.join(process.cwd(), '.github', 'transition-history.json');
    this.history = [];
    this.loadHistory();
  }

  recordTransition(fromPersona, toPersona, timestamp = new Date().toISOString()) {
    const record = {
      fromPersona: (fromPersona || 'UNKNOWN').toUpperCase(),
      toPersona: (toPersona || 'UNKNOWN').toUpperCase(),
      timestamp,
    };
    this.history.push(record);
    this.saveHistory();
    return record;
  }

  getTransitionCount(fromPersona, toPersona) {
    const from = (fromPersona || 'UNKNOWN').toUpperCase();
    const to = (toPersona || 'UNKNOWN').toUpperCase();

    return this.history.filter(
      (rec) => rec.fromPersona === from && rec.toPersona === to
    ).length;
  }

  detectLoop(fromPersona, toPersona) {
    const count = this.getTransitionCount(fromPersona, toPersona);
    return count >= this.maxTransitions;
  }

  clearHistory() {
    this.history = [];
    if (fs.existsSync(this.historyFile)) {
      try {
        fs.unlinkSync(this.historyFile);
      } catch (err) {
        this.logger.warn(`Failed to delete history file: ${err.message}`);
      }
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
      fs.writeFileSync(
        this.historyFile,
        JSON.stringify(this.history, null, 2),
        'utf8'
      );
    } catch (err) {
      this.logger.error(`Failed to save transition history: ${err.message}`);
    }
  }
}

module.exports = LoopDetector;
