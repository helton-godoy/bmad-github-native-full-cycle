/**
 * Unit tests for agent-doc.js functions.
 */

const { extractTags, generateMarkdown } = require('../../agent-core/scripts/agent-doc');

describe('agent-doc extractTags', () => {
    it('should extract all tag types from a single block comment', () => {
        const content = `
/**
 * @ai-context This is context.
 * @ai-invariant This is an invariant.
 * @ai-connection This is a connection.
 */
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(3);
        expect(tags).toContainEqual({ type: 'ai-context', content: 'This is context.' });
        expect(tags).toContainEqual({ type: 'ai-invariant', content: 'This is an invariant.' });
        expect(tags).toContainEqual({ type: 'ai-connection', content: 'This is a connection.' });
    });

    it('should extract tags from multiple block comments', () => {
        const content = `
/**
 * @ai-context Context 1
 */

function someCode() {}

/**
 * @ai-invariant Invariant 1
 */
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(2);
        expect(tags).toContainEqual({ type: 'ai-context', content: 'Context 1' });
        expect(tags).toContainEqual({ type: 'ai-invariant', content: 'Invariant 1' });
    });

    it('should extract multiple tags of the same type', () => {
        const content = `
/**
 * @ai-context Context 1
 * @ai-context Context 2
 */
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(2);
        expect(tags).toContainEqual({ type: 'ai-context', content: 'Context 1' });
        expect(tags).toContainEqual({ type: 'ai-context', content: 'Context 2' });
    });

    it('should handle tags with varying whitespace', () => {
        const content = `
/**
 * @ai-context   Context with spaces
 * @ai-invariant	Invariant with tab
 */
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(2);
        expect(tags).toContainEqual({ type: 'ai-context', content: 'Context with spaces' });
        expect(tags).toContainEqual({ type: 'ai-invariant', content: 'Invariant with tab' });
    });

    it('should ignore regular block comments without tags', () => {
        const content = `
/**
 * This is a regular comment.
 */
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(0);
    });

    it('should ignore line comments (based on current regex)', () => {
        const content = `
// @ai-context This should be ignored
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(0);
    });

    it('should return empty array for empty content', () => {
        const tags = extractTags('');
        expect(tags).toEqual([]);
    });

    it('should handle complex content with tags mixed with text', () => {
        const content = `
/**
 * Some description
 * @ai-context Important context
 *
 * More text here.
 * @ai-invariant Critical invariant
 */
`;
        const tags = extractTags(content);
        expect(tags).toHaveLength(2);
        expect(tags).toContainEqual({ type: 'ai-context', content: 'Important context' });
        expect(tags).toContainEqual({ type: 'ai-invariant', content: 'Critical invariant' });
    });
});

describe('agent-doc generateMarkdown', () => {
    it('should generate markdown for empty mapData', () => {
        const mapData = {};
        const md = generateMarkdown(mapData);
        expect(md).toContain('*No AgentDoc tags found yet. Start adding `@ai-context` to your code!*');
    });

    it('should generate markdown with extracted tags', () => {
        const mapData = {
            'file1.js': [
                { type: 'ai-context', content: 'Context 1' },
                { type: 'ai-invariant', content: 'Invariant 1' },
                { type: 'ai-connection', content: 'Connection 1' }
            ]
        };
        const md = generateMarkdown(mapData);
        expect(md).toContain('## 📄 `file1.js`');
        expect(md).toContain('### 🧠 Context');
        expect(md).toContain('- Context 1');
        expect(md).toContain('### 🛡️ Invariants (DO NOT BREAK)');
        expect(md).toContain('- 🔴 **Invariant 1**');
        expect(md).toContain('### 🔗 Connections');
        expect(md).toContain('- ➡️ Connection 1');
    });

    it('should skip files with no tags', () => {
        const mapData = {
            'file1.js': [],
            'file2.js': [{ type: 'ai-context', content: 'Context 2' }]
        };
        const md = generateMarkdown(mapData);
        expect(md).not.toContain('file1.js');
        expect(md).toContain('file2.js');
    });
});
