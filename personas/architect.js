/**
 * @ai-context Architect Persona - System design and technical decisions
 * @ai-invariant Architect must create technical specifications and system design
 * @ai-connection Architect connects to PM requirements and provides implementation guidance
 */
const BasePersona = require('./base-persona');
const ProductContextValidator = require('../scripts/bmad/product-context-validator');

class Architect extends BasePersona {
    constructor(githubToken) {
        super('Architect Agent', 'Architect', githubToken);
    }

    /**
     * @ai-context Design system architecture based on requirements
     */
    async execute(planningIssueNumber) {
        this.log('Starting architecture design');

        try {
            // Validate product context before proceeding
            try {
                const validator = new ProductContextValidator();
                const result = validator.validate();
                if (!result.valid) {
                    throw new Error(`productContext.md validation failed: ${result.errors.join('; ')}`);
                }
            } catch (validationError) {
                this.log(`Product context validation error: ${validationError.message}`);
                throw validationError;
            }

            // Get planning issue
            const issue = await this.octokit.rest.issues.get({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'shantilly-cli',
                issue_number: planningIssueNumber
            });

            this.log(`Designing architecture for: ${issue.data.title}`);

            // Create architecture design
            const architectureDesign = this.createArchitectureDesign(issue.data);

            // Update context
            this.updateActiveContext(`Designing arquitetura para issue #${planningIssueNumber}`);

            // Create implementation issue
            await this.createImplementationIssue(issue.data, architectureDesign);

            // Micro-commit architecture documents
            await this.microCommit('Architect: System design completed', [
                {
                    path: 'docs/architecture/system-design.md',
                    content: architectureDesign
                }
            ]);

            this.log('Architecture design completed');
            return architectureDesign;

        } catch (error) {
            this.log(`Error in Architect execution: ${error.message}`);
            throw error;
        }
    }

    /**
     * @ai-context Create comprehensive architecture design
     */
    createArchitectureDesign(planningIssue) {
        // Extract context or use defaults
        const productContext = this.context.productContext || '';
        const techStackMatch = productContext.match(/## Technical Stack([\s\S]*?)##/);
        const techStack = techStackMatch ? techStackMatch[1].trim() : 'Node.js (Default)';
        const systemMap = (this.context.architectureSpec || '').trim();

        const design = `# System Architecture Design

## Overview
Architecture design for: ${planningIssue.title}

## Requirements Analysis
Based on planning issue #${planningIssue.number}

## Context & Technology Stack
${techStack}

## Existing Architecture Map
${systemMap || 'No existing SYSTEM_MAP.md found. This design will serve as the initial architecture reference.'}

## System Components

### 1. Core Application Layer
- **Runtime/Language**: Derived from Product Context
- **Framework**: Derived from Product Context
- **Architecture Pattern**: Modular/Layered

### 2. Business Logic Layer
- **Services**: Domain logic isolation
- **Handlers/Controllers**: Input processing
- **Utilities**: Shared helper functions

### 3. Data Layer
- **Storage**: As defined in requirements (File/DB)
- **Persistence**: Data access patterns
- **Backup**: Version control / Snapshots

### 4. Integration Layer
- **External APIs**: GitHub, etc.
- **Events**: Webhooks / Signals

## Security Architecture

### Authentication & Authorization
- Secure credential management
- Role-based access (if applicable)

### Data Protection
- Input validation (Critical)
- Secure storage of sensitive data

## Performance Considerations

### Efficiency
- Resource usage optimization
- Startup time minimization

### Monitoring
- Logging strategy
- Performance metrics tracking

## Deployment Architecture

### Environment Setup
- Development: Local environment
- Testing: CI Pipeline
- Production: Build artifacts

### CI/CD Pipeline
- Automated testing
- Linting & Quality checks
- Automated release process

## Implementation Guidelines

### Code Structure
(Adapt to target language conventions)
\`\`\`
src/ or cmd/
├── core/           # Core logic
├── api/            # Interfaces
├── data/           # Data access
└── config/         # Configuration
\`\`\`

### Development Standards
- Follow BMAD micro-commit pattern
- Maintain high test coverage
- Use AgentDoc tags for documentation
- Implement security best practices

## Risk Assessment
- **Security**: Mitigate with validation and secure coding
- **Performance**: Optimize critical paths
- **Maintainability**: Enforce clean code principles

---
*Designed by Architect Agent on ${new Date().toISOString()}*`;

        return design;
    }

    /**
     * @ai-context Create implementation issue for developers
     */
    async createImplementationIssue(planningIssue, architectureDesign) {
        const title = `Implementation: ${planningIssue.title.replace('Architecture Planning: ', '')}`;
        const body = `## Planning Issue
#${planningIssue.number}: ${planningIssue.title}

## Architecture Design
${architectureDesign}

## Implementation Tasks

### Phase 1: Core Setup
- [ ] Initialize project structure
- [ ] Set up core application framework
- [ ] Configure basic configuration
- [ ] Implement core utilities

### Phase 2: Core Features
- [ ] Implement primary business logic
- [ ] Add data layer implementation
- [ ] Implement input/output handling
- [ ] Add logging and monitoring

### Phase 3: Integration
- [ ] External API integration (if needed)
- [ ] Event handling
- [ ] State management

### Phase 4: Testing & Security
- [ ] Unit tests
- [ ] Integration tests
- [ ] Security review
- [ ] Performance testing

## Technical Requirements
- Follow the architecture design exactly
- Implement all security measures
- Maintain code quality standards
- Add comprehensive tests

## Deliverables
- Working implementation
- Test suite (>80% coverage)
- Security documentation
- Deployment guide

## Next Steps
@helton-godoy/developer Please implement according to this design.

---
*Created by Architect Agent*`;

        await this.createIssue(title, body, ['implementation', 'development']);
    }
}

module.exports = Architect;
