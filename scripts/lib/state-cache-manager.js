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
    this.registeredPersonas = (options.registeredPersonas || [
      'ORCHESTRATOR', 'PM', 'ARCHITECT', 'DEVELOPER', 'QA', 'SECURITY',
      'DEVOPS', 'RELEASEMANAGER', 'RECOVERY',
    ]).map((persona) => persona.toUpperCase());
    this.maxContextBytes = options.maxContextBytes ?? 1024 * 1024;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 2000;
    this.staleLockMs = options.staleLockMs ?? 30000;
  }

  async persistState(persona, stepId, context = {}, metadata = {}) {
    const state = {
      workflowId: metadata.workflowId || context.workflowId || 'default',
      currentPersona: persona,
      persona,
      stepId,
      context,
      status: metadata.status || 'running',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    };
    if (!(await this.validateState(state))) {
      throw new Error('State validation failed before persistence');
    }
    await this.atomicWrite(state);

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
      if (fs.existsSync(this.backupFile)) {
        try {
          const backup = JSON.parse(fs.readFileSync(this.backupFile, 'utf8'));
          if (await this.validateState(backup)) {
            await this.atomicWrite(backup);
            return backup;
          }
        } catch (backupError) {
          this.logger.error(`Backup restoration failed: ${backupError.message}`);
        }
      }
      return await this.resetToInitial();
    }
  }

  async validateState(state) {
    if (!state || typeof state !== 'object') return false;
    const persona = state.currentPersona || state.persona;
    if (!persona || typeof persona !== 'string') return false;
    if (!this.registeredPersonas.includes(persona.toUpperCase())) return false;
    if (!state.stepId || typeof state.stepId !== 'string') return false;
    if (!state.stepId.trim()) return false;
    if (!state.context || typeof state.context !== 'object' || Array.isArray(state.context))
      return false;
    try {
      if (Buffer.byteLength(JSON.stringify(state.context), 'utf8') > this.maxContextBytes)
        return false;
    } catch (error) {
      return false;
    }
    return true;
  }

  async resetToInitial() {
    const initialState = {
      currentPersona: 'ORCHESTRATOR',
      persona: 'ORCHESTRATOR',
      workflowId: 'default',
      stepId: 'INIT-000',
      context: {},
      status: 'reset',
      timestamp: new Date().toISOString(),
      resetReason: 'State validation failed or explicitly reset',
    };

    await this.atomicWrite(initialState);

    return initialState;
  }

  async atomicWrite(state) {
    const payload = JSON.stringify(state, null, 2);
    const dir = path.dirname(this.stateFile);
    fs.mkdirSync(dir, { recursive: true });
    const tmpFile = path.join(
      dir,
      `.${path.basename(this.stateFile)}.${process.pid}.${Date.now()}.tmp`
    );
    const release = this.acquireLock();
    try {
      fs.writeFileSync(tmpFile, payload, { encoding: 'utf8', mode: 0o600 });
      const fd = fs.openSync(tmpFile, 'r');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (fs.existsSync(this.stateFile)) {
        fs.copyFileSync(this.stateFile, this.backupFile);
      }
      fs.renameSync(tmpFile, this.stateFile);
      return true;
    } catch (error) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean temporary state: ${cleanupError.message}`);
      }
      throw new Error(`State persistence failed: ${error.message}`);
    } finally {
      release();
    }
  }

  acquireLock() {
    const started = Date.now();
    fs.mkdirSync(path.dirname(this.lockFile), { recursive: true });
    for (let attempt = 0; attempt < 100000; attempt += 1) {
      try {
        const fd = fs.openSync(this.lockFile, 'wx', 0o600);
        fs.writeFileSync(fd, `${process.pid}:${Date.now()}`);
        fs.closeSync(fd);
        return () => {
          try {
            fs.unlinkSync(this.lockFile);
          } catch (error) {
            if (error.code !== 'ENOENT') this.logger.warn(`Lock release failed: ${error.message}`);
          }
        };
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          if (Date.now() - fs.statSync(this.lockFile).mtimeMs > this.staleLockMs) {
            fs.unlinkSync(this.lockFile);
            continue;
          }
        } catch (statError) {
          if (statError.code !== 'ENOENT') throw statError;
          continue;
        }
        if (Date.now() - started >= this.lockTimeoutMs) {
          throw new Error(`State lock timeout after ${this.lockTimeoutMs}ms`);
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }
    throw new Error(`State lock timeout after ${this.lockTimeoutMs}ms`);
  }

  async withAtomicWrite(operation) {
    return operation();
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
