#!/usr/bin/env node
// Registers a store build with the update server, so the JavaScript embedded in it becomes a base
// for delta patches. Without it, a phone that never received an update downloads the whole bundle.
//
//   node scripts/register-store-build.mjs <file.aab|file.apk|file.ipa> [--profile production]
//   node scripts/register-store-build.mjs --newest ipa     (the latest build-*.ipa in this folder)
//
// Needs OTA_PUBLISH_TOKEN and OTA_URL: run it under `dotenv -c production`.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { embeddedUpdateEntries } from './lib/storeBuildArchive.mjs'

const expoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}

const newestBuild = extension => {
  const builds = readdirSync(process.cwd())
    .filter(name => name.startsWith('build-') && name.endsWith(`.${extension}`))
    .map(name => ({ name, modified: statSync(name).mtimeMs }))
    .sort((a, b) => b.modified - a.modified)
  if (builds.length === 0) fail(`No build-*.${extension} in ${process.cwd()}`)
  return path.resolve(builds[0].name)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const unzip = (...unzipArgs) => {
  const result = spawnSync('unzip', unzipArgs, { maxBuffer: 256 * 1024 * 1024 })
  if (result.status !== 0) fail(`unzip ${unzipArgs.join(' ')} failed: ${result.stderr}`)
  return result.stdout
}

const archive = option('newest')
  ? newestBuild(option('newest'))
  : args[0] && !args[0].startsWith('--')
    ? path.resolve(args[0])
    : fail('Usage: register-store-build.mjs <file.aab|file.apk|file.ipa> | --newest <extension>')
const profile = option('profile') ?? 'production'
const channel = option('channel') ?? profile

if (!process.env.OTA_PUBLISH_TOKEN)
  fail('OTA_PUBLISH_TOKEN is missing: run under dotenv -c production')

let entries
try {
  entries = embeddedUpdateEntries(archive, unzip('-Z1', archive).toString('utf8').split('\n'))
} catch (error) {
  fail(error.message)
}

const directory = mkdtempSync(path.join(tmpdir(), 'store-build-'))
try {
  const manifest = path.join(directory, 'app.manifest')
  const bundle = path.join(directory, path.basename(entries.bundle))
  writeFileSync(manifest, unzip('-p', archive, entries.manifest))
  writeFileSync(bundle, unzip('-p', archive, entries.bundle))

  const register = spawnSync(
    'yarn',
    [
      ...['open-ota', 'build', 'register', '--platform', entries.platform],
      ...['--profile', profile, '--channel', channel, '--manifest', manifest, '--bundle', bundle],
    ],
    { cwd: expoDirectory, stdio: 'inherit' }
  )
  if (register.status !== 0) {
    fail(
      `The build itself is fine, but the update server did not register it. Retry with:\n` +
        `  dotenv -c production -- node scripts/register-store-build.mjs ${archive}`
    )
  }
} finally {
  rmSync(directory, { recursive: true, force: true })
}
