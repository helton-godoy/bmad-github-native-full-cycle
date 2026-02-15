module.exports = {
  plugins: {
    'postcss-import': {},
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      stage: 3,
      features: {
        'nesting-rules': true,
      },
    },
  },
};
