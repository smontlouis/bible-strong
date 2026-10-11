import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

// The layout library of the share images shapes text with HarfBuzz, whose WebAssembly it
// carries as text and compiles when it starts. A Worker may not compile WebAssembly while it
// runs (ADR-0083): it may only start modules that were compiled when it was built. The
// standalone build of the library is therefore rewritten as it is bundled, in the three
// places that stop it from starting in a Worker:
//
// - it reads the address of the script it runs in, which a Worker does not have;
// - it compiles HarfBuzz from the bytes it carries: it is given the same module instead,
//   imported compiled from the package those bytes come from (`harfbuzzjs/hb.wasm`; a test
//   checks that the two are the same);
// - it compiles a small module for each kind of function HarfBuzz calls back: those modules
//   depend only on the signature of the function, so they are written here once per
//   signature and imported compiled.
//
// Each place must be found exactly once: a release of the library that moves them fails the
// build here, rather than a share image in production.

const STANDALONE_BUILD = /[\\/]satori[\\/]dist[\\/]standalone\.js$/u

/** Every signature `harfbuzzjs` registers a callback with (`addFunction` in its `hbjs.js`). */
export const HARFBUZZ_CALLBACK_SIGNATURES = [
  'iiiii',
  'ippiip',
  'ippiipp',
  'ippip',
  'ippipip',
  'ippipp',
  'ippippp',
  'ipppipp',
  'ipppp',
  'vi',
  'viiiffffffi',
  'viiiffffi',
  'viiiffi',
  'viiii',
] as const

const WASM_TYPES: Record<string, number> = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 }

const sized = (bytes: number[]): number[] => [(bytes.length % 128) | 128, bytes.length >> 7, ...bytes]

const types = (signature: string): number[] => sized([...signature].map(type => WASM_TYPES[type]!))

/**
 * The module that lets WebAssembly call one JavaScript function of a signature: it imports
 * the function and exports it again. Written as the library writes it at run time.
 */
export const harfBuzzCallbackModule = (signature: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.of(
    ...[0, 97, 115, 109, 1, 0, 0, 0, 1],
    ...sized([
      1,
      96,
      ...types(signature.slice(1)),
      ...types(signature[0] === 'v' ? '' : signature[0]!),
    ]),
    ...[2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0]
  )

const CALLBACK_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'generated',
  'harfbuzz-callbacks'
)

const callbackFile = (signature: string) => path.join(CALLBACK_FOLDER, `${signature}.wasm`)

const writeCallbackModules = () => {
  mkdirSync(CALLBACK_FOLDER, { recursive: true })
  for (const signature of HARFBUZZ_CALLBACK_SIGNATURES) {
    writeFileSync(callbackFile(signature), harfBuzzCallbackModule(signature))
  }
}

const REPLACEMENTS = [
  { from: 'self.location.href', to: '""' },
  {
    from: 'await WebAssembly.instantiate(uA,j)',
    to: '{instance:await WebAssembly.instantiate(__harfBuzzModule,j),module:__harfBuzzModule}',
  },
  { from: 'TA=new WebAssembly.Module(uA)', to: 'TA=__harfBuzzCallback(j)' },
] as const

const imports = (): string =>
  [
    `import __harfBuzzModule from 'harfbuzzjs/hb.wasm';`,
    ...HARFBUZZ_CALLBACK_SIGNATURES.map(
      (signature, index) =>
        `import __harfBuzzCallback${index} from ${JSON.stringify(callbackFile(signature))};`
    ),
    `const __harfBuzzCallbacks = {${HARFBUZZ_CALLBACK_SIGNATURES.map(
      (signature, index) => `${JSON.stringify(signature)}:__harfBuzzCallback${index}`
    ).join(',')}};`,
    `const __harfBuzzCallback = signature => {`,
    `  const module = __harfBuzzCallbacks[signature];`,
    `  if (!module) throw new Error('SATORI_FOR_WORKERS: no callback module for ' + signature);`,
    `  return module;`,
    `};`,
  ].join('\n')

export const rewriteSatoriForWorkers = (code: string): string => {
  let rewritten = code
  for (const { from, to } of REPLACEMENTS) {
    const found = rewritten.split(from).length - 1
    if (found !== 1) throw new Error(`SATORI_FOR_WORKERS: expected one "${from}", found ${found}`)
    rewritten = rewritten.replace(from, () => to)
  }
  return `${imports()}\n${rewritten}`
}

// Vite bundles the dependencies of the development server ahead of time, with esbuild and
// without the plugins of the build: the same rewriting is given to it there, and the
// compiled modules are left as imports for the Workers runtime to resolve.
const whenBundledForDevelopment = {
  name: 'satori-for-workers',
  setup(build: {
    onResolve: (
      options: { filter: RegExp },
      callback: (args: { path: string }) => { path: string; external: true }
    ) => void
    onLoad: (
      options: { filter: RegExp },
      callback: (args: { path: string }) => { contents: string; loader: 'js' }
    ) => void
  }) {
    // esbuild reads its filters as Go expressions, which have no `u` flag.
    build.onResolve({ filter: /\.wasm$/ }, args => ({ path: args.path, external: true }))
    build.onLoad({ filter: /[\\/]satori[\\/]dist[\\/]standalone\.js$/ }, args => ({
      contents: rewriteSatoriForWorkers(readFileSync(args.path, 'utf8')),
      loader: 'js',
    }))
  },
}

export const satoriForWorkers = (): Plugin => ({
  name: 'satori-for-workers',
  enforce: 'pre',
  config() {
    writeCallbackModules()
    return {
      environments: {
        ssr: { optimizeDeps: { esbuildOptions: { plugins: [whenBundledForDevelopment] } } },
      },
    }
  },
  transform(code, id) {
    if (!STANDALONE_BUILD.test(id.split('?')[0] ?? id)) return undefined
    return { code: rewriteSatoriForWorkers(code), map: null }
  },
})
