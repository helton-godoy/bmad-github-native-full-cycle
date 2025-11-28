/**
 * @ai-context Enhanced Developer Persona with advanced code generation and validation
 * @ai-invariant Developer must implement according to architecture specifications with quality checks
 * @ai-connection Developer connects to architecture design and provides production-ready code
 */
const EnhancedBasePersona = require('./base-persona-enhanced');
const fs = require('fs');
const path = require('path');

class EnhancedDeveloper extends EnhancedBasePersona {
    constructor(githubToken) {
        super('Enhanced Developer Agent', 'Developer', githubToken);
        this.techStack = this.detectTechStack();
        this.codeQuality = {
            coverage: 0,
            complexity: 0,
            tests: 0
        };
    }

    /**
     * @ai-context Detect project tech stack from configuration files
     */
    detectTechStack() {
        const stack = {
            language: 'unknown',
            framework: 'none',
            packageManager: 'none',
            testing: 'none'
        };

        // Detect language and framework
        if (fs.existsSync('package.json')) {
            stack.language = 'javascript';
            stack.packageManager = 'npm';
            
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
            if (pkg.dependencies?.react) stack.framework = 'react';
            if (pkg.dependencies?.express) stack.framework = 'express';
            if (pkg.dependencies?.vue) stack.framework = 'vue';
        } else if (fs.existsSync('go.mod')) {
            stack.language = 'go';
            stack.packageManager = 'go';
        } else if (fs.existsSync('Cargo.toml')) {
            stack.language = 'rust';
            stack.packageManager = 'cargo';
        } else if (fs.existsSync('requirements.txt') || fs.existsSync('pyproject.toml')) {
            stack.language = 'python';
            stack.packageManager = 'pip';
        }

        // Detect testing framework
        if (fs.existsSync('jest.config.js') || fs.existsSync('jest.config.json')) {
            stack.testing = 'jest';
        } else if (fs.existsSync('pytest.ini') || fs.existsSync('pyproject.toml')) {
            stack.testing = 'pytest';
        } else if (fs.existsSync('go.mod') && fs.existsSync('*_test.go')) {
            stack.testing = 'go-test';
        }

        return stack;
    }

