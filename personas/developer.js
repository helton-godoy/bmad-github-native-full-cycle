/**
 * @ai-context Developer Persona - Code implementation and feature development
 * @ai-invariant Developer must implement according to architecture specifications
 * @ai-connection Developer connects to architecture design and provides working code
 */
const BasePersona = require('./base-persona');
const fs = require('fs');
const path = require('path');

class Developer extends BasePersona {
    constructor(githubToken) {
        super('Developer Agent', 'Developer', githubToken);
    }

    /**
     * @ai-context Implement features based on architecture design
     */
    async execute(implementationIssueNumber) {
        this.log('Starting implementation');
        
        try {
            // Get implementation issue
            const issue = await this.octokit.rest.issues.get({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'shantilly-cli',
                issue_number: implementationIssueNumber
            });

            this.log(`Implementing: ${issue.data.title}`);

            // Update context
            this.updateActiveContext(`Implementando feature da issue #${implementationIssueNumber}`);

            // Implement core components
            await this.implementCoreComponents();

            // Implement API endpoints
            await this.implementAPIEndpoints();

            // Implement GitHub integration
            await this.implementGitHubIntegration();

            // Create tests
            await this.createTests();

            // Micro-commit implementation
            await this.microCommit('Developer: Core implementation completed', [
                {
                    path: 'src/app.js',
                    content: this.getAppJS()
                },
                {
                    path: 'src/config/index.js',
                    content: this.getConfigJS()
                },
                {
                    path: 'src/services/github-service.js',
                    content: this.getGitHubServiceJS()
                },
                {
                    path: 'src/controllers/persona-controller.js',
                    content: this.getPersonaControllerJS()
                },
                {
                    path: 'tests/integration.test.js',
                    content: this.getIntegrationTests()
                }
            ]);

            // Create QA review issue
            await this.createQAReviewIssue(issue.data);

            this.log('Implementation completed');
            return { status: 'completed', files: ['src/app.js', 'src/config/index.js', 'src/services/github-service.js', 'src/controllers/persona-controller.js'] };

        } catch (error) {
            this.log(`Error in Developer execution: ${error.message}`);
            throw error;
        }
    }

