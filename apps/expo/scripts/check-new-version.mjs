#!/usr/bin/env node
// Refuses a production build or a production update whose app version already went out
// (apps/expo/AGENTS.md, "Versions").
//
//   node scripts/check-new-version.mjs <android|ios|update> [--ref <git ref>] [--same-version]
//
//   android, ios  compared with the last successful run of that platform's production build
//                 workflow on GitHub
//   update        compared with the update the server serves to each platform on this runtime
//                 (needs OTA_URL: run under dotenv -c production), and with the last production
//                 builds
//   --ref         read the version from this commit (what a GitHub runner will build), not from
//                 the working tree
//   --same-version, or SAME_VERSION=1: lets the same version go out again (a rebuild, a corrected
//                 update), never an older one
//
// Needs the `gh` CLI, signed in (GH_TOKEN on a runner).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runtimeOf, updateVersionFromResponse, versionRefusal } from './lib/appVersion.mjs'

const expoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repository = path.resolve(expoDirectory, '../..')
const packageFile = 'apps/expo/package.json'
const buildWorkflows = {
  android: { file: 'expo-android-production-build.yml', name: 'Android' },
  ios: { file: 'expo-ios-production-build.yml', name: 'iOS' },
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)
const kind = args[0]
const refIndex = args.indexOf('--ref')
const ref = refIndex === -1 ? undefined : args[refIndex + 1]
const known = new Set(['--ref', ref, '--same-version'])
if (
  !['android', 'ios', 'update'].includes(kind) ||
  (refIndex !== -1 && !ref) ||
  args.slice(1).some(arg => !known.has(arg))
) {
  fail(
    'Usage: node scripts/check-new-version.mjs <android|ios|update> [--ref <git ref>] [--same-version]'
  )
}
const sameVersion =
  args.includes('--same-version') || ['1', 'true'].includes(process.env.SAME_VERSION ?? '')

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { cwd: repository, encoding: 'utf8' })
  if (result.error) fail(`${command} could not start: ${result.error.message}`)
  if (result.status !== 0) {
    fail(`${command} ${commandArgs.join(' ')} failed:\n${(result.stderr || result.stdout).trim()}`)
  }
  return result.stdout
}

const version = JSON.parse(
  ref
    ? run('git', ['show', `${ref}:${packageFile}`])
    : readFileSync(path.join(repository, packageFile), 'utf8')
).version

/** The version of the last successful production build of a platform on GitHub, or null. */
const lastBuild = platform => {
  const { file, name } = buildWorkflows[platform]
  const runs = JSON.parse(
    run('gh', [
      'run',
      'list',
      '--workflow',
      file,
      '--status',
      'success',
      '--limit',
      '10',
      '--json',
      'databaseId,headSha',
    ])
  )
  // On a runner, the run doing the check is not finished yet, but leave it out all the same.
  const last = runs.find(entry => String(entry.databaseId) !== process.env.GITHUB_RUN_ID)
  if (!last) return []
  const built = JSON.parse(
    run('gh', [
      'api',
      '-H',
      'Accept: application/vnd.github.raw',
      `repos/{owner}/{repo}/contents/${packageFile}?ref=${last.headSha}`,
    ])
  ).version
  return [
    { what: `the last ${name} production build (${last.headSha.slice(0, 7)})`, version: built },
  ]
}

/** The version of the production update the server serves to a platform on this runtime. */
const servedUpdate = async platform => {
  const server = process.env.OTA_URL
  if (!server) fail('OTA_URL is missing: run under dotenv -c production.')
  const response = await fetch(new URL('/manifest', server), {
    headers: {
      'expo-protocol-version': '1',
      'expo-platform': platform,
      'expo-runtime-version': runtimeOf(version),
      'expo-channel-name': 'production',
    },
  }).catch(error => fail(`The update server did not answer: ${error.message}`))
  if (response.status === 204) return []
  if (!response.ok) fail(`The update server answered ${response.status} for ${platform}.`)
  const served = updateVersionFromResponse(
    response.headers.get('content-type'),
    await response.text()
  )
  return served ? [{ what: `the update served to ${platform}`, version: served }] : []
}

const shipped =
  kind === 'update'
    ? [
        ...(await servedUpdate('ios')),
        ...(await servedUpdate('android')),
        ...lastBuild('ios'),
        ...lastBuild('android'),
      ]
    : lastBuild(kind)

const refusal = versionRefusal({ version, shipped, sameVersion })
if (refusal) fail(`Refused: ${refusal}`)
console.log(
  shipped.length
    ? `Version ${version} is new${sameVersion ? ' or allowed again' : ''} (${shipped.map(entry => `${entry.what}: ${entry.version}`).join('; ')}).`
    : `Version ${version}: nothing shipped to compare with.`
)
