import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  newArchEnabled: false,
  name: process.env.APP_NAME ?? 'dev - Bible Strong',
  jsEngine: 'hermes',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  primaryColor: '#ffffff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android'],
  version: '21.2.2',
  orientation: 'default',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',

  android: {
    versionCode: 423,
    package: 'com.smontlouis.biblestrong',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ??
      'firebase/dev/google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/foreground-image.png',
      backgroundImage: './assets/images/background-image.png',
      monochromeImage: './assets/images/icon_notification.png',
    },
  },
  ios: {
    bundleIdentifier:
      process.env.BUNDLE_IDENTIFIER ?? 'com.smontlouis.biblestrong.dev',
    buildNumber: '212',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ??
      './firebase/dev/GoogleService-Info.plist',
    userInterfaceStyle: 'automatic',
    supportsTablet: true,
    infoPlist: {
      UIBackgroundModes: ['audio'],
      NSAppTransportSecurity: {
        NSExceptionDomains: {
          'timeline.biblehistory.com': {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
      ITSAppUsesNonExemptEncryption: false,
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ['en', 'fr'],
      CFBundleDevelopmentRegion: 'en',
    },

    entitlements: {
      'com.apple.developer.applesignin': ['Default'],
    },
  },
  plugins: [
    'expo-asset',
    'expo-sqlite',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
          useFrameworks: 'static',
        },
        android: {
          targetSdkVersion: 35,
          usesCleartextTraffic: true,
          extraMavenRepos: [
            '../../node_modules/@notifee/react-native/android/libs',
          ],
        },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './src/assets/fonts/LiterataBook-Regular.otf',
          './src/assets/fonts/eina-03-bold.otf',
        ],
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'sevn-apps',
        project: 'bible-strong',
      },
    ],
    ['./plugins/gradleProperties.js'],
    [
      './plugins/withAndroidUsesFeature.js',
      {
        name: 'android.hardware.microphone',
        attributes: {
          required: 'false',
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash.png',
        imageWidth: 200,
        backgroundColor: '#ffffff',
        dark: {
          image: './assets/images/splash-dark.png',
          imageWidth: 200,
          backgroundColor: '#0F2132',
        },
      },
    ],
    ['@react-native-google-signin/google-signin'],
    ['react-native-edge-to-edge'],
  ],
  extra: {
    eas: {
      projectId: 'fdf72b90-346b-11e9-ad9a-255491359311',
    },
    ethern: {
      projectId: 'ccb42b86-1286-4ca0-99bd-929b7ce418c1',
    },
  },
  updates: {
    url: 'https://u.expo.dev/fdf72b90-346b-11e9-ad9a-255491359311',
    checkAutomatically: 'NEVER',
    requestHeaders: {
      'expo-channel-name': process.env.EAS_BUILD_CHANNEL,
    },
  },
  runtimeVersion: '1.0.2',
})
