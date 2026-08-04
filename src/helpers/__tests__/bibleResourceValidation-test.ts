import { validatePericopeResource, validateRedWordsResource } from '../bibleResourceValidation'

describe('Bible child resource validation', () => {
  it('accepts the nested pericope publication shape', () => {
    expect(() =>
      validatePericopeResource({
        1: {
          1: {
            1: { h1: 'LES TEMPS ANCIENS', h3: 'Création du monde' },
          },
          2: {},
        },
      })
    ).not.toThrow()
  })

  it('rejects malformed pericope headings', () => {
    expect(() =>
      validatePericopeResource({
        1: { 1: { 1: { h3: 42 } } },
      })
    ).toThrow('BIBLE_PERICOPE_SCHEMA_MISMATCH')
  })

  it('accepts red-word ranges indexed by verse', () => {
    expect(() =>
      validateRedWordsResource({
        '40-3-15': [{ start: 3, end: 18 }],
      })
    ).not.toThrow()
  })

  it('accepts the empty-verse sentinel used by published red-word resources', () => {
    expect(() =>
      validateRedWordsResource({
        '41-11-26': [{ start: 0, end: -1 }],
      })
    ).not.toThrow()
  })

  it('rejects malformed or inverted red-word ranges', () => {
    expect(() =>
      validateRedWordsResource({
        '40-3-15': [{ start: 18, end: 3 }],
      })
    ).toThrow('BIBLE_RED_WORDS_SCHEMA_MISMATCH')
  })
})
