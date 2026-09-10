import { parsePreviewOsis, parseReferencePreviewLink } from '../referenceTarget'
import { loadReferencePreview } from '../loadPreview'
import type { BibleContentAccess } from '~features/resources/bibleContentAccess'

jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: { t: (key: string) => key },
}))

it.each(['bible://Matt.3.13-Matt.3.17', '/Matt_3.13-Matt_3.17'])(
  'recognizes editorial reference %s',
  href => {
    expect(parseReferencePreviewLink({ href, type: '' })).toMatchObject({
      selections: [{ book: 40, chapter: 3, start: 13, end: 17 }],
      title: 'Matthieu 3:13–17',
    })
  }
)
it('keeps Nave disjoint verses and explicit link versions', () => {
  expect(parseReferencePreviewLink({ href: 'v=1-2-3,5', type: '' })?.selections).toEqual([
    { book: 1, chapter: 2, start: 3, end: 3 },
    { book: 1, chapter: 2, start: 5, end: 5 },
  ])
  expect(
    parseReferencePreviewLink({ href: 'bible://John.3.16?version=KJV', type: '' })?.version
  ).toBe('KJV')
})
it('recognizes legacy dictionary reference links', () => {
  expect(parseReferencePreviewLink({ href: 'Jean 3.16', type: 'verse' })?.selections).toEqual([
    { book: 43, chapter: 3, start: 16, end: 16 },
  ])
})
it.each([
  'https://example.com/John.3.16',
  'strong://G0026',
  'Aaron',
  '#section',
  'v=0-1-2',
  'v=1-0-2',
  'Unknown.1.2',
  'Matt.3.17-Matt.3.13',
  'Matt.999.1',
  'Matt.3.0',
])('leaves other or invalid links alone: %s', href => {
  expect(parseReferencePreviewLink({ href, type: '' })).toBeUndefined()
})
it('retains complete cross-chapter boundaries and chapter-only references', () => {
  expect(parsePreviewOsis('John.3.35-John.4.2')?.selections).toEqual([
    { book: 43, chapter: 3, start: 35, end: undefined },
    { book: 43, chapter: 4, start: undefined, end: 2 },
  ])
  expect(parsePreviewOsis('John.3')?.selections).toEqual([
    { book: 43, chapter: 3, start: undefined, end: undefined },
  ])
})
const loadChapter = jest.fn(async ({ book, chapter }: { book: number; chapter: number }) => ({
  success: true as const,
  data: {
    kind: 'plain' as const,
    verses: [1, 2, 3, 4, 5].map(v => ({
      Livre: String(book),
      Chapitre: String(chapter),
      Verset: String(v),
      Texte: `verse ${v}`,
    })),
  },
}))
const access = { loadChapter } as unknown as BibleContentAccess
it('loads each chapter once and excludes verses between disjoint selections', async () => {
  loadChapter.mockClear()
  const target = parseReferencePreviewLink({ href: 'v=1-2-3,5', type: '' })!
  expect((await loadReferencePreview(target, 'KJV', access)).map(v => v.Verset)).toEqual(['3', '5'])
  expect(loadChapter).toHaveBeenCalledTimes(1)
  expect(loadChapter).toHaveBeenCalledWith({ book: 1, chapter: 2, version: 'KJV' })
})
it('loads both sides of a cross-chapter range', async () => {
  const verses = await loadReferencePreview(parsePreviewOsis('John.3.4-John.4.2')!, 'LSG', access)
  expect(verses.map(v => `${v.Chapitre}:${v.Verset}`)).toEqual(['3:4', '3:5', '4:1', '4:2'])
})
it('reports unavailable resources instead of returning an empty success', async () => {
  const unavailable = {
    loadChapter: async () => ({ success: false, error: { message: 'offline' } }),
  } as unknown as BibleContentAccess
  await expect(
    loadReferencePreview(parsePreviewOsis('John.3.16')!, 'LSG', unavailable)
  ).rejects.toThrow('offline')
})
