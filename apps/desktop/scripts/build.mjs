// Builds the desktop app for the current OS (ADR-0107).
//
//   node scripts/build.mjs                  installers with the signed updater
//   node scripts/build.mjs --appstore       the Mac App Store build: sandboxed, no updater
//   node scripts/build.mjs --skip-web       reuse apps/expo/dist-desktop
//   node scripts/build.mjs --allow-missing-keys   a local test build that cannot decrypt
//
// A release without the Offline-copy keys could not install any Offline copy, so the build
// refuses to run without them unless asked.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readArchiveKeys, withArchiveKeys } from './archiveKeys.mjs'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const appStore = args.has('--appstore')

if (!readArchiveKeys() && !args.has('--allow-missing-keys')) {
  throw new Error(
    'BIBLE_STRONG_ARCHIVE_KEYS is missing: the app could not install Offline copies. ' +
      'Pass --allow-missing-keys for a local test build.'
  )
}

if (!args.has('--skip-web')) {
  execFileSync('node', [join(desktopRoot, 'scripts/export-web.mjs')], { stdio: 'inherit' })
}

const tauriArgs = ['tauri', 'build']
if (process.platform === 'darwin') tauriArgs.push('--target', 'universal-apple-darwin')
// macOS honours the associated-domains entitlement of a Developer ID app only when the app
// embeds a provisioning profile that grants it (ADR-0082). The profile stays outside git.
const provisioningProfile = join(desktopRoot, 'src-tauri/embedded.provisionprofile')
if (appStore) {
  if (process.platform !== 'darwin') throw new Error('The App Store build is macOS only')
  tauriArgs.push('--config', 'src-tauri/tauri.appstore.conf.json', '--', '--no-default-features')
} else if (process.platform === 'darwin') {
  if (existsSync(provisioningProfile)) {
    tauriArgs.push('--config', 'src-tauri/tauri.provisioned.conf.json')
  } else {
    console.warn(
      'No src-tauri/embedded.provisionprofile: links to bible-strong.app will not open this build.'
    )
  }
}

// Installers carry update signatures: locally, with the key kept outside the repository.
const env = withArchiveKeys(process.env)
// The DMG layout step drives Finder, which needs an automation permission; CI skips it.
env.CI ??= 'true'
const updaterKey = join(homedir(), '.tauri', 'bible-strong-updater.key')
if (!appStore && !env.TAURI_SIGNING_PRIVATE_KEY && existsSync(updaterKey)) {
  env.TAURI_SIGNING_PRIVATE_KEY = updaterKey
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= ''
}

// On Windows `yarn` is a `.cmd` script, which only a shell can start.
execFileSync('yarn', tauriArgs, {
  cwd: desktopRoot,
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})
