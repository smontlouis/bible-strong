#!/usr/bin/env node
// Builds the production AAB or IPA on a GitHub runner, waits for it and stores the file in
// ~/Builds/bible-strong. The runner builds the commit at the tip of master on GitHub, not this
// checkout: push first.
//
//   node scripts/build-on-github.mjs <android|ios> [--submit] [--no-register] [--same-version]
//
//   --submit        also send the build to the store from the runner (TestFlight, or the Play
//                   production track with managed publishing)
//   --no-register   do not declare the build to the update server (a trial, not a store build)
//   --same-version  build again the version of the last production build of this platform (a
//                   rebuild); without it, a version already built is refused before the run starts
//
// The build number comes from EAS (eas.json, appVersionSource remote), the version from
// apps/expo/package.json: move it first with `yarn release:version`.
//
// Needs the `gh` CLI, signed in with access to the repository.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workflows = {
  android: { file: 'expo-android-production-build.yml', extension: 'aab' },
  ios: { file: 'expo-ios-production-build.yml', extension: 'ipa' },
}
const buildsDirectory = path.join(homedir(), 'Builds', 'bible-strong')

const args = process.argv.slice(2)
const platform = args.find(arg => !arg.startsWith('--'))
const unknown = args.filter(
  arg => arg.startsWith('--') && !['--submit', '--no-register', '--same-version'].includes(arg)
)
if (!workflows[platform] || unknown.length > 0) {
  fail(
    'Usage: node scripts/build-on-github.mjs <android|ios> [--submit] [--no-register] [--same-version]'
  )
}
const { file: workflow, extension } = workflows[platform]
const submit = args.includes('--submit')
const register = !args.includes('--no-register')
const sameVersion = args.includes('--same-version')

function fail(message) {
  console.error(message)
  process.exit(1)
}

const run = (command, commandArgs, { inherit = false } = {}) => {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) fail(`${command} could not start: ${result.error.message}`)
  return {
    ok: result.status === 0,
    out: (result.stdout ?? '').trim(),
    err: (result.stderr ?? '').trim(),
  }
}
const must = (command, commandArgs) => {
  const result = run(command, commandArgs)
  if (!result.ok) fail(`${command} ${commandArgs.join(' ')} failed:\n${result.err}`)
  return result.out
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// What the runner will build is GitHub's master, whatever this checkout holds.
must('git', ['fetch', '--quiet', 'origin', 'master'])
const remote = must('git', ['rev-parse', 'origin/master'])
const local = must('git', ['rev-parse', 'HEAD'])
console.log(`Building master on GitHub: ${must('git', ['log', '-1', '--format=%h %s', remote])}`)
if (local !== remote) {
  console.warn(`Warning: this checkout is at ${local.slice(0, 7)}, which is not what gets built.`)
}
if (run('git', ['status', '--porcelain']).out) {
  console.warn('Warning: uncommitted changes here are not part of the build.')
}

// The workflow checks it too, but a refusal here costs no runner.
const versionCheck = run(
  'node',
  [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-new-version.mjs'),
    platform,
    '--ref',
    remote,
    ...(sameVersion ? ['--same-version'] : []),
  ],
  { inherit: true }
)
if (!versionCheck.ok) process.exit(1)

const knownRuns = () =>
  JSON.parse(
    must('gh', [
      'run',
      'list',
      '--workflow',
      workflow,
      '--event',
      'workflow_dispatch',
      '--limit',
      '10',
      '--json',
      'databaseId',
    ])
  ).map(entry => entry.databaseId)

const before = new Set(knownRuns())
must('gh', [
  'workflow',
  'run',
  workflow,
  '--ref',
  'master',
  '-f',
  `register=${register}`,
  '-f',
  `submit=${submit}`,
  '-f',
  `same_version=${sameVersion}`,
])

let runId
for (let attempt = 0; attempt < 30 && !runId; attempt++) {
  await sleep(2000)
  runId = knownRuns().find(id => !before.has(id))
}
if (!runId) fail('The workflow was started but its run did not show up: look at the Actions tab.')

console.log(must('gh', ['run', 'view', String(runId), '--json', 'url', '--jq', '.url']))
console.log(
  `register=${register} submit=${submit}. Waiting for the run (Android about 50 min, iOS about 75 min)…`
)

const watched = run('gh', ['run', 'watch', String(runId), '--interval', '60', '--exit-status'], {
  inherit: true,
})

// The artifact is uploaded before the store step, so a failed submission still leaves a build.
const downloadDirectory = mkdtempSync(path.join(tmpdir(), 'bible-strong-github-build-'))
try {
  const download = run('gh', ['run', 'download', String(runId), '--dir', downloadDirectory])
  const found = download.ok
    ? readdirSync(downloadDirectory, { recursive: true }).find(name =>
        name.endsWith(`.${extension}`)
      )
    : undefined
  if (found) {
    mkdirSync(buildsDirectory, { recursive: true })
    const destination = path.join(buildsDirectory, path.basename(found))
    renameSync(path.join(downloadDirectory, found), destination)
    console.log(`Stored ${destination}`)
  } else if (watched.ok) {
    fail(`The run passed but no .${extension} could be downloaded:\n${download.err}`)
  }
} finally {
  rmSync(downloadDirectory, { recursive: true, force: true })
}

if (!watched.ok) fail(`The run failed: gh run view ${runId} --log-failed`)
