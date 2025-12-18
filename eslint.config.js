const expoConfig = require('eslint-config-expo/flat')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'react/display-name': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'builds/**',
      'dist/**',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
      'src/features/bible/bibleWebView/**',
      'src/features/studies/studiesWebView/**',
      'src/helpers/react-native-htmlview/vendor/**',
      'src/helpers/lunr.*.min.js',
    ],
  },
]
