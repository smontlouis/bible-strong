import { describe, expect, it } from 'vitest'
import { digestBuild } from './buildRevision'

const ROOT = '/repo/apps/site'
const modules = [
  { id: `${ROOT}/src/routes/bible.$.tsx`, code: `import "${ROOT}/features/bible/BiblePage.tsx"` },
  { id: `${ROOT}/features/bible/BiblePage.tsx`, code: 'export default function BiblePage() {}' },
  { id: '\0tanstack-start-manifest:v', code: '{"/assets/index-abc.js":1}' },
  { id: 'cloudflare:workers', code: null },
]

describe('Revision of a build', () => {
  it('is the same for the same modules, in any order', () => {
    expect(digestBuild(modules, ROOT)).toBe(digestBuild([...modules].reverse(), ROOT))
    expect(digestBuild(modules, ROOT)).toMatch(/^[0-9a-f]{16}$/u)
  })

  it('is the same wherever the repository is checked out', () => {
    const elsewhere = modules.map(({ id, code }) => ({
      id: id.replaceAll(ROOT, '/ci/build/apps/site'),
      code: code?.replaceAll(ROOT, '/ci/build/apps/site') ?? null,
    }))
    expect(digestBuild(elsewhere, '/ci/build/apps/site')).toBe(digestBuild(modules, ROOT))
  })

  it('changes with the code of a module', () => {
    const changed = modules.map(module =>
      module.id.endsWith('BiblePage.tsx') ? { ...module, code: 'export default 1' } : module
    )
    expect(digestBuild(changed, ROOT)).not.toBe(digestBuild(modules, ROOT))
  })

  it('changes with the files the browser is sent, which the manifest lists', () => {
    const changed = modules.map(module =>
      module.id.includes('manifest') ? { ...module, code: '{"/assets/index-xyz.js":1}' } : module
    )
    expect(digestBuild(changed, ROOT)).not.toBe(digestBuild(modules, ROOT))
  })

  it('changes when a module is added or renamed', () => {
    expect(digestBuild([...modules, { id: `${ROOT}/new.ts`, code: '' }], ROOT)).not.toBe(
      digestBuild(modules, ROOT)
    )
  })
})
