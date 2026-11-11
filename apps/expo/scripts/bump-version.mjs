#!/usr/bin/env node
// Moves the app version and commits it alone (apps/expo/AGENTS.md, "Versions").
//
//   node scripts/bump-version.mjs <patch|minor|major>      (yarn release:version <part>)
//
// patch: an update, or a store build without native change; same runtime, updates keep reaching
// the builds of this minor. minor: a native change, so a new runtime and new store builds.
// The build numbers are not here: EAS gives the next one to each production build.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RELEASE_PARTS, nextVersion, runtimeOf } from './lib/appVersion.mjs'

const expoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repository = path.resolve(expoDirectory, '../..')
const packagePath = path.join(expoDirectory, 'package.json')
const packageFile = path.relative(repository, packagePath)

function fail(message) {
  console.error(message)
  process.exit(1)
}

const git = (...args) => spawnSync('git', args, { cwd: repository, encoding: 'utf8' })

const part = process.argv[2]
if (!RELEASE_PARTS.includes(part) || process.argv.length > 3) {
  fail(`Usage: yarn release:version <${RELEASE_PARTS.join('|')}>`)
}

// The commit takes the whole file: anything else changed in it would go along.
if (git('diff', '--quiet', 'HEAD', '--', packageFile).status !== 0) {
  fail(`${packageFile} has uncommitted changes: commit or set them aside first.`)
}

const text = readFileSync(packagePath, 'utf8')
const { version } = JSON.parse(text)
const next = nextVersion(version, part)
const field = `"version": "${version}"`
if (text.indexOf(field) === -1 || text.indexOf(field) !== text.lastIndexOf(field)) {
  fail(`Could not find exactly one ${field} in ${packageFile}.`)
}
writeFileSync(packagePath, text.replace(field, `"version": "${next}"`))

// Only this file, whatever else the shared checkout has staged.
const commit = git('commit', '--quiet', '-m', `chore(expo): version ${next}`, '--', packageFile)
if (commit.status !== 0) {
  writeFileSync(packagePath, text)
  fail(`The commit failed, the version is back to ${version}:\n${commit.stderr}`)
}

console.log(`Version ${version} → ${next}, committed. Push before building or publishing.`)
if (runtimeOf(next) === runtimeOf(version)) {
  console.log(`Runtime ${runtimeOf(next)} unchanged: an update or a store build can carry it.`)
} else {
  console.log(
    `New runtime ${runtimeOf(next)}: it needs store builds, and updates published from now on ` +
      `no longer reach the ${runtimeOf(version)} builds. An update is always a patch.`
  )
}
