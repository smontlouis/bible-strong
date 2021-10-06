module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    assetExts: [
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
  },
}
