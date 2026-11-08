// Starts a desktop release in GitHub Actions, which builds, signs and publishes it
// (docs/desktop-release.md). The version is the one of apps/desktop/package.json on master.
//
//   yarn desktop:release            build the three systems, then publish them to the readers
//   yarn desktop:release --draft    stop at the draft release, to test the installers first
//   yarn desktop:release --publish  publish the draft of that version, without rebuilding
import { execFileSync } from 'node:child_process'

const REPO = 'smontlouis/bible-strong'
const args = process.argv.slice(2)
for (const arg of args) {
  if (arg !== '--draft' && arg !== '--publish') {
    throw new Error(`Unknown option ${arg}: use --draft or --publish`)
  }
}
const draft = args.includes('--draft')
const publish = args.includes('--publish')
if (draft && publish) throw new Error('Choose --draft or --publish, not both')

const gh = (...ghArgs) => execFileSync('gh', ghArgs, { encoding: 'utf8' }).trim()

// The CI builds master as pushed, so the version comes from there, not from this checkout.
const { version } = JSON.parse(
  gh(
    'api',
    '-H',
    'Accept: application/vnd.github.raw+json',
    `repos/${REPO}/contents/apps/desktop/package.json?ref=master`
  )
)
const tag = `desktop-v${version}`

const existing = (() => {
  try {
    return JSON.parse(gh('release', 'view', tag, '--repo', REPO, '--json', 'isDraft'))
  } catch {
    return undefined
  }
})()

const run = (workflow, ...inputs) => {
  gh('workflow', 'run', workflow, '--repo', REPO, '--ref', 'master', ...inputs)
  console.log(`Follow it at https://github.com/${REPO}/actions/workflows/${workflow}`)
}

if (publish) {
  if (!existing) throw new Error(`No draft ${tag}: build one with yarn desktop:release --draft`)
  if (!existing.isDraft) throw new Error(`${tag} is already published`)
  console.log(`Publishing the draft ${tag} to the readers.`)
  run('desktop-promote.yml', '-f', `version=${version}`)
} else {
  if (existing && !existing.isDraft) {
    throw new Error(`${tag} is already published: raise version in apps/desktop/package.json`)
  }
  if (existing) {
    throw new Error(
      `A draft ${tag} already exists: publish it with --publish, or delete it on GitHub to rebuild`
    )
  }
  console.log(
    draft
      ? `Building ${tag} into a draft release (about 20 minutes).`
      : `Building ${tag}, then publishing it to the readers (about 20 minutes).`
  )
  run('desktop-release.yml', '-f', `draft=${draft}`)
}