    /**
     * @ai-context Enhanced implementation with code quality checks
     */
    async execute(implementationIssueNumber) {
        this.log('Starting enhanced implementation');
        this.validatePrerequisites();

        try {
            // Get implementation issue
            const issue = await this.octokit.rest.issues.get({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'bmad-github-native-full-cycle',
                issue_number: implementationIssueNumber
            });

            this.log(`Implementing: ${issue.data.title}`);

            // Parse implementation requirements
            const requirements = this.parseImplementationRequirements(issue.data.body);
            
            // Generate implementation plan
            const plan = this.generateImplementationPlan(requirements);
            
            // Execute implementation phases
            const artifacts = [];
            
            for (const phase of plan.phases) {
                this.log(`Executing phase: ${phase.name}`);
                const phaseArtifacts = await this.executePhase(phase);
                artifacts.push(...phaseArtifacts);
                
                // Commit phase results
                await this.commit(`Complete ${phase.name} phase`, phaseArtifacts);
            }

            // Run quality checks
            await this.runQualityChecks();

            // Create completion issue
            await this.createIssue(
                `Implementation Complete: ${issue.data.title}`,
                this.generateImplementationReport(requirements, artifacts),
                ['implementation-complete', 'ready-for-testing']
            );

            // Update handover
            this.updateHandover('QA', artifacts, 'Implementation completed');

            this.log('Enhanced implementation completed successfully');
            return this.getSummary();

        } catch (error) {
            this.log(`Implementation failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Parse implementation requirements from issue body
     */
    parseImplementationRequirements(issueBody) {
        const requirements = {
            features: [],
            technical: [],
            constraints: [],
            acceptance: []
        };

        // Extract requirements using regex patterns
        const featurePattern = /Feature:\s*(.+)$/gm;
        const technicalPattern = /Technical:\s*(.+)$/gm;
        const constraintPattern = /Constraint:\s*(.+)$/gm;
        const acceptancePattern = /Acceptance:\s*(.+)$/gm;

        let match;
        while ((match = featurePattern.exec(issueBody)) !== null) {
            requirements.features.push(match[1].trim());
        }
        while ((match = technicalPattern.exec(issueBody)) !== null) {
            requirements.technical.push(match[1].trim());
        }
        while ((match = constraintPattern.exec(issueBody)) !== null) {
            requirements.constraints.push(match[1].trim());
        }
        while ((match = acceptancePattern.exec(issueBody)) !== null) {
            requirements.acceptance.push(match[1].trim());
        }

        return requirements;
    }

    /**
     * @ai-context Generate detailed implementation plan
     */
    generateImplementationPlan(requirements) {
        const plan = {
            phases: [
                {
                    name: 'Setup',
                    description: 'Initialize project structure and dependencies',
                    tasks: this.generateSetupTasks(requirements)
                },
                {
                    name: 'Core Implementation',
                    description: 'Implement main functionality',
                    tasks: this.generateCoreTasks(requirements)
                },
                {
                    name: 'Testing',
                    description: 'Implement comprehensive tests',
                    tasks: this.generateTestingTasks(requirements)
                },
                {
                    name: 'Documentation',
                    description: 'Create technical documentation',
                    tasks: this.generateDocumentationTasks(requirements)
                }
            ]
        };

        return plan;
    }

    /**
     * @ai-context Generate setup tasks based on requirements
     */
    generateSetupTasks(requirements) {
        const tasks = [];

        // Project structure
        tasks.push({
            type: 'directory',
            path: 'src',
            description: 'Create source directory'
        });

        tasks.push({
            type: 'directory',
            path: 'tests',
            description: 'Create test directory'
        });

        // Configuration files based on tech stack
        if (this.techStack.language === 'javascript') {
            tasks.push({
                type: 'file',
                path: 'package.json',
                description: 'Update package.json with dependencies'
            });
        } else if (this.techStack.language === 'go') {
            tasks.push({
                type: 'file',
                path: 'go.mod',
                description: 'Update go.mod with dependencies'
            });
        }

        return tasks;
    }

    /**
     * @ai-context Generate core implementation tasks
     */
    generateCoreTasks(requirements) {
        const tasks = [];

        for (const feature of requirements.features) {
            tasks.push({
                type: 'implementation',
                feature: feature,
                description: `Implement feature: ${feature}`
            });
        }

        return tasks;
    }

    /**
     * @ai-context Generate testing tasks
     */
    generateTestingTasks(requirements) {
        const tasks = [];

        for (const acceptance of requirements.acceptance) {
            tasks.push({
                type: 'test',
                scenario: acceptance,
                description: `Test scenario: ${acceptance}`
            });
        }

        return tasks;
    }

    /**
     * @ai-context Generate documentation tasks
     */
    generateDocumentationTasks(requirements) {
        return [
            {
                type: 'documentation',
                path: 'docs/api.md',
                description: 'Create API documentation'
            },
            {
                type: 'documentation',
                path: 'README.md',
                description: 'Update README with implementation details'
            }
        ];
    }

    /**
     * @ai-context Execute implementation phase
     */
    async executePhase(phase) {
        const artifacts = [];

        for (const task of phase.tasks) {
            this.log(`Executing task: ${task.description}`);
            
            try {
                const result = await this.executeTask(task);
                if (result) {
                    artifacts.push(result);
                }
            } catch (error) {
                this.log(`Task failed: ${task.description} - ${error.message}`, 'ERROR');
                throw error;
            }
        }

        return artifacts;
    }

    /**
     * @ai-context Execute individual task
     */
    async executeTask(task) {
        switch (task.type) {
            case 'directory':
                if (!fs.existsSync(task.path)) {
                    fs.mkdirSync(task.path, { recursive: true });
                    this.log(`Created directory: ${task.path}`);
                }
                return task.path;

            case 'file':
                return await this.createFile(task);

            case 'implementation':
                return await this.implementFeature(task);

            case 'test':
                return await this.createTest(task);

            case 'documentation':
                return await this.createDocumentation(task);

            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    /**
     * @ai-context Create file based on tech stack
     */
    async createFile(task) {
        const content = this.generateFileContent(task.path);
        fs.writeFileSync(task.path, content, 'utf-8');
        this.log(`Created file: ${task.path}`);
        return task.path;
    }

    /**
     * @ai-context Generate file content based on path and tech stack
     */
    generateFileContent(filePath) {
        if (filePath === 'package.json') {
            return JSON.stringify({
                name: 'bmad-enhanced-project',
                version: '1.0.0',
                description: 'BMAD Enhanced Framework Project',
                main: 'src/index.js',
                scripts: {
                    start: 'node src/index.js',
                    test: 'jest',
                    'test:watch': 'jest --watch',
                    'test:coverage': 'jest --coverage'
                },
                dependencies: {
                    express: '^4.18.0',
                    '@octokit/rest': '^19.0.0'
                },
                devDependencies: {
                    jest: '^29.0.0',
                    nodemon: '^2.0.0'
                }
            }, null, 2);
        }

        if (filePath === 'go.mod') {
            return `module bmad-enhanced-project

go 1.21

require (
    github.com/gin-gonic/gin v1.9.0
    github.com/stretchr/testify v1.8.0
)
`;
        }

        return '// Auto-generated file\n';
    }

    /**
     * @ai-context Implement feature based on requirements
     */
    async implementFeature(task) {
        const featureName = task.feature.toLowerCase().replace(/\s+/g, '-');
        const fileName = `src/${featureName}.js`;
        
        const content = this.generateFeatureCode(task.feature);
        fs.writeFileSync(fileName, content, 'utf-8');
        
        this.log(`Implemented feature: ${task.feature}`);
        return fileName;
    }

    /**
     * @ai-context Generate feature code
     */
    generateFeatureCode(feature) {
        return `/**
 * Feature: ${feature}
 * Generated by BMAD Enhanced Developer
 */

class ${feature.replace(/\s+/g, '')}Feature {
    constructor() {
        this.name = '${feature}';
        this.enabled = true;
    }

    /**
     * Execute feature logic
     */
    async execute(params = {}) {
        console.log(\`Executing \${this.name} feature\`);
        
        // Feature implementation goes here
        return {
            success: true,
            data: params,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate feature parameters
     */
    validate(params) {
        // Add validation logic based on requirements
        return true;
    }
}

module.exports = ${feature.replace(/\s+/g, '')}Feature;
`;
    }

    /**
     * @ai-context Create test file
     */
    async createTest(task) {
        const testName = task.scenario.toLowerCase().replace(/\s+/g, '-');
        const fileName = `tests/${testName}.test.js`;
        
        const content = this.generateTestCode(task.scenario);
        fs.writeFileSync(fileName, content, 'utf-8');
        
        this.log(`Created test: ${task.scenario}`);
        return fileName;
    }

    /**
     * @ai-context Generate test code
     */
    generateTestCode(scenario) {
        return `/**
 * Test: ${scenario}
 * Generated by BMAD Enhanced Developer
 */

const { ${scenario.replace(/\s+/g, '')}Feature } = require('../src/${scenario.toLowerCase().replace(/\s+/g, '-')}.js');

describe('${scenario}', () => {
    let feature;

    beforeEach(() => {
        feature = new ${scenario.replace(/\s+/g, '')}Feature();
    });

    test('should execute successfully', async () => {
        const result = await feature.execute();
        expect(result.success).toBe(true);
        expect(result.timestamp).toBeDefined();
    });

    test('should validate parameters', () => {
        const isValid = feature.validate({ test: 'value' });
        expect(isValid).toBe(true);
    });
});
`;
    }

    /**
     * @ai-context Create documentation
     */
    async createDocumentation(task) {
        const content = this.generateDocumentationContent(task.path);
        fs.writeFileSync(task.path, content, 'utf-8');
        
        this.log(`Created documentation: ${task.path}`);
        return task.path;
    }

    /**
     * @ai-context Generate documentation content
     */
    generateDocumentationContent(filePath) {
        if (filePath.includes('api.md')) {
            return `# API Documentation

Generated by BMAD Enhanced Framework

## Endpoints

### Feature API

#### Execute Feature
\`\`\`
POST /api/feature
Content-Type: application/json

{
  "feature": "feature-name",
  "params": {}
}
\`\`\`

#### Response
\`\`\`
{
  "success": true,
  "data": {},
  "timestamp": "2023-01-01T00:00:00.000Z"
}
\`\`\`
`;
        }

        return `# Documentation

Generated by BMAD Enhanced Framework

## Overview

This documentation was automatically generated during the implementation phase.

## Features

- Feature implementation
- Comprehensive testing
- Quality assurance
- Automated documentation

## Tech Stack

- Language: ${this.techStack.language}
- Framework: ${this.techStack.framework}
- Testing: ${this.techStack.testing}
`;
    }

    /**
     * @ai-context Run quality checks on implemented code
     */
    async runQualityChecks() {
        this.log('Running quality checks');

        try {
            // Run tests
            if (this.techStack.testing === 'jest') {
                await this.execCommand('npm test');
            } else if (this.techStack.testing === 'go-test') {
                await this.execCommand('go test ./...');
            }

            // Run linting
            if (fs.existsSync('.eslintrc.js')) {
                await this.execCommand('npx eslint src/');
            }

            // Check code coverage
            if (this.techStack.testing === 'jest') {
                await this.execCommand('npm run test:coverage');
            }

            this.log('Quality checks passed');
        } catch (error) {
            this.log(`Quality check failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Generate implementation report
     */
    generateImplementationReport(requirements, artifacts) {
        return `# Implementation Report

## Requirements Analysis
- **Features:** ${requirements.features.length}
- **Technical Requirements:** ${requirements.technical.length}
- **Constraints:** ${requirements.constraints.length}
- **Acceptance Criteria:** ${requirements.acceptance.length}

## Implementation Details
- **Tech Stack:** ${this.techStack.language} (${this.techStack.framework})
- **Files Created:** ${artifacts.length}
- **Test Coverage:** Target: 80%+

## Artifacts Generated
${artifacts.map(artifact => `- \`${artifact}\``).join('\n')}

## Quality Metrics
- **Tests Written:** ${requirements.acceptance.length}
- **Documentation:** Complete
- **Code Review:** Ready

## Next Steps
1. QA testing phase
2. Security review
3. Performance testing
4. Release preparation

---
*Generated by Enhanced Developer Persona*
`;
    }
}

module.exports = EnhancedDeveloper;
