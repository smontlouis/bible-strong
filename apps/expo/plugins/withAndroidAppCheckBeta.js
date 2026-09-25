const { AndroidConfig, withAndroidManifest, withGradleProperties } = require('expo/config-plugins')

const SITE_KEY_METADATA = 'app.biblestrong.appcheck.recaptcha.siteKey'
const ENABLED_PROPERTY = 'bibleStrong.appCheckRecaptcha'

module.exports = function withAndroidAppCheckBeta(config, { enabled = false, siteKey } = {}) {
  if (enabled && (typeof siteKey !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(siteKey))) {
    throw new Error(
      'Set ANDROID_APP_CHECK_RECAPTCHA_SITE_KEY to an Android reCAPTCHA key before building the beta.'
    )
  }

  config = withGradleProperties(config, result => {
    result.modResults = result.modResults.filter(item => item.key !== ENABLED_PROPERTY)
    result.modResults.push({ type: 'property', key: ENABLED_PROPERTY, value: String(enabled) })
    return result
  })

  return withAndroidManifest(config, result => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults)
    application['meta-data'] = (application['meta-data'] ?? []).filter(
      item => item.$['android:name'] !== SITE_KEY_METADATA
    )
    if (enabled) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        application,
        SITE_KEY_METADATA,
        siteKey
      )
    }
    return result
  })
}
