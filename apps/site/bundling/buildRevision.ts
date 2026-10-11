import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Plugin } from 'vite'

// Cloudflare keeps a rendered page for a month (ADR-0084). A deployment that changes nothing
// of what renders the pages (a test, a script, a document) should not empty that cache; any
// other must. The build therefore names itself after what it is made of: a digest of every
// module of the Worker, among them the list of the files the browser is sent. The gateway
// puts that name in the key each page is kept under.

/** Replaced, in the built Worker, by the revision of the build. */
export const BUILD_REVISION_PLACEHOLDER = '__SITE_BUILD_REVISION__'

export type BuiltModule = { id: string; code: string | null }

/**
 * The same modules give the same revision, wherever the repository is checked out: a module
 * is named by its path from the root of the site.
 */
export const digestBuild = (modules: readonly BuiltModule[], root: string): string => {
  const named = modules.map(module => ({
    name: module.id.replace(/^\0+/u, '').replaceAll(root, ''),
    code: (module.code ?? '').replaceAll(root, ''),
  }))
  const hash = createHash('sha256')
  for (const module of named.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    hash.update(module.name)
    hash.update('\0')
    hash.update(module.code)
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

export const buildRevision = (): Plugin => {
  let root = process.cwd()
  let revision: string | undefined

  return {
    name: 'build-revision',
    configResolved(config) {
      root = path.resolve(config.root)
    },
    buildEnd() {
      if (this.environment.name !== 'ssr') return
      const modules: BuiltModule[] = []
      for (const id of this.getModuleIds()) {
        modules.push({ id, code: this.getModuleInfo(id)?.code ?? null })
      }
      revision = digestBuild(modules, root)
    },
    renderChunk(code) {
      if (this.environment.name !== 'ssr' || !code.includes(BUILD_REVISION_PLACEHOLDER)) {
        return null
      }
      if (!revision) throw new Error('BUILD_REVISION: the modules of the build were not read')
      const named = revision
      return { code: code.replaceAll(BUILD_REVISION_PLACEHOLDER, () => named), map: null }
    },
    generateBundle() {
      if (this.environment.name === 'ssr' && revision) this.info(`build revision: ${revision}`)
    },
  }
}
