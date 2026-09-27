const fs = require('fs');
const os = require('os');
const path = require('path');

const AgentDoc = require('../../scripts/agent-doc');
const BmadAgentDoc = require('../../scripts/bmad/agent-doc');
const EnhancedAgentDoc = require('../../scripts/bmad/agent-doc-enhanced');

describe('Agent documentation tools', () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-doc-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const taggedSource = `/**
 * @ai-context Persona workflow API component
 * @ai-invariant State must remain valid
 * @ai-connection Connects to storage service
 * @ai-security Validate every request
 * @ai-performance Cache repeated reads
 */
// @ai-todo add metrics
`;

  test.each([
    ['root', AgentDoc],
    ['bmad', BmadAgentDoc],
  ])('%s generator scans, extracts, formats and writes a system map', async (_, tool) => {
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'src', 'sample.js'), taggedSource);
    fs.writeFileSync(path.join(root, 'src', 'ignored.txt'), taggedSource);
    fs.writeFileSync(path.join(root, 'node_modules', 'hidden.js'), taggedSource);

    const files = tool.scanDir(root);
    expect(files).toEqual([path.join(root, 'src', 'sample.js')]);
    const tags = tool.extractTags(taggedSource);
    expect(tags.map((tag) => tag.type)).toEqual([
      'ai-invariant',
      'ai-context',
      'ai-connection',
    ]);
    expect(tool.generateMarkdown({})).toContain('No AgentDoc tags');
    const markdown = tool.generateMarkdown({ 'src/sample.js': tags, empty: [] });
    expect(markdown).toContain('Persona workflow API component');
    expect(markdown).toContain('DO NOT BREAK');
    expect(markdown).toContain('Connects to storage service');

    const result = await tool.main({ rootDir: root, syncQdrant: false });
    expect(result.mapData['src/sample.js']).toHaveLength(3);
    expect(fs.readFileSync(result.outputPath, 'utf8')).toContain('SYSTEM MAP');
  });

  test('root generator provides deterministic embeddings and Qdrant request handling', async () => {
    const first = AgentDoc.mockEmbedding('abc');
    const second = AgentDoc.mockEmbedding('abc');
    expect(first).toHaveLength(384);
    expect(first).toEqual(second);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ result: { collections: [] } }) })
      .mockResolvedValueOnce({ json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({ json: async () => ({ status: 'ok' }) });
    await AgentDoc.syncToQdrant({
      'a.js': [{ type: 'ai-context', content: 'context' }],
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    global.fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(AgentDoc.qdrantRequest('/collections')).resolves.toBeNull();
    delete global.fetch;
  });

  test('root generator handles existing collection, empty points and direct main sync', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ json: async () => ({
        status: 'ok',
        result: { collections: [{ name: 'bmad_agent_memory' }] },
      }) });
    await AgentDoc.ensureCollection();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch.mockClear();
    await AgentDoc.syncToQdrant({});
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fs.writeFileSync(path.join(root, 'plain.js'), 'const value = 1;');
    await AgentDoc.main({ rootDir: root, syncQdrant: true });
    expect(global.fetch).toHaveBeenCalled();
    delete global.fetch;
  });

  test('enhanced generator extracts all tag styles and generates every document', async () => {
    const doc = new EnhancedAgentDoc();
    const extracted = doc.extractTagsFromFile(taggedSource, 'src/sample.js');
    expect(extracted['ai-context'][0]).toMatchObject({
      file: 'src/sample.js',
      line: 1,
    });
    expect(extracted['ai-todo'][0].content).toBe('add metrics');
    expect(doc.getLineNumber('a\nb\nc', 4)).toBe(3);

    Object.keys(extracted).forEach((type) => {
      doc.semanticTags[type] = extracted[type];
    });
    const saved = {};
    jest.spyOn(doc, 'saveDocumentation').mockImplementation((name, body) => {
      saved[name] = body;
    });
    const append = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
    doc.generateDocumentation();

    expect(Object.keys(saved)).toEqual(
      expect.arrayContaining([
        'OVERVIEW.md',
        'ARCHITECTURE.md',
        'PERSONAS.md',
        'WORKFLOWS.md',
        'COMPONENTS.md',
        'API.md',
        'SECURITY.md',
        'PERFORMANCE.md',
        'SYSTEM_MAP.md',
        'SYSTEM_MAP.mermaid',
      ])
    );
    expect(saved['SYSTEM_MAP.mermaid']).toContain('storage_service');
    expect(append).toHaveBeenCalled();
    expect(doc.getMetrics().documentationGenerated).toBe(8);
  });

  test('enhanced generator covers empty and populated format helpers', () => {
    const doc = new EnhancedAgentDoc();
    const tag = { content: 'Persona workflow API component connects to DB', file: 'x.js', line: 2 };
    const methods = [
      'extractProjectDescription',
      'extractKeyComponents',
      'extractArchitecturePrinciples',
      'extractDevelopmentApproach',
      'formatInvariants',
      'formatConnections',
      'extractArchitecturePatterns',
      'extractTechnologyStack',
      'formatPersonas',
      'extractPersonaResponsibilities',
      'extractPersonaWorkflows',
      'formatWorkflows',
      'extractWorkflowPhases',
      'extractWorkflowMetrics',
      'formatComponents',
      'extractComponentInterfaces',
      'extractComponentDependencies',
      'formatAPIs',
      'extractAPIEndpoints',
      'extractAPIAuthentication',
      'formatSecurityConsiderations',
      'extractSecurityBestPractices',
      'extractSecurityMetrics',
      'formatPerformanceConsiderations',
      'extractPerformanceMetrics',
      'extractOptimizationStrategies',
    ];
    methods.forEach((method) => {
      expect(typeof doc[method]([])).toBe('string');
      expect(typeof doc[method]([tag])).toBe('string');
    });
    expect(doc.formatSemanticTags('ai-context')).toContain('No ai-context');
    doc.semanticTags['ai-context'] = [tag];
    expect(doc.formatSemanticTags('ai-context')).toContain('`x.js`');
  });

  test('enhanced helpers cover keyword-specific and fallback branches', () => {
    const doc = new EnhancedAgentDoc();
    const tags = [
      { content: 'project description architecture overview', file: 'a.js', line: 1 },
      { content: 'component service module responsibility', file: 'b.js', line: 2 },
      { content: 'principle pattern approach methodology', file: 'c.js', line: 3 },
      { content: 'technology framework database language', file: 'd.js', line: 4 },
      { content: 'persona role responsibility workflow process phase metric performance endpoint route auth security optimization cache', file: 'e.js', line: 5 },
    ];
    const methods = [
      'extractProjectDescription', 'extractKeyComponents',
      'extractArchitecturePrinciples', 'extractDevelopmentApproach',
      'extractArchitecturePatterns', 'extractTechnologyStack',
      'extractPersonaResponsibilities', 'extractPersonaWorkflows',
      'extractWorkflowPhases', 'extractWorkflowMetrics',
      'extractComponentInterfaces', 'extractComponentDependencies',
      'extractAPIEndpoints', 'extractAPIAuthentication',
      'extractSecurityBestPractices', 'extractSecurityMetrics',
      'extractPerformanceMetrics', 'extractOptimizationStrategies',
    ];
    methods.forEach((method) => {
      expect(doc[method](tags)).not.toBe('No information available.');
    });
  });

  test('enhanced scanner and run handle files, exclusions and read failures', async () => {
    fs.mkdirSync(path.join(root, 'nested'));
    fs.mkdirSync(path.join(root, '.hidden'));
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'nested', 'a.js'), taggedSource);
    fs.writeFileSync(path.join(root, 'nested', 'b.bin'), taggedSource);
    const doc = new EnhancedAgentDoc();
    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(doc.getAllCodeFiles()).toEqual([path.join('nested', 'a.js')]);
      jest.spyOn(doc, 'saveDocumentation').mockImplementation(() => {});
      jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      await doc.run();
      expect(doc.getMetrics().filesProcessed).toBe(1);
      expect(doc.getMetrics().tagsExtracted).toBeGreaterThan(0);
    } finally {
      process.chdir(cwd);
    }
  });
});
