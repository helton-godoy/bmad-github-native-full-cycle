/**
 * @ai-context Architect Persona - System design and technical decisions
 * @ai-invariant Architect must create technical specifications and system design
 * @ai-connection Architect connects to PM requirements and provides implementation guidance
 */
const BasePersona = require('./base-persona');

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
        const design = `# System Architecture Design

## Overview
Architecture design for: ${planningIssue.title}

## Requirements Analysis
Based on planning issue #${planningIssue.number}

## System Components

### 1. API Layer
- **Framework**: Express.js
- **Authentication**: JWT
- **Validation**: Input sanitization
- **Rate Limiting**: Security measure

### 2. Business Logic Layer
- **Services**: Modular service architecture
- **Controllers**: Request handling
- **Middleware**: Security and logging

### 3. Data Layer
- **Database**: File-based storage (for simplicity)
- **Caching**: In-memory cache
- **Backup**: Git-based versioning

### 4. Integration Layer
- **GitHub API**: @octokit/rest
- **Webhooks**: Event processing
- **Authentication**: OAuth/App tokens

## Security Architecture

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- API token management

### Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection

### API Security
- Rate limiting
- CORS configuration
- Request validation

## Performance Considerations

### Scalability
- Horizontal scaling ready
- Load balancing support
- Caching strategies

### Monitoring
- Request logging
- Performance metrics
- Error tracking

## Deployment Architecture

### Environment Setup
- Development: Local Node.js
- Testing: GitHub Actions
- Production: Container-ready

### CI/CD Pipeline
- Automated testing
- Security scanning
- Automated deployment

## Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Security**: bcrypt, jsonwebtoken
- **GitHub**: @octokit/rest
- **Testing**: Jest
- **Documentation**: AgentDoc

## Implementation Guidelines

### Code Structure
\`\`\`
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── middleware/      # Security & utilities
├── utils/           # Helper functions
└── config/          # Configuration
\`\`\`

### Development Standards
- Follow BMAD micro-commit pattern
- Maintain 80%+ test coverage
- Use AgentDoc tags for documentation
- Implement security best practices

## Risk Assessment
- **Security**: Medium risk, mitigated with best practices
- **Performance**: Low risk, optimized architecture
- **Scalability**: Medium risk, designed for growth
- **Maintainability**: Low risk, clean architecture

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
- [ ] Set up Express server
- [ ] Configure middleware
- [ ] Implement authentication

### Phase 2: API Development
- [ ] Implement core endpoints
- [ ] Add validation
- [ ] Error handling
- [ ] Logging

### Phase 3: Integration
- [ ] GitHub API integration
- [ ] Webhook handling
- [ ] Event processing
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
