import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoots = ['packages/resource-domain', 'packages/resource-catalog']
const forbiddenImports = [
  '@bible-strong/mobile',
  '@bible-strong/resource-service',
  'apps/mobile',
  'expo',
  'firebase',
  'react',
  'react-native',
  'drizzle-orm',
  'kysely',
  'pg',
  'node:fs',
  'node:http',
]

const collectSourceFiles = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? collectSourceFiles(target) : [target]
    })
  )
  return nested
    .flat()
    .filter(file => /\.(?:ts|tsx|mjs)$/u.test(file) && !file.endsWith('.node-test.ts'))
}

const violations = []
for (const packageRoot of packageRoots) {
  const absoluteRoot = path.join(workspaceRoot, packageRoot)
  for (const file of await collectSourceFiles(path.join(absoluteRoot, 'src'))) {
    const source = await readFile(file, 'utf8')
    for (const dependency of forbiddenImports) {
      const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      const importPattern = new RegExp(
        `(?:from\\s+|import\\s*\\()(['\"])${escaped}(?:/[^'\"]*)?\\1`,
        'u'
      )
      if (importPattern.test(source)) {
        violations.push(`${path.relative(workspaceRoot, file)}: forbidden import ${dependency}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log('Shared Resource package boundaries are valid.')
}
