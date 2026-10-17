import type { ReadingContext } from '../conversations'
import { resolveReadingContexts } from '../readingContextSources'

jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
  __esModule: true,
  default: { t: (key: string) => key },
}))
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: () => 'Jean 3:16',
}))
jest.mock('~features/lexique/strongRouteIdentity', () => ({
  normalizeStrongRouteIdentity: (data: { identityCode?: string }) =>
    data.identityCode ? { code: data.identityCode } : undefined,
}))
jest.mock('~features/lexique/strongDetailRoutes', () => ({
  parseStrongDetailRouteParams: (params: Record<string, unknown>) => ({ context: params }),
}))

const context = (key: string, kind: ReadingContext['kind'] = 'commentary'): ReadingContext => ({
  key,
  kind,
  label: key,
  detail: key,
})
const tab = { id: 'tab-1', type: 'home' } as never

describe('reading contexts offered to the assistant', () => {
  it('prefers what the active tab published over what its tab state implies', () => {
    const { reader } = resolveReadingContexts({
      tab,
      pathname: '/',
      params: {},
      registry: {
        a: { scope: 'tab:tab-1', path: '/', context: context('published') },
        b: { scope: 'tab:tab-2', path: '/', context: context('other tab') },
      },
    })
    expect(reader?.key).toBe('published')
  })

  it('only takes the route opened over the reader from its own path', () => {
    const registry = {
      a: { scope: 'panel', path: '/plan', context: context('plan', 'plan') },
      b: { scope: 'panel', path: '/meditation', context: context('meditation', 'meditation') },
    }
    expect(
      resolveReadingContexts({ tab, pathname: '/meditation', params: {}, registry }).panel?.key
    ).toBe('meditation')
    expect(
      resolveReadingContexts({ tab, pathname: '/search', params: {}, registry }).panel
    ).toBeNull()
  })

  it('describes a Strong route from its own parameters when nothing was published', () => {
    const { panel } = resolveReadingContexts({
      tab,
      pathname: '/strong',
      params: { identityCode: 'G25', clickedWord: 'aimé', bibleVersion: 'LSG' },
      registry: {},
    })
    expect(panel?.kind).toBe('word')
    expect(panel?.label).toBe('aimé · G25')
    expect(panel?.bibleVersion).toBe('LSG')
    expect(panel?.activeContext).toEqual({ kind: 'word', bibleVersion: 'LSG', reference: 'G25' })
  })

  it('offers nothing for a tab with no study surface', () => {
    expect(
      resolveReadingContexts({ tab, pathname: '/', params: {}, registry: {} }).reader
    ).toBeNull()
  })
})
