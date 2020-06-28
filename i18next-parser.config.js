module.exports = {
  locales: ['en', 'fr'],
  output: 'i18n/locales/$LOCALE/$NAMESPACE.json',
  useKeysAsDefaultValue: true,
  keySeparator: false,
  lexers: {
    js: ['JsxLexer'],
    ts: ['JsxLexer'],
    jsx: ['JsxLexer'],
    tsx: ['JsxLexer'],

    default: ['JsxLexer'],
  },
}
