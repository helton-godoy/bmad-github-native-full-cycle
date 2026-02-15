/**
 * Unit Tests for Context Synchronizer - Edge Cases and Error Handling
 * Tests edge cases, error recovery, and boundary conditions
 * Requirements: 5.4, 7.3
 */

const ContextSynchronizer = require('../../scripts/hooks/context-synchronizer');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../scripts/lib/logger');
jest.mock('../../scripts/lib/context-manager');

describe('Context Synchronizer - Edge Cases', () => {
    let contextSynchronizer;
    let mockExecSync;
    let mockFs;
    let mockContextManager;

    beforeEach(() => {
        jest.clearAllMocks();

        mockExecSync = require('child_process').execSync;
        mockFs = require('fs');
        mockContextManager = require('../../scripts/lib/context-manager');

        // Default mock implementations
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('# Active Context\n**Persona:** DEVELOPER\n**Step ID:** STEP-001');
        mockFs.writeFileSync.mockImplementation(() => { });
        mockExecSync.mockReturnValue('file1.js\nfile2.js');

        mockContextManager.mockImplementation(() => ({
            read: jest.fn().mockResolvedValue('# Active Context\n**Persona:** DEVELOPER\n**Step ID:** STEP-001'),
            write: jest.fn().mockResolvedValue('abc123def456'),
            withLock: jest.fn().mockImplementation((lockName, operation) => operation())
        }));

        contextSynchronizer = new ContextSynchronizer({
            autoUpdate: true,
            validateConsistency: true,
            trackPersonaTransitions: true
        });
    });

    describe('Input Validation', () => {
        test('should handle null persona', async () => {
            const result = await contextSynchronizer.syncPersonaState(null, 'STEP-001');

            expect(result).toBeDefined();
            expect(result.results.personaValidation.valid).toBe(false);
            expect(result.results.personaValidation.errors).toContain('Persona is required');
        });

        test('should handle undefined persona', async () => {
            const result = await contextSynchronizer.syncPersonaState(undefined, 'STEP-001');

            expect(result).toBeDefined();
            expect(result.results.personaValidation.valid).toBe(false);
        });

        test('should handle empty persona', async () => {
            const result = await contextSynchronizer.syncPersonaState('', 'STEP-001');

            expect(result).toBeDefined();
            expect(result.results.personaValidation.valid).toBe(false);
        });

        test('should handle null step ID', async () => {
            const result = await contextSynchronizer.syncPersonaState('DEVELOPER', null);

            expect(result).toBeDefined();
            expect(result.stepId).toBeNull();
        });

        test('should handle invalid persona name', async () => {
            const result = await contextSynchronizer.syncPersonaState('INVALID_PERSONA', 'STEP-001');

            expect(result).toBeDefined();
            expect(result.results.personaValidation.valid).toBe(false);
            expect(result.results.personaValidation.errors).toContain('Invalid persona: INVALID_PERSONA');
        });

        test('should handle lowercase persona', async () => {
            const result = await contextSynchronizer.syncPersonaState('developer', 'STEP-001');

            expect(result).toBeDefined();
            // Should either reject or normalize to uppercase
            expect(result.results.personaValidation).toBeDefined();
        });
    });

    describe('File System Error Handling', () => {
        test('should handle missing context file', async () => {
            mockFs.existsSync.mockReturnValue(false);
            mockContextManager().read.mockRejectedValue(new Error('File not found'));

            const result = await contextSynchronizer.validateContextConsistency();

            expect(result).toBeDefined();
            expect(result.consistent).toBe(false);
            expect(result.results.contextFileExists).toBe(false);
        });

        test('should handle context file read errors', async () => {
            mockContextManager().read.mockRejectedValue(new Error('Permission denied'));

            const result = await contextSynchronizer.updateActiveContext({
                message: 'Test commit',
                persona: 'DEVELOPER',
                stepId: 'STEP-001'
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle context file write errors', async () => {
            mockContextManager().write.mockRejectedValue(new Error('Write failed'));

            const result = await contextSynchronizer.updateActiveContext({
                message: 'Test commit',
                persona: 'DEVELOPER',
                stepId: 'STEP-001'
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(false);
        });

        test('should handle lock acquisition failures', async () => {
            mockContextManager().withLock.mockRejectedValue(new Error('Lock timeout'));

            const result = await contextSynchronizer.syncPersonaState('DEVELOPER', 'STEP-001');

            expect(result).toBeDefined();
            // Should handle lock failure gracefully
            expect(result.results).toBeDefined();
        });
    });

    describe('Git Command Error Handling', () => {
        test('should handle git command failures', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('Git command failed');
            });

            const result = await contextSynchronizer.validateContextConsistency();

            expect(result).toBeDefined();
            expect(result.consistent).toBeDefined();
            // Should handle git errors gracefully
        });

        test('should handle empty git output', async () => {
            mockExecSync.mockReturnValue('');

            const files = contextSynchronizer.getChangedFiles();

            expect(files).toEqual([]);
        });

        test('should handle git not available', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('git: command not found');
            });

            const files = contextSynchronizer.getChangedFiles();

            expect(files).toEqual([]);
        });
    });

    describe('Persona Extraction', () => {
        test('should extract persona from valid message', () => {
            const persona = contextSynchronizer.extractPersonaFromMessage('[DEVELOPER] [STEP-001] Test');

            expect(persona).toBe('DEVELOPER');
        });

        test('should return null for invalid message format', () => {
            const persona = contextSynchronizer.extractPersonaFromMessage('Invalid message');

            expect(persona).toBeNull();
        });

        test('should return null for empty message', () => {
            const persona = contextSynchronizer.extractPersonaFromMessage('');

            expect(persona).toBeNull();
        });

        test('should return null for null message', () => {
            const persona = contextSynchronizer.extractPersonaFromMessage(null);

            expect(persona).toBeNull();
        });

        test('should extract persona from context content', () => {
            const content = '**Persona:** ARCHITECT\n**Step ID:** ARCH-042';
            const persona = contextSynchronizer.extractPersonaFromContext(content);

            expect(persona).toBe('ARCHITECT');
        });

        test('should return null for missing persona in context', () => {
            const content = '**Step ID:** STEP-001';
            const persona = contextSynchronizer.extractPersonaFromContext(content);

            expect(persona).toBeNull();
        });
    });

    describe('Step ID Extraction', () => {
        test('should extract step ID from valid message', () => {
            const stepId = contextSynchronizer.extractStepIdFromMessage('[DEVELOPER] [STEP-001] Test');

            expect(stepId).toBe('STEP-001');
        });

        test('should return null for invalid message format', () => {
            const stepId = contextSynchronizer.extractStepIdFromMessage('Invalid message');

            expect(stepId).toBeNull();
        });

        test('should return null for empty message', () => {
            const stepId = contextSynchronizer.extractStepIdFromMessage('');

            expect(stepId).toBeNull();
        });

        test('should handle various step ID formats', () => {
            const formats = [
                { message: '[DEVELOPER] [STEP-001] Test', expected: 'STEP-001' },
                { message: '[ARCHITECT] [ARCH-042] Test', expected: 'ARCH-042' },
                { message: '[QA] [TEST-123] Test', expected: 'TEST-123' }
            ];

            formats.forEach(({ message, expected }) => {
                const stepId = contextSynchronizer.extractStepIdFromMessage(message);
                expect(stepId).toBe(expected);
            });
        });
    });

    describe('Workflow Phase Determination', () => {
        test('should determine workflow phase from persona', () => {
            const phases = [
                { persona: 'PM', expected: 'planning' },
                { persona: 'ARCHITECT', expected: 'design' },
                { persona: 'DEVELOPER', expected: 'implementation' },
                { persona: 'QA', expected: 'testing' },
                { persona: 'DEVOPS', expected: 'deployment' },
                { persona: 'RELEASE', expected: 'release' }
            ];

            phases.forEach(({ persona, expected }) => {
                const phase = contextSynchronizer.determineWorkflowPhase({ persona });
                expect(phase).toBe(expected);
            });
        });

        test('should handle unknown persona', () => {
            const phase = contextSynchronizer.determineWorkflowPhase({ persona: 'UNKNOWN' });

            expect(phase).toBe('unknown');
        });

        test('should handle missing persona', () => {
            const phase = contextSynchronizer.determineWorkflowPhase({});

            expect(phase).toBe('unknown');
        });
    });

    describe('Commit Summary Generation', () => {
        test('should generate summary from commit info', () => {
            const commitInfo = {
                message: '[DEVELOPER] [STEP-001] Implement feature X',
                persona: 'DEVELOPER',
                stepId: 'STEP-001',
                changedFiles: ['file1.js', 'file2.js']
            };

            const summary = contextSynchronizer.generateCommitSummary(commitInfo);

            expect(summary).toBeDefined();
            expect(typeof summary).toBe('string');
            expect(summary.length).toBeGreaterThan(0);
            expect(summary).toContain('DEVELOPER');
            expect(summary).toContain('STEP-001');
        });

        test('should handle minimal commit info', () => {
            const commitInfo = {
                message: 'Simple commit'
            };

            const summary = contextSynchronizer.generateCommitSummary(commitInfo);

            expect(summary).toBeDefined();
            expect(typeof summary).toBe('string');
        });

        test('should handle empty commit info', () => {
            const summary = contextSynchronizer.generateCommitSummary({});

            expect(summary).toBeDefined();
            expect(typeof summary).toBe('string');
        });
    });

    describe('Context Update Generation', () => {
        test('should generate updated context', () => {
            const existingContext = '# Active Context\n**Persona:** DEVELOPER\n**Step ID:** STEP-001';
            const contextUpdate = {
                persona: 'QA',
                stepId: 'TEST-001',
                workflowPhase: 'testing',
                summary: 'Testing phase started'
            };

            const updated = contextSynchronizer.generateUpdatedContext(existingContext, contextUpdate);

            expect(updated).toBeDefined();
            expect(updated).toContain('QA');
            expect(updated).toContain('TEST-001');
            expect(updated).toContain('testing');
        });

        test('should handle empty existing context', () => {
            const contextUpdate = {
                persona: 'DEVELOPER',
                stepId: 'STEP-001',
                workflowPhase: 'implementation',
                summary: 'New context'
            };

            const updated = contextSynchronizer.generateUpdatedContext('', contextUpdate);

            expect(updated).toBeDefined();
            expect(updated).toContain('DEVELOPER');
        });

        test('should preserve previous entries', () => {
            const existingContext = `# Active Context
**Persona:** DEVELOPER
**Step ID:** STEP-001

## Previous Commits
- [DEVELOPER] [STEP-001] Previous work`;

            const contextUpdate = {
                persona: 'DEVELOPER',
                stepId: 'STEP-002',
                workflowPhase: 'implementation',
                summary: 'Continued work'
            };

            const updated = contextSynchronizer.generateUpdatedContext(existingContext, contextUpdate);

            expect(updated).toContain('Previous work');
        });
    });

    describe('Persona Validation', () => {
        test('should validate valid personas', () => {
            const validPersonas = ['DEVELOPER', 'ARCHITECT', 'PM', 'QA', 'DEVOPS', 'SECURITY', 'RELEASE', 'RECOVERY', 'ORCHESTRATOR'];

            validPersonas.forEach(persona => {
                const result = contextSynchronizer.validatePersona(persona);
                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });

        test('should reject invalid personas', () => {
            const invalidPersonas = ['INVALID', 'TESTER', 'ADMIN', ''];

            invalidPersonas.forEach(persona => {
                const result = contextSynchronizer.validatePersona(persona);
                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
            });
        });

        test('should reject null persona', () => {
            const result = contextSynchronizer.validatePersona(null);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Persona is required');
        });

        test('should reject undefined persona', () => {
            const result = contextSynchronizer.validatePersona(undefined);

            expect(result.valid).toBe(false);
        });
    });

    describe('Persona Transition Validation', () => {
        test('should validate valid transitions', async () => {
            mockContextManager().read.mockResolvedValue('**Persona:** PM\n**Step ID:** STEP-001');

            const result = await contextSynchronizer.validatePersonaTransition('ARCHITECT');

            expect(result).toBeDefined();
            expect(result.valid).toBe(true);
        });

        test('should reject invalid transitions', async () => {
            mockContextManager().read.mockResolvedValue('**Persona:** DEVELOPER\n**Step ID:** STEP-001');

            const result = await contextSynchronizer.validatePersonaTransition('PM');

            expect(result).toBeDefined();
            expect(result.valid).toBe(false);
        });

        test('should handle missing current persona', async () => {
            mockContextManager().read.mockResolvedValue('**Step ID:** STEP-001');

            const result = await contextSynchronizer.validatePersonaTransition('DEVELOPER');

            expect(result).toBeDefined();
            // Should handle gracefully
        });

        test('should handle context read errors', async () => {
            mockContextManager().read.mockRejectedValue(new Error('Read failed'));

            const result = await contextSynchronizer.validatePersonaTransition('DEVELOPER');

            expect(result).toBeDefined();
            expect(result.valid).toBe(false);
        });
    });

    describe('Consistency Validation', () => {
        test('should validate consistent context', async () => {
            const consistentContext = `# Active Context
**Persona:** DEVELOPER
**Step ID:** STEP-001
**Workflow Phase:** implementation
**Last Updated:** 2024-01-01T00:00:00Z`;

            mockContextManager().read.mockResolvedValue(consistentContext);
            mockExecSync.mockReturnValue('[DEVELOPER] [STEP-001] Recent work');

            const result = await contextSynchronizer.validateContextConsistency();

            expect(result).toBeDefined();
            expect(result.consistent).toBe(true);
            expect(result.results).toBeDefined();
        });

        test('should detect inconsistent persona', async () => {
            const inconsistentContext = `# Active Context
**Persona:** DEVELOPER
**Step ID:** STEP-001`;

            mockContextManager().read.mockResolvedValue(inconsistentContext);
            mockExecSync.mockReturnValue('[QA] [TEST-001] Testing work');

            const result = await contextSynchronizer.validateContextConsistency();

            expect(result).toBeDefined();
            expect(result.consistent).toBe(false);
        });

        test('should provide recommendations for inconsistencies', async () => {
            mockContextManager().read.mockResolvedValue('');
            mockFs.existsSync.mockReturnValue(false);

            const result = await contextSynchronizer.validateContextConsistency();

            expect(result).toBeDefined();
            expect(result.recommendations).toBeDefined();
            expect(result.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('BMAD Handover Synchronization', () => {
        test('should sync handover successfully', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue('# BMAD Handover\n**From:** PM\n**To:** ARCHITECT');

            const result = await contextSynchronizer.syncBMADHandover('ARCHITECT', 'ARCH-001');

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        test('should handle missing handover file', async () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = await contextSynchronizer.syncBMADHandover('DEVELOPER', 'STEP-001');

            expect(result).toBeDefined();
            // Should handle gracefully
        });

        test('should handle handover write errors', async () => {
            mockFs.writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const result = await contextSynchronizer.syncBMADHandover('DEVELOPER', 'STEP-001');

            expect(result).toBeDefined();
            expect(result.success).toBe(false);
        });
    });

    describe('Edge Cases in Context Parsing', () => {
        test('should handle malformed context content', () => {
            const malformedContent = 'Random text without proper format';
            const persona = contextSynchronizer.extractPersonaFromContext(malformedContent);

            expect(persona).toBeNull();
        });

        test('should handle context with extra whitespace', () => {
            const content = '  **Persona:**   DEVELOPER  \n  **Step ID:**   STEP-001  ';
            const persona = contextSynchronizer.extractPersonaFromContext(content);

            expect(persona).toBe('DEVELOPER');
        });

        test('should handle context with different line endings', () => {
            const content = '**Persona:** DEVELOPER\r\n**Step ID:** STEP-001\r\n';
            const persona = contextSynchronizer.extractPersonaFromContext(content);

            expect(persona).toBe('DEVELOPER');
        });

        test('should handle context with unicode characters', () => {
            const content = '**Persona:** DEVELOPER 🚀\n**Step ID:** STEP-001';
            const persona = contextSynchronizer.extractPersonaFromContext(content);

            expect(persona).toBe('DEVELOPER 🚀');
        });
    });

    describe('Concurrent Operations', () => {
        test('should handle concurrent update attempts', async () => {
            const commitInfo = {
                message: 'Test commit',
                persona: 'DEVELOPER',
                stepId: 'STEP-001'
            };

            // Simulate concurrent updates
            const updates = [
                contextSynchronizer.updateActiveContext(commitInfo),
                contextSynchronizer.updateActiveContext(commitInfo),
                contextSynchronizer.updateActiveContext(commitInfo)
            ];

            const results = await Promise.all(updates);

            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
            });
        });

        test('should handle concurrent persona state syncs', async () => {
            const syncs = [
                contextSynchronizer.syncPersonaState('DEVELOPER', 'STEP-001'),
                contextSynchronizer.syncPersonaState('DEVELOPER', 'STEP-002'),
                contextSynchronizer.syncPersonaState('DEVELOPER', 'STEP-003')
            ];

            const results = await Promise.all(syncs);

            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.persona).toBe('DEVELOPER');
            });
        });
    });

    describe('Memory and Resource Management', () => {
        test('should handle large context files', async () => {
            const largeContext = '# Active Context\n' + 'A'.repeat(100000);
            mockContextManager().read.mockResolvedValue(largeContext);

            const result = await contextSynchronizer.validateContextConsistency();

            expect(result).toBeDefined();
        });

        test('should handle many changed files', () => {
            const manyFiles = Array.from({ length: 1000 }, (_, i) => `file${i}.js`).join('\n');
            mockExecSync.mockReturnValue(manyFiles);

            const files = contextSynchronizer.getChangedFiles();

            expect(files).toBeDefined();
            expect(files.length).toBe(1000);
        });
    });
});
