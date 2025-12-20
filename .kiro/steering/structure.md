# Project Structure & Organization

## Root Directory Layout

```
bmad-github-native-full-cycle/
├── .clinerules/                # AI agent rules and workflows
├── .github/                    # GitHub templates and workflows
├── .kiro/                      # Kiro IDE configuration and steering
├── agent-core/                 # Core agent functionality
├── bin/                        # Executable scripts
├── docs/                       # Generated documentation
├── personas/                   # BMAD persona implementations
├── scripts/                    # Automation and workflow scripts
├── src/                        # Main application source code
├── tests/                      # Test suites and mocks
└── Configuration files         # Package.json, eslint, etc.
```

## Key Directories

### `/src` - Application Source

- `app.js` - Express application setup
- `index.js` - Application entry point
- `controllers/` - Request handlers
- `middleware/` - Express middleware
- `repositories/` - Data access layer
- `routes/` - API route definitions
- `services/` - Business logic
- `utils/` - Utility functions

### `/personas` - BMAD AI Personas

- `base-persona-enhanced.js` - Enhanced base class for all personas
- `developer-enhanced.js` - Enhanced developer persona
- Individual persona files for PM, Architect, QA, DevOps, Security, Release Manager

### `/scripts` - Automation Scripts

- `bmad/` - BMAD-specific workflow scripts
- `lib/` - Shared utility libraries (ContextManager, Logger, etc.)
- `agent-doc.js` - Documentation generation

### `/tests` - Test Organization

- `unit/` - Unit tests
- `integration/` - Integration tests
- `mocks/` - Test mocks and fixtures
- `personas/` - Persona-specific tests
- `simulation/` - Workflow simulation tests

### `/docs` - Documentation

- `architecture/` - System architecture docs
- `en/` - English documentation
- `pt-br/` - Portuguese documentation
- `operations/` - Operational runbooks
- `reports/` - Generated reports and audits

## File Naming Conventions

### Source Files

- Use kebab-case for directories: `user-management/`
- Use camelCase for JavaScript files: `userController.js`
- Use PascalCase for classes: `EnhancedBasePersona`

### Documentation

- Use UPPERCASE for important docs: `README.md`, `SECURITY.md`
- Use kebab-case for generated docs: `tech-spec.md`
- Include language suffix: `README.pt-br.md`

### BMAD-Specific Files

- Persona files: `[role]-enhanced.js` or `[role].js`
- Workflow scripts: `bmad-[function].js`
- Context files: `productContext.md`, `activeContext.md`

## Configuration Files Location

### Root Level

- `package.json` - Dependencies and scripts
- `.eslintrc.js` - Linting configuration
- `jest.config.js` - Test configuration
- `.env.example` - Environment template

### Hidden Directories

- `.github/` - GitHub-specific files
- `.kiro/` - Kiro IDE settings and steering rules
- `.clinerules/` - AI agent behavior rules

## Import/Export Patterns

### Module Exports

```javascript
// Use CommonJS for Node.js compatibility
module.exports = ClassName;
module.exports = { function1, function2 };
```

### Dependency Injection

```javascript
// Personas receive dependencies via constructor
constructor(name, role, githubToken) {
    this.octokit = new Octokit({ auth: githubToken });
    this.contextManager = new ContextManager();
}
```

## Memory Bank Files

### Context Management

- `productContext.md` - Long-term project knowledge (always loaded)
- `activeContext.md` - Current session context (frequently updated)
- `.clineignore` - Files to exclude from AI context for token optimization

### State Tracking

- `.github/BMAD_HANDOVER.md` - Persona transition state
- `task.md` - Current roadmap and tasks

## Security Considerations

### Sensitive Files

- Never commit `.env` files
- Use `.secrets.example` for templates
- Store tokens in environment variables only

### File Permissions

- Executable scripts in `bin/` and `scripts/`
- Read-only for configuration files
- Write access for context and log files
