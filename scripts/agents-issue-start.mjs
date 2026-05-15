import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const issueNumber = process.argv[2]
const createBranch = process.argv.includes('--create-branch')
const createWorktree = process.argv.includes('--worktree')
const dryRun = process.argv.includes('--dry-run')

const usage = () => {
  console.log('Usage: yarn agents:issue:start <issue-number> [--dry-run] [--create-branch]')
  console.log('')
  console.log('Fetches a GitHub issue with gh, writes .scratch/issues/<number>/ artifacts,')
  console.log('and prepares a mobile-sequential implementation prompt for Codex.')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run        Print planned paths and git actions without writing files.')
  console.log('  --create-branch  Create and check out the recommended branch in this worktree.')
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

if (createWorktree) {
  console.error('--worktree is not supported for Bible Strong mobile issue work.')
  console.error(
    'This repo uses mobile-sequential orchestration: create one branch in the current worktree and run the local mobile verification loop before moving to the next issue.'
  )
  console.error('Use --create-branch, or omit it to generate artifacts only.')
  process.exit(1)
}

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })

const slugify = value =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')

const issueJson = (() => {
  try {
    return run('gh', [
      'issue',
      'view',
      issueNumber,
      '--comments',
      '--json',
      'number,title,body,labels,url,author,comments,state',
    ])
  } catch (error) {
    console.error('Failed to fetch issue with gh.')
    console.error('Make sure gh is installed, authenticated, and run inside the GitHub repo clone.')
    if (error.stderr) console.error(error.stderr.toString())
    process.exit(1)
  }
})()

const issue = JSON.parse(issueJson)
const labels = (issue.labels ?? []).map(label => label.name)
const slug = slugify(issue.title || `issue-${issue.number}`)
const branchName = `codex/issue-${issue.number}-${slug}`
const issueDir = path.join(repoRoot, '.scratch/issues', String(issue.number))
const issuePath = path.join(issueDir, 'issue.json')
const promptPath = path.join(issueDir, 'prompt.md')
const summaryPath = path.join(issueDir, 'summary.md')

const issueText = [
  issue.title,
  issue.body,
  labels.join(' '),
  ...(issue.comments ?? []).map(comment => comment.body),
]
  .filter(Boolean)
  .join('\n')
  .toLowerCase()

const sensitiveMatches = [
  ['auth/account', /\bauth|sign[- ]?in|login|account deletion|delete account|user-owned data\b/],
  ['sync/firebase', /\bfirebase|firestore|sync|remote config|storage\b/],
  ['backup/import/export', /\bbackup|import|export|restore\b/],
  [
    'native/release',
    /\beas|native|ios|android|release|build profile|bundle id|app store|play store\b/,
  ],
].filter(([, pattern]) => pattern.test(issueText))

const isReadyForAgent = labels.includes('ready-for-agent')
const hasNeedsInfo = labels.includes('needs-info')
const hasWontfix = labels.includes('wontfix')

