// The installers of the desktop app, as the site offers them (ADR-0107). They are files of the
// repository's GitHub Releases, and the site never names a version: it follows the manifest the
// updater of the desktop app reads, so it offers the version the readers' apps update to, and
// never a draft (docs/desktop-release.md).

const REPOSITORY = 'https://github.com/smontlouis/bible-strong'
const RELEASE_FILES = `${REPOSITORY}/releases/download/`

/** The manifest of the latest published version, written by `Desktop promote`. */
export const DESKTOP_MANIFEST_URL = `${RELEASE_FILES}desktop-latest/latest.json`

/** Every version, with its notes. */
export const DESKTOP_RELEASES_URL = `${REPOSITORY}/releases`

/** The installers a reader can download, by the name their address gives them. */
export const DESKTOP_FILES = ['mac', 'windows', 'linux-appimage', 'linux-deb'] as const
export type DesktopFile = (typeof DESKTOP_FILES)[number]

export const isDesktopFile = (value: string): value is DesktopFile =>
  (DESKTOP_FILES as readonly string[]).includes(value)

/** The address of an installer on the site: it always leads to the latest version. */
export const desktopFilePath = (file: DesktopFile): string => `/download/latest/${file}`

export type DesktopRelease = {
  version: string
  /** When it was published, as an ISO date. */
  publishedAt?: string
  /** Its page on GitHub, with its notes. */
  notesUrl: string
  files: Partial<Record<DesktopFile, string>>
}

type ManifestPlatforms = Record<string, { url?: unknown } | undefined>

/**
 * The first address the manifest gives under one of these keys. Only a file of the repository's
 * releases is taken: the site sends readers to it, and must not send them anywhere else.
 */
const fileUnder = (platforms: ManifestPlatforms, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const url = platforms[key]?.url
    if (typeof url === 'string' && url.startsWith(RELEASE_FILES) && !url.includes('..')) return url
  }
  return undefined
}

/**
 * The installers of a version, from the updater's manifest. The manifest names the files the
 * updater installs: the Windows installer, the AppImage and the `.deb`, but for macOS the app's
 * archive, not the disk image a reader opens. The disk image sits beside the Windows installer
 * under the same name, with `universal.dmg` for its end (`Bible.Strong_28.0.3_universal.dmg`).
 */
export const readDesktopRelease = (manifest: unknown): DesktopRelease | undefined => {
  if (typeof manifest !== 'object' || manifest === null) return undefined
  const {
    version,
    pub_date: publishedAt,
    platforms,
  } = manifest as {
    version?: unknown
    pub_date?: unknown
    platforms?: unknown
  }
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/u.test(version)) return undefined
  if (typeof platforms !== 'object' || platforms === null) return undefined

  const files: Partial<Record<DesktopFile, string>> = {}
  const windows = fileUnder(platforms as ManifestPlatforms, 'windows-x86_64-nsis', 'windows-x86_64')
  if (windows) {
    files.windows = windows
    const installer = /^(.+)_x64-setup\.exe$/u.exec(windows)
    if (installer) files.mac = `${installer[1]}_universal.dmg`
  }
  const appImage = fileUnder(
    platforms as ManifestPlatforms,
    'linux-x86_64-appimage',
    'linux-x86_64'
  )
  if (appImage?.endsWith('.AppImage')) files['linux-appimage'] = appImage
  const deb = fileUnder(platforms as ManifestPlatforms, 'linux-x86_64-deb')
  if (deb?.endsWith('.deb')) files['linux-deb'] = deb

  return {
    version,
    publishedAt:
      typeof publishedAt === 'string' && !Number.isNaN(Date.parse(publishedAt))
        ? publishedAt
        : undefined,
    notesUrl: `${DESKTOP_RELEASES_URL}/tag/desktop-v${version}`,
    files,
  }
}

/**
 * How long Cloudflare keeps the manifest, in seconds: a version published on GitHub reaches the
 * site within that time.
 */
const MANIFEST_KEEPING = 300

/** The latest published version, or nothing when GitHub does not answer. */
export const fetchDesktopRelease = async (): Promise<DesktopRelease | undefined> => {
  try {
    const response = await fetch(DESKTOP_MANIFEST_URL, {
      signal: AbortSignal.timeout(5000),
      // Kept by the data centre for every reader; ignored outside a Worker.
      cf: { cacheTtl: MANIFEST_KEEPING, cacheEverything: true },
    } as RequestInit)
    if (!response.ok) return undefined
    return readDesktopRelease(await response.json())
  } catch {
    return undefined
  }
}
