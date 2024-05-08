const { withAndroidManifest } = require('@expo/config-plugins')

// Fonction pour modifier ou ajouter le uses-feature selon les options
const setFeatureWithAttributes = (androidManifest, options) => {
  const manifest = androidManifest.manifest

  const existingFeatureIndex = manifest['uses-feature']?.findIndex(
    feature => feature['$']['android:name'] === options.name
  )

  if (existingFeatureIndex !== undefined && existingFeatureIndex >= 0) {
    // Modifier les attributs existants
    Object.keys(options.attributes).forEach(key => {
      manifest['uses-feature'][existingFeatureIndex]['$']['android:' + key] =
        options.attributes[key]
    })
  } else {
    // Ajouter l'élément uses-feature si non existant
    const featureElement = {
      $: {
        'android:name': options.name,
        ...Object.fromEntries(
          Object.entries(options.attributes).map(([key, value]) => [
            `android:${key}`,
            value,
          ])
        ),
      },
    }
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = []
    }
    manifest['uses-feature'].push(featureElement)
  }

  return androidManifest
}

// Plugin Config avec options
const withAndroidUsesFeature = (config, options) => {
  return withAndroidManifest(config, async config => {
    config.modResults = setFeatureWithAttributes(config.modResults, options)
    return config
  })
}

module.exports = withAndroidUsesFeature
