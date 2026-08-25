import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const logsDir = path.join(repoRoot, '.scratch/logs')
const command = process.argv[2] ?? 'help'

const ensureLogsDir = () => {
  fs.mkdirSync(logsDir, { recursive: true })
}

const readLogFiles = () => {
  ensureLogsDir()
  return fs
    .readdirSync(logsDir)
    .filter(file => file.endsWith('.log'))
    .sort()
    .flatMap(file => {
      const filePath = path.join(logsDir, file)
      return fs
        .readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => ({ file, line }))
    })
}

const printMatches = predicate => {
  const matches = readLogFiles().filter(
    ({ line }) => line.includes('[AgentLog]') && predicate(line)
  )

  for (const match of matches) {
    console.log(`${match.file}: ${match.line}`)
  }

  if (matches.length === 0) {
    console.log(`No matching [AgentLog] entries in ${path.relative(repoRoot, logsDir)}`)
  }
}

switch (command) {
  case 'clear': {
    fs.rmSync(logsDir, { recursive: true, force: true })
    ensureLogsDir()
    console.log(`Cleared ${path.relative(repoRoot, logsDir)}`)
    break
  }
  case 'all': {
    printMatches(() => true)
    break
  }
  case 'errors': {
    printMatches(line => /"level":"(error|fatal)"/.test(line))
    break
  }
  case 'startup': {
    printMatches(line => line.includes('"area":"startup"'))
    break
  }
  case 'navigation': {
    printMatches(line => line.includes('"area":"navigation"'))
    break
  }
  case 'help':
  default: {
    console.log('Usage: node scripts/agents-log-session.mjs <clear|all|errors|startup|navigation>')
    console.log('Capture Metro or simulator output into .scratch/logs/*.log before querying.')
  }
}
