const archiveLayouts = {
  aab: {
    platform: 'android',
    manifest: /^base\/assets\/app\.manifest$/,
    bundle: /^base\/assets\/index\.android\.bundle$/,
  },
  apk: {
    platform: 'android',
    manifest: /^assets\/app\.manifest$/,
    bundle: /^assets\/index\.android\.bundle$/,
  },
  ipa: {
    platform: 'ios',
    manifest: /^Payload\/[^/]+\.app\/EXUpdates\.bundle\/app\.manifest$/,
    bundle: /^Payload\/[^/]+\.app\/main\.jsbundle$/,
  },
}

export const storeBuildExtensions = Object.keys(archiveLayouts)

/**
 * Where a store build keeps the update expo-updates embedded in it: the manifest names the update
 * and the bundle is what a phone runs until its first update arrives.
 */
export const embeddedUpdateEntries = (archivePath, entryNames) => {
  const extension = archivePath.split('.').pop().toLowerCase()
  const layout = archiveLayouts[extension]
  if (!layout) {
    throw new Error(`${archivePath}: expected a store build (${storeBuildExtensions.join(', ')})`)
  }

  const manifest = entryNames.find(name => layout.manifest.test(name))
  const bundle = entryNames.find(name => layout.bundle.test(name))
  if (!manifest || !bundle) {
    const missing = [!manifest && 'app.manifest', !bundle && 'the JavaScript bundle'].filter(
      Boolean
    )
    throw new Error(`${archivePath} holds no ${missing.join(' and no ')} from expo-updates`)
  }

  return { platform: layout.platform, manifest, bundle }
}
