export default {
  locales: ['en', 'fr'],
  input: [
    'src/**/*.{js,ts,tsx}',
    '!src/features/bible/bibleWebView/**',
    '!src/features/studies/studiesWebView/**',
  ],
  output: 'i18n/locales/$LOCALE/translation.json',
  defaultNamespace: 'translation',
  keySeparator: false,
  namespaceSeparator: false,
  keepRemoved: true,
  jsonIndent: 2,
  lineEnding: '\n',
}
