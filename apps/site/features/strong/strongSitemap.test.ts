import { afterEach, describe, expect, it, vi } from 'vitest'
import { listStrongSitemapUrls } from './strongSitemap'

const row = (stepCode: string, classicStrong: string, gloss: string) => ({
  id: 1,
  stepCode,
  classicStrong,
  language: 'hebrew',
  original: 'א',
  transliteration: 'a',
  gloss,
})

// The lexicon list, a page per cursor. Elohim is only listed when every sense is asked for.
const PAGES: Record<string, { entries: ReturnType<typeof row>[]; nextCursor?: string }> = {
  first: {
    entries: [row('H0430G', 'H0430', 'Dieu'), row('H0430H', 'H0430', '(SEIGNEUR)-Elohe')],
    nextCursor: 'second',
  },
  second: { entries: [row('H8064', 'H8064', 'ciel')] },
}

const stubLexiconList = () => {
  const requests: URL[] = []
  vi.stubGlobal('fetch', async (input: URL) => {
    requests.push(input)
    const page = PAGES[input.searchParams.get('cursor') ?? 'first']
    return new Response(JSON.stringify({ resource: { revision: 'r1' }, ...page }))
  })
  return requests
}

afterEach(() => vi.unstubAllGlobals())

describe('listStrongSitemapUrls', () => {
  it('asks every page of the lexicon list for every sense', async () => {
    const requests = stubLexiconList()
    await listStrongSitemapUrls('hebrew')

    expect(requests.map(url => url.pathname)).toEqual([
      '/v1/strong-lexicon/entries',
      '/v1/strong-lexicon/entries',
    ])
    expect(requests.map(url => url.searchParams.get('identities'))).toEqual(['all', 'all'])
    expect(requests.map(url => url.searchParams.get('lexicalLanguage'))).toEqual([
      'hebrew',
      'hebrew',
    ])
  })

  it('names a split number by its page and a whole number by its sense', async () => {
    stubLexiconList()
    const urls = await listStrongSitemapUrls('hebrew')

    expect(urls.map(url => new URL(url.loc).pathname)).toEqual([
      '/strong/fr/h0430',
      '/strong/en/h0430',
      '/strong/fr/h8064',
      '/strong/en/h8064',
    ])
  })
})
