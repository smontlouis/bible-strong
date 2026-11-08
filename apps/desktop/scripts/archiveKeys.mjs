// The Offline-copy keys (ADR-0065): BIBLE_STRONG_ARCHIVE_KEYS from the environment, or from
// apps/expo/.env.local as for the mobile builds. Never printed.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME = 'BIBLE_STRONG_ARCHIVE_KEYS'
const envLocal = join(dirname(fileURLToPath(import.meta.url)), '../../expo/.env.local')

export const readArchiveKeys = () => {
  if (process.env[NAME]) return process.env[NAME]
  if (!existsSync(envLocal)) return undefined
  const line = readFileSync(envLocal, 'utf8')
    .split('\n')
    .find(entry => entry.startsWith(`${NAME}=`))
  return line
    ?.slice(NAME.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
}

export const withArchiveKeys = env => {
  const keys = readArchiveKeys()
  return keys ? { ...env, [NAME]: keys } : env
}
