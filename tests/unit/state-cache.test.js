/**
 * Property-Based Tests for State Cache Manager
 * **Feature: bmad-critical-fixes**
 *
 * Properties:
 * - Property 20: State Persistence
 * - Property 24: Atomic State Operations
 * - Property 21: State Restoration on Restart
 * - Property 22: State Validation
 * - Property 23: Invalid State Fallback
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const fc = require('fast-check');
const StateCacheManager = require('../../scripts/lib/state-cache-manager');

describe('StateCacheManager Property Tests', () => {
  let tmpDir;
  let cacheManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-state-test-'));
    cacheManager = new StateCacheManager({
      stateFile: path.join(tmpDir, 'state.json'),
      backupFile: path.join(tmpDir, 'state.backup.json'),
      lockFile: path.join(tmpDir, 'state.lock'),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  describe('Property 20: State Persistence', () => {
    test('should persist and restore state correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'ORCHESTRATOR'),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[A-Z0-9-]+$/.test(s)),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ minLength: 0, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
          async (persona, stepId, context) => {
            const persisted = await cacheManager.persistState(persona, stepId, context);
            expect(persisted.currentPersona).toBe(persona);
            expect(persisted.stepId).toBe(stepId);
            expect(persisted.context).toEqual(context);
            expect(persisted.timestamp).toBeTruthy();
            expect(persisted.version).toBe('2.0.0');
            expect(fs.existsSync(cacheManager.stateFile)).toBe(true);
            const restored = await cacheManager.restoreState();
            expect(restored.currentPersona).toBe(persona);
            expect(restored.stepId).toBe(stepId);
            expect(restored.context).toEqual(context);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should create backup before overwriting existing state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z0-9-]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z0-9-]+$/.test(s)),
          async (step1, step2) => {
            await cacheManager.persistState('PM', step1, { phase: 'planning' });
            await cacheManager.persistState('ARCHITECT', step2, { phase: 'design' });
            expect(fs.existsSync(cacheManager.backupFile)).toBe(true);
            const backupState = JSON.parse(fs.readFileSync(cacheManager.backupFile, 'utf8'));
            expect(backupState.stepId).toBe(step1);
            expect(backupState.currentPersona).toBe('PM');
            const currentState = JSON.parse(fs.readFileSync(cacheManager.stateFile, 'utf8'));
            expect(currentState.stepId).toBe(step2);
            expect(currentState.currentPersona).toBe('ARCHITECT');
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 24: Atomic State Operations', () => {
    test('should maintain valid state after multiple sequential atomic writes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({ persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA'), stepId: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[A-Z0-9-]+$/.test(s)) }),
            { minLength: 1, maxLength: 10 }
          ),
          async (operations) => {
            for (const op of operations) {
              await cacheManager.persistState(op.persona, op.stepId, {});
            }
            const content = fs.readFileSync(cacheManager.stateFile, 'utf8');
            let state;
            expect(() => { state = JSON.parse(content); }).not.toThrow();
            expect(state.currentPersona).toBeTruthy();
            expect(state.stepId).toBeTruthy();
            expect(state.version).toBe('2.0.0');
            const lastOp = operations[operations.length - 1];
            expect(state.currentPersona).toBe(lastOp.persona);
            expect(state.stepId).toBe(lastOp.stepId);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 21: State Restoration on Restart', () => {
    test('should restore the last persisted state on restart', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({ persona: fc.constantFrom('DEVELOPER', 'ARCHITECT', 'PM', 'QA'), stepId: fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[A-Z0-9-]+$/.test(s)), contextKey: fc.string({ minLength: 1, maxLength: 10 }), contextValue: fc.string({ minLength: 1, maxLength: 20 }) }),
          async (data) => {
            const context = { [data.contextKey]: data.contextValue };
            await cacheManager.persistState(data.persona, data.stepId, context);
            const newManager = new StateCacheManager({ stateFile: cacheManager.stateFile, backupFile: cacheManager.backupFile, lockFile: cacheManager.lockFile });
            const restored = await newManager.restoreState();
            expect(restored.currentPersona).toBe(data.persona);
            expect(restored.stepId).toBe(data.stepId);
            expect(restored.context[data.contextKey]).toBe(data.contextValue);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should restore from backup file when state file is missing', async () => {
      // Persist twice to ensure a backup exists (backup created only when state file exists)
      await cacheManager.persistState('INIT', 'START-000', { phase: 'init' });
      await cacheManager.persistState('DEVELOPER', 'DEV-001', { task: 'implement' });

      fs.unlinkSync(cacheManager.stateFile);
      expect(fs.existsSync(cacheManager.stateFile)).toBe(false);
      expect(fs.existsSync(cacheManager.backupFile)).toBe(true);
      const restored = await cacheManager.restoreState();
      expect(restored).not.toBeNull();
      // Backup contains the state before the second persist
      expect(restored.currentPersona).toBe('INIT');
      expect(restored.stepId).toBe('START-000');
      expect(fs.existsSync(cacheManager.stateFile)).toBe(true);
    });

    test('should return null when no state or backup exists', async () => {
      const freshManager = new StateCacheManager({ stateFile: path.join(tmpDir, 'nonexistent.json'), backupFile: path.join(tmpDir, 'nonexistent.backup.json') });
      const result = await freshManager.restoreState();
      expect(result).toBeNull();
    });
  });

  describe('Property 22: State Validation', () => {
    test('should validate correct states and reject invalid ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          async (currentPersona, stepId) => {
            const testState = { currentPersona, stepId, context: {}, timestamp: new Date().toISOString() };
            const isValid = await cacheManager.validateState(testState);
            const expectedValid = typeof currentPersona === 'string' && currentPersona.length > 0 && typeof stepId === 'string' && stepId.length > 0;
            expect(isValid).toBe(expectedValid);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should reject null and undefined states', async () => {
      expect(await cacheManager.validateState(null)).toBe(false);
      expect(await cacheManager.validateState(undefined)).toBe(false);
    });

    test('should reject states with missing required fields', async () => {
      expect(await cacheManager.validateState({ stepId: 'TEST-001', context: {} })).toBe(false);
      expect(await cacheManager.validateState({ currentPersona: 'TEST', context: {} })).toBe(false);
      expect(await cacheManager.validateState({ currentPersona: '', stepId: 'TEST-001', context: {} })).toBe(false);
      expect(await cacheManager.validateState({ currentPersona: 'TEST', stepId: '', context: {} })).toBe(false);
    });
  });

  describe('Property 23: Invalid State Fallback', () => {
    test('should reset to initial state when restored state is invalid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({ stepId: fc.string({ minLength: 1, maxLength: 10 }), contextKey: fc.string({ minLength: 1, maxLength: 10 }), contextValue: fc.string({ minLength: 1, maxLength: 20 }) }),
          async (data) => {
            const invalidState = { stepId: data.stepId, context: { [data.contextKey]: data.contextValue }, timestamp: new Date().toISOString(), version: '2.0.0' };
            fs.writeFileSync(cacheManager.stateFile, JSON.stringify(invalidState), 'utf8');
            const restored = await cacheManager.restoreState();
            expect(restored).not.toBeNull();
            expect(restored.currentPersona).toBe('ORCHESTRATOR');
            expect(restored.stepId).toBe('INIT-000');
            expect(restored.resetReason).toBe('State validation failed or explicitly reset');
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should fall back to initial state when JSON parsing fails', async () => {
      fs.writeFileSync(cacheManager.stateFile, 'not valid json {{{', 'utf8');
      const restored = await cacheManager.restoreState();
      expect(restored).not.toBeNull();
      expect(restored.currentPersona).toBe('ORCHESTRATOR');
      expect(restored.stepId).toBe('INIT-000');
    });

    test('should fall back to initial state when both state and backup are invalid', async () => {
      fs.writeFileSync(cacheManager.stateFile, '{invalid}', 'utf8');
      fs.writeFileSync(cacheManager.backupFile, '{also invalid}', 'utf8');
      const restored = await cacheManager.restoreState();
      expect(restored).not.toBeNull();
      expect(restored.currentPersona).toBe('ORCHESTRATOR');
      expect(restored.stepId).toBe('INIT-000');
    });
  });
});
