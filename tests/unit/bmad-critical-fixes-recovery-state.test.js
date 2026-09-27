const fs = require('fs');
const os = require('os');
const path = require('path');
const fc = require('fast-check');
const ErrorRecoveryManager = require('../../scripts/lib/error-recovery-manager');
const StateCacheManager = require('../../scripts/lib/state-cache-manager');

describe('Critical fixes recovery and state properties', () => {
  let tempDir;
  let stateFile;
  let manager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-state-'));
    stateFile = path.join(tempDir, 'state.json');
    manager = new StateCacheManager({
      stateFile,
      backupFile: path.join(tempDir, 'backup.json'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Property 16: escalates with full context after retries are exhausted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER'),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (persona, operation) => {
          const recovery = new ErrorRecoveryManager({
            maxRetries: 2,
            initialDelay: 0,
            maxDelay: 0,
            stateCache: manager,
          });
          const result = await recovery.handleError(new Error('temporary'), persona, {
            operation,
            stepId: 'STEP-001',
            category: 'UNREGISTERED',
          });
          expect(result.status).toBe('suspended');
          expect(result.context).toEqual(
            expect.objectContaining({ persona, operation, retryCount: 2 })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 17: activates registered remediation with complete context', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 30 }), async (message) => {
        const remediation = jest.fn().mockResolvedValue({ success: true });
        const recovery = new ErrorRecoveryManager({
          stateCache: manager,
          remediations: { TRANSIENT: remediation },
        });
        const result = await recovery.escalateToRecovery(new Error(message), {
          persona: 'QA',
          operation: 'test',
          retryCount: 2,
          category: 'TRANSIENT',
        });
        expect(recovery.recoveryPersonaActive).toBe(true);
        expect(result.status).toBe('remediated');
        expect(remediation).toHaveBeenCalledWith(
          expect.objectContaining({ persona: 'QA', errorMessage: message })
        );
      }),
      { numRuns: 100 }
    );
  });

  test('Property 18: persists and suspends when remediation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((value) => value.trim()),
        async (stepId) => {
        const recovery = new ErrorRecoveryManager({
          stateCache: manager,
          remediations: { FAILURE: async () => ({ success: false, action: 'retry' }) },
        });
        const result = await recovery.escalateToRecovery(new Error('failed'), {
          persona: 'DEVELOPER',
          operation: 'build',
          stepId,
          category: 'FAILURE',
          context: { artifact: 'src/index.js' },
        });
        expect(result.status).toBe('suspended');
        expect(result.remediationSteps).toHaveLength(1);
        expect((await manager.restoreState()).stepId).toBe(stepId);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 19: restores the exact active recovery step', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PM', 'ARCHITECT', 'QA'),
        fc.string({ minLength: 1, maxLength: 20 }).filter((value) => value.trim()),
        async (persona, stepId) => {
          await manager.persistState(persona, stepId, { value: 1 });
          const recovery = new ErrorRecoveryManager({ stateCache: manager });
          expect(await recovery.resume()).toEqual(
            expect.objectContaining({ currentPersona: persona, stepId })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 20: persists persona, step and serializable context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PM', 'ARCHITECT', 'DEVELOPER', 'QA'),
        fc.string({ minLength: 1, maxLength: 30 }).filter((value) => value.trim()),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.jsonValue()),
        async (persona, stepId, context) => {
          await manager.persistState(persona, stepId, context);
          const restored = await new StateCacheManager({
            stateFile,
            backupFile: path.join(tempDir, 'backup.json'),
          }).restoreState();
          expect(restored).toEqual(expect.objectContaining({
            currentPersona: persona,
            stepId,
            context: JSON.parse(JSON.stringify(context)),
          }));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 21: detects and reloads valid prior-run state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((value) => value.trim()),
        async (stepId) => {
        await manager.persistState('QA', stepId, { resumed: true });
        const restarted = new StateCacheManager({
          stateFile,
          backupFile: path.join(tempDir, 'backup.json'),
        });
        expect(await restarted.restoreState()).toEqual(
          expect.objectContaining({ currentPersona: 'QA', stepId })
        );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 22: validates registered persona, step and context', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (valid) => {
        const state = valid
          ? { currentPersona: 'PM', stepId: 'STEP-1', context: {} }
          : { currentPersona: 'ALIEN', stepId: '', context: [] };
        expect(await manager.validateState(state)).toBe(valid);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 23: resets explicitly when persisted state is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (invalidContext) => {
        fs.writeFileSync(
          stateFile,
          JSON.stringify({ currentPersona: 'INVALID', stepId: '', context: invalidContext })
        );
        const restored = await manager.restoreState();
        expect(restored).toEqual(
          expect.objectContaining({
            currentPersona: 'ORCHESTRATOR',
            stepId: 'INIT-000',
            status: 'reset',
          })
        );
      }),
      { numRuns: 100 }
    );
  });

  test('Property 24: failed atomic replacement leaves prior state intact', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((value) => value.trim()),
        async (stepId) => {
        await manager.persistState('PM', 'OLD', { stable: true });
        const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
          throw new Error('interrupted');
        });
        await expect(manager.persistState('PM', stepId, { stable: false })).rejects.toThrow(
          'State persistence failed'
        );
        rename.mockRestore();
        expect(JSON.parse(fs.readFileSync(stateFile, 'utf8'))).toEqual(
          expect.objectContaining({ stepId: 'OLD', context: { stable: true } })
        );
        }
      ),
      { numRuns: 100 }
    );
  });
});
