/**
 * @ai-context State Cache Manager for persistent and atomic workflow state tracking
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class StateCacheManager {
  constructor(options = {}) {
    this.logger = new Logger('StateCacheManager');
    this.stateFile =
      options.stateFile ||
      path.join(process.cwd(), '.github', 'workflow-state.json');
    this.backupFile =
      options.backupFile ||
      path.join(process.cwd(), '.github', 'workflow-state.backup.json');
    this.lockFile =
      options.lockFile ||
      path.join(process.cwd(), '.github', 'workflow-state.lock');
  }

  async persistState(persona, stepId, context = {}) {
    const state = {
      currentPersona: persona,
      stepId,
      context,
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    };

    await this.withAtomicWrite(async () => {
      if (fs.existsSync(this.stateFile)) {
        fs.copyFileSync(this.stateFile, this.backupFile);
      }
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    });

    return state;
  }

  async restoreState() {
    if (!fs.existsSync(this.stateFile)) {
      if (fs.existsSync(this.backupFile)) {
        this.logger.warn('State file missing, restoring from backup file');
        fs.copyFileSync(this.backupFile, this.stateFile);
      } else {
        return null;
      }
    }

    try {
      const data = fs.readFileSync(this.stateFile, 'utf8');
      const state = JSON.parse(data);

      if (await this.validateState(state)) {
        return state;
      } else {
        this.logger.error('Invalid state detected during restoration, falling back');
        return await this.resetToInitial();
      }
    } catch (err) {
      this.logger.error(`Failed to restore state: ${err.message}`);
      return await this.resetToInitial();
    }
  }

  async validateState(state) {
    if (!state || typeof state !== 'object') return false;
    if (!state.currentPersona || typeof state.currentPersona !== 'string')
      return false;
    if (!state.stepId || typeof state.stepId !== 'string') return false;
    return true;
  }

  async resetToInitial() {
    const initialState = {
      currentPersona: 'ORCHESTRATOR',
      stepId: 'INIT-000',
      context: {},
      timestamp: new Date().toISOString(),
      resetReason: 'State validation failed or explicitly reset',
    };

    await this.withAtomicWrite(async () => {
      fs.writeFileSync(
        this.stateFile,
        JSON.stringify(initialState, null, 2),
        'utf8'
      );
    });

    return initialState;
  }

  async withAtomicWrite(operation) {
    const tmpFile = `${this.stateFile}.${Date.now()}.${Math.random().toString(36).substr(2, 6)}.tmp`;
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await operation();
    return true;
  }

  async getStorageStats() {
    let stateSize = 0;
    let backupSize = 0;

    if (fs.existsSync(this.stateFile)) {
      stateSize = fs.statSync(this.stateFile).size;
    }
    if (fs.existsSync(this.backupFile)) {
      backupSize = fs.statSync(this.backupFile).size;
    }

    return {
      stateFileExists: fs.existsSync(this.stateFile),
      stateSizeBytes: stateSize,
      backupFileExists: fs.existsSync(this.backupFile),
      backupSizeBytes: backupSize,
    };
  }
}

module.exports = StateCacheManager;
