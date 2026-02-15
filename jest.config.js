module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/scripts', '<rootDir>/personas', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        'scripts/**/*.js',
        'personas/**/*.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!src/index.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 10000, // Reduced from 30000
    transformIgnorePatterns: [
        'node_modules/(?!(@octokit)/)'
    ],
    moduleNameMapper: {
        '^@octokit/rest': '<rootDir>/tests/mocks/octokit.js'
    },
    verbose: false, // Reduced verbosity
    silent: false,

    // Performance optimizations
    maxWorkers: 1, // Force single worker by default
    cache: false, // Disable cache to reduce I/O
    bail: 1, // Stop on first failure
    forceExit: true, // Force exit after tests
    detectOpenHandles: false, // Disable handle detection for speed

    // Memory optimizations
    logHeapUsage: false,
    exposedGC: false,

    // CI optimizations (will be overridden by environment)
    ci: process.env.CI === 'true',

    // Custom test sequencer for better resource management
    testSequencer: '<rootDir>/tests/utils/resource-aware-sequencer.js'
};
