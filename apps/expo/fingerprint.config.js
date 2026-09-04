/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: [
    // Store version/build bumps do not change JavaScript/native compatibility.
    'ExpoConfigVersions',
    // Expo Config `extra` values are delivered with the JavaScript update.
    'ExpoConfigExtraSection',
    // Package scripts are tooling commands; native dependencies remain fingerprinted.
    'PackageJsonScriptsAll',
  ],
}

module.exports = config
