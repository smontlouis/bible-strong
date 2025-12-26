const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

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
    'wasm', // Required for expo-sqlite web support
  ],
  // Disable package exports to fix "import.meta" errors with shaka-player and other ESM packages
  // See: https://github.com/expo/expo/issues/30323
  unstable_enablePackageExports: false,
  resolveRequest: (context, moduleName, platform) => {
    // Web shims for native-only packages
    if (platform === 'web') {
      if (moduleName === '@invertase/react-native-apple-authentication') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-apple-authentication.web.tsx'),
          type: 'sourceFile',
        }
      }
      if (moduleName === 'rn-fetch-blob') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/rn-fetch-blob.web.ts'),
          type: 'sourceFile',
        }
      }
      if (moduleName === 'redux-persist-filesystem-storage') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/redux-persist-filesystem-storage.web.ts'),
          type: 'sourceFile',
        }
      }
      // Firebase shims for web
      if (moduleName === '@react-native-firebase/firestore') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-firebase-firestore.web.ts'),
          type: 'sourceFile',
        }
      }
      if (moduleName === '@react-native-firebase/auth') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-firebase-auth.web.ts'),
          type: 'sourceFile',
        }
      }
      if (moduleName === '@react-native-firebase/analytics') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-firebase-analytics.web.ts'),
          type: 'sourceFile',
        }
      }
      if (moduleName === '@react-native-firebase/storage') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-firebase-storage.web.ts'),
          type: 'sourceFile',
        }
      }
      if (moduleName === '@react-native-firebase/remote-config') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-firebase-remote-config.web.ts'),
          type: 'sourceFile',
        }
      }
      // expo-file-system shim (handles both 'expo-file-system' and 'expo-file-system/legacy')
      if (moduleName === 'expo-file-system' || moduleName === 'expo-file-system/legacy') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/expo-file-system.web.ts'),
          type: 'sourceFile',
        }
      }
      if (moduleName === 'react-native-restart') {
        return {
          filePath: path.resolve(__dirname, 'src/shims/react-native-restart.web.ts'),
          type: 'sourceFile',
        }
      }
    }
    // Fall back to default resolution
    return context.resolveRequest(context, moduleName, platform)
  },
}

module.exports = config
