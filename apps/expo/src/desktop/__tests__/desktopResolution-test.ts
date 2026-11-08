import fs from 'fs'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const resolution = require('../../../desktopResolution.cjs') as {
  PACKAGE_SHIMS: Record<string, string>
  SHARED_ON_DESKTOP: Set<string>
  desktopFileFor: (projectRoot: string, filePath: string) => string
}

const projectRoot = path.resolve(__dirname, '../../..')
const file = (relative: string) => path.join(projectRoot, relative)
const desktopFile = (relative: string) =>
  path.relative(projectRoot, resolution.desktopFileFor(projectRoot, file(relative)))

describe('desktop module resolution', () => {
  it('takes a .desktop file over the web or shared one', () => {
    expect(desktopFile('src/helpers/storage.web.ts')).toBe('src/helpers/storage.desktop.ts')
    expect(desktopFile('src/helpers/resourceAppCheck.web.ts')).toBe(
      'src/helpers/resourceAppCheck.desktop.ts'
    )
    expect(desktopFile('modules/bible-strong-archive/index.ts')).toBe(
      'modules/bible-strong-archive/index.desktop.ts'
    )
  })

  it('takes the shared file over a .web variant that only removes Offline copies', () => {
    expect(desktopFile('src/helpers/sqlite.web.ts')).toBe('src/helpers/sqlite.ts')
    expect(desktopFile('src/features/settings/DownloadsScreen.web.tsx')).toBe(
      'src/features/settings/DownloadsScreen.tsx'
    )
  })

  it('keeps every other web file and the packages', () => {
    expect(desktopFile('src/helpers/firebase.web.ts')).toBe('src/helpers/firebase.web.ts')
    expect(desktopFile('src/helpers/toast.ts')).toBe('src/helpers/toast.ts')
    const dependency = file('node_modules/expo-sqlite/src/index.ts')
    expect(resolution.desktopFileFor(projectRoot, dependency)).toBe(dependency)
  })

  it('lists only files that exist in both variants', () => {
    for (const base of resolution.SHARED_ON_DESKTOP) {
      const variants = ['ts', 'tsx'].flatMap(extension => [
        `${base}.${extension}`,
        `${base}.web.${extension}`,
      ])
      const present = variants.filter(variant => fs.existsSync(file(variant)))
      expect([base, present.length]).toEqual([base, 2])
    }
    for (const shim of Object.values(resolution.PACKAGE_SHIMS)) {
      expect(fs.existsSync(file(shim))).toBe(true)
    }
  })
})
