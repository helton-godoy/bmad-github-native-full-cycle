/**
 * Resource-Aware Test Sequencer
 * Orders tests to minimize resource usage and prevent system overload
 */

const Sequencer = require('@jest/test-sequencer').default;
const fs = require('fs');
const path = require('path');

class ResourceAwareSequencer extends Sequencer {
    /**
     * Sort tests to optimize resource usage
     * 1. Unit tests first (faster, less resource intensive)
     * 2. Integration tests second
     * 3. Property-based tests last (most resource intensive)
     */
    sort(tests) {
        const testCategories = {
            unit: [],
            integration: [],
            property: [],
            other: []
        };

        // Categorize tests based on file path and content
        tests.forEach(test => {
            const testPath = test.path;
            const testContent = this.getTestContent(testPath);

            if (testPath.includes('/unit/') || testPath.includes('.unit.')) {
                testCategories.unit.push(test);
            } else if (testPath.includes('/integration/') || testPath.includes('.integration.')) {
                testCategories.integration.push(test);
            } else if (this.isPropertyBasedTest(testContent)) {
                testCategories.property.push(test);
            } else {
                testCategories.other.push(test);
            }
        });

        // Sort each category by file size (smaller files first)
        Object.keys(testCategories).forEach(category => {
            testCategories[category].sort((a, b) => {
                const sizeA = this.getFileSize(a.path);
                const sizeB = this.getFileSize(b.path);
                return sizeA - sizeB;
            });
        });

        // Return tests in optimized order
        return [
            ...testCategories.unit,
            ...testCategories.other,
            ...testCategories.integration,
            ...testCategories.property
        ];
    }

    /**
     * Get test file content safely
     */
    getTestContent(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            return '';
        }
    }

    /**
     * Check if test file contains property-based tests
     */
    isPropertyBasedTest(content) {
        const propertyTestIndicators = [
            'fc.assert',
            'fc.property',
            'fast-check',
            'Property-Based',
            'property test',
            'fc.asyncProperty'
        ];

        return propertyTestIndicators.some(indicator =>
            content.includes(indicator)
        );
    }

    /**
     * Get file size safely
     */
    getFileSize(filePath) {
        try {
            return fs.statSync(filePath).size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Estimate test complexity based on file content
     */
    estimateTestComplexity(filePath) {
        const content = this.getTestContent(filePath);
        const fileSize = this.getFileSize(filePath);

        let complexity = fileSize / 1000; // Base complexity on file size

        // Add complexity for specific patterns
        const complexityIndicators = [
            { pattern: /describe\(/g, weight: 1 },
            { pattern: /it\(/g, weight: 0.5 },
            { pattern: /test\(/g, weight: 0.5 },
            { pattern: /beforeEach\(/g, weight: 2 },
            { pattern: /afterEach\(/g, weight: 2 },
            { pattern: /mock/gi, weight: 1.5 },
            { pattern: /spy/gi, weight: 1.5 },
            { pattern: /async/g, weight: 2 },
            { pattern: /await/g, weight: 1 },
            { pattern: /setTimeout/g, weight: 3 },
            { pattern: /setInterval/g, weight: 3 },
            { pattern: /execSync/g, weight: 5 },
            { pattern: /spawn/g, weight: 4 }
        ];

        complexityIndicators.forEach(({ pattern, weight }) => {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length * weight;
            }
        });

        return complexity;
    }
}

module.exports = ResourceAwareSequencer;