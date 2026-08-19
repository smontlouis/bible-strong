import { readdir } from 'node:fs/promises'
import path from 'node:path'

export const findPublicationBundlesRecursively = async (roots: readonly string[]) => {
  const manifests: string[] = []
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(candidate)
      } else if (entry.isFile() && entry.name === 'manifest.json') {
        manifests.push(path.dirname(candidate))
      }
    }
  }
  for (const root of roots) await visit(path.resolve(root))
  return [...new Set(manifests)].sort((left, right) => left.localeCompare(right))
}

export const parsePublicationCatalogRoots = (
  values: readonly string[],
  environmentValue = process.env.RESOURCE_PUBLICATION_ROOTS
) => {
  const roots: string[] = []
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== '--root' || !values[index + 1]) {
      throw new Error(`PUBLICATION_CLI_ARGUMENT_INVALID:${values[index] ?? '<missing>'}`)
    }
    roots.push(values[index + 1]!)
    index += 1
  }
  if (roots.length === 0 && environmentValue) {
    roots.push(...environmentValue.split(path.delimiter).filter(Boolean))
  }
  if (roots.length === 0) throw new Error('PUBLICATION_CLI_ARGUMENT_REQUIRED:--root')
  return roots
}
