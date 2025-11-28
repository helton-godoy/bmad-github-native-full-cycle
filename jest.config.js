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
    testTimeout: 30000,
    transformIgnorePatterns: [
        'node_modules/(?!(@octokit)/)'
    ],
    moduleNameMapper: {
        '^@octokit/rest': '<rootDir>/tests/mocks/octokit.js'
    },
    verbose: true
};
