import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = process.cwd()
const logsDir = path.join(repoRoot, '.scratch/logs')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const logPath = path.join(logsDir, `session-${timestamp}.log`)
const command = process.platform === 'win32' ? 'yarn.cmd' : 'yarn'
const childArgs = ['start']

fs.mkdirSync(logsDir, { recursive: true })

const stream = fs.createWriteStream(logPath, { flags: 'a' })
const child = spawn(command, childArgs, {
  cwd: repoRoot,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
})

console.log(`Capturing Expo output to ${path.relative(repoRoot, logPath)}`)

const write = (chunk, target) => {
  target.write(chunk)
  stream.write(chunk)
}

child.stdout.on('data', chunk => write(chunk, process.stdout))
child.stderr.on('data', chunk => write(chunk, process.stderr))

const stop = signal => {
  child.kill(signal)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

child.on('close', code => {
  stream.end(() => {
    process.exit(code ?? 0)
  })
})
