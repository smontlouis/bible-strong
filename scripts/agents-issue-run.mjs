import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const args = process.argv.slice(2)
const issueNumber = args[0]
const dryRun = args.includes('--dry-run')
const createPr = args.includes('--create-pr')
const pushBranch = args.includes('--push')
const ready = args.includes('--ready')
const draft = args.includes('--draft') || !ready
const noCommit = args.includes('--no-commit')
const allowDirty = args.includes('--allow-dirty')
const baseIndex = args.indexOf('--base')
const baseBranch = baseIndex === -1 ? 'master' : args[baseIndex + 1]
const codexSandboxIndex = args.indexOf('--codex-sandbox')
const codexSandbox = codexSandboxIndex === -1 ? 'danger-full-access' : args[codexSandboxIndex + 1]
const codexSandboxModes = new Set(['read-only', 'workspace-write', 'danger-full-access'])

const usage = () => {
  console.log(
    'Usage: yarn agents:issue:run <issue-number> [--dry-run] [--no-commit] [--allow-dirty] [--create-pr] [--push] [--draft|--ready] [--base <branch>] [--codex-sandbox <mode>]'
  )
  console.log('')
  console.log(
    'Runs one local orchestration unit: issue start, agent execution, commit, then PR packaging.'
  )
  console.log('')
  console.log('Options:')
  console.log(
    '  --dry-run        Print the issue start plan without writing files or changing git state.'
  )
  console.log('  --no-commit      Do not create a local commit after the agent finishes.')
  console.log('  --allow-dirty    Permit starting from a dirty worktree.')
  console.log(
    '  --create-pr      Create the pull request after packaging it. Without this, PR is dry-run.'
  )
  console.log(
    '  --push           Push the current branch before creating the PR. Requires --create-pr.'
  )
  console.log('  --draft          Create the PR as draft. This is the default.')
  console.log('  --ready          Create the PR as ready for review.')
  console.log('  --base           Base branch for diff and PR creation. Defaults to master.')
  console.log(
    '  --codex-sandbox  Sandbox for Codex execution: read-only, workspace-write, or danger-full-access.'
  )
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

if (codexSandboxIndex !== -1 && !codexSandbox) {
  console.error('Expected a value after --codex-sandbox.')
  usage()
  process.exit(1)
}

if (!codexSandboxModes.has(codexSandbox)) {
  console.error(`Unsupported --codex-sandbox mode: ${codexSandbox}`)
  console.error('Expected one of: read-only, workspace-write, danger-full-access.')
  process.exit(1)
}

if (pushBranch && !createPr) {
  console.error('Use --push only with --create-pr.')
  process.exit(1)
}

const run = (command, commandArgs, options = {}) =>
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })

const exists = filePath => fs.existsSync(filePath)

const readIfExists = filePath => {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

const hasStagedChanges = () => {
  try {
    run('git', ['diff', '--cached', '--quiet'])
    return false
  } catch {
    return true
  }
}

const hasCommittedDiff = () => {
  try {
    run('git', ['diff', '--quiet', `${baseBranch}...HEAD`])
    return false
  } catch {
    return true
  }
}

const currentBranch = () => run('git', ['branch', '--show-current']).trim()
const statusShort = () => run('git', ['status', '--short']).trim()

const runStep = (label, command, commandArgs) => {
  try {
    run(command, commandArgs, { stdio: 'inherit' })
  } catch {
    console.error(`${label} failed.`)
    process.exit(1)
  }
}

const issueDir = path.join(repoRoot, '.scratch/issues', issueNumber)
const commitMessagePath = path.join(issueDir, 'commit-message.txt')

const startArgs = ['agents:issue:start', issueNumber]

if (dryRun) {
  startArgs.push('--dry-run')
} else {
  startArgs.push('--create-branch', '--run-codex', '--codex-sandbox', codexSandbox)
}

console.log(`Starting issue #${issueNumber}`)

if (!dryRun && !allowDirty) {
  const initialStatus = statusShort()

  if (initialStatus) {
    console.error('Refusing to start from a dirty worktree:')
    console.error(initialStatus)
    console.error('Commit, stash, or rerun with --allow-dirty if this is intentional.')
    process.exit(1)
  }
}

runStep('Issue start', 'yarn', startArgs)

if (dryRun) {
  console.log('Dry run complete. No Codex run, commit, push, or PR packaging was attempted.')
  process.exit(0)
}

const branch = currentBranch()

if (branch === baseBranch) {
  console.error(`Refusing to continue on the base branch: ${baseBranch}`)
  console.error('The start step should have created or switched to the issue branch.')
  process.exit(1)
}

if (!noCommit) {
  if (!exists(commitMessagePath)) {
    console.error(`Missing commit message artifact: ${path.relative(repoRoot, commitMessagePath)}`)
    console.error(
      'The agent must write a Conventional Commits subject before this wrapper commits.'
    )
    process.exit(1)
  }

  const commitMessage = readIfExists(commitMessagePath).trim().split('\n')[0]?.trim()

  if (!commitMessage) {
    console.error(`Empty commit message artifact: ${path.relative(repoRoot, commitMessagePath)}`)
    process.exit(1)
  }

  runStep('Git stage', 'git', ['add', '-A', '--', '.', ':!.scratch'])

  if (hasStagedChanges()) {
    runStep('Git commit', 'git', ['commit', '-m', commitMessage])
  } else {
    console.log('No staged changes to commit.')
  }
}

if (!hasCommittedDiff()) {
  console.error(`No committed diff found against ${baseBranch}.`)
  console.error('Refusing to package an empty issue branch.')
  process.exit(1)
}

const prArgs = ['agents:issue:pr', issueNumber, '--base', baseBranch]

if (createPr) {
  prArgs.push('--create')
  if (pushBranch) prArgs.push('--push')
  prArgs.push(draft ? '--draft' : '--ready')
} else {
  prArgs.push('--dry-run')
}

runStep('Issue PR packaging', 'yarn', prArgs)
