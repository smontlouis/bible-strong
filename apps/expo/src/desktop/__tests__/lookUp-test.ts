jest.mock('../../../i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: { t: (key: string) => key },
}))

import { lookUpPassage } from '../lookUp'

const summary = (text: string, language: 'fr' | 'en' = 'fr') => {
  const target = lookUpPassage(text, 'LSG', language)
  if (target?.kind !== 'bible') return target
  const { version, book, chapter, passage } = target.route
  return { version, book: book.Numero, chapter, passage }
}

describe('looking up a selection from another app', () => {
  it('opens a verse in the reader’s version', () => {
    expect(summary('Jean 3:16')).toEqual({
      version: 'LSG',
      book: 43,
      chapter: 3,
      passage: { startVerse: 16, endVerse: 16 },
    })
  })

  it('opens a whole chapter without a passage', () => {
    expect(summary('  Genèse 1 ')).toEqual({
      version: 'LSG',
      book: 1,
      chapter: 1,
      passage: undefined,
    })
  })

  it('reads a reference written in the other language', () => {
    expect(summary('John 3:16-18')).toMatchObject({ book: 43, chapter: 3 })
    expect(summary('Jean 3:16', 'en')).toMatchObject({ book: 43, chapter: 3 })
  })

  it('leaves words and sentences to the search', () => {
    expect(lookUpPassage('amour', 'LSG', 'fr')).toBeUndefined()
    expect(lookUpPassage('Car Dieu a tant aimé le monde, Jean 3:16', 'LSG', 'fr')).toBeUndefined()
  })
})
