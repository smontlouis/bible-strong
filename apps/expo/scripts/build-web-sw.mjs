// Builds dist/sw.js after `expo export --platform web` (ADR-0067):
// bundles service-worker/sw.ts with esbuild, then injects the precache manifest with Serwist.
import { injectManifest } from '@serwist/build'
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const dist = join(appRoot, 'dist')
const MiB = 1024 * 1024
// Decoded bytes kept in Cache Storage; see plans/expo-web-pwa.md (Baseline).
const PRECACHE_BUDGET = 30 * MiB

const work = mkdtempSync(join(tmpdir(), 'web-sw-'))

try {
  const bundled = join(work, 'sw.js')
  await build({
    entryPoints: [join(appRoot, 'service-worker/sw.ts')],
    outfile: bundled,
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
  })

  const { count, size, warnings } = await injectManifest({
    swSrc: bundled,
    swDest: join(dist, 'sw.js'),
    globDirectory: dist,
    globPatterns: [
      'index.html',
      'manifest.webmanifest',
      'favicon.ico',
      'icons/*.png',
      '_expo/static/**/*.{js,css}',
      // Faces awaited by loadWebFonts() before the first paint (src/helpers/appFonts.ts).
      'assets/node_modules/@expo/vector-icons/**/{Feather,Ionicons,MaterialIcons,MaterialCommunityIcons}.*.ttf',
      'assets/src/assets/fonts/{LiterataBook-Regular,eina-03-bold,FiraCode-Regular}.*.otf',
    ],
    // Expo exports package assets under assets/node_modules; the default ignore would drop them.
    globIgnores: [],
    // Expo puts a content hash in these file names, so the URL is the revision.
    dontCacheBustURLsMatching: /^(_expo\/static|assets)\//,
    maximumFileSizeToCacheInBytes: 24 * MiB,
    manifestTransforms: [
      // Browsers request `/assets/node_modules/%40expo/...`; precache keys must match exactly.
      async entries => ({
        manifest: entries.map(entry => ({ ...entry, url: entry.url.replaceAll('@', '%40') })),
        warnings: [],
      }),
    ],
  })

  for (const warning of warnings) console.warn(`sw: ${warning}`)
  if (warnings.length > 0) throw new Error('Service worker precache produced warnings')
  if (size > PRECACHE_BUDGET) {
    throw new Error(
      `Precache is ${(size / MiB).toFixed(2)} MiB, over the ${PRECACHE_BUDGET / MiB} MiB budget`
    )
  }
  console.log(`sw: precached ${count} files, ${(size / MiB).toFixed(2)} MiB`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
