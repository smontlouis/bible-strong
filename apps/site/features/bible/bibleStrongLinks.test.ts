import { describe, expect, it } from 'vitest'
import { bibleStrongLinks } from './bibleStrongLinks'

describe('bibleStrongLinks', () => {
  it('opens the sense a word has in its verse, under its classical number', () => {
    // 1 Samuel 2:29, "to make yourselves fat": the second sense of H1254.
    expect(
      bibleStrongLinks(
        [
          { kind: 'strong', code: 'H1254' },
          { kind: 'estrong', code: 'H1254b' },
          { kind: 'dstrong', code: 'H1254B' },
        ],
        'fr'
      )
    ).toEqual([{ code: 'H1254B', path: '/strong/fr/h1254B', label: 'H1254' }])
  })

  it('keeps the classical number of a word the lexicon does not tell apart', () => {
    expect(bibleStrongLinks([{ kind: 'strong', code: 'H8064' }], 'en')).toEqual([
      { code: 'H8064', path: '/strong/en/h8064', label: 'H8064' },
    ])
  })

  it('reads the codes of an index that does not pad them', () => {
    expect(
      bibleStrongLinks(
        [
          { kind: 'strong', code: 'H430' },
          { kind: 'dstrong', code: 'H430G' },
          // What the word also stands for is not an entry of its own here.
          { kind: 'ustrong', code: 'H3068G' },
        ],
        'en'
      )
    ).toEqual([{ code: 'H0430G', path: '/strong/en/h0430G', label: 'H430' }])
  })

  it('keeps the words of a compound in the order of the text', () => {
    expect(
      bibleStrongLinks(
        [
          { kind: 'strong', code: 'H853' },
          { kind: 'strong', code: 'H1254' },
          { kind: 'estrong', code: 'H1254a' },
          { kind: 'dstrong', code: 'H1254A' },
        ],
        'en'
      ).map(link => link.code)
    ).toEqual(['H0853', 'H1254A'])
  })

  it('leaves out what is not a Strong identity', () => {
    expect(bibleStrongLinks([{ kind: 'lemma', code: 'x' }], 'fr')).toEqual([])
  })
})
