// The app version (`version` in apps/expo/package.json): one for iOS, Android, the Web and the
// desktop app. Its major and minor make the update runtime; see apps/expo/AGENTS.md, "Versions".

export const parseVersion = version => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? ''))
  if (!match) throw new Error(`Unsupported app version: ${version}`)
  return match.slice(1).map(Number)
}

export const RELEASE_PARTS = ['patch', 'minor', 'major']

export const nextVersion = (version, part) => {
  const [major, minor, patch] = parseVersion(version)
  if (part === 'major') return `${major + 1}.0.0`
  if (part === 'minor') return `${major}.${minor + 1}.0`
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`
  throw new Error(`Unknown release part: ${part} (expected ${RELEASE_PARTS.join(', ')})`)
}

export const compareVersions = (a, b) => {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1
  }
  return 0
}

/** The update runtime of a version: its major and minor (`app.config.ts`). */
export const runtimeOf = version => parseVersion(version).slice(0, 2).join('.')

/**
 * The app version of the update a server answers with (expo-updates protocol 1: a multipart
 * answer whose `manifest` part embeds the app config), or null when it answers with a directive
 * instead: no update on this runtime, or a rollback to the embedded one.
 */
export const updateVersionFromResponse = (contentType, body) => {
  const boundary = /boundary=("?)([^";]+)\1/i.exec(contentType ?? '')?.[2]
  if (!boundary) throw new Error(`Not a multipart answer: ${contentType}`)
  for (const part of body.split(`--${boundary}`)) {
    const separator = /\r?\n\r?\n/.exec(part)
    if (!separator) continue
    if (!/name="manifest"/i.test(part.slice(0, separator.index))) continue
    const manifest = JSON.parse(part.slice(separator.index + separator[0].length).trim())
    const version = manifest.extra?.expoClient?.version
    if (!version) throw new Error('The update manifest carries no app version.')
    return version
  }
  return null
}

/**
 * Why a release of `version` is refused, or null. `shipped` lists what already went out, as
 * `{ what, version }`. Only what went out on the same runtime counts: a fix for the binaries of
 * an older runtime (a `release/28.0` branch) is not older than master's builds. The same version
 * passes only when `sameVersion` allows it; an older one never does.
 */
export const versionRefusal = ({ version, shipped, sameVersion = false }) => {
  const runtime = runtimeOf(version)
  for (const entry of shipped.filter(item => runtimeOf(item.version) === runtime)) {
    const order = compareVersions(version, entry.version)
    if (order < 0) return `${version} is older than ${entry.what} (${entry.version}).`
    if (order === 0 && !sameVersion) {
      return (
        `${version} is already the version of ${entry.what}. Run ` +
        '`yarn release:version <patch|minor>` first, or allow the same version again ' +
        '(--same-version, the same_version input, or SAME_VERSION=1).'
      )
    }
  }
  return null
}
