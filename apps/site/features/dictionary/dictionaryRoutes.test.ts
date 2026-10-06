import { describe, expect, it } from 'vitest'
import { dictionaryEntryBreadcrumbs, dictionaryLetterBreadcrumbs } from './dictionaryBreadcrumbs'
import { dictionaryWorkName } from './dictionaryHead'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  buildDictionaryLetterPath,
  buildDictionaryWorkPath,
  buildWebAppDictionaryEntryUrl,
  createDictionaryArticleSlug,
  dictionaryLetter,
  dictionaryLetterInitials,
  parseDictionaryEntryId,
  parseDictionaryWorkRoute,
  validateDictionaryListSearch,
} from './dictionaryRoutes'

describe('Dictionary article slugs', () => {
  it('derives a readable label from a heading', () => {
    expect(createDictionaryArticleSlug('Aaron')).toBe('aaron')
    expect(createDictionaryArticleSlug('Ébed-Mélec (serviteur du roi)')).toBe(
      'ebed-melec-serviteur-du-roi'
    )
    expect(createDictionaryArticleSlug('Aaron’s Rod')).toBe('aaron-s-rod')
    expect(createDictionaryArticleSlug('  Ab (1) ')).toBe('ab-1')
  })

  it('never yields an empty segment', () => {
    expect(createDictionaryArticleSlug('…')).toBe('article')
    expect(createDictionaryArticleSlug('')).toBe('article')
  })

  it('leaves a slug unchanged', () => {
    expect(createDictionaryArticleSlug('ebed-melec-serviteur-du-roi')).toBe(
      'ebed-melec-serviteur-du-roi'
    )
  })
})

describe('Dictionary public routes', () => {
  it('reads the language and the work in their canonical spelling', () => {
    expect(parseDictionaryWorkRoute({ language: 'fr', work: 'bost' })).toEqual({
      language: 'fr',
      work: 'bost',
    })
    expect(parseDictionaryWorkRoute({ language: 'EN', work: 'Easton-Webster' })).toEqual({
      language: 'en',
      work: 'easton-webster',
    })
  })

  it('rejects what cannot name a dictionary', () => {
    expect(parseDictionaryWorkRoute({ language: 'de', work: 'bost' })).toBeUndefined()
    for (const work of ['', 'bost_fr', '-bost', 'bost-', 'bo st', 'bost/1']) {
      expect(parseDictionaryWorkRoute({ language: 'fr', work })).toBeUndefined()
    }
  })

  it('reads an article identity as a positive integer', () => {
    expect(parseDictionaryEntryId('2')).toBe(2)
    expect(parseDictionaryEntryId('0002')).toBe(2)
    expect(parseDictionaryEntryId('10872')).toBe(10872)
    for (const value of [undefined, '', '0', '-1', '1.5', '1e3', 'a', '2a', '1234567890123456']) {
      expect(parseDictionaryEntryId(value)).toBeUndefined()
    }
  })

  it('builds the paths of the lists', () => {
    expect(buildDictionaryIndexPath('fr')).toBe('/dictionary/fr')
    expect(buildDictionaryWorkPath('en', 'easton-webster')).toBe('/dictionary/en/easton-webster')
    expect(buildDictionaryLetterPath('fr', 'bost', 'a')).toBe('/dictionary/fr/bost/a')
    expect(buildDictionaryLetterPath('fr', 'bost', 'a', 1)).toBe('/dictionary/fr/bost/a')
    expect(buildDictionaryLetterPath('en', 'isbe', 's', 3)).toBe('/dictionary/en/isbe/s?page=3')
    expect(() => buildDictionaryWorkPath('fr', 'Bost')).toThrow('DICTIONARY_ROUTE_INVALID')
  })

  it('builds the article path and the same address in the study workspace', () => {
    const entry = { language: 'fr', work: 'bost', entryId: 780, word: 'Égypte' } as const
    expect(buildDictionaryEntryPath(entry)).toBe('/dictionary/fr/bost/780/egypte')
    expect(buildWebAppDictionaryEntryUrl(entry)).toBe(
      'https://web.bible-strong.app/dictionary/fr/bost/780/egypte'
    )
    expect(() => buildDictionaryEntryPath({ ...entry, entryId: 0 })).toThrow(
      'DICTIONARY_ROUTE_INVALID'
    )
    expect(() => buildDictionaryEntryPath({ ...entry, entryId: 1.5 })).toThrow(
      'DICTIONARY_ROUTE_INVALID'
    )
  })

  it('only reads a page number from the search of a list', () => {
    expect(validateDictionaryListSearch({ page: 2 })).toEqual({ page: 2 })
    expect(validateDictionaryListSearch({ page: 1 })).toEqual({ page: 1 })
    for (const page of [0, -2, 1.5, '2', 'abc', null, undefined, true]) {
      expect(validateDictionaryListSearch({ page })).toStrictEqual({ page: undefined })
    }
    expect(validateDictionaryListSearch({ other: 2 })).toStrictEqual({ page: undefined })
  })
})

