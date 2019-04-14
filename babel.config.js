module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['transform-remove-console'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '~assets': './src/assets',
            '~common': './src/common',
            '~features': './src/features',
            '~helpers': './src/helpers',
            '~navigation': './src/navigation',
            '~redux': './src/redux',
            '~themes': './src/themes'
          }
        }
      ]
    ]
  }
}
