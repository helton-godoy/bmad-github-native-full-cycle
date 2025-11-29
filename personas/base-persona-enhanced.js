/**
 * @ai-context Enhanced Base class for all BMAD personas with advanced features
 * @ai-invariant All personas must extend this enhanced base class
 * @ai-connection This class connects to GitHub API, context management, and advanced logging
 */
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const ContextManager = require('../scripts/lib/context-manager');
const Logger = require('../scripts/lib/logger');
const SecretManager = require('../scripts/lib/secret-manager');
const CacheManager = require('../scripts/lib/cache-manager');

class EnhancedBasePersona {
    constructor(name, role, githubToken) {
        this.name = name;
        this.role = role;
        this.githubToken = githubToken;
        this.octokit = new Octokit({ auth: githubToken });
        this.contextManager = new ContextManager();
        this.secretManager = new SecretManager();
        this.cacheManager = new CacheManager(); // Default 1h TTL
        this.logger = new Logger(role); // Use role as component name

        // Validate critical secrets on startup
        this.secretManager.validateRequired(['GITHUB_TOKEN']);

        this.context = this.loadContext();
        this.startTime = new Date();
        this.metrics = {
            issuesCreated: 0,
            commitsMade: 0,
            filesModified: 0,
            errors: 0
        };
    }

    /**
     * @ai-context Load project context from files with enhanced error handling
     */
    /**
     * @ai-context Load project context from files with enhanced error handling
     */
    loadContext() {
        try {
            const context = {
                activeContext: this.contextManager.read('activeContext.md') || '',
                productContext: this.contextManager.read('productContext.md') || '',
                architectureSpec: this.contextManager.read('docs/architecture/SYSTEM_MAP.md') || '',
                handoverState: this.contextManager.read('.github/BMAD_HANDOVER.md') || '',
                contextHash: null // Hash is now managed internally by ContextManager writes, but we keep property for compatibility
            };

            // Calculate hash of loaded activeContext for reference
            if (context.activeContext) {
                context.contextHash = this.contextManager.computeHash(context.activeContext);
            }

            return context;
        } catch (error) {
            console.error(`Error loading context: ${error.message}`);
            return {
                activeContext: '',
                productContext: '',
                architectureSpec: '',
                handoverState: '',
                contextHash: null
            };
        }
    }

