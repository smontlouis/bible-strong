import type {
  OfflineResourceRegistryEntry,
  OfflineResourceRegistrySnapshot,
} from '../resourceAvailability'
import { getStrongIndexLexiconModuleId } from '../strongIndexLexicon'

const lexicon = (moduleId: string, status: string): OfflineResourceRegistryEntry =>
  ({
    id: `strong-lexicon:${moduleId}`,
    resource: { kind: 'strong-lexicon-module', moduleId },
    availability: { status },
    verified: true,
    updateAvailable: false,
  }) as OfflineResourceRegistryEntry

const registry = (
  entries: OfflineResourceRegistryEntry[] = []
): OfflineResourceRegistrySnapshot => ({
  revision: 1,
  phase: 'ready',
  resources: new Map(entries.map(entry => [entry.id, entry])),
})

describe('Strong lexicon acquired with a Strong Bible index', () => {
  it('is the simple lexicon in the Strong language when none is installed', () => {
    expect(getStrongIndexLexiconModuleId(registry(), 'fr')).toBe('simple-fr')
    expect(getStrongIndexLexiconModuleId(registry(), 'en')).toBe('simple-en')
  })

  it.each(['simple-fr', 'core'])('is not needed once %s is installed', moduleId => {
    expect(
      getStrongIndexLexiconModuleId(registry([lexicon(moduleId, 'available')]), 'fr')
    ).toBeUndefined()
  })

  it('ignores the simple lexicon of another language', () => {
    expect(getStrongIndexLexiconModuleId(registry([lexicon('simple-en', 'available')]), 'fr')).toBe(
      'simple-fr'
    )
  })

  it('replaces an installed lexicon that can no longer be read', () => {
    expect(
      getStrongIndexLexiconModuleId(registry([lexicon('simple-fr', 'incompatible')]), 'fr')
    ).toBe('simple-fr')
  })
})
