import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME ?? 'Dev Bible Strong',
  jsEngine: 'hermes',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  privacy: 'unlisted',
  primaryColor: '#fff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android'],
  version: '17.2.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
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
    versionCode: 365,
    package: 'com.smontlouis.biblestrong',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ??
      'firebase/dev/google-services.json',
  },
  ios: {
    bundleIdentifier:
      process.env.BUNDLE_IDENTIFIER ?? 'com.smontlouis.biblestrong.dev',
    buildNumber: '157',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ??
      './firebase/dev/GoogleService-Info.plist',
  },
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#6E6E6E',
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
  ],
  extra: {
    eas: {
      projectId: '1afee084-2344-4ead-a708-ffefec92b35b',
    },
  },
})
