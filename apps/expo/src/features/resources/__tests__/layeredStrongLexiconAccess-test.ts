import type { StrongLexiconEntry } from '@bible-strong/resource-domain/strong-lexicon'
import type { StrongLexiconAccess } from '../strongLexiconAccess'
import {
  createLayeredStrongLexiconAccess,
  getPrimaryStrongLexiconAvailability,
} from '../layeredStrongLexiconAccess'
import { ResourceAccessError } from '../resourceAccessError'

const identity = { kind: 'dstrong' as const, code: 'G2491K' }
const entry = (definitionHtml: string): StrongLexiconEntry => ({
  id: 1,
  selectedIdentity: identity,
  stepCode: identity.code,
  classicStrong: 'G2495',
  eStrong: 'G2495',
  dStrong: 'G2491K =',
  language: 'greek',
  baseCode: 2495,
  original: 'Ἰωνᾶς',
  transliteration: 'Ionas',
  gloss: 'Jonas',
  definitionHtml,
  relations: [],
  resources: [],
  lsjAbsent: false,
  modules: {
    resources: { status: 'missing', moduleId: 'resources' },
    entities: { status: 'missing', moduleId: 'entities' },
  },
})
const source = (value?: StrongLexiconEntry): StrongLexiconAccess => ({
  getModuleAvailability: async moduleId =>
    value ? { status: 'available', moduleId } : { status: 'missing', moduleId },
  loadEntry: async () => {
    if (!value) throw new ResourceAccessError('NETWORK_OFFLINE')
    return value
  },
  loadEntries: async () => (value ? [value] : []),
  loadEntryCards: async () => {
    if (!value) throw new ResourceAccessError('NETWORK_OFFLINE')
    return [value]
  },
  loadPreview: async () => {
    if (!value) throw new ResourceAccessError('NETWORK_OFFLINE')
    return [value]
  },
  loadMorphologies: async () => [],
  loadEntity: async () => undefined,
  loadChapterEntities: async () => [],
  listEntries: async () => ({ entries: [] }),
  search: async () => [],
  browseByGlossPrefix: async () => [],
  random: async () => undefined,
})

it('keeps historical definitions primary and STEP definitions in the advanced level', async () => {
  const access = createLayeredStrongLexiconAccess(source(entry('Simple')), source(entry('STEP')))
  const result = await access.loadEntry(identity, 'fr')
  expect(result?.definitionHtml).toBe('Simple')
  expect(result?.detailedDefinitionHtml).toBe('STEP')
  expect(result?.classicStrong).toBe('G2495')
  expect((await access.loadPreview([identity], 'fr'))[0]?.definitionHtml).toBe('Simple')
})

it('works with only a simple offline copy and does not require the detailed lexicon', async () => {
  const access = createLayeredStrongLexiconAccess(source(entry('Simple')), source())
  expect((await access.loadEntry(identity, 'en'))?.definitionHtml).toBe('Simple')
  expect((await access.loadEntry(identity, 'en'))?.detailedDefinitionHtml).toBeUndefined()
})

it('keeps an existing detailed copy readable without calling it a simple definition', async () => {
  const access = createLayeredStrongLexiconAccess(source(), source(entry('STEP')))
  const result = await access.loadEntry(identity, 'fr')
  expect(result?.definitionHtml).toBeUndefined()
  expect(result?.detailedDefinitionHtml).toBe('STEP')
  expect((await access.loadPreview([identity], 'fr'))[0]?.definitionHtml).toBeUndefined()
  expect((await getPrimaryStrongLexiconAvailability(access, 'fr')).status).toBe('available')
})

it('preserves offline recovery when neither level is readable', async () => {
  const access = createLayeredStrongLexiconAccess(source(), source())
  await expect(access.loadEntry(identity, 'fr')).rejects.toMatchObject({ code: 'NETWORK_OFFLINE' })
})

it('preserves the preview source identity filtering and deduplication', async () => {
  const simple = source(entry('Simple'))
  const preview = jest.spyOn(simple, 'loadPreview')
  const cards = jest.spyOn(simple, 'loadEntryCards')
  const access = createLayeredStrongLexiconAccess(simple, source(entry('STEP')))
  const identities = [identity, { kind: 'ustrong' as const, code: 'G2495' }, identity]
  expect(await access.loadPreview(identities, 'fr')).toEqual([entry('Simple')])
  expect(preview).toHaveBeenCalledWith(identities, 'fr')
  expect(cards).not.toHaveBeenCalled()
})
