import { ExpoConfig, ConfigContext } from 'expo/config'

const environment = process.env.EXPO_PUBLIC_ENVIRONMENT

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Bible Strong',
  jsEngine: 'hermes',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  privacy: 'unlisted',
  primaryColor: '#fff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android'],
  version: '17.2.0',
  orientation: 'default',
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
    googleServicesFile: './google-services.json',
  },
  ios: {
    buildNumber: '157',
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
          compileSdkVersion: 33,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '9201ed8c-3151-4540-a1ec-c61a13be0f42',
    },
  },
})
