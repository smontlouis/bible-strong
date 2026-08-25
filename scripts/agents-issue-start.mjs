import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const issueNumber = process.argv[2]
const createBranch = process.argv.includes('--create-branch')
const createWorktree = process.argv.includes('--worktree')
const dryRun = process.argv.includes('--dry-run')
const runCodex = process.argv.includes('--run-codex')
const codexSandboxIndex = process.argv.indexOf('--codex-sandbox')
const codexSandbox =
  codexSandboxIndex === -1 ? 'danger-full-access' : process.argv[codexSandboxIndex + 1]
const codexSandboxModes = new Set(['read-only', 'workspace-write', 'danger-full-access'])

const usage = () => {
  console.log(
    'Usage: yarn agents:issue:start <issue-number> [--dry-run] [--create-branch] [--run-codex] [--codex-sandbox <mode>]'
  )
  console.log('')
  console.log('Fetches a GitHub issue with gh, writes .scratch/issues/<number>/ artifacts,')
  console.log('and prepares a mobile-sequential implementation prompt for Codex.')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run        Print planned paths and git actions without writing files.')
  console.log('  --create-branch  Create and check out the recommended branch in this worktree.')
  console.log('  --run-codex      Run Codex non-interactively with the generated prompt.')
  console.log(
    '  --codex-sandbox  Sandbox for --run-codex: read-only, workspace-write, or danger-full-access.'
  )
  console.log(
    '                   Defaults to danger-full-access for trusted local mobile runtime validation.'
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

if (createWorktree) {
  console.error('--worktree is not supported for Bible Strong mobile issue work.')
  console.error(
    'This repo uses mobile-sequential orchestration: create one branch in the current worktree and run the local mobile verification loop before moving to the next issue.'
  )
  console.error('Use --create-branch, or omit it to generate artifacts only.')
  process.exit(1)
}

if (dryRun && runCodex) {
  console.error('Use either --dry-run or --run-codex, not both.')
  console.error('--dry-run does not write the generated prompt that Codex should read.')
  process.exit(1)
}

if (codexSandboxIndex !== -1 && !runCodex) {
  console.error('Use --codex-sandbox only with --run-codex.')
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

const getCurrentBranch = () => run('git', ['branch', '--show-current']).trim()

const branchExists = branch => {
  try {
    run('git', ['rev-parse', '--verify', '--quiet', branch])
    return true
  } catch {
    return false
  }
}

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
const codexFinalPath = path.join(issueDir, 'codex-final.md')
const evidenceDir = path.join(issueDir, 'evidence')
const mobileValidationPath = path.join(issueDir, 'mobile-validation.md')
const commitMessagePath = path.join(issueDir, 'commit-message.txt')
const changeSummaryPath = path.join(issueDir, 'change-summary.md')
const prNotesPath = path.join(issueDir, 'pr-notes.md')

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

If this issue changes runtime or user-facing behavior, run the required smoke paths from \`docs/agents/smoke-tests.md\` with Argent or equivalent simulator/device tooling before PR readiness.

For UI or runtime changes, produce stable evidence for the future PR step:

- write screenshots, screen recordings, or other UI artifacts under \`${path.relative(repoRoot, evidenceDir)}\`;
- when the change is visual, capture after screenshots that show the implemented result;
- prefer descriptive names such as \`after-home.png\`, \`after-settings.png\`, or \`runtime-smoke.png\`;
- do not create duplicate screenshots just to simulate a before/after pair;
- write a concise mobile validation report to \`${path.relative(repoRoot, mobileValidationPath)}\`;
- include the simulator/emulator/device used, the Argent session details when applicable, smoke path covered, relevant app logs, and whether runtime validation is \`passed\`, \`blocked\`, or \`not-needed\`;
- stop Argent simulator servers, Metro, or other helper processes you started unless the operator explicitly asks to keep them running.

## PR Handoff Artifacts

Before ending, prepare deterministic handoff files for the local orchestration wrapper:

- write a Conventional Commits subject to \`${path.relative(repoRoot, commitMessagePath)}\`;
- write a concise implementation summary to \`${path.relative(repoRoot, changeSummaryPath)}\`;
- write any PR-specific notes, risks, screenshots to mention, or reviewer guidance to \`${path.relative(repoRoot, prNotesPath)}\`;
- keep these files factual and based on the implemented diff and validation evidence;
- do not push, open a PR, or change remote state.

## Completion Output

End with:

- files changed;
- branch used;
- validation commands run and results;
- mobile runtime status: \`passed\`, \`blocked\`, or \`not-needed\`;
- evidence files written;
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
- UI/runtime evidence should be written under \`${path.relative(repoRoot, evidenceDir)}\`.
- Mobile validation summary should be written to \`${path.relative(repoRoot, mobileValidationPath)}\`.
- Commit and PR handoff should be written to \`${path.relative(repoRoot, commitMessagePath)}\`, \`${path.relative(repoRoot, changeSummaryPath)}\`, and \`${path.relative(repoRoot, prNotesPath)}\`.
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
      if (getCurrentBranch() === branchName) {
        // Reruns on the prepared branch should refresh issue artifacts and continue.
      } else if (branchExists(branchName)) {
        run('git', ['switch', branchName], { stdio: 'inherit' })
      } else {
        run('git', ['switch', '-c', branchName], { stdio: 'inherit' })
      }
    }
  } catch {
    console.error(`Failed to create or switch to branch ${branchName}.`)
    process.exit(1)
  }
}

console.log(`${dryRun ? 'Planned' : 'Prepared'} issue #${issue.number}: ${issue.title}`)
const branchStatus = createBranch
  ? dryRun
    ? ' (would create or switch)'
    : ' (created or checked out)'
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

if (runCodex) {
  const promptRelativePath = path.relative(repoRoot, promptPath)
  const finalRelativePath = path.relative(repoRoot, codexFinalPath)
  console.log(`Running Codex exec with ${promptRelativePath}`)
  console.log(`Codex sandbox: ${codexSandbox}`)
  console.log(`Codex final message will be written to ${finalRelativePath}`)

  try {
    run(
      'codex',
      [
        'exec',
        '--cd',
        repoRoot,
        '--sandbox',
        codexSandbox,
        '--output-last-message',
        codexFinalPath,
        `Read ${promptRelativePath} and implement the issue using the repository harness contract. Continue until the required local checks pass or blockers are clearly documented.`,
      ],
      { stdio: 'inherit' }
    )
  } catch {
    console.error('Codex exec failed.')
    console.error(`Inspect ${finalRelativePath} if it was written, then rerun or resume manually.`)
    process.exit(1)
  }
}
