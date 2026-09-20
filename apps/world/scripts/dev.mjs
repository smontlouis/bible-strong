import { spawn } from 'node:child_process'
const children = ['dev:client', 'dev:multiplayer'].map(script =>
  spawn('yarn', [script], { stdio: 'inherit' })
)
let closing = false
function stop(code = 0) {
  if (closing) return
  closing = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
for (const child of children) {
  child.on('error', error => {
    console.error(error)
    stop(1)
  })
  child.on('exit', code => stop(code ?? 0))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
