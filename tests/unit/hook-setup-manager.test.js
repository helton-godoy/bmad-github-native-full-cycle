/**
 * Unit tests for HookSetupManager
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const HookSetupManager = require('../../scripts/hooks/hook-setup-manager');

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');
jest.mock('../../scripts/lib/logger');

describe('HookSetupManager', () => {
    let manager;
    let mockProjectRoot;
    let mockHuskyPath;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock paths
        mockProjectRoot = '/mock/project';
        mockHuskyPath = path.join(mockProjectRoot, '.husky');

        // Create manager instance
        manager = new HookSetupManager({
            projectRoot: mockProjectRoot,
            verbose: false
        });

        // Mock process.cwd()
        jest.spyOn(process, 'cwd').mockReturnValue(mockProjectRoot);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should initialize with default options', () => {
            const defaultManager = new HookSetupManager();
            expect(defaultManager.options.projectRoot).toBe(mockProjectRoot);
            expect(defaultManager.options.huskyDir).toBe('.husky');
            expect(defaultManager.options.forceReinstall).toBe(false);
        });

        test('should initialize with custom options', () => {
            const customManager = new HookSetupManager({
                projectRoot: '/custom/path',
                huskyDir: '.custom-husky',
                forceReinstall: true,
                verbose: true
            });

            expect(customManager.options.projectRoot).toBe('/custom/path');
            expect(customManager.options.huskyDir).toBe('.custom-husky');
            expect(customManager.options.forceReinstall).toBe(true);
            expect(customManager.options.verbose).toBe(true);
        });

        test('should define required hooks', () => {
            expect(manager.requiredHooks).toEqual(['commit-msg', 'pre-commit', 'pre-push']);
        });

        test('should have hook templates for all required hooks', () => {
            expect(manager.hookTemplates).toHaveProperty('commit-msg');
            expect(manager.hookTemplates).toHaveProperty('pre-commit');
            expect(manager.hookTemplates).toHaveProperty('pre-push');
        });
    });

    describe('installHooks', () => {
        test('should install Husky and create all hooks successfully', async () => {
            // Mock Husky not installed initially, then installed
            let huskyInstalled = false;
            let hooksCreated = false;

            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return hooksCreated;
                if (path.includes('.husky/commit-msg')) return hooksCreated;
                if (path.includes('.husky/pre-commit')) return hooksCreated;
                if (path.includes('.husky/pre-push')) return hooksCreated;
                if (path.includes('hook-orchestrator.js')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({
                        devDependencies: huskyInstalled ? { husky: '^9.0.0' } : {}
                    });
                }
                return '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\nHookOrchestrator';
            });

            fs.mkdirSync.mockImplementation(() => {
                hooksCreated = true;
            });

            fs.writeFileSync.mockImplementation(() => {
                hooksCreated = true;
            });

            fs.chmodSync.mockReturnValue(undefined);
            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockImplementation((cmd) => {
                if (cmd.includes('npm install')) {
                    huskyInstalled = true;
                    return '';
                }
                if (cmd.includes('husky init')) {
                    hooksCreated = true;
                    return '';
                }
                return 'git version 2.0.0';
            });

            const result = await manager.installHooks();

            expect(result.success).toBe(true);
            expect(result.huskyInstalled).toBe(true);
            expect(result.hooksCreated).toEqual(['commit-msg', 'pre-commit', 'pre-push']);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect existing hooks and skip installation without forceReinstall', async () => {
            // Mock Husky installed and hooks exist
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return true;
                if (path.includes('.husky/')) return true;
                if (path.includes('hook-orchestrator.js')) return true;
                return false;
            });

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const result = await manager.installHooks();

            expect(result.success).toBe(true);
            expect(result.warnings).toContain('Existing hooks detected - use forceReinstall option to overwrite');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        test('should reinstall hooks when forceReinstall is true', async () => {
            manager.options.forceReinstall = true;

            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\nHookOrchestrator';
            });

            fs.writeFileSync.mockReturnValue(undefined);
            fs.chmodSync.mockReturnValue(undefined);
            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const result = await manager.installHooks();

            expect(result.success).toBe(true);
            expect(result.hooksCreated.length).toBeGreaterThan(0);
        });

        test('should handle Husky installation failure', async () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue(JSON.stringify({ devDependencies: {} }));

            execSync.mockImplementation(() => {
                throw new Error('npm install failed');
            });

            const result = await manager.installHooks();

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to install Husky');
        });

        test('should handle hook creation failure', async () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return true;
                return false;
            });

            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = await manager.installHooks();

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('detectExistingHooks', () => {
        test('should detect no hooks when .husky directory does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            fs.readFileSync.mockReturnValue(JSON.stringify({ devDependencies: {} }));

            const result = manager.detectExistingHooks();

            expect(result.hasHooks).toBe(false);
            expect(result.huskyInstalled).toBe(false);
            expect(result.hooks).toHaveLength(3);
            expect(result.hooks.every(h => !h.exists)).toBe(true);
        });

        test('should detect existing hooks with correct metadata', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            const mockDate = new Date('2024-01-01');
            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: mockDate,
                size: 1234
            });

            const result = manager.detectExistingHooks();

            expect(result.hasHooks).toBe(true);
            expect(result.huskyInstalled).toBe(true);
            expect(result.hooks).toHaveLength(3);

            result.hooks.forEach(hook => {
                expect(hook.exists).toBe(true);
                expect(hook.executable).toBe(true);
                expect(hook.lastModified).toBe(mockDate.toISOString());
                expect(hook.size).toBe(1234);
            });
        });

        test('should detect non-executable hooks', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            fs.statSync.mockReturnValue({
                mode: 0o644, // Not executable
                mtime: new Date(),
                size: 1000
            });

            const result = manager.detectExistingHooks();

            expect(result.hasHooks).toBe(true);
            result.hooks.forEach(hook => {
                expect(hook.exists).toBe(true);
                expect(hook.executable).toBe(false);
            });
        });

        test('should handle stat errors gracefully', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            fs.statSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = manager.detectExistingHooks();

            expect(result.hasHooks).toBe(true);
            result.hooks.forEach(hook => {
                expect(hook.exists).toBe(true);
                expect(hook.executable).toBe(false);
                expect(hook.lastModified).toBeNull();
            });
        });
    });

    describe('updateHooks', () => {
        test('should update existing hooks successfully', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            fs.copyFileSync.mockReturnValue(undefined);
            fs.writeFileSync.mockReturnValue(undefined);
            fs.chmodSync.mockReturnValue(undefined);

            execSync.mockReturnValue('git version 2.0.0');

            const result = await manager.updateHooks();

            expect(result.success).toBe(true);
            expect(result.hooksUpdated).toEqual(['commit-msg', 'pre-commit', 'pre-push']);
            expect(result.errors).toHaveLength(0);
            expect(fs.copyFileSync).toHaveBeenCalledTimes(3); // Backup each hook
        });

        test('should warn when no existing hooks to update', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readFileSync.mockReturnValue(JSON.stringify({ devDependencies: {} }));

            const result = await manager.updateHooks();

            expect(result.success).toBe(false);
            expect(result.warnings).toContain('No existing hooks found - use installHooks() instead');
            expect(result.hooksUpdated).toHaveLength(0);
        });

        test('should handle update failures for individual hooks', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            fs.copyFileSync.mockReturnValue(undefined);

            // Make writeFileSync fail for one hook
            let callCount = 0;
            fs.writeFileSync.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Write failed');
                }
            });

            fs.chmodSync.mockReturnValue(undefined);
            execSync.mockReturnValue('git version 2.0.0');

            const result = await manager.updateHooks();

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.hooksUpdated.length).toBeLessThan(3);
        });
    });

    describe('validateHookInstallation', () => {
        test('should validate successful installation', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const result = manager.validateHookInstallation();

            expect(result.allValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.checks.length).toBeGreaterThan(0);

            // Check that all required validations passed
            const huskyCheck = result.checks.find(c => c.name === 'Husky installed');
            expect(huskyCheck.passed).toBe(true);

            const dirCheck = result.checks.find(c => c.name === '.husky directory exists');
            expect(dirCheck.passed).toBe(true);
        });

        test('should fail validation when Husky is not installed', () => {
            fs.existsSync.mockReturnValue(false);
            fs.readFileSync.mockReturnValue(JSON.stringify({ devDependencies: {} }));

            const result = manager.validateHookInstallation();

            expect(result.allValid).toBe(false);
            expect(result.errors).toContain('Husky is not installed');
        });

        test('should fail validation when .husky directory does not exist', () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return false;
                return false;
            });

            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            const result = manager.validateHookInstallation();

            expect(result.allValid).toBe(false);
            expect(result.errors).toContain('.husky directory not found');
        });

        test('should fail validation when hooks are missing', () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return true;
                if (path.includes('hook-orchestrator.js')) return true;
                return false; // Hooks don't exist
            });

            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            execSync.mockReturnValue('git version 2.0.0');

            const result = manager.validateHookInstallation();

            expect(result.allValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('hook not found'))).toBe(true);
        });

        test('should fail validation when hooks are not executable', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o644, // Not executable
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const result = manager.validateHookInstallation();

            expect(result.allValid).toBe(false);
            expect(result.errors.some(e => e.includes('not executable'))).toBe(true);
        });

        test('should warn when hook content is invalid', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return 'invalid hook content'; // Missing shebang and HookOrchestrator
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const result = manager.validateHookInstallation();

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('content may be invalid'))).toBe(true);
        });

        test('should fail validation when Hook Orchestrator is missing', () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return true;
                if (path.includes('.husky/')) return true;
                if (path.includes('hook-orchestrator.js')) return false;
                return false;
            });

            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const result = manager.validateHookInstallation();

            expect(result.allValid).toBe(false);
            expect(result.errors).toContain('Hook Orchestrator not found - hooks will not function');
        });

        test('should warn when not a Git repository', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockImplementation((cmd) => {
                if (cmd.includes('git rev-parse')) {
                    throw new Error('Not a git repository');
                }
                return '';
            });

            const result = manager.validateHookInstallation();

            expect(result.warnings).toContain('Not a Git repository - hooks will not function');
        });
    });

    describe('generateConfigReport', () => {
        test('should generate comprehensive configuration report', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                return '#!/usr/bin/env sh\nHookOrchestrator';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date('2024-01-01'),
                size: 1000
            });

            execSync.mockImplementation((cmd) => {
                if (cmd.includes('husky --version')) return '9.0.0';
                if (cmd.includes('git --version')) return 'git version 2.40.0';
                return '';
            });

            const report = manager.generateConfigReport();

            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('projectRoot', mockProjectRoot);
            expect(report).toHaveProperty('huskyDirectory', '.husky');
            expect(report).toHaveProperty('configuration');
            expect(report).toHaveProperty('hooks');
            expect(report).toHaveProperty('validation');
            expect(report).toHaveProperty('recommendations');

            expect(report.configuration.hooksInstalled).toBe(true);
            expect(report.configuration.huskyVersion).toBe('9.0.0');
            expect(report.configuration.gitVersion).toBe('git version 2.40.0');
            expect(report.configuration.nodeVersion).toBe(process.version);

            expect(report.hooks).toHaveLength(3);
            expect(report.validation).toBeDefined();
        });

        test('should include recommendations when hooks are not installed', () => {
            fs.existsSync.mockReturnValue(false);
            fs.readFileSync.mockReturnValue(JSON.stringify({ devDependencies: {} }));

            const report = manager.generateConfigReport();

            expect(report.recommendations.length).toBeGreaterThan(0);
            expect(report.recommendations).toContain('Install Husky: npm install --save-dev husky');
            expect(report.recommendations).toContain('Install git hooks: npm run hooks:setup');
        });

        test('should include recommendations for validation errors', () => {
            fs.existsSync.mockImplementation((path) => {
                if (path.includes('package.json')) return true;
                if (path === mockHuskyPath) return true;
                return false; // Hooks don't exist
            });

            fs.readFileSync.mockReturnValue(JSON.stringify({
                devDependencies: { husky: '^9.0.0' }
            }));

            execSync.mockReturnValue('git version 2.0.0');

            const report = manager.generateConfigReport();

            expect(report.recommendations).toContain('Fix validation errors before using git hooks');
            expect(report.recommendations.some(r => r.startsWith('Fix:'))).toBe(true);
        });

        test('should detect outdated hooks', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.includes('package.json')) {
                    return JSON.stringify({ devDependencies: { husky: '^9.0.0' } });
                }
                // Return old hook content without HookOrchestrator
                return '#!/usr/bin/env sh\nold hook content';
            });

            fs.statSync.mockReturnValue({
                mode: 0o755,
                mtime: new Date(),
                size: 1000
            });

            execSync.mockReturnValue('git version 2.0.0');

            const report = manager.generateConfigReport();

            expect(report.recommendations.some(r => r.includes('Update outdated hooks'))).toBe(true);
        });

        test('should handle errors gracefully', () => {
            // Make detectExistingHooks throw an error
            jest.spyOn(manager, 'detectExistingHooks').mockImplementation(() => {
                throw new Error('File system error');
            });

            const report = manager.generateConfigReport();

            expect(report).toHaveProperty('error');
            expect(report.error).toBe('File system error');
            expect(report.recommendations).toContain('Fix configuration report generation error');
        });
    });

    describe('hook templates', () => {
        test('commit-msg template should contain required elements', () => {
            const template = manager.getCommitMsgTemplate();

            expect(template).toContain('#!/usr/bin/env sh');
            expect(template).toContain('husky.sh');
            expect(template).toContain('HookOrchestrator');
            expect(template).toContain('executeCommitMsg');
            expect(template).toContain('COMMIT_MSG_FILE');
        });

        test('pre-commit template should contain required elements', () => {
            const template = manager.getPreCommitTemplate();

            expect(template).toContain('#!/usr/bin/env sh');
            expect(template).toContain('husky.sh');
            expect(template).toContain('HookOrchestrator');
            expect(template).toContain('executePreCommit');
            expect(template).toContain('STAGED_FILES');
        });

        test('pre-push template should contain required elements', () => {
            const template = manager.getPrePushTemplate();

            expect(template).toContain('#!/usr/bin/env sh');
            expect(template).toContain('husky.sh');
            expect(template).toContain('HookOrchestrator');
            expect(template).toContain('executePrePush');
            expect(template).toContain('BRANCH');
            expect(template).toContain('REMOTE');
        });
    });
});
