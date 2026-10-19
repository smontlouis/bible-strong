/* eslint-disable import/first */
const mockTranslations: Record<string, string> = {
  Matthieu: 'Matthew',
  'Livre {{bookNumber}}': 'Book {{bookNumber}}',
}

jest.mock('~helpers/bibleBookCatalog', () => ({
  getBook: (book: number) => (book === 40 ? { Numero: 40, Nom: 'Matthieu' } : undefined),
}))
jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: { bookNumber?: number }) =>
      (mockTranslations[key] ?? key).replace('{{bookNumber}}', String(options?.bookNumber)),
  },
}))

import { getCommentaryBookLabel } from '../commentaryBookLabel'

it('shows the book name in the interface language, not the stored French name', () => {
  expect(getCommentaryBookLabel(40)).toBe('Matthew')
})

it('falls back to a translated book number for an unknown book', () => {
  expect(getCommentaryBookLabel(99)).toBe('Book 99')
})
