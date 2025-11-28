/**
 * @ai-context Base class for all BMAD personas
 * @ai-invariant All personas must extend this base class
 * @ai-connection This class connects to GitHub API and context management
 */
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

class BasePersona {
    constructor(name, role, githubToken) {
        this.name = name;
        this.role = role;
        this.githubToken = githubToken;
        this.octokit = new Octokit({ auth: githubToken });
        this.context = this.loadContext();
    }

    /**
     * @ai-context Load project context from files
     */
    loadContext() {
        try {
            const activeContext = fs.readFileSync('activeContext.md', 'utf-8');
            const productContext = fs.readFileSync('productContext.md', 'utf-8');
            return { activeContext, productContext };
        } catch (error) {
            console.error('Error loading context:', error.message);
            return { activeContext: '', productContext: '' };
        }
    }

    /**
     * @ai-context Update active context with current work
     */
    updateActiveContext(update) {
        const contextPath = path.join(process.cwd(), 'activeContext.md');
        let currentContext = '';
        
        try {
            currentContext = fs.readFileSync(contextPath, 'utf-8');
        } catch (error) {
            console.error('Error reading active context:', error.message);
        }

        // Update persona current section
        const updatedContext = currentContext.replace(
            /## Persona Atual\n\*\*.*\*\* - .*/,
            `## Persona Atual\n**${this.name}** - ${update}`
        );

        fs.writeFileSync(contextPath, updatedContext);
        console.log(`✅ Context updated by ${this.name}`);
    }

    /**
     * @ai-context Create micro-commit with tracking ID
     */
    async microCommit(message, files = []) {
        const commitId = `${this.role.toLowerCase()}-${Date.now()}`;
        
        const commitMessage = `[${commitId}] ${message}`;
        
        try {
            // Add files
            for (const file of files) {
                await this.octokit.rest.repos.createOrUpdateFileContents({
                    owner: process.env.GITHUB_OWNER || 'helton-godoy',
                    repo: process.env.GITHUB_REPO || 'shantilly-cli',
                    path: file.path,
                    message: commitMessage,
                    content: Buffer.from(file.content).toString('base64'),
                    branch: process.env.GITHUB_BRANCH || 'main'
                });
            }

            console.log(`✅ Micro-commit created: ${commitId}`);
            return commitId;
        } catch (error) {
            console.error('Error creating micro-commit:', error.message);
            throw error;
        }
    }

    /**
     * @ai-context Create GitHub issue for task tracking
     */
    async createIssue(title, body, labels = []) {
        try {
            const issue = await this.octokit.rest.issues.create({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'shantilly-cli',
                title: `[${this.role}] ${title}`,
                body: `**Persona:** ${this.name}\n\n${body}`,
                labels: [this.role.toLowerCase(), ...labels]
            });

            console.log(`✅ Issue created: #${issue.data.number}`);
            return issue.data;
        } catch (error) {
            console.error('Error creating issue:', error.message);
            throw error;
        }
    }

    /**
     * @ai-context Abstract method for persona execution
     */
    async execute() {
        throw new Error('Execute method must be implemented by persona');
    }

    /**
     * @ai-context Log persona activity
     */
    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${this.role}] ${this.name}: ${message}`);
    }
}

module.exports = BasePersona;
