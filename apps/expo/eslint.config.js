const expoConfig = require('eslint-config-expo/flat')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')
const reactCompiler = require('eslint-plugin-react-compiler')
const globals = require('globals')
module.exports = [
  ...expoConfig,
  prettierConfig,
  reactCompiler.configs.recommended,
  {
    files: ['**/__tests__/**/*.ts', '**/*-test.ts'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    files: ['plugins/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'off',
      'react-compiler/react-compiler': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      // On web, Uniwind only swaps in its className-aware components for named imports, which
      // babel-plugin-react-native-web points at react-native-web/dist/exports/<Name>. A namespace
      // import goes through react-native-web's index and drops every className.
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportDeclaration[source.value='react-native'] > ImportNamespaceSpecifier",
          message:
            "Import React Native components by name: on web, `import * as X from 'react-native'` bypasses Uniwind and ignores className.",
        },
        // Hermes on Android builds a collator on every localeCompare call: sorting a list kept the
        // JS thread busy for seconds on entry-level phones and raised ANRs.
        {
          selector: "CallExpression[callee.property.name='localeCompare']",
          message: 'Use compareText from ~helpers/compareText: localeCompare is slow on Android.',
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '**/*.css',
      'src/uniwind-types.d.ts',
      '.expo/**',
      'android/**',
      'ios/**',
      'builds/**',
      'dist/**',
      // Local artefacts, all git-ignored. Flat config does not read .gitignore, and a desktop
      // export or a saved bundle (tens of MB of minified JS) keeps ESLint busy for many minutes.
      'dist-desktop/**',
      '.scratch/**',
      '.wrangler/**',
      '.sim-fleet/**',
      '.playwright-cli/**',
      'coverage/**',
      'modules/*/android/build/**',
      'modules/*/android/.gradle/**',
      'modules/*/android/src/main/java/**/generated/**',
      'modules/*/ios/Generated/**',
      'docs/assets/app-flows/dist/**',
      'docs/research/data/bible-project/presentation-data.js',
      '.agents/**',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
      'src/helpers/react-native-htmlview/vendor/**',
      'vendor/**',
      'src/helpers/lunr.*.min.js',
      '_bmad/**',
      '_bmad-output/**',
      'src/features/studies/StudiesDOM/**',
      'src/features/bible/BibleDOM/**',
    ],
  },
]
