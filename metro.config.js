const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

config.resolver = {
  ...config.resolver,
  assetExts: [
    ...config.resolver.assetExts,
    'db',
    'sqlite',
    'mp3',
    'ttf',
    'otf',
    'png',
    'jpg',
    'jpeg',
    'json',
    'txt',
    'html',
  ],
}

module.exports = config
