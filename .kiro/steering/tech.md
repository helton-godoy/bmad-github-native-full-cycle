# Technology Stack & Build System

## Core Technologies

### Runtime & Framework

- **Node.js**: >= 18.0.0 (ES2021 features enabled)
- **Express.js**: Web application framework
- **JavaScript**: ES6+ with CommonJS modules

### Development Tools

- **ESLint**: Code linting with recommended rules
- **Prettier**: Code formatting
- **Jest**: Testing framework with 80% coverage threshold
- **Babel**: Transpilation for Node.js 18 target

### Dependencies

- **@octokit/rest**: GitHub API integration
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT authentication
- **helmet**: Security middleware
- **joi**: Input validation
- **winston**: Logging (via custom Logger class)

## Build System & Commands

### Essential Commands

```bash
# Setup and installation
npm install
npm run setup                    # Install dependencies and set permissions

# Development
npm start                        # Start the application
npm run dev                      # Generate docs and start

# BMAD Workflow Commands
npm run bmad:workflow <issue>    # Execute enhanced full workflow
npm run bmad:docs               # Generate enhanced documentation
npm run bmad:gatekeeper         # Run gatekeeper validation

# Quality Assurance
npm run test                    # Run Jest tests
npm run test:coverage           # Run tests with coverage report
npm run lint                    # Run ESLint
npm run lint:fix               # Fix ESLint issues automatically
npm run validate               # Run lint + test (required for commits)

# Build & Release
npm run build                   # Generate docs + validate
npm run release                 # Build + coverage report
```

### Code Quality Standards

- **ESLint Rules**:
  - Single quotes required
  - Semicolons required
  - 2-space indentation
  - No unused variables (error)
  - Console warnings allowed
- **Test Coverage**: Minimum 80% for branches, functions, lines, statements
- **Pre-commit Validation**: All commits must pass `npm run validate`

## Architecture Patterns

### BMAD Persona System

- All personas extend `EnhancedBasePersona` class
- Personas use dependency injection for GitHub API, logging, context management
- Commit pattern: `[PERSONA] [STEP-ID] Description`

### Context Management

- `ContextManager`: Handles file-based context with atomic operations
- `Logger`: Centralized logging with component-based organization
- `SecretManager`: Environment variable validation
- `CacheManager`: In-memory caching with TTL

### Security

- Helmet middleware for Express security headers
- JWT-based authentication
- Bcrypt for password hashing
- Input validation with Joi schemas
