import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME ?? 'dev - Bible Strong',
  jsEngine: 'hermes',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  privacy: 'unlisted',
  primaryColor: '#fff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android'],
  version: '17.4.2',
  orientation: 'portrait',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: [
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
  android: {
    versionCode: 374,
    package: 'com.smontlouis.biblestrong',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ??
      'firebase/dev/google-services.json',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#fff',
      dark: {
        image: './assets/images/splash-dark.png',
        resizeMode: 'contain',
        backgroundColor: '#102031',
      },
    },
  },
  ios: {
    bundleIdentifier:
      process.env.BUNDLE_IDENTIFIER ?? 'com.smontlouis.biblestrong.dev',
    buildNumber: '162',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ??
      './firebase/dev/GoogleService-Info.plist',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#fff',
      dark: {
        image: './assets/images/splash-dark.png',
        resizeMode: 'contain',
        backgroundColor: '#0F2132',
      },
    },
    infoPlist: {
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
    '@react-native-firebase/crashlytics',
    '@notifee/react-native',
    [
      'expo-build-properties',
      {
        ios: {
          useFrameworks: 'static',
          infoPlist: {
            UIBackgroundModes: ['audio'],
          },
        },
        android: {
          compileSdkVersion: 34,
          usesCleartextTraffic: true,
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
  ],
  extra: {
    eas: {
      projectId: 'fdf72b90-346b-11e9-ad9a-255491359311',
    },
  },
})
