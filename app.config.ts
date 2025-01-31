import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  newArchEnabled: false,
  name: process.env.APP_NAME ?? 'dev - Bible Strong',
  jsEngine: 'hermes',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  primaryColor: '#fff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android'],
  version: '18.0.7',
  orientation: 'default',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',

  android: {
    versionCode: 386,
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
    buildNumber: '176',
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
    },

    entitlements: {
      'com.apple.developer.applesignin': ['Default'],
    },
  },
  plugins: [
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
        imageWidth: 160,
        backgroundColor: '#fff',
        dark: {
          backgroundColor: '#0F2132',
        },
      },
    ],
    ['@react-native-google-signin/google-signin'],
  ],
  extra: {
    eas: {
      projectId: 'fdf72b90-346b-11e9-ad9a-255491359311',
    },
    updates: {
      assetPatternsToBeBundled: [
        'assets/images/*',
        'src/assets/fonts/*',
        'src/assets/images/*',
        'src/assets/plans/*',
        'src/assets/bible_versions/*',
        'src/assets/timeline/*',
        'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf',
        'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf',
        'src/features/bible/bibleWebView/dist/index.html',
        'src/features/studies/studiesWebView/dist/index.html',
      ],
    },
  },
})
