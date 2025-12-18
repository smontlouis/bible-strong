module.exports = function (api) {
  api.cache(true)

  const config = {
    presets: ['babel-preset-expo'],
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
            '~themes': './src/themes',
            '~state': './src/state',
            '~i18n': './i18n',
          },
        },
      ],
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  }

  return config
}
