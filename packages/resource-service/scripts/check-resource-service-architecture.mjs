import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'src')

const collectTypeScriptFiles = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(entry => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? collectTypeScriptFiles(target) : [target]
    })
  )
  return files.flat().filter(file => /\.tsx?$/.test(file) && !file.includes('__tests__'))
}

const violations = []
for (const file of await collectTypeScriptFiles(sourceRoot)) {
  const relative = path.relative(root, file)
  const source = await readFile(file, 'utf8')

  if (source.includes('@effect/sql-kysely')) {
    violations.push(`${relative}: @effect/sql-kysely is not allowed`)
  }

  if (/from ['"]drizzle-orm(?:\/[^'"]+)?['"]/.test(source)) {
    const allowed = new Set([
      'src/database/schema.ts',
      'src/database/types.ts',
    ])
    if (!allowed.has(relative)) {
      violations.push(`${relative}: Drizzle imports are limited to schema and type derivation`)
    }
  }

  if (/from ['"](?:kysely|kysely-neon|pg|@neondatabase\/serverless)['"]/.test(source)) {
    const allowed = new Set([
      'src/database/localDatabase.ts',
      'src/database/hyperdriveDatabase.ts',
      'src/database/neonDatabase.ts',
      'src/database/types.ts',
    ])
    if (!allowed.has(relative) && !relative.includes('/repositories/')) {
      violations.push(`${relative}: database clients must stay behind database/repository modules`)
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log('Resource service architecture boundaries are valid.')
}
