import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const args = process.argv.slice(2)
const issueNumber = args[0]
const dryRun = args.includes('--dry-run')
const createPr = args.includes('--create')
const pushBranch = args.includes('--push')
const ready = args.includes('--ready')
const draft = args.includes('--draft') || !ready
const baseIndex = args.indexOf('--base')
const baseBranch = baseIndex === -1 ? 'master' : args[baseIndex + 1]

const usage = () => {
  console.log(
    'Usage: yarn agents:issue:pr <issue-number> [--dry-run] [--create] [--push] [--draft|--ready] [--base <branch>]'
  )
  console.log('')
  console.log('Builds a PR body from .scratch issue artifacts and optionally opens a GitHub PR.')
  console.log('')
  console.log('Options:')
  console.log(
    '  --dry-run   Print the planned PR title/body path without writing or changing remote state.'
  )
  console.log('  --create    Create the pull request with gh after writing the body.')
  console.log('  --push      Push the current branch before --create.')
  console.log('  --draft     Create as draft. This is the default.')
  console.log('  --ready     Create as ready for review.')
  console.log('  --base      Base branch for diff and PR creation. Defaults to master.')
}

if (!issueNumber || issueNumber === '--help' || issueNumber === '-h') {
  usage()
  process.exit(issueNumber ? 0 : 1)
}

if (!/^\d+$/.test(issueNumber)) {
  console.error(`Expected a numeric issue number, got: ${issueNumber}`)
  usage()
  process.exit(1)
}

if (ready && args.includes('--draft')) {
  console.error('Use either --draft or --ready, not both.')
  process.exit(1)
}

if (baseIndex !== -1 && !baseBranch) {
  console.error('Expected a value after --base.')
  usage()
  process.exit(1)
}

if (pushBranch && !createPr) {
  console.error('Use --push only with --create.')
  process.exit(1)
}

const run = (command, commandArgs, options = {}) =>
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })

const readIfExists = filePath => {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

const exists = filePath => fs.existsSync(filePath)

const truncate = (value, max = 1200) => {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trimEnd()}\n\n...`
}

const checkbox = passed => (passed ? '[x]' : '[ ]')

const hasPassed = (text, commandPattern) => {
  const escaped = commandPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escaped}[^\\n]*(passed|succeeded|success)`, 'i').test(text)
}

