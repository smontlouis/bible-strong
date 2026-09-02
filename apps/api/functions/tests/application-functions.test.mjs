import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const retiredFunctions = ['count_verses', 'dictionnaire', 'grec', 'hebreu']

test('keeps Resource reads out of the Application API deployment', async () => {
  const entrypoint = await readFile(path.join(root, 'src/index.ts'), 'utf8')

  for (const functionName of retiredFunctions) {
    assert.doesNotMatch(entrypoint, new RegExp(`from ['"]\\./${functionName}['"]`, 'u'))
    await assert.rejects(access(path.join(root, `src/${functionName}.ts`)))
  }
})
