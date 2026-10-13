const fs = require('fs')
const path = require('path')

const { IOSConfig, withDangerousMod } = require('expo/config-plugins')

const APP_CHECK_IMPORT = '#import "RNFBAppCheckModule.h"'
const FIREBASE_INITIALIZATION = `// @generated begin bible-strong-firebase-app-check
    RNFBAppCheckModule.sharedInstance()
    FirebaseApp.configure()
// @generated end bible-strong-firebase-app-check`
const INITIALIZATION_POINTS = [
  '    window = UIWindow(frame: UIScreen.main.bounds)',
  '    reactNativeFactory = factory',
]

const normalizeFirebaseInitialization = contents => {
  const withoutGeneratedFirebaseBlocks = contents
    .replace(
      /^.*@generated begin @react-native-firebase\/app(?:-check|-didFinishLaunchingWithOptions).*$[\s\S]*?^.*@generated end @react-native-firebase\/app(?:-check|-didFinishLaunchingWithOptions).*$\n?/gm,
      ''
    )
    .replace(
      /^.*@generated begin bible-strong-firebase-app-check.*$[\s\S]*?^.*@generated end bible-strong-firebase-app-check.*$\n?/gm,
      ''
    )
    .replace(
      /^[ \t]*(?:RNFBAppCheckModule\.sharedInstance\(\)|FirebaseApp\.configure\(\))[ \t]*$\n?/gm,
      ''
    )

  // Since SDK 58 the window is created by SceneDelegate, so the app delegate no longer has the
  // window line. Firebase still has to be configured here, before the scene starts React Native.
  const initializationPoint = INITIALIZATION_POINTS.find(point =>
    withoutGeneratedFirebaseBlocks.includes(point)
  )
  if (!initializationPoint) {
    throw new Error('FIREBASE_APP_CHECK_SWIFT_INITIALIZATION_POINT_MISSING')
  }

  return withoutGeneratedFirebaseBlocks.replace(
    initializationPoint,
    `${initializationPoint}\n${FIREBASE_INITIALIZATION}`
  )
}

module.exports = config =>
  withDangerousMod(config, [
    'ios',
    async config => {
      const appDelegate = IOSConfig.Paths.getAppDelegate(config.modRequest.projectRoot)

      if (appDelegate.language !== 'swift') return config

      const appDelegateContents = await fs.promises.readFile(appDelegate.path, 'utf8')
      await fs.promises.writeFile(
        appDelegate.path,
        normalizeFirebaseInitialization(appDelegateContents.replace(/^import RNFBAppCheck\n/m, ''))
      )

      const iosProjectDirectory = path.dirname(appDelegate.path)
      const bridgingHeaderName = (await fs.promises.readdir(iosProjectDirectory)).find(fileName =>
        fileName.endsWith('-Bridging-Header.h')
      )

      if (!bridgingHeaderName) {
        throw new Error('FIREBASE_APP_CHECK_SWIFT_BRIDGING_HEADER_MISSING')
      }

      const bridgingHeaderPath = path.join(iosProjectDirectory, bridgingHeaderName)
      const bridgingHeaderContents = await fs.promises.readFile(bridgingHeaderPath, 'utf8')

      if (!bridgingHeaderContents.includes(APP_CHECK_IMPORT)) {
        await fs.promises.writeFile(
          bridgingHeaderPath,
          `${bridgingHeaderContents.trimEnd()}\n${APP_CHECK_IMPORT}\n`
        )
      }

      return config
    },
  ])
