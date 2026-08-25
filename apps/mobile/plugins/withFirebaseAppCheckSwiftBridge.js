const fs = require('fs')
const path = require('path')

const { IOSConfig, withDangerousMod } = require('expo/config-plugins')

const APP_CHECK_IMPORT = '#import <RNFBAppCheckModule.h>'
const FIREBASE_INITIALIZATION = `// @generated begin bible-strong-firebase-app-check
    RNFBAppCheckModule.sharedInstance()
    FirebaseApp.configure()
// @generated end bible-strong-firebase-app-check`

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

  const windowInitialization = '    window = UIWindow(frame: UIScreen.main.bounds)'
  if (!withoutGeneratedFirebaseBlocks.includes(windowInitialization)) {
    throw new Error('FIREBASE_APP_CHECK_SWIFT_INITIALIZATION_POINT_MISSING')
  }

  return withoutGeneratedFirebaseBlocks.replace(
    windowInitialization,
    `${windowInitialization}\n${FIREBASE_INITIALIZATION}`
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
