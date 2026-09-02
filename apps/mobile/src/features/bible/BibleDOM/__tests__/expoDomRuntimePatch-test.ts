import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import ts from 'typescript'

type ExpoBaseModule = {
  getDOMComponentURL: (filePath: string) => string
}

const getExpoSourcePath = (relativePath: string): string => {
  const expoRoot = dirname(require.resolve('expo/package.json'))
  return join(expoRoot, 'src/dom', relativePath)
}

const loadExpoBaseModule = (): ExpoBaseModule => {
  const sourcePath = getExpoSourcePath('base.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  }).outputText
  const loadedModule = { exports: {} as ExpoBaseModule }

  new Function('require', 'module', 'exports', output)(require, loadedModule, loadedModule.exports)

  return loadedModule.exports
}

describe('Expo DOM runtime patch', () => {
  const originalExpo = globalThis.expo
  const originalNodeEnv = process.env.NODE_ENV
  const originalExpoOS = process.env.EXPO_OS

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
    process.env.EXPO_OS = 'ios'
  })

  afterEach(() => {
    globalThis.expo = originalExpo
    process.env.NODE_ENV = originalNodeEnv
    process.env.EXPO_OS = originalExpoOS
  })

  it.each([
    [
      'embedded asset first',
      {
        embedded: 'file:///App/BibleStrong.app/assets/icon.png',
        dom: 'file:///Caches/ExpoUpdates/update/reader.html',
      },
    ],
    [
      'updated DOM asset first',
      {
        dom: 'file:///Caches/ExpoUpdates/update/reader.html',
        embedded: 'file:///App/BibleStrong.app/assets/icon.png',
      },
    ],
  ])('resolves the requested OTA DOM asset with %s', (_label, localAssets) => {
    globalThis.expo = {
      modules: {
        ExpoUpdates: {
          isEnabled: true,
          isEmbeddedLaunch: false,
          localAssets,
        },
      },
    } as unknown as typeof globalThis.expo

    expect(loadExpoBaseModule().getDOMComponentURL('reader.html')).toBe(
      'file:///Caches/ExpoUpdates/update/reader.html'
    )
  })

  it('keeps the bundled iOS DOM location for an embedded launch', () => {
    globalThis.expo = {
      modules: {
        ExpoUpdates: {
          isEnabled: true,
          isEmbeddedLaunch: true,
          localAssets: {
            dom: 'file:///App/BibleStrong.app/www.bundle/reader.html',
          },
        },
      },
    } as unknown as typeof globalThis.expo

    expect(loadExpoBaseModule().getDOMComponentURL('reader.html')).toBe('www.bundle/reader.html')
  })

  it('loads WebViews through the exact DOM component URL resolver', () => {
    const wrapperSource = readFileSync(getExpoSourcePath('webview-wrapper.tsx'), 'utf8')

    expect(wrapperSource).toContain('overrideUri ?? getDOMComponentURL(filePath)')
  })
})
