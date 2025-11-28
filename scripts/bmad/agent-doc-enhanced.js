/**
 * @ai-context Enhanced Agent Documentation Generator with advanced semantic analysis
 * @ai-invariant Must extract and document all semantic tags from codebase
 * @ai-connection Connects code analysis to comprehensive documentation generation
 */
const fs = require('fs');
const path = require('path');

class EnhancedAgentDoc {
    constructor() {
        this.semanticTags = {
            'ai-context': [],
            'ai-invariant': [],
            'ai-connection': [],
            'ai-deprecated': [],
            'ai-todo': [],
            'ai-bug': [],
            'ai-performance': [],
            'ai-security': []
        };
        
        this.documentation = {
            overview: '',
            architecture: '',
            personas: [],
            workflows: [],
            components: [],
            apis: [],
            security: [],
            performance: []
        };

        this.metrics = {
            filesProcessed: 0,
            tagsExtracted: 0,
            documentationGenerated: 0,
            errors: 0
        };
    }

    /**
     * @ai-context Extract semantic tags from all files in the codebase
     */
    extractTags() {
        console.log('🔍 Extracting semantic tags from codebase...');
        
        const files = this.getAllCodeFiles();
        
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const tags = this.extractTagsFromFile(content, file);
                
                // Organize tags by type
                for (const [type, tagList] of Object.entries(tags)) {
                    this.semanticTags[type].push(...tagList);
                }
                
                this.metrics.filesProcessed++;
                console.log(`✅ Processed: ${file}`);
                
            } catch (error) {
                console.error(`❌ Error processing ${file}: ${error.message}`);
                this.metrics.errors++;
            }
        }
        
        this.metrics.tagsExtracted = Object.values(this.semanticTags).reduce((sum, tags) => sum + tags.length, 0);
        console.log(`📊 Extracted ${this.metrics.tagsExtracted} tags from ${this.metrics.filesProcessed} files`);
    }

    /**
     * @ai-context Get all code files from the project
     */
    getAllCodeFiles() {
        const extensions = ['.js', '.ts', '.go', '.py', '.java', '.md', '.json', '.yml', '.yaml'];
        const files = [];
        
        const scanDirectory = (dir) => {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    scanDirectory(fullPath);
                } else if (stat.isFile()) {
                    const ext = path.extname(item);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        };
        
        scanDirectory('.');
        return files;
    }

    /**
     * @ai-context Extract tags from a single file
     */
    extractTagsFromFile(content, filePath) {
        const tags = {};
        
        // Initialize tag types
        for (const tagType of Object.keys(this.semanticTags)) {
            tags[tagType] = [];
        }
        
        // Extract from block comments
        const blockCommentRegex = /\/\*\*([\s\S]*?)\*\//g;
        let match;
        
        while ((match = blockCommentRegex.exec(content)) !== null) {
            const commentBlock = match[1];
            
            for (const tagType of Object.keys(tags)) {
                const tagRegex = new RegExp(`@${tagType}\\s+(.*)`, 'g');
                let tagMatch;
                
                while ((tagMatch = tagRegex.exec(commentBlock)) !== null) {
                    tags[tagType].push({
                        content: tagMatch[1].trim(),
                        file: filePath,
                        line: this.getLineNumber(content, match.index),
                        type: tagType
                    });
                }
            }
        }
        
        // Extract from line comments
        const lineCommentRegex = /\/\/.*@(\w+-\w+)\s+(.*)$/gm;
        
        while ((match = lineCommentRegex.exec(content)) !== null) {
            const tagType = match[1];
            const tagContent = match[2].trim();
            
            if (tags[tagType]) {
                tags[tagType].push({
                    content: tagContent,
                    file: filePath,
                    line: this.getLineNumber(content, match.index),
                    type: tagType
                });
            }
        }
        
        return tags;
    }

    /**
     * @ai-context Get line number from character index
     */
    getLineNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    /**
     * @ai-context Generate comprehensive documentation
     */
    generateDocumentation() {
        console.log('📝 Generating comprehensive documentation...');
        
        // Generate overview
        this.generateOverview();
        
        // Generate architecture documentation
        this.generateArchitecture();
        
        // Generate persona documentation
        this.generatePersonaDocumentation();
        
        // Generate workflow documentation
        this.generateWorkflowDocumentation();
        
        // Generate component documentation
        this.generateComponentDocumentation();
        
        // Generate API documentation
        this.generateAPIDocumentation();
        
        // Generate security documentation
        this.generateSecurityDocumentation();
        
        // Generate performance documentation
        this.generatePerformanceDocumentation();
        
        // Generate main system map
        this.generateSystemMap();
        
        this.metrics.documentationGenerated = 8;
        console.log(`📚 Generated ${this.metrics.documentationGenerated} documentation sections`);
    }

    /**
     * @ai-context Generate project overview
     */
    generateOverview() {
        const contexts = this.semanticTags['ai-context'];
        const overview = `# Project Overview

## Description
${this.extractProjectDescription(contexts)}

## Key Components
${this.extractKeyComponents(contexts)}

## Architecture Principles
${this.extractArchitecturePrinciples(contexts)}

## Development Approach
${this.extractDevelopmentApproach(contexts)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.overview = overview;
        this.saveDocumentation('OVERVIEW.md', overview);
    }

    /**
     * @ai-context Generate architecture documentation
     */
    generateArchitecture() {
        const invariants = this.semanticTags['ai-invariant'];
        const connections = this.semanticTags['ai-connection'];
        
        const architecture = `# Architecture Documentation

## System Invariants
${this.formatInvariants(invariants)}

## Component Connections
${this.formatConnections(connections)}

## Architecture Patterns
${this.extractArchitecturePatterns(invariants)}

## Technology Stack
${this.extractTechnologyStack(connections)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.architecture = architecture;
        this.saveDocumentation('ARCHITECTURE.md', architecture);
    }

    /**
     * @ai-context Generate persona documentation
     */
    generatePersonaDocumentation() {
        const personaTags = this.semanticTags['ai-context'].filter(tag => 
            tag.content.toLowerCase().includes('persona')
        );
        
        const personas = `# Persona Documentation

## Available Personas
${this.formatPersonas(personaTags)}

## Persona Responsibilities
${this.extractPersonaResponsibilities(personaTags)}

## Persona Workflows
${this.extractPersonaWorkflows(personaTags)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.personas = personas;
        this.saveDocumentation('PERSONAS.md', personas);
    }

    /**
     * @ai-context Generate workflow documentation
     */
    generateWorkflowDocumentation() {
        const workflowTags = this.semanticTags['ai-context'].filter(tag => 
            tag.content.toLowerCase().includes('workflow')
        );
        
        const workflows = `# Workflow Documentation

## Available Workflows
${this.formatWorkflows(workflowTags)}

## Workflow Phases
${this.extractWorkflowPhases(workflowTags)}

## Workflow Metrics
${this.extractWorkflowMetrics(workflowTags)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.workflows = workflows;
        this.saveDocumentation('WORKFLOWS.md', workflows);
    }

    /**
     * @ai-context Generate component documentation
     */
    generateComponentDocumentation() {
        const components = this.semanticTags['ai-context'].filter(tag => 
            tag.content.toLowerCase().includes('component')
        );
        
        const componentDocs = `# Component Documentation

## System Components
${this.formatComponents(components)}

## Component Interfaces
${this.extractComponentInterfaces(components)}

## Component Dependencies
${this.extractComponentDependencies(components)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.components = componentDocs;
        this.saveDocumentation('COMPONENTS.md', componentDocs);
    }

    /**
     * @ai-context Generate API documentation
     */
    generateAPIDocumentation() {
        const apiTags = this.semanticTags['ai-context'].filter(tag => 
            tag.content.toLowerCase().includes('api')
        );
        
        const apis = `# API Documentation

## Available APIs
${this.formatAPIs(apiTags)}

## API Endpoints
${this.extractAPIEndpoints(apiTags)}

## API Authentication
${this.extractAPIAuthentication(apiTags)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.apis = apis;
        this.saveDocumentation('API.md', apis);
    }

    /**
     * @ai-context Generate security documentation
     */
    generateSecurityDocumentation() {
        const securityTags = this.semanticTags['ai-security'];
        const securityDocs = `# Security Documentation

## Security Considerations
${this.formatSecurityConsiderations(securityTags)}

## Security Best Practices
${this.extractSecurityBestPractices(securityTags)}

## Security Metrics
${this.extractSecurityMetrics(securityTags)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.security = securityDocs;
        this.saveDocumentation('SECURITY.md', securityDocs);
    }

    /**
     * @ai-context Generate performance documentation
     */
    generatePerformanceDocumentation() {
        const performanceTags = this.semanticTags['ai-performance'];
        const performanceDocs = `# Performance Documentation

## Performance Considerations
${this.formatPerformanceConsiderations(performanceTags)}

## Performance Metrics
${this.extractPerformanceMetrics(performanceTags)}

## Optimization Strategies
${this.extractOptimizationStrategies(performanceTags)}

---
*Generated by Enhanced BMAD Agent Documentation*
`;

        this.documentation.performance = performanceDocs;
        this.saveDocumentation('PERFORMANCE.md', performanceDocs);
    }

    /**
     * @ai-context Generate enhanced system map
     */
    generateSystemMap() {
        const systemMap = `# Enhanced System Map

## Semantic Context
${this.formatSemanticTags('ai-context')}

## System Invariants
${this.formatSemanticTags('ai-invariant')}

## Component Connections
${this.formatSemanticTags('ai-connection')}

## Security Considerations
${this.formatSemanticTags('ai-security')}

## Performance Notes
${this.formatSemanticTags('ai-performance')}

## Known Issues
${this.formatSemanticTags('ai-bug')}

## TODO Items
${this.formatSemanticTags('ai-todo')}

## Deprecated Features
${this.formatSemanticTags('ai-deprecated')}

## Documentation Metrics
- Files Processed: ${this.metrics.filesProcessed}
- Tags Extracted: ${this.metrics.tagsExtracted}
- Documentation Generated: ${this.metrics.documentationGenerated}
- Errors: ${this.metrics.errors}

---
*Generated by Enhanced BMAD Agent Documentation*
*Last Updated: ${new Date().toISOString()}
`;

        this.saveDocumentation('SYSTEM_MAP.md', systemMap);
    }

    /**
     * @ai-context Format semantic tags for display
     */
    formatSemanticTags(tagType) {
        const tags = this.semanticTags[tagType];
        
        if (tags.length === 0) {
            return `No ${tagType} tags found.\n`;
        }
        
        return tags.map(tag => 
            `### ${tag.content}\n- **File:** \`${tag.file}\`\n- **Line:** ${tag.line}\n`
        ).join('\n');
    }

    /**
     * @ai-context Helper methods for content extraction
     */
    extractProjectDescription(contexts) {
        const descriptions = contexts.filter(tag => 
            tag.content.toLowerCase().includes('project') || 
            tag.content.toLowerCase().includes('description')
        );
        
        return descriptions.length > 0 
            ? descriptions.map(tag => `- ${tag.content}`).join('\n')
            : 'Project description not found in semantic tags.';
    }

    extractKeyComponents(contexts) {
        const components = contexts.filter(tag => 
            tag.content.toLowerCase().includes('component')
        );
        
        return components.length > 0 
            ? components.map(tag => `- **${tag.content}** (\`${tag.file}\`)`).join('\n')
            : 'No components identified in semantic tags.';
    }

    extractArchitecturePrinciples(contexts) {
        const principles = contexts.filter(tag => 
            tag.content.toLowerCase().includes('architecture') || 
            tag.content.toLowerCase().includes('principle')
        );
        
        return principles.length > 0 
            ? principles.map(tag => `- ${tag.content}`).join('\n')
            : 'No architecture principles found in semantic tags.';
    }

    extractDevelopmentApproach(contexts) {
        const approaches = contexts.filter(tag => 
            tag.content.toLowerCase().includes('development') || 
            tag.content.toLowerCase().includes('approach')
        );
        
        return approaches.length > 0 
            ? approaches.map(tag => `- ${tag.content}`).join('\n')
            : 'No development approach specified in semantic tags.';
    }

    formatInvariants(invariants) {
        return invariants.length > 0 
            ? invariants.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`:${tag.line})`).join('\n')
            : 'No invariants defined.';
    }

    formatConnections(connections) {
        return connections.length > 0 
            ? connections.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`:${tag.line})`).join('\n')
            : 'No connections defined.';
    }

    extractArchitecturePatterns(invariants) {
        const patterns = invariants.filter(tag => 
            tag.content.toLowerCase().includes('pattern')
        );
        
        return patterns.length > 0 
            ? patterns.map(tag => `- ${tag.content}`).join('\n')
            : 'No architecture patterns identified.';
    }

    extractTechnologyStack(connections) {
        const tech = connections.filter(tag => 
            tag.content.toLowerCase().includes('tech') || 
            tag.content.toLowerCase().includes('stack')
        );
        
        return tech.length > 0 
            ? tech.map(tag => `- ${tag.content}`).join('\n')
            : 'No technology stack information found.';
    }

    formatPersonas(personas) {
        return personas.length > 0 
            ? personas.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`)`).join('\n')
            : 'No personas defined.';
    }

    extractPersonaResponsibilities(personas) {
        const responsibilities = personas.filter(tag => 
            tag.content.toLowerCase().includes('responsibility')
        );
        
        return responsibilities.length > 0 
            ? responsibilities.map(tag => `- ${tag.content}`).join('\n')
            : 'No persona responsibilities defined.';
    }

    extractPersonaWorkflows(personas) {
        const workflows = personas.filter(tag => 
            tag.content.toLowerCase().includes('workflow')
        );
        
        return workflows.length > 0 
            ? workflows.map(tag => `- ${tag.content}`).join('\n')
            : 'No persona workflows defined.';
    }

    formatWorkflows(workflows) {
        return workflows.length > 0 
            ? workflows.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`)`).join('\n')
            : 'No workflows defined.';
    }

    extractWorkflowPhases(workflows) {
        const phases = workflows.filter(tag => 
            tag.content.toLowerCase().includes('phase')
        );
        
        return phases.length > 0 
            ? phases.map(tag => `- ${tag.content}`).join('\n')
            : 'No workflow phases defined.';
    }

    extractWorkflowMetrics(workflows) {
        const metrics = workflows.filter(tag => 
            tag.content.toLowerCase().includes('metric')
        );
        
        return metrics.length > 0 
            ? metrics.map(tag => `- ${tag.content}`).join('\n')
            : 'No workflow metrics defined.';
    }

    formatComponents(components) {
        return components.length > 0 
            ? components.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`)`).join('\n')
            : 'No components defined.';
    }

    extractComponentInterfaces(components) {
        const interfaces = components.filter(tag => 
            tag.content.toLowerCase().includes('interface')
        );
        
        return interfaces.length > 0 
            ? interfaces.map(tag => `- ${tag.content}`).join('\n')
            : 'No component interfaces defined.';
    }

    extractComponentDependencies(components) {
        const dependencies = components.filter(tag => 
            tag.content.toLowerCase().includes('dependency')
        );
        
        return dependencies.length > 0 
            ? dependencies.map(tag => `- ${tag.content}`).join('\n')
            : 'No component dependencies defined.';
    }

    formatAPIs(apis) {
        return apis.length > 0 
            ? apis.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`)`).join('\n')
            : 'No APIs defined.';
    }

    extractAPIEndpoints(apis) {
        const endpoints = apis.filter(tag => 
            tag.content.toLowerCase().includes('endpoint')
        );
        
        return endpoints.length > 0 
            ? endpoints.map(tag => `- ${tag.content}`).join('\n')
            : 'No API endpoints defined.';
    }

    extractAPIAuthentication(apis) {
        const auth = apis.filter(tag => 
            tag.content.toLowerCase().includes('auth')
        );
        
        return auth.length > 0 
            ? auth.map(tag => `- ${tag.content}`).join('\n')
            : 'No API authentication defined.';
    }

    formatSecurityConsiderations(securityTags) {
        return securityTags.length > 0 
            ? securityTags.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`:${tag.line})`).join('\n')
            : 'No security considerations defined.';
    }

    extractSecurityBestPractices(securityTags) {
        const practices = securityTags.filter(tag => 
            tag.content.toLowerCase().includes('practice')
        );
        
        return practices.length > 0 
            ? practices.map(tag => `- ${tag.content}`).join('\n')
            : 'No security best practices defined.';
    }

    extractSecurityMetrics(securityTags) {
        const metrics = securityTags.filter(tag => 
            tag.content.toLowerCase().includes('metric')
        );
        
        return metrics.length > 0 
            ? metrics.map(tag => `- ${tag.content}`).join('\n')
            : 'No security metrics defined.';
    }

    formatPerformanceConsiderations(performanceTags) {
        return performanceTags.length > 0 
            ? performanceTags.map(tag => `- **${tag.content}** (\`${path.basename(tag.file)}\`:${tag.line})`).join('\n')
            : 'No performance considerations defined.';
    }

    extractPerformanceMetrics(performanceTags) {
        const metrics = performanceTags.filter(tag => 
            tag.content.toLowerCase().includes('metric')
        );
        
        return metrics.length > 0 
            ? metrics.map(tag => `- ${tag.content}`).join('\n')
            : 'No performance metrics defined.';
    }

    extractOptimizationStrategies(performanceTags) {
        const strategies = performanceTags.filter(tag => 
            tag.content.toLowerCase().includes('optimization') || 
            tag.content.toLowerCase().includes('strategy')
        );
        
        return strategies.length > 0 
            ? strategies.map(tag => `- ${tag.content}`).join('\n')
            : 'No optimization strategies defined.';
    }

    /**
     * @ai-context Save documentation to file
     */
    saveDocumentation(filename, content) {
        const docsDir = 'docs/architecture';
        
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }
        
        const filePath = path.join(docsDir, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
        
        console.log(`📄 Saved: ${filePath}`);
    }

    /**
     * @ai-context Get documentation metrics
     */
    getMetrics() {
        return this.metrics;
    }

    /**
     * @ai-context Run complete documentation generation
     */
    async run() {
        console.log('🚀 Starting Enhanced Agent Documentation Generation...');
        
        try {
            this.extractTags();
            this.generateDocumentation();
            
            console.log('✅ Enhanced documentation generation completed!');
            console.log(`📊 Final Metrics:`, this.getMetrics());
            
        } catch (error) {
            console.error('❌ Documentation generation failed:', error.message);
            throw error;
        }
    }
}

// CLI Interface
if (require.main === module) {
    const agent = new EnhancedAgentDoc();
    agent.run()
        .then(() => {
            console.log('🎉 Enhanced Agent Documentation completed successfully!');
        })
        .catch(error => {
            console.error('❌ Enhanced Agent Documentation failed:', error.message);
            process.exit(1);
        });
}

module.exports = EnhancedAgentDoc;
