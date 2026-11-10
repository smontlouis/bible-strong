import { describe, expect, it } from 'vitest'
import { desktopFilePath, isDesktopFile, readDesktopRelease } from './desktopRelease'

const FILES = 'https://github.com/smontlouis/bible-strong/releases/download/desktop-v28.0.3'

// The manifest `Desktop promote` published for 28.0.3, without its signatures.
const manifest = {
  version: '28.0.3',
  notes: 'Bible Strong for macOS, Windows and Linux.',
  pub_date: '2026-11-09T21:23:45.315Z',
  platforms: {
    'windows-x86_64': { url: `${FILES}/Bible.Strong_28.0.3_x64-setup.exe` },
    'windows-x86_64-nsis': { url: `${FILES}/Bible.Strong_28.0.3_x64-setup.exe` },
    'linux-x86_64': { url: `${FILES}/Bible.Strong_28.0.3_amd64.AppImage` },
    'linux-x86_64-appimage': { url: `${FILES}/Bible.Strong_28.0.3_amd64.AppImage` },
    'linux-x86_64-deb': { url: `${FILES}/Bible.Strong_28.0.3_amd64.deb` },
    'darwin-aarch64': { url: `${FILES}/Bible.Strong_universal.app.tar.gz` },
    'darwin-x86_64': { url: `${FILES}/Bible.Strong_universal.app.tar.gz` },
  },
}

describe('Installers of the latest desktop version', () => {
  it('reads every installer from the updater manifest', () => {
    expect(readDesktopRelease(manifest)).toEqual({
      version: '28.0.3',
      publishedAt: '2026-11-09T21:23:45.315Z',
      notesUrl: 'https://github.com/smontlouis/bible-strong/releases/tag/desktop-v28.0.3',
      files: {
        mac: `${FILES}/Bible.Strong_28.0.3_universal.dmg`,
        windows: `${FILES}/Bible.Strong_28.0.3_x64-setup.exe`,
        'linux-appimage': `${FILES}/Bible.Strong_28.0.3_amd64.AppImage`,
        'linux-deb': `${FILES}/Bible.Strong_28.0.3_amd64.deb`,
      },
    })
  })

  it('takes the generic keys of an older manifest', () => {
    const release = readDesktopRelease({
      version: '0.1.0',
      platforms: {
        'windows-x86_64': { url: `${FILES}/Bible.Strong_0.1.0_x64-setup.exe` },
        'linux-x86_64': { url: `${FILES}/Bible.Strong_0.1.0_amd64.AppImage` },
      },
    })
    expect(release?.publishedAt).toBeUndefined()
    expect(release?.files).toEqual({
      mac: `${FILES}/Bible.Strong_0.1.0_universal.dmg`,
      windows: `${FILES}/Bible.Strong_0.1.0_x64-setup.exe`,
      'linux-appimage': `${FILES}/Bible.Strong_0.1.0_amd64.AppImage`,
    })
  })

  it('never leads out of the repository’s releases', () => {
    const release = readDesktopRelease({
      version: '28.0.3',
      platforms: {
        'windows-x86_64': { url: 'https://example.com/Bible.Strong_28.0.3_x64-setup.exe' },
        'linux-x86_64-appimage': { url: `${FILES}/../../../../evil/x.AppImage` },
        'linux-x86_64-deb': { url: 42 },
      },
    })
    expect(release?.files).toEqual({})
  })

  it('refuses what is not a manifest', () => {
    expect(readDesktopRelease(undefined)).toBeUndefined()
    expect(readDesktopRelease('latest')).toBeUndefined()
    expect(readDesktopRelease({ platforms: manifest.platforms })).toBeUndefined()
    expect(readDesktopRelease({ ...manifest, version: 'next' })).toBeUndefined()
    expect(readDesktopRelease({ version: '28.0.3' })).toBeUndefined()
  })

  it('gives each installer an address of the site', () => {
    expect(desktopFilePath('linux-deb')).toBe('/download/latest/linux-deb')
    expect(isDesktopFile('mac')).toBe(true)
    expect(isDesktopFile('latest.json')).toBe(false)
  })
})