    /**
     * @ai-context Safe file reading with fallback
     */
    safeReadFile(filePath, fallback = '') {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            return fallback;
        }
    }

    /**
     * @ai-context Enhanced logging with timestamps and metrics (Delegated to Logger)
     */
    log(message, level = 'INFO') {
        // Map legacy log levels to Logger methods
        switch (level) {
            case 'ERROR':
                this.logger.error(message);
                break;
            case 'WARNING':
                this.logger.warn(message);
                break;
            default:
                this.logger.info(message);
        }
    }

    // appendLogFile is deprecated/removed as Logger handles file writing internally

    // Removed getContextHash and validateContextIntegrity as they are replaced by ContextManager

    /**
     * @ai-context Get issue with caching
     */
    async getIssue(issueNumber) {
        const cacheKey = `issue-${issueNumber}`;
        const cached = this.cacheManager.get(cacheKey);

        if (cached) {
            this.log(`Using cached data for issue #${issueNumber}`);
            return cached;
        }

        try {
            const issue = await this.octokit.rest.issues.get({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'bmad-github-native-full-cycle',
                issue_number: issueNumber
            });

            this.cacheManager.set(cacheKey, issue.data);
            return issue.data;
        } catch (error) {
            this.log(`Failed to fetch issue #${issueNumber}: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Create GitHub issue with enhanced metadata
     */
    async createIssue(title, body, labels = []) {
        try {
            const issue = await this.octokit.rest.issues.create({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'bmad-github-native-full-cycle',
                title,
                body,
                labels: [...labels, this.role.toLowerCase()]
            });

            this.metrics.issuesCreated++;
            this.log(`Created issue #${issue.data.number}: ${title}`);
            return issue.data;
        } catch (error) {
            this.metrics.errors++;
            this.log(`Failed to create issue: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Enhanced commit with automatic metrics tracking and validation
     */
    async commit(message, files = []) {
        try {
            // 1. Stage files
            if (files.length > 0) {
                for (const file of files) {
                    await this.execCommand(`git add "${file}"`);
                }
            } else {
                // If no specific files provided, check if there are changes and stage all
                try {
                    const status = await this.execCommand('git status --porcelain');
                    if (status.trim()) {
                        await this.execCommand('git add .');
                        this.log('Auto-staged all changes (no specific files provided)');
                    } else {
                        this.log('Nothing to commit (no changes detected)', 'WARNING');
                        return null;
                    }
                } catch (error) {
                    // git status failed?
                    this.log(`Failed to check git status: ${error.message}`, 'ERROR');
                    throw error;
                }
            }

            // 2. Verify if there is anything staged
            // git diff --cached --quiet returns 0 (success) if NO changes, 1 (error) if changes exist
            let hasStagedChanges = false;
            try {
                await this.execCommand('git diff --cached --quiet');
            } catch (e) {
                hasStagedChanges = true;
            }

            if (!hasStagedChanges) {
                this.log('Nothing staged to commit after git add', 'WARNING');
                return null;
            }

            // 3. PRE-COMMIT VALIDATION (Critical Security Fix)
            const skipValidation = process.env.BMAD_SKIP_VALIDATION === 'true';

            if (!skipValidation) {
                this.log('Running pre-commit validation...');
                try {
                    // Try to run validation if package.json has validate script
                    const packageJsonPath = 'package.json';
                    if (fs.existsSync(packageJsonPath)) {
                        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                        if (!pkg.scripts || !pkg.scripts.validate) {
                            this.log('❌ package.json encontrado mas script "validate" ausente. Commit bloqueado.', 'ERROR');
                            await this.execCommand('git reset HEAD');
                            throw new Error('Commit blocked: scripts.validate is required in package.json for BMAD workflows');
                        }

                        await this.execCommand('npm run validate');
                        this.log('✅ Pre-commit validation passed');
                    }
                } catch (validationError) {
                    this.log(`❌ Pre-commit validation FAILED: ${validationError.message}`, 'ERROR');
                    this.log('Rolling back staged changes...', 'WARNING');
                    await this.execCommand('git reset HEAD');
                    throw new Error(`Commit blocked by validation failure: ${validationError.message}`);
                }
            } else {
                this.log('⚠️ Pre-commit validation SKIPPED (BMAD_SKIP_VALIDATION=true)', 'WARNING');
            }

            // 4. Commit with enhanced message
            const commitMessage = `[${this.role.toUpperCase()}] [STEP-${this.getNextStepId()}] ${message}`;
            await this.execCommand(`git commit -m "${commitMessage}"`);

            this.metrics.commitsMade++;
            this.metrics.filesModified += files.length > 0 ? files.length : 1;
            this.log(`Committed: ${commitMessage}`);

            return commitMessage;
        } catch (error) {
            this.metrics.errors++;
            this.log(`Failed to commit: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Execute shell command with error handling
     */
    async execCommand(command) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * @ai-context Get next step ID for commits
     */
    getNextStepId() {
        // Simple increment - in real implementation would track from handover
        return String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    }

    /**
     * @ai-context Update handover state
     */
    /**
     * @ai-context Update handover state with context locking
     */
    updateHandover(nextPersona, artifacts, status) {
        const handoverContent = this.generateHandoverContent(nextPersona, artifacts, status);

        try {
            // Use ContextManager for atomic write of handover file
            // We unify to BMAD_HANDOVER.md to match Orchestrator
            const handoverPath = '.github/BMAD_HANDOVER.md';
            this.contextManager.write(handoverPath, handoverContent);

            this.log(`Updated handover for ${nextPersona}`);

            // Also update activeContext if needed (example)
            // this.contextManager.write('activeContext.md', this.context.activeContext);

        } catch (error) {
            this.log(`Failed to update handover: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Update active context with locking
     */
    updateActiveContext(content) {
        try {
            // Append to existing context or overwrite? 
            // Original implementation usually appends or updates specific sections.
            // For simplicity and robustness, we'll append a log entry to activeContext.md

            const contextPath = 'activeContext.md';
            const timestamp = new Date().toISOString();
            const entry = `\n- [${timestamp}] [${this.role}] ${content}`;

            // Use ContextManager for atomic append (read + write)
            // Note: In a real high-concurrency scenario, we might want a specific 'append' operation in ContextManager
            // but read+write inside a lock (which ContextManager handles if we expose lock, but here we use simple write)
            // Actually ContextManager.write overwrites. We need read-modify-write.

            // Since ContextManager doesn't expose "withLock" publicly in the simple usage, 
            // we rely on its internal locking for individual ops. 
            // Ideally ContextManager should support atomic updates.
            // For now, we'll read then write, accepting a small race window between read/write 
            // OR we can implement an 'update' method in ContextManager.
            // Let's just do read-modify-write here, assuming low collision for this specific file in this phase.

            let currentContent = this.contextManager.read(contextPath) || '# Active Context\n';
            currentContent += entry;

            this.contextManager.write(contextPath, currentContent);

            // Update local cache
            this.context.activeContext = currentContent;

        } catch (error) {
            this.log(`Failed to update active context: ${error.message}`, 'ERROR');
            // Don't throw, just log error for context updates
        }
    }

    /**
     * @ai-context Micro-commit changes
     */
    async microCommit(message, files = []) {
        // Wrapper around commit for compatibility
        // In original BMAD, microCommit might have specific logic, but here we map to enhanced commit
        // If files is an array of objects {path, content}, we need to write them first

        if (files.length > 0 && typeof files[0] === 'object') {
            for (const file of files) {
                if (file.path && file.content) {
                    // Ensure directory exists
                    const dir = path.dirname(file.path);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(file.path, file.content);
                }
            }
            // Extract paths for git add
            const filePaths = files.map(f => f.path);
            return this.commit(message, filePaths);
        }

        return this.commit(message, files);
    }

    /**
     * @ai-context Generate handover content
     */
    generateHandoverContent(nextPersona, artifacts, status) {
        const timestamp = new Date().toISOString();
        const duration = new Date() - this.startTime;

        return `# BMAD Handover State

## Current Persona: ${this.name}
- **Role:** ${this.role}
- **Started:** ${this.startTime.toISOString()}
- **Duration:** ${Math.round(duration / 1000)}s
- **Status:** ${status}

## Next Persona: ${nextPersona}

## Artifacts Generated
${artifacts.map(artifact => `- ${artifact}`).join('\n')}

## Metrics
- Issues Created: ${this.metrics.issuesCreated}
- Commits Made: ${this.metrics.commitsMade}
- Files Modified: ${this.metrics.filesModified}
- Errors: ${this.metrics.errors}

## Context State
- Active Context: ${this.context.activeContext ? '✅ Updated' : '❌ Missing'}
- Product Context: ${this.context.productContext ? '✅ Updated' : '❌ Missing'}
- Architecture Spec: ${this.context.architectureSpec ? '✅ Updated' : '❌ Missing'}

## Handover Timestamp: ${timestamp}

---
*Generated by BMAD Enhanced Framework*
`;
    }

    /**
     * @ai-context Validate prerequisites for persona execution
     */
    validatePrerequisites() {
        const required = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'];
        const missing = required.filter(env => !process.env[env]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        return true;
    }

    /**
     * @ai-context Get persona execution summary
     */
    getSummary() {
        const duration = new Date() - this.startTime;
        return {
            persona: this.name,
            role: this.role,
            duration: Math.round(duration / 1000),
            metrics: this.metrics,
            status: 'completed'
        };
    }
}

module.exports = EnhancedBasePersona;
