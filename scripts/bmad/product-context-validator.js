/**
 * @ai-context Product Context Schema Validator
 * @ai-invariant Ensures productContext.md has required structure
 */

const fs = require('fs');

class ProductContextValidator {
    constructor() {
        this.requiredSections = [
            '## Project Overview',
            '## Technical Stack',
            '## Core Requirements',
            '## Success Metrics'
        ];

        this.validTechStacks = [
            'node.js', 'nodejs',
            'go', 'golang',
            'python',
            'rust',
            'java'
        ];
    }

    /**
     * @ai-context Validate productContext.md structure
     */
    validate(filePath = 'productContext.md') {
        if (!fs.existsSync(filePath)) {
            throw new Error(`productContext.md not found at ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const errors = [];
        const warnings = [];

        // 1. Check required sections
        for (const section of this.requiredSections) {
            if (!content.includes(section)) {
                errors.push(`Missing required section: ${section}`);
            }
        }

        // 2. Validate Technical Stack section
        if (content.includes('## Technical Stack')) {
            const techStackSection = this.extractSection(content, 'Technical Stack');
            const detectedStack = this.detectTechStack(techStackSection);

            if (detectedStack.length === 0) {
                errors.push('No valid technology stack detected in ## Technical Stack');
            } else if (detectedStack.length > 2) {
                warnings.push(`Multiple technology stacks detected: ${detectedStack.join(', ')}. Ensure compatibility.`);
            }
        }

        // 3. Check for empty sections
        for (const section of this.requiredSections) {
            if (content.includes(section)) {
                const sectionContent = this.extractSection(content, section.replace('## ', ''));
                if (sectionContent.trim().length < 50) {
                    warnings.push(`Section ${section} is very short (< 50 chars). Consider adding more detail.`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * @ai-context Extract section content from markdown
     */
    extractSection(content, sectionTitle) {
        const regex = new RegExp(`## ${sectionTitle}\\s*([\\s\\S]*?)(?=##|$)`, 'i');
        const match = content.match(regex);
        return match ? match[1].trim() : '';
    }

    /**
     * @ai-context Detect technology stack from content
     */
    detectTechStack(content) {
        const lowerContent = content.toLowerCase();
        const detected = [];

        for (const tech of this.validTechStacks) {
            if (lowerContent.includes(tech)) {
                detected.push(tech);
            }
        }

        return detected;
    }

    /**
     * @ai-context Generate validation report
     */
    generateReport(validationResult) {
        let report = '# Product Context Validation Report\n\n';

        if (validationResult.valid) {
            report += '✅ **Status**: VALID\n\n';
        } else {
            report += '❌ **Status**: INVALID\n\n';
        }

        if (validationResult.errors.length > 0) {
            report += '## Errors\n\n';
            validationResult.errors.forEach(error => {
                report += `- ❌ ${error}\n`;
            });
            report += '\n';
        }

        if (validationResult.warnings.length > 0) {
            report += '## Warnings\n\n';
            validationResult.warnings.forEach(warning => {
                report += `- ⚠️ ${warning}\n`;
            });
        }

        return report;
    }
}

// CLI usage
if (require.main === module) {
    const validator = new ProductContextValidator();
    try {
        const result = validator.validate();
        console.log(validator.generateReport(result));
        process.exit(result.valid ? 0 : 1);
    } catch (error) {
        console.error(`❌ Validation failed: ${error.message}`);
        process.exit(1);
    }
}

module.exports = ProductContextValidator;
