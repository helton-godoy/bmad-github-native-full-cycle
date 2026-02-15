const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                node: true,
                jest: true,
                describe: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly'
            }
        },
        rules: {
            'indent': 'off',
            'linebreak-style': ['error', 'unix'],
            'quotes': 'off', // Handled by Prettier
            'semi': 'off', // Handled by Prettier
            'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
            'no-console': 'off',
            'prefer-const': 'error',
            'no-var': 'error'
        },
        ignores: [
            'node_modules/**',
            'coverage/**',
            'dist/**',
            'build/**'
        ]
    }
];
