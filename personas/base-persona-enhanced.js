/**
 * @ai-context Enhanced Base class for all BMAD personas with advanced features
 * @ai-invariant All personas must extend this enhanced base class
 * @ai-connection This class connects to GitHub API, context management, and advanced logging
 */
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

class EnhancedBasePersona {
    constructor(name, role, githubToken) {
        this.name = name;
        this.role = role;
        this.githubToken = githubToken;
        this.octokit = new Octokit({ auth: githubToken });
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
                activeContext: this.safeReadFile('activeContext.md', ''),
                productContext: this.safeReadFile('productContext.md', ''),
                architectureSpec: this.safeReadFile('docs/architecture/SYSTEM_MAP.md', ''),
                handoverState: this.safeReadFile('.github/BMAD_HANDOVER.md', ''),
                contextHash: this.getContextHash('activeContext.md')
            };
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
     * @ai-context Enhanced logging with timestamps and metrics
     */
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.name}]`;
        console.log(`${prefix} ${message}`);

        // Log to file for audit trail
        this.appendLogFile(`${prefix} ${message}\n`);
    }

    /**
     * @ai-context Append to log file
     */
    /**
     * @ai-context Append to log file
     */
    appendLogFile(content) {
        try {
            const logDir = '.github/logs';
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logFile = path.join(logDir, `bmad-${this.role.toLowerCase()}.log`);
            fs.appendFileSync(logFile, content);
        } catch (error) {
            console.error(`Failed to write log file: ${error.message}`);
        }
    }

    /**
     * @ai-context Get SHA256 hash of a file for context locking
     */
    getContextHash(filePath) {
        try {
            if (!fs.existsSync(filePath)) return null;
            const content = fs.readFileSync(filePath, 'utf-8');
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(content).digest('hex');
        } catch (error) {
            this.log(`Failed to compute context hash: ${error.message}`, 'ERROR');
            return null;
        }
    }

    /**
     * @ai-context Validate context integrity before updates
     */
    validateContextIntegrity(filePath, expectedHash) {
        const currentHash = this.getContextHash(filePath);
        if (expectedHash && currentHash !== expectedHash) {
            throw new Error(`Context integrity violation: ${filePath} was modified by another process`);
        }
        return true;
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
            // Context Lock: Validate integrity before writing
            const contextPath = 'activeContext.md';
            if (fs.existsSync(contextPath)) {
                this.validateContextIntegrity(contextPath, this.context.contextHash);
            }

            const enhancedHandoverPath = '.github/BMAD_HANDOVER_ENHANCED.md';
            fs.writeFileSync(enhancedHandoverPath, handoverContent);
            this.log(`Updated enhanced handover for ${nextPersona}`);

            // Update context hash after successful write
            this.context.contextHash = this.getContextHash(contextPath);
        } catch (error) {
            this.log(`Failed to update handover: ${error.message}`, 'ERROR');
            throw error; // Re-throw to prevent silent failures
        }
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
