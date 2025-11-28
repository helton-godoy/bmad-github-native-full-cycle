/**
 * @ai-context Jest setup file for BMAD testing
 * @ai-invariant Configure test environment and mocks
 * @ai-connection Setup consistent test environment across all tests
 */

// Mock environment variables
process.env.GITHUB_TOKEN = 'mock-github-token';
process.env.GITHUB_OWNER = 'helton-godoy';
process.env.GITHUB_REPO = 'shantilly-cli';
process.env.GITHUB_BRANCH = 'main';
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);
