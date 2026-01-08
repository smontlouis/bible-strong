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
            '~devtools': './src/devtools',
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
      // Automatically adds debug labels to Jotai atoms
      'jotai/babel/plugin-debug-label',
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  }

  return config
}
