module.exports = function (api) {
  let platform
  api.caller(caller => {
    platform = caller.platform
  })

  // Cache must be disabled
  api.cache(false)

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
            '~i18n': './i18n',
            '~state': './state',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  }

  if (platform === 'web') {
    config.presets = [
      'babel-preset-expo',
      [
        '@babel/preset-env',
        {
          targets: {
            chrome: '66',
          },
        },
      ],
    ]

    config.plugins = [
      ...config.plugins,
      ...[
        ['@babel/plugin-transform-class-properties', { loose: true }],
        ['@babel/plugin-transform-private-methods', { loose: true }],
        ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        'babel-plugin-transform-globalthis',
      ],
    ]
  }

  return config
}
