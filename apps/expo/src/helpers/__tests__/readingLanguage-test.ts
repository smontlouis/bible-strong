import { getOriginalBookTitle } from '../originalBookTitles'
import { getReadingBookName, getReadingLanguage, translateForReading } from '../readingLanguage'

let mockAppLanguage = 'fr'
const englishBooks: Record<string, string> = {
  Proverbes: 'Proverbs',
  Chapitre: 'Chapter',
  Psaume: 'Psalm',
}

jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => mockAppLanguage,
  default: {
    t: (key: string, options?: { lng?: string }) =>
      options?.lng === 'en' ? (englishBooks[key] ?? key) : key,
  },
}))

jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

const proverbs = { Nom: 'Proverbes' }

describe('reading language', () => {
  beforeEach(() => {
    mockAppLanguage = 'fr'
  })

  it('follows a French or English version whatever the app speaks', () => {
    expect(getReadingLanguage('KJV')).toBe('en')
    expect(getReadingBookName(proverbs, 'KJV')).toBe('Proverbs')
    expect(translateForReading('Chapitre', 'KJV')).toBe('Chapter')

    mockAppLanguage = 'en'
    expect(getReadingLanguage('LSG')).toBe('fr')
    expect(getReadingBookName(proverbs, 'LSG')).toBe('Proverbes')
  })

  it.each(['BHG', 'BHS', 'LXX', 'SBLGNT', 'VUL'])(
    'keeps the app language for %s, an original-language version',
    versionId => {
      expect(getReadingLanguage(versionId)).toBe('fr')
      mockAppLanguage = 'en'
      expect(getReadingLanguage(versionId)).toBe('en')
    }
  )

  it('keeps the app language for an unknown version', () => {
    mockAppLanguage = 'en'
    expect(getReadingLanguage('UNKNOWN')).toBe('en')
    expect(getReadingLanguage()).toBe('en')
  })
})

describe('original book titles', () => {
  it('has none for a French or English version', () => {
    expect(getOriginalBookTitle(1, 'LSG')).toBeNull()
    expect(getOriginalBookTitle(1, 'KJV')).toBeNull()
  })

  it('reads the BHG Old Testament in Hebrew and its New Testament in Greek', () => {
    expect(getOriginalBookTitle(1, 'BHG')).toEqual({ title: 'בראשית', lang: 'he', dir: 'rtl' })
    expect(getOriginalBookTitle(43, 'BHG')).toEqual({
      title: 'Κατὰ Ἰωάννην',
      lang: 'grc',
      dir: 'ltr',
    })
  })

  it('names the books of the Septuagint, the Greek New Testament and the Vulgate', () => {
    expect(getOriginalBookTitle(19, 'LXX')?.title).toBe('Ψαλμοί')
    expect(getOriginalBookTitle(67, 'LXX')?.title).toBe('Τωβίτ')
    expect(getOriginalBookTitle(40, 'SBLGNT')?.title).toBe('Κατὰ Ματθαῖον')
    expect(getOriginalBookTitle(9, 'VUL')).toEqual({ title: 'Regum I', lang: 'la', dir: 'ltr' })
  })

  it('names every book of a Hebrew, Greek or Latin canon', () => {
    const range = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, index) => from + index)

    for (const book of range(1, 39)) expect(getOriginalBookTitle(book, 'BHS')).not.toBeNull()
    for (const book of range(40, 66)) expect(getOriginalBookTitle(book, 'DEL')).not.toBeNull()
    for (const book of range(1, 77)) expect(getOriginalBookTitle(book, 'LXX')).not.toBeNull()
    for (const book of range(1, 74)) expect(getOriginalBookTitle(book, 'VUL')).not.toBeNull()
  })
})