describe('Dictionary letters', () => {
  it('files a heading under its plain initial', () => {
    expect(dictionaryLetter('Aaron', 'fr')).toBe('a')
    expect(dictionaryLetter(' zacharie', 'fr')).toBe('z')
    expect(dictionaryLetter('Zion', 'en')).toBe('z')
  })

  it('files French accented initials under their letter', () => {
    expect(dictionaryLetter('Égypte', 'fr')).toBe('e')
    expect(dictionaryLetter('Âge', 'fr')).toBe('a')
    expect(dictionaryLetter('Œuvres', 'fr')).toBe('o')
    expect(dictionaryLetterInitials('e', 'fr')).toEqual(['e', 'é', 'è', 'ê', 'ë'])
    expect(dictionaryLetterInitials('b', 'fr')).toEqual(['b'])
  })

  it('asks English works for the plain letter only', () => {
    expect(dictionaryLetterInitials('e', 'en')).toEqual(['e'])
    expect(dictionaryLetter('Égypte', 'en')).toBeUndefined()
  })

  it('does not file a heading starting with anything else', () => {
    expect(dictionaryLetter('(Beth)-Togarma', 'fr')).toBeUndefined()
    expect(dictionaryLetter('70 semaines', 'fr')).toBeUndefined()
    expect(dictionaryLetter('  ', 'fr')).toBeUndefined()
  })
})

describe('Dictionary breadcrumbs', () => {
  const work = { id: 'bost', abbreviation: 'Bost' }

  it('leads to an article through its work and its letter', () => {
    expect(
      dictionaryEntryBreadcrumbs({ language: 'fr', work, id: 780, word: 'Égypte', letter: 'e' })
    ).toEqual([
      { label: 'Dictionnaire', path: '/dictionary/fr' },
      { label: 'Bost', path: '/dictionary/fr/bost' },
      { label: 'E', path: '/dictionary/fr/bost/e' },
      { label: 'Égypte', path: '/dictionary/fr/bost/780/egypte' },
    ])
  })

  it('skips the letter of an article that is not filed', () => {
    expect(
      dictionaryEntryBreadcrumbs({ language: 'fr', work, id: 9, word: '70 semaines' }).map(
        breadcrumb => breadcrumb.label
      )
    ).toEqual(['Dictionnaire', 'Bost', '70 semaines'])
  })

  it('numbers the following pages of a letter', () => {
    expect(dictionaryLetterBreadcrumbs('fr', work, 'a', 2).at(-1)).toEqual({
      label: 'A – page 2',
      path: '/dictionary/fr/bost/a?page=2',
    })
  })
})

describe('Dictionary work names', () => {
  it('adds the name a work is known by to a generic title', () => {
    expect(dictionaryWorkName({ title: 'Dictionnaire de la Bible', abbreviation: 'Bost' })).toBe(
      'Dictionnaire de la Bible (Bost)'
    )
    expect(
      dictionaryWorkName({
        title: 'International Standard Bible Encyclopedia',
        abbreviation: 'ISBE 1915',
      })
    ).toBe('International Standard Bible Encyclopedia (ISBE 1915)')
  })

  it('keeps a title that already starts with it', () => {
    expect(dictionaryWorkName({ title: 'Smith’s Bible Dictionary', abbreviation: 'Smith' })).toBe(
      'Smith’s Bible Dictionary'
    )
    expect(
      dictionaryWorkName({
        title: 'Easton’s Bible Dictionary & Webster’s 1828 Dictionary',
        abbreviation: 'Easton + Webster 1828',
      })
    ).toBe('Easton’s Bible Dictionary & Webster’s 1828 Dictionary')
  })
})
