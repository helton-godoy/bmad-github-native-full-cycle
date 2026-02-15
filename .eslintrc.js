module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    rules: {
        'no-console': 'warn',
        'no-unused-vars': 'error',
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'indent': 'off', // Handled by Prettier
        'comma-dangle': ['error', 'always-multiline'],
    },
};
