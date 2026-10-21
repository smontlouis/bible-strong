import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import ts from 'typescript'

type ExpoBaseModule = {
  getDOMComponentURL: (filePath: string) => string
}

// Since SDK 58 the application loads Expo's compiled files, so those are the ones the patch has
// to change: a patch applied to `src/dom` alone would have no effect at runtime.
const getExpoBuildPath = (relativePath: string): string => {
  const expoRoot = dirname(require.resolve('expo/package.json'))
  return join(expoRoot, 'build/dom', relativePath)
}

const requireFromExpoBase = (id: string) =>
  id === '../utils/getDevServer'
    ? { default: () => ({ url: 'http://localhost:8081' }) }
    : require(id)

const loadExpoBaseModule = (): ExpoBaseModule => {
  const sourcePath = getExpoBuildPath('base.js')
  const source = readFileSync(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      allowJs: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  }).outputText
  const loadedModule = { exports: {} as ExpoBaseModule }

  new Function('require', 'module', 'exports', output)(
    requireFromExpoBase,
    loadedModule,
    loadedModule.exports
  )

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
    const wrapperSource = readFileSync(getExpoBuildPath('webview-wrapper.js'), 'utf8')

    expect(wrapperSource).toContain('overrideUri ?? getDOMComponentURL(filePath)')
  })

  // Re-sending every prop on every render re-rendered the whole chapter in the WebView: the
  // wrapper sends only the props that changed, and everything again when the page (re)loads.
  it('sends only the changed props, and all of them when the page loads', () => {
    const wrapperSource = readFileSync(getExpoBuildPath('webview-wrapper.js'), 'utf8')
    const onLoadSource = wrapperSource.slice(wrapperSource.indexOf('onLoad: (event)=>{'))
    const domReadySource = wrapperSource.slice(wrapperSource.indexOf('if (type === DOM_READY)'))

    expect(wrapperSource).toContain('function serializeMarshalledProps(marshalled)')
    expect(wrapperSource).toContain('partial: true')
    expect(wrapperSource).toContain('if (!changed && removed.length === 0 && !namesChanged) return;')
    expect(onLoadSource.slice(0, 120)).toContain('emitProps(true)')
    expect(domReadySource.slice(0, 160)).toContain('emitProps(true)')
  })

  it('merges partial props into the ones the DOM side already has', () => {
    const entrySource = readFileSync(getExpoBuildPath('dom-entry.js'), 'utf8')

    expect(entrySource).toContain('function mergePartialProps(previous, msg)')
    expect(entrySource).toContain('setProps((previous)=>mergePartialProps(previous, msg))')
  })

  it('reports a lost Android render process to the owner before reloading', () => {
    const wrapperSource = readFileSync(getExpoBuildPath('webview-wrapper.js'), 'utf8')
    const handlerStart = wrapperSource.indexOf('onRenderProcessGone: (event)=>{')
    const handlerSource = wrapperSource.slice(handlerStart, wrapperSource.indexOf('...dom,'))

    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerSource).toContain('onRenderProcessGoneProp?.(event)')
    expect(handlerSource).toContain('webviewRef.current?.reload()')
  })
})
