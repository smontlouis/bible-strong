import { ExpoConfig, ConfigContext } from 'expo/config'

const isAppCheckBeta = process.env.ANDROID_APP_CHECK_BETA === 'true'
const betaVersionCode = Number(process.env.ANDROID_APP_CHECK_BETA_VERSION_CODE ?? '505')
if (
  isAppCheckBeta &&
  process.env.EAS_BUILD_PROFILE &&
  process.env.EAS_BUILD_PROFILE !== 'app-check-beta'
) {
  throw new Error('ANDROID_APP_CHECK_BETA is reserved for the app-check-beta build profile.')
}
if (isAppCheckBeta && (!Number.isSafeInteger(betaVersionCode) || betaVersionCode <= 504)) {
  throw new Error('ANDROID_APP_CHECK_BETA_VERSION_CODE must be an integer greater than 504.')
}
if (isAppCheckBeta && process.env.EAS_BUILD_PLATFORM === 'ios') {
  throw new Error('The App Check beta profile is Android-only.')
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME ?? 'dev - Bible Strong',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  scheme: 'biblestrong',
  primaryColor: '#ffffff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android', 'web'],
  version: isAppCheckBeta ? '27.0.18-beta.1' : '27.0.17',
  orientation: 'default',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',

  android: {
    versionCode: isAppCheckBeta ? betaVersionCode : 505,
    // Isolate this native pilot without changing the runtime of standard releases.
    // Bump this identifier whenever the beta's native dependencies/configuration change.
    runtimeVersion: isAppCheckBeta ? 'android-app-check-recaptcha-beta-v1' : undefined,
    package: 'com.smontlouis.biblestrong',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ?? 'firebase/dev/google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/foreground-image.png',
      backgroundImage: './assets/images/background-image.png',
      monochromeImage: './assets/images/icon_notification.png',
    },
    // Deep linking: Android App Links
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'bible-strong.app',
            pathPrefix: '/',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    bundleIdentifier: process.env.BUNDLE_IDENTIFIER ?? 'com.smontlouis.biblestrong.dev',
    buildNumber: '293',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ?? './firebase/dev/GoogleService-Info.plist',
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
      'com.apple.developer.devicecheck.appattest-environment': 'production',
    },
    // Deep linking: iOS Universal Links
    associatedDomains: ['applinks:bible-strong.app'],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/icon-2.png',
  },
  plugins: [
    'expo-sharing',
    'expo-router',
    'expo-asset',
    'expo-image',
    'expo-sqlite',
    'expo-audio',
    '@react-native-firebase/app',
    './plugins/withFirebaseAppCheckSwiftBridge.js',
    '@react-native-firebase/app-check',
    [
      './plugins/withAndroidAppCheckBeta.js',
      {
        enabled: isAppCheckBeta,
        siteKey: isAppCheckBeta ? process.env.ANDROID_APP_CHECK_RECAPTCHA_SITE_KEY : undefined,
      },
    ],
    '@react-native-firebase/auth',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.4',
          useFrameworks: 'static',
          forceStaticLinking: [
            'RNFBApp',
            'RNFBAppCheck',
            'RNFBAuth',
            'RNFBFirestore',
            'RNFBConfig',
            'RNFBStorage',
          ],
        },
        android: {
          targetSdkVersion: 36,
          usesCleartextTraffic: true,
          extraMavenRepos: ['../../node_modules/@notifee/react-native/android/libs'],
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
    resourceApiUrl: process.env.EXPO_PUBLIC_RESOURCE_API_URL,
    resourceArtifactBaseUrl: process.env.EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL,
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
  experiments: {
    reactCompiler: true,
  },
  runtimeVersion: 'a170e84b5290228c1fc1a7d1b850784dc093085c',
  // runtimeVersion: {
  //   policy: 'fingerprint',
  // },
})
