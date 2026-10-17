module.exports = function (api) {
  const isWeb = api.caller(caller => caller?.platform === 'web')
  const isTest = api.env('test')

  const config = {
    // The Worklets plugin is configured at the end of `plugins`: the preset must not add a
    // second, unconfigured one.
    presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
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
      // Bundle Mode lets a worklet call an npm module off the JS thread: react-native-streamdown
      // closes streamed Markdown with `remend` there. Native bundles only. Keep this plugin last.
      [
        'react-native-worklets/plugin',
        { bundleMode: !isWeb && !isTest, importForwarding: { moduleNames: ['remend'] } },
      ],
    ],
    env: {
      test: {
        plugins: ['dynamic-import-node'],
      },
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  }

  return config
}
