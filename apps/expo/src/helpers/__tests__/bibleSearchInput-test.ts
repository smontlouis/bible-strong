import {
  findClosestBibleSearchTerm,
  highlightFuzzyBibleSearchText,
  highlightBibleSearchText,
  normalizeBibleSearchText,
  parseBibleTextSearchQuery,
  parseStrongReference,
} from '../bibleSearchInput'

describe('Bible search input', () => {
  describe('parseStrongReference', () => {
    it('normalizes Greek and Hebrew Strong references', () => {
      expect(parseStrongReference('g0026')).toEqual({
        language: 'greek',
        number: 26,
        code: 'G26',
      })
      expect(parseStrongReference(' H 0430 ')).toEqual({
        language: 'hebrew',
        number: 430,
        code: 'H430',
      })
    })

    it('rejects partial, zero, and non-numeric Strong references', () => {
      expect(parseStrongReference('mot H430')).toBeNull()
      expect(parseStrongReference('G0')).toBeNull()
      expect(parseStrongReference('H')).toBeNull()
    })
  })

  describe('normalizeBibleSearchText', () => {
    it('folds French accents, apostrophes, case, and punctuation', () => {
      expect(normalizeBibleSearchText('“L’Amour”, ÉTERNEL !')).toBe('l amour eternel')
    })

    it('folds Greek diacritics and final sigma', () => {
      expect(normalizeBibleSearchText('Ἀγάπη Λόγος')).toBe('αγαπη λογοσ')
    })

    it('removes Hebrew niqqud and cantillation', () => {
      expect(normalizeBibleSearchText('בְּרֵאשִׁ֖ית אֱלֹהִים')).toBe('בראשית אלהים')
    })
  })

  describe('parseBibleTextSearchQuery', () => {
    it('recognizes an entire quoted phrase', () => {
      expect(parseBibleTextSearchQuery('« amour de Dieu »')).toEqual({
        kind: 'phrase',
        raw: 'amour de Dieu',
        normalized: 'amour de dieu',
        terms: ['amour', 'de', 'dieu'],
      })
    })

    it('treats an ordinary query as natural terms', () => {
      expect(parseBibleTextSearchQuery('L’amour de Dieu')).toEqual({
        kind: 'terms',
        raw: 'L’amour de Dieu',
        normalized: 'l amour de dieu',
        terms: ['l', 'amour', 'de', 'dieu'],
      })
    })

    it('does not interpret a mixed quoted query as an expert expression', () => {
      expect(parseBibleTextSearchQuery('"amour de Dieu" monde')).toMatchObject({
        kind: 'terms',
        normalized: 'amour de dieu monde',
      })
    })

    it('rejects empty and punctuation-only input', () => {
      expect(parseBibleTextSearchQuery('  ')).toBeNull()
      expect(parseBibleTextSearchQuery('---')).toBeNull()
    })
  })

  describe('highlightBibleSearchText', () => {
    it('preserves accents and original-language marks in highlighted results', () => {
      expect(highlightBibleSearchText('L’Éternel est fidèle', 'eternel')).toBe(
        'L’{{Éternel}} est fidèle'
      )
      expect(highlightBibleSearchText('Ἀγάπη Θεοῦ', 'αγαπη')).toBe('{{Ἀγάπη}} Θεοῦ')
      expect(highlightBibleSearchText('אֱלֹהִים בָּרָא', 'אלהים')).toBe('{{אֱלֹהִים}} בָּרָא')
    })

    it('highlights an exact normalized phrase as one range', () => {
      expect(highlightBibleSearchText('Car Dieu a tant aimé le monde', '"aimé le monde"')).toBe(
        'Car Dieu a tant {{aimé le monde}}'
      )
    })
  })

  describe('findClosestBibleSearchTerm', () => {
    it('corrects a sufficiently long missing term from the local FTS vocabulary', () => {
      expect(
        findClosestBibleSearchTerm('resurection', ['restauration', 'resurrection', 'résurrection'])
      ).toBe('resurrection')
    })

    it('does not correct short or distant terms', () => {
      expect(findClosestBibleSearchTerm('dieu', ['lieu', 'dieu'])).toBe('dieu')
      expect(findClosestBibleSearchTerm('vie', ['voie'])).toBeUndefined()
      expect(findClosestBibleSearchTerm('resurection', ['justification'])).toBeUndefined()
    })
  })

  it('highlights the corrected word in a fuzzy result', () => {
    expect(highlightFuzzyBibleSearchText('Je suis la résurrection et la vie', 'resurection')).toBe(
      'Je suis la {{résurrection}} et la vie'
    )
  })
})
