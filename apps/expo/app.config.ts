import { ExpoConfig, ConfigContext } from 'expo/config'

const APP_VERSION = '28.0.3'
// Patch releases share a runtime and receive the same OTA updates. Any native change must
// ship in a new major or minor version, which creates a new runtime.
const [majorVersion, minorVersion] = APP_VERSION.split('.')
const RUNTIME_VERSION = `${majorVersion}.${minorVersion}`

// Icon fonts built into the Android app. Loaded at run time, a font file an update copied can
// be empty on disk, and every icon of that family stays blank. Each family is named as
// @expo/vector-icons checks it with Font.isLoaded, so the icons never load it again. The plugin
// resolves the path as a module when it is not a file of the project.
const vectorIconFont = (fontFamily: string, file: string) => ({
  fontFamily,
  fontDefinitions: [
    {
      path: `@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${file}`,
      weight: 400,
    },
  ],
})

// The interface face, Pulp Display, built into both apps as one family of five weights, upright
// and italic, so that `fontWeight` and `fontStyle` pick the file. The files carry the metrics,
// weights and italic flags of the originals (`scripts/pulp-display-metrics.py`): iOS picks a
// face by them, Android by the definitions below.
const PULP_DISPLAY_WEIGHTS = [
  ['Regular', 400],
  ['Medium', 500],
  ['SemiBold', 600],
  ['Bold', 700],
  ['ExtraBold', 800],
] as const
const PULP_DISPLAY_FACES = PULP_DISPLAY_WEIGHTS.flatMap(([name, weight]) =>
  (['normal', 'italic'] as const).map(style => ({
    path: `./src/assets/fonts/PulpDisplay-${name}${style === 'italic' ? 'Italic' : ''}.ttf`,
    weight,
    style,
  }))
)

// The reading face, Literata Book, built into both apps under the name the app gives it. Android
// only knew it once the startup's deferred `Font.loadAsync` ran, so the first screens, the
// onboarding among them, were drawn in Roboto.
const LITERATA_BOOK = './src/assets/fonts/LiterataBook-Regular.otf'

// The families of public pages a link opens in the application.
const PUBLIC_RESOURCE_PATHS = [
  '/bible/',
  '/strong/',
  '/dictionary/',
  '/nave/',
  '/commentary/',
  '/timeline/',
]

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME ?? 'dev - Bible Strong',
  description: 'Bible strong for french people',
  slug: 'bible-strong',
  scheme: 'biblestrong',
  primaryColor: '#ffffff',
  githubUrl: 'https://github.com/bulby97/bible-strong',
  platforms: ['ios', 'android', 'web'],
  version: APP_VERSION,
  orientation: 'default',
  icon: './assets/images/icon-2.png',
  userInterfaceStyle: 'automatic',

  android: {
    versionCode: 516,
    package: 'com.smontlouis.biblestrong',
    googleServicesFile:
      process.env.ANDROID_GOOGLE_SERVICES_FILE ?? 'firebase/dev/google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/foreground-image.png',
      backgroundImage: './assets/images/background-image.png',
      monochromeImage: './assets/images/icon_notification.png',
    },
    // Deep linking: Android App Links. Only the resources the application shows (ADR-0082):
    // the home of the site, its legal pages and shared studies stay in the browser.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: PUBLIC_RESOURCE_PATHS.map(pathPrefix => ({
          scheme: 'https',
          host: 'bible-strong.app',
          pathPrefix,
        })),
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  ios: {
    bundleIdentifier: process.env.BUNDLE_IDENTIFIER ?? 'com.smontlouis.biblestrong.dev',
    buildNumber: '303',
    googleServicesFile:
      process.env.IOS_GOOGLE_SERVICES_FILE ?? './firebase/dev/GoogleService-Info.plist',
    userInterfaceStyle: 'automatic',
    // Icon Composer document: iOS draws its light, dark, tinted and clear appearances from
    // these layers, and Xcode flattens them for systems before iOS 26.
    icon: './assets/images/AppIcon.icon',
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
    // CocoaPods, not SPM: RNFirebase 26 rejects SPM with our static frameworks linkage.
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
    './plugins/withFirebaseAppCheckSwiftBridge.js',
    // Offline-copy keys come from BIBLE_STRONG_ARCHIVE_KEYS in the build environment (ADR-0065).
    './plugins/withBibleStrongArchiveKeys.js',
    '@react-native-firebase/app-check',
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
        ios: {
          fonts: [LITERATA_BOOK, ...PULP_DISPLAY_FACES.map(face => face.path)],
        },
        android: {
          fonts: [
            vectorIconFont('feather', 'Feather.ttf'),
            vectorIconFont('ionicons', 'Ionicons.ttf'),
            {
              fontFamily: 'Literata Book',
              fontDefinitions: [{ path: LITERATA_BOOK, weight: 400 }],
            },
            { fontFamily: 'Pulp Display', fontDefinitions: PULP_DISPLAY_FACES },
          ],
        },
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
          // The canvas of the « Sombre » theme; splash-dark.png carries the same ground.
          backgroundColor: '#0e1521',
        },
      },
    ],
    ['@react-native-google-signin/google-signin'],
    // Pages run under the navigation bar; the system scrim over its three-button form showed as a
    // band over the canvas. SystemBars styles the buttons with the theme instead.
    ['react-native-edge-to-edge', { android: { enforceNavigationBarContrast: false } }],
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
  // Our own update server (Open OTA on Cloudflare), see docs/adr/0085. The address, the channel
  // and the certificate are native settings: changing any of them needs a new build.
  updates: {
    url: 'https://updates.bible-strong.app/manifest',
    checkAutomatically: 'NEVER',
    // Only builds with a channel (staging, production) receive updates. A development client
    // with the certificate would also demand a signed manifest from Metro.
    ...(process.env.EAS_BUILD_CHANNEL && {
      codeSigningCertificate: './certs/certificate.pem',
      codeSigningMetadata: {
        keyid: 'main',
        alg: 'rsa-v1_5-sha256',
      },
    }),
    requestHeaders: {
      'expo-channel-name': process.env.EAS_BUILD_CHANNEL,
    },
  },
  experiments: {
    reactCompiler: true,
  },
  runtimeVersion: RUNTIME_VERSION,
})
