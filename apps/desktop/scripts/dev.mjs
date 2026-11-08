// Runs the desktop app against the desktop web dev server on port 9090 (`yarn web:dev`),
// with the Offline-copy keys so that downloads can be tested for real.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readArchiveKeys, withArchiveKeys } from './archiveKeys.mjs'

if (!readArchiveKeys()) {
  console.warn('[desktop] BIBLE_STRONG_ARCHIVE_KEYS is missing: Offline copies will not install')
}

const child = spawn('yarn', ['tauri', 'dev', '--config', 'src-tauri/tauri.dev.conf.json'], {
  cwd: join(dirname(fileURLToPath(import.meta.url)), '..'),
  stdio: 'inherit',
  env: withArchiveKeys(process.env),
})
child.on('exit', code => process.exit(code ?? 0))