const prompt = `# Agent Issue Implementation Prompt

Issue: #${issue.number} - ${issue.title}
URL: ${issue.url}
Recommended branch: \`${branchName}\`
Orchestration mode: \`mobile-sequential\`

## Required Reading

Read these files before changing code:

- \`AGENTS.md\`
- \`CONTEXT.md\`
- \`docs/agents/orchestration.md\`
- \`docs/agents/validation.md\`
- \`docs/agents/smoke-tests.md\`
- \`docs/agents/sensitive-areas.md\`
- \`docs/agents/observability.md\`

## Issue Body

${issue.body?.trim() || '_No issue body._'}

## Comments

${
  issue.comments?.length
    ? issue.comments
        .map(
          comment =>
            `### ${comment.author?.login ?? 'unknown'} at ${comment.createdAt ?? 'unknown'}\n\n${
              comment.body?.trim() || '_Empty comment._'
            }`
        )
        .join('\n\n')
    : '_No comments._'
}

## Harness Contract

- Work only on this issue or a tightly scoped prerequisite.
- Use branch \`${branchName}\` unless the operator chooses another branch.
- Use the current worktree. Do not create a per-issue worktree for mobile user-facing work in this repo.
- Respect the mobile orchestration policy in \`docs/agents/orchestration.md\`.
- Run the smallest relevant static checks, then broaden when touching shared state, navigation, storage, startup, sync, or sensitive areas.
- For user-facing/runtime changes, do not open or advance a PR until the local mobile verification loop has produced evidence.
- Do not run destructive auth, sync, backup/import/export, native release, or production validation without explicit owner approval.

## Suggested Static Validation

- \`yarn typecheck\`
- \`yarn lint\`
- \`yarn test --watchman=false\` when Jest/Watchman is flaky in the agent environment
- \`yarn format:check\`
- \`yarn agents:quality:check\`
- \`yarn agents:architecture:check\`

## Mobile Validation

Mobile runtime validation is host-only and sequential by default.

If this issue changes runtime or user-facing behavior, run the required smoke paths from \`docs/agents/smoke-tests.md\` with \`serve-sim\` or equivalent simulator/device tooling before PR readiness.

## Completion Output

End with:

- files changed;
- branch used;
- validation commands run and results;
- whether mobile validation is not needed or passed;
- sensitive areas touched;
- remaining blockers.
`

const summary = `# Issue #${issue.number} Start

- Title: ${issue.title}
- URL: ${issue.url}
- State: ${issue.state}
- Labels: ${labels.length ? labels.join(', ') : 'none'}
- Ready for agent: ${isReadyForAgent ? 'yes' : 'no'}
- Orchestration mode: \`mobile-sequential\`
- Recommended branch: \`${branchName}\`
- Prompt: \`${path.relative(repoRoot, promptPath)}\`

## Sensitive-Area Scan

${
  sensitiveMatches.length
    ? sensitiveMatches
        .map(([area]) => `- ${area}: possible match; inspect before implementation`)
        .join('\n')
    : '- No obvious sensitive-area keywords detected by the starter scan.'
}

## Mobile Orchestration

- Work happens on one dedicated branch in the current worktree.
- Static validation runs before the local mobile runtime smoke path.
- Mobile runtime validation uses the host simulator/dev-client loop directly.
- User-facing/runtime PRs should not be opened or advanced until smoke passes, unless the change is non-runtime/non-user-facing.

## Suggested Next Step

Use the generated prompt with Codex on branch \`${branchName}\`.
`

if (!dryRun) {
  fs.mkdirSync(issueDir, { recursive: true })
  fs.writeFileSync(issuePath, `${JSON.stringify(issue, null, 2)}\n`)
  fs.writeFileSync(promptPath, prompt)
  fs.writeFileSync(summaryPath, summary)
}

if (createBranch) {
  try {
    if (!dryRun) {
      run('git', ['switch', '-c', branchName], { stdio: 'inherit' })
    }
  } catch {
    console.error(`Failed to create branch ${branchName}.`)
    process.exit(1)
  }
}

console.log(`${dryRun ? 'Planned' : 'Prepared'} issue #${issue.number}: ${issue.title}`)
const branchStatus = createBranch
  ? dryRun
    ? ' (would create and check out)'
    : ' (created and checked out)'
  : ' (not created)'
console.log(`Branch: ${branchName}${branchStatus}`)
console.log('Orchestration mode: mobile-sequential')
console.log(`${dryRun ? 'Would write' : 'Wrote'} ${path.relative(repoRoot, issuePath)}`)
console.log(`${dryRun ? 'Would write' : 'Wrote'} ${path.relative(repoRoot, promptPath)}`)
console.log(`${dryRun ? 'Would write' : 'Wrote'} ${path.relative(repoRoot, summaryPath)}`)

if (!isReadyForAgent) {
  console.log('Note: issue is not labeled ready-for-agent.')
}

if (hasNeedsInfo || hasWontfix) {
  console.log('Warning: issue has a label that may block agent implementation.')
}

if (sensitiveMatches.length > 0) {
  console.log('Sensitive-area scan found possible matches:')
  for (const [area] of sensitiveMatches) {
    console.log(`- ${area}`)
  }
}
