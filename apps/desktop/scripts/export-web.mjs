// Exports the Expo web app for the desktop shell into apps/expo/dist-desktop (ADR-0107):
// production settings, desktop module resolution (BIBLE_STRONG_DESKTOP) and desktop branches
// (EXPO_PUBLIC_DESKTOP). The public web export (`web:build`) is not affected.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const expoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../expo')
const outDir = join(expoRoot, 'dist-desktop')

rmSync(outDir, { recursive: true, force: true })
// On Windows `yarn` is a `.cmd` script, which only a shell can start.
execFileSync(
  'yarn',
  [
    'dotenv',
    '-e',
    '.env.production',
    '--',
    'expo',
    'export',
    '--platform',
    'web',
    '--output-dir',
    'dist-desktop',
  ],
  {
    cwd: expoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      EXPO_NO_DOTENV: '1',
      BIBLE_STRONG_DESKTOP: '1',
      EXPO_PUBLIC_DESKTOP: '1',
    },
  }
)

// Pages of the public web that the desktop app never serves.
for (const entry of ['desktop-sign-in', '_headers', 'robots.txt', 'manifest.webmanifest']) {
  rmSync(join(outDir, entry), { recursive: true, force: true })
}

const index = readFileSync(join(outDir, 'index.html'), 'utf8')
if (!index.includes('__BIBLE_STRONG_BOOTSTRAP_URL__')) {
  throw new Error('dist-desktop/index.html does not load the desktop bootstrap')
}
if (!existsSync(join(outDir, '_expo'))) throw new Error('dist-desktop has no bundle')
console.log(`[desktop] web export ready in ${outDir}`)