const extractStatus = text => {
  const explicit = text.match(/mobile runtime status:\s*`?(passed|blocked|not-needed)`?/i)
  if (explicit) return explicit[1].toLowerCase()
  const markdown = text.match(/\b(?:status|verdict)\s*:\s*`?(passed|blocked|not-needed|pass)\b/i)
  if (markdown) return markdown[1].toLowerCase() === 'pass' ? 'passed' : markdown[1].toLowerCase()
  if (/serve-sim result:[\s\S]*started successfully/i.test(text)) return 'passed'
  if (/mobile validation:[\s\S]*(blocked|cannot|failed|unable)/i.test(text)) return 'blocked'
  if (/not-needed|not needed|non-runtime|non-user-facing/i.test(text)) return 'not-needed'
  return 'blocked'
}

const issueDir = path.join(repoRoot, '.scratch/issues', issueNumber)
const issuePath = path.join(issueDir, 'issue.json')
const codexFinalPath = path.join(issueDir, 'codex-final.md')
const mobileValidationPath = path.join(issueDir, 'mobile-validation.md')
const legacyRuntimeValidationPath = path.join(issueDir, 'codex-runtime-validation.md')
const evidenceDir = path.join(issueDir, 'evidence')
const prBodyPath = path.join(issueDir, 'pr-body.md')
const commitMessagePath = path.join(issueDir, 'commit-message.txt')
const changeSummaryPath = path.join(issueDir, 'change-summary.md')
const prNotesPath = path.join(issueDir, 'pr-notes.md')

if (!exists(issuePath)) {
  console.error(`Missing issue artifact: ${path.relative(repoRoot, issuePath)}`)
  console.error(`Run yarn agents:issue:start ${issueNumber} first.`)
  process.exit(1)
}

const issue = JSON.parse(readIfExists(issuePath))
const codexFinal = readIfExists(codexFinalPath)
const mobileValidation = readIfExists(mobileValidationPath)
const legacyRuntimeValidation = readIfExists(legacyRuntimeValidationPath)
const commitMessage = readIfExists(commitMessagePath)
const changeSummary = readIfExists(changeSummaryPath)
const prNotes = readIfExists(prNotesPath)
const combinedReport = [codexFinal, mobileValidation, legacyRuntimeValidation]
  .filter(Boolean)
  .join('\n\n')
const mobileStatus = extractStatus(combinedReport)

if (ready && mobileStatus === 'blocked') {
  console.error('Refusing to create a ready PR while mobile runtime status is blocked.')
  console.error('Use the default draft PR mode, or fix validation and rerun with --ready.')
  process.exit(1)
}

const currentBranch = run('git', ['branch', '--show-current']).trim()
const statusShort = run('git', ['status', '--short']).trim()
const changedFiles = run('git', ['diff', '--name-only', `${baseBranch}...HEAD`])
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)
const diffStat = run('git', ['diff', '--stat', `${baseBranch}...HEAD`]).trim()
const evidenceFiles = exists(evidenceDir)
  ? fs
      .readdirSync(evidenceDir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(path.relative(repoRoot, evidenceDir), entry.name))
      .sort()
  : []

const prTitle = `#${issue.number} ${issue.title}`
const reportExcerpt = truncate(combinedReport || 'No agent validation report found.', 1800)
const changeSummaryExcerpt = truncate(changeSummary || 'No change summary artifact found.', 1200)
const prNotesExcerpt = truncate(prNotes || 'No PR-specific notes artifact found.', 1200)
const filesList = changedFiles.length
  ? changedFiles.map(file => `- \`${file}\``).join('\n')
  : '- No committed file changes detected against base branch.'
const evidenceList = [
  exists(mobileValidationPath) ? `- \`${path.relative(repoRoot, mobileValidationPath)}\`` : null,
  exists(legacyRuntimeValidationPath)
    ? `- \`${path.relative(repoRoot, legacyRuntimeValidationPath)}\``
    : null,
  exists(codexFinalPath) ? `- \`${path.relative(repoRoot, codexFinalPath)}\`` : null,
  exists(commitMessagePath) ? `- \`${path.relative(repoRoot, commitMessagePath)}\`` : null,
  exists(changeSummaryPath) ? `- \`${path.relative(repoRoot, changeSummaryPath)}\`` : null,
  exists(prNotesPath) ? `- \`${path.relative(repoRoot, prNotesPath)}\`` : null,
  ...evidenceFiles.map(file => `- \`${file}\``),
]
  .filter(Boolean)
  .join('\n')

const prBody = `## Summary

- Closes #${issue.number}
- ${issue.title}

## Agent Change Summary

${changeSummaryExcerpt}

## Scope

- Issue/request: ${issue.url ?? `#${issue.number}`}
- Branch: \`${currentBranch || '(detached)'}\`
- Base: \`${baseBranch}\`
- Proposed commit: ${commitMessage.trim() ? `\`${commitMessage.trim().split('\n')[0]}\`` : 'not recorded'}
- Owned files or modules:
${filesList}
- Sensitive areas touched: none identified by this wrapper

## Validation

- ${checkbox(hasPassed(combinedReport, 'yarn typecheck'))} \`yarn typecheck\`
- ${checkbox(hasPassed(combinedReport, 'yarn lint'))} \`yarn lint\`
- ${checkbox(hasPassed(combinedReport, 'yarn test'))} \`yarn test\`
- ${checkbox(hasPassed(combinedReport, 'yarn format:check'))} \`yarn format:check\`
- [ ] i18n extraction run or not needed

## Smoke Status

- ${checkbox(mobileStatus === 'not-needed')} Not needed for this change
- ${checkbox(mobileStatus === 'passed')} Manual smoke run using \`docs/agents/smoke-tests.md\`
- ${checkbox(mobileStatus === 'blocked')} Deferred, with reason: see mobile validation below

## Mobile Validation

- ${checkbox(mobileStatus === 'not-needed')} Not needed: non-runtime or non-user-facing change
- ${checkbox(mobileStatus === 'passed')} Passed via \`serve-sim\` or equivalent simulator/device flow

Smoke paths:

- See agent validation report below.

Evidence:

${evidenceList || '- No stable evidence artifacts found.'}

## PR Notes

${prNotesExcerpt}

## Agent Validation Report

${reportExcerpt}

## Diff Stat

\`\`\`text
${diffStat || 'No committed diff against base branch.'}
\`\`\`

## Sensitive-Area Notes

Use \`docs/agents/sensitive-areas.md\` before changing auth, sync, migrations, backup/import/export, build identity, native config, external services, or user-owned data.

- Environment used: local
- Account-backed validation: not recorded by wrapper
- Production/staging validation: not run
- Rollback or mitigation notes: standard revert
`

if (!dryRun) {
  fs.mkdirSync(issueDir, { recursive: true })
  fs.writeFileSync(prBodyPath, prBody)
}

console.log(`${dryRun ? 'Planned' : 'Prepared'} PR for issue #${issue.number}`)
console.log(`Title: ${prTitle}`)
console.log(`Branch: ${currentBranch}`)
console.log(`Base: ${baseBranch}`)
console.log(`Mobile runtime status: ${mobileStatus}`)
console.log(`${dryRun ? 'Would write' : 'Wrote'} ${path.relative(repoRoot, prBodyPath)}`)

if (statusShort) {
  console.log('Warning: working tree has uncommitted changes:')
  console.log(statusShort)
}

if (createPr) {
  if (currentBranch === baseBranch) {
    console.error(`Refusing to create a PR from the base branch: ${baseBranch}`)
    process.exit(1)
  }

  if (pushBranch) {
    run('git', ['push', '-u', 'origin', currentBranch], { stdio: 'inherit' })
  }

  const ghArgs = [
    'pr',
    'create',
    '--base',
    baseBranch,
    '--head',
    currentBranch,
    '--title',
    prTitle,
    '--body-file',
    prBodyPath,
  ]

  if (draft) {
    ghArgs.push('--draft')
  }

  run('gh', ghArgs, { stdio: 'inherit' })
}