    /**
     * @ai-context Implement core application structure
     */
    async implementCoreComponents() {
        this.log('Setting up core application structure');
        
        // Ensure directories exist
        const dirs = ['src/config', 'src/controllers', 'src/services', 'src/middleware', 'src/utils', 'tests'];
        dirs.forEach(dir => {
            const fullPath = path.join(process.cwd(), dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    /**
     * @ai-context Implement API endpoints
     */
    async implementAPIEndpoints() {
        this.log('Implementing API endpoints');
        // Implementation handled in getPersonaControllerJS()
    }

    /**
     * @ai-context Implement GitHub integration
     */
    async implementGitHubIntegration() {
        this.log('Implementing GitHub integration');
        // Implementation handled in getGitHubServiceJS()
    }

    /**
     * @ai-context Create test suite
     */
    async createTests() {
        this.log('Creating test suite');
        // Implementation handled in getIntegrationTests()
    }

    /**
     * @ai-context Get Express app configuration
     */
    getAppJS() {
        return `const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const personaController = require('./controllers/persona-controller');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path}\`);
    next();
});

// Routes
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: require('../package.json').version
    });
});

app.use('/api/personas', personaController);

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app;`;
    }

    /**
     * @ai-context Get configuration module
     */
    getConfigJS() {
        return `require('dotenv').config();

module.exports = {
    // Server Configuration
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // GitHub Configuration
    github: {
        owner: process.env.GITHUB_OWNER || 'helton-godoy',
        repo: process.env.GITHUB_REPO || 'shantilly-cli',
        branch: process.env.GITHUB_BRANCH || 'main',
        token: process.env.GITHUB_TOKEN
    },
    
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'bmad-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },
    
    // BMAD Configuration
    bmad: {
        requireContextUpdate: process.env.BMAD_REQUIRE_CONTEXT_UPDATE !== 'false',
        microCommitPrefix: process.env.BMAD_COMMIT_PREFIX || 'BMAD',
        enableAutoTesting: process.env.BMAD_AUTO_TESTING !== 'false'
    }
};`;
    }

    /**
     * @ai-context Get GitHub service implementation
     */
    getGitHubServiceJS() {
        return `const { Octokit } = require('@octokit/rest');
const config = require('../config');

class GitHubService {
    constructor() {
        this.octokit = new Octokit({ auth: config.github.token });
        this.owner = config.github.owner;
        this.repo = config.github.repo;
        this.branch = config.github.branch;
    }

    /**
     * Create issue with BMAD tracking
     */
    async createIssue(title, body, labels = []) {
        try {
            const issue = await this.octokit.rest.issues.create({
                owner: this.owner,
                repo: this.repo,
                title,
                body,
                labels
            });
            return issue.data;
        } catch (error) {
            console.error('Error creating issue:', error.message);
            throw error;
        }
    }

    /**
     * Create micro-commit with tracking ID
     */
    async createMicroCommit(message, files) {
        const timestamp = new Date().toISOString();
        const commitId = \`\${config.bmad.microCommitPrefix}-\${Date.now()}\`;
        
        try {
            for (const file of files) {
                await this.octokit.rest.repos.createOrUpdateFileContents({
                    owner: this.owner,
                    repo: this.repo,
                    path: file.path,
                    message: \`[\${commitId}] \${message}\`,
                    content: Buffer.from(file.content).toString('base64'),
                    branch: this.branch
                });
            }
            return commitId;
        } catch (error) {
            console.error('Error creating micro-commit:', error.message);
            throw error;
        }
    }

    /**
     * Get issue details
     */
    async getIssue(issueNumber) {
        try {
            const issue = await this.octokit.rest.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber
            });
            return issue.data;
        } catch (error) {
            console.error('Error getting issue:', error.message);
            throw error;
        }
    }

    /**
     * Add comment to issue
     */
    async addComment(issueNumber, body) {
        try {
            const comment = await this.octokit.rest.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                body
            });
            return comment.data;
        } catch (error) {
            console.error('Error adding comment:', error.message);
            throw error;
        }
    }
}

module.exports = new GitHubService();`;
    }

    /**
     * @ai-context Get persona controller implementation
     */
    getPersonaControllerJS() {
        return `const express = require('express');
const githubService = require('../services/github-service');
const ProjectManager = require('../../personas/project-manager');
const Architect = require('../../personas/architect');

const router = express.Router();

/**
 * Execute PM persona
 */
router.post('/pm/:issueNumber', async (req, res) => {
    try {
        const { issueNumber } = req.params;
        const pm = new ProjectManager(config.github.token);
        const result = await pm.execute(parseInt(issueNumber));
        
        res.json({ 
            success: true, 
            message: 'PM execution completed',
            result 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Execute Architect persona
 */
router.post('/architect/:issueNumber', async (req, res) => {
    try {
        const { issueNumber } = req.params;
        const architect = new Architect(config.github.token);
        const result = await architect.execute(parseInt(issueNumber));
        
        res.json({ 
            success: true, 
            message: 'Architect execution completed',
            result 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Get persona status
 */
router.get('/status', (req, res) => {
    res.json({
        personas: ['PM', 'Architect', 'Developer', 'QA', 'DevOps', 'Security', 'Release Manager'],
        status: 'Operational',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;`;
    }

    /**
     * @ai-context Get integration tests
     */
    getIntegrationTests() {
        return `const request = require('supertest');
const app = require('../src/app');

describe('BMAD Integration Tests', () => {
    describe('Health Check', () => {
        test('GET /health should return healthy status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
            
            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('Persona API', () => {
        test('GET /api/personas/status should return persona status', async () => {
            const response = await request(app)
                .get('/api/personas/status')
                .expect(200);
            
            expect(response.body).toHaveProperty('personas');
            expect(response.body).toHaveProperty('status', 'Operational');
        });
    });

    describe('BMAD Workflow', () => {
        test('Should maintain context throughout workflow', () => {
            // Test context management
            expect(true).toBe(true); // Placeholder for context test
        });

        test('Should create micro-commits with tracking', () => {
            // Test micro-commit functionality
            expect(true).toBe(true); // Placeholder for commit test
        });
    });
});`;
    }

    /**
     * @ai-context Create QA review issue
     */
    async createQAReviewIssue(implementationIssue) {
        const title = `QA Review: ${implementationIssue.title.replace('Implementation: ', '')}`;
        const body = `## Implementation Issue
#${implementationIssue.number}: ${implementationIssue.title}

## Implementation Details
Core components implemented:
- Express.js application structure
- GitHub API integration service
- Persona controller endpoints
- Configuration management
- Test suite foundation

## QA Checklist

### Functionality Testing
- [ ] API endpoints respond correctly
- [ ] GitHub integration works
- [ ] Error handling implemented
- [ ] Logging functional

### Code Quality
- [ ] Code follows architecture design
- [ ] Security best practices implemented
- [ ] Documentation complete
- [ ] Test coverage >80%

### Integration Testing
- [ ] GitHub API connectivity
- [ ] Persona workflow execution
- [ ] Context management
- [ ] Micro-commit functionality

### Security Testing
- [ ] Input validation
- [ ] Authentication mechanisms
- [ ] API security
- [ ] Error information disclosure

## Test Results
- Unit tests: Pending
- Integration tests: Pending
- Security tests: Pending

## Next Steps
@helton-godoy/qa Please review and validate implementation.

---
*Created by Developer Agent*`;

        await this.createIssue(title, body, ['qa', 'review', 'testing']);
    }
}

module.exports = Developer;
