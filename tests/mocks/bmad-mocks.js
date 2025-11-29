/**
 * @ai-context Reusable Mocks for BMAD Unit Tests
 */

const mockOctokit = {
    rest: {
        issues: {
            get: jest.fn(),
            create: jest.fn().mockResolvedValue({ data: { number: 123, title: 'Mock Issue' } }),
            update: jest.fn()
        },
        repos: {
            getContent: jest.fn()
        }
    }
};

const mockContextManager = {
    read: jest.fn(),
    write: jest.fn(),
    computeHash: jest.fn().mockReturnValue('mock-hash')
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

const mockFs = {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    mkdirSync: jest.fn()
};

module.exports = {
    mockOctokit,
    mockContextManager,
    mockLogger,
    mockFs
};
