import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { sha256 } from './sdabc-french-translation-pipeline.mjs'
import { readFileSync } from 'node:fs'

// Separate from the Lexicon V3 execution receipt. Updating this pin must never alter Lexicon lineage.
export const SDABC_CODEX_VERSION = 'codex-cli 0.150.0-alpha.8'
export const SDABC_CODEX_SHA256 = '4ff5e75f028e913cfeb53bd7319f87573cdce6538c1b1ccc44ce62d5ce51ca1d'
export const SDABC_CODEX_BUNDLE_BINARY = '/Applications/ChatGPT.app/Contents/Resources/codex'

const fileHash = filePath => sha256(readFileSync(filePath))

export const assertSdabcCodexBinary = (filePath, {
  expectedVersion = SDABC_CODEX_VERSION,
  expectedSha256 = SDABC_CODEX_SHA256,
} = {}) => {
  const absolute = resolve(filePath)
  const stat = lstatSync(absolute)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`sdabc-codex-binary-invalid:${absolute}`)
  if ((stat.mode & 0o222) !== 0) throw new Error(`sdabc-codex-binary-writable:${absolute}`)
  const actualHash = fileHash(absolute)
  if (actualHash !== expectedSha256) throw new Error(`sdabc-codex-binary-hash:${actualHash}`)
  const version = spawnSync(absolute, ['--version'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' } })
  if (version.status !== 0 || version.stdout.trim() !== expectedVersion) throw new Error(`sdabc-codex-binary-version:${version.stdout.trim()}`)
  return { path: absolute, version: expectedVersion, sha256: expectedSha256 }
}

export const ensureSdabcCodexBinary = ({
  destination,
  source = SDABC_CODEX_BUNDLE_BINARY,
  expectedVersion = SDABC_CODEX_VERSION,
  expectedSha256 = SDABC_CODEX_SHA256,
}) => {
  const target = resolve(destination)
  if (existsSync(target)) return assertSdabcCodexBinary(target, { expectedVersion, expectedSha256 })
  const sourceHash = fileHash(source)
  if (sourceHash !== expectedSha256) throw new Error(`sdabc-codex-source-unpinned:${sourceHash}`)
  mkdirSync(dirname(target), { recursive: true })
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`
  try {
    copyFileSync(source, temporary)
    chmodSync(temporary, 0o555)
    if (fileHash(temporary) !== expectedSha256) throw new Error('sdabc-codex-stage-copy-hash')
    renameSync(temporary, target)
  } finally {
    rmSync(temporary, { force: true })
  }
  return assertSdabcCodexBinary(target, { expectedVersion, expectedSha256 })
}
