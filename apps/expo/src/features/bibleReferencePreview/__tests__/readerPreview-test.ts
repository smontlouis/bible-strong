import { Platform } from 'react-native'
import { createReaderPreview } from '../readerPreview'
jest.mock('~features/resources/dictionaryAccess', () => ({
  getDefaultDictionaryWork: (language: string) =>
    language === 'en' ? 'easton-webster' : 'westphal',
}))
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: { t: (key: string) => key },
}))
beforeEach(() => {
  Platform.OS = 'web'
})

it('previews a note without executing its original navigation', () => {
  const open = jest.fn()
  const request = createReaderPreview(
    { type: 'note', noteId: 'annotation:abc' },
    'LSG',
    'Note',
    open
  )
  expect(request).toMatchObject({ kind: 'note', noteId: 'annotation:abc' })
  expect(open).not.toHaveBeenCalled()
  request?.open()
  expect(open).toHaveBeenCalledTimes(1)
})
it('preserves disjoint cross-chapter passages and the relation version', () => {
  const request = createReaderPreview(
    { type: 'verse', verseKeys: ['43-3-16', '43-4-2'], version: 'KJV' },
    'LSG',
    'Note',
    () => {}
  )
  expect(request).toMatchObject({
    kind: 'bible',
    version: 'KJV',
    selections: [
      { book: 43, chapter: 3, start: 16, end: 16 },
      { book: 43, chapter: 4, start: 2, end: 2 },
    ],
  })
})
it('previews studies and saved external links on Web', () => {
  expect(
    createReaderPreview({ type: 'study', studyId: 'study' }, 'LSG', 'Note', () => {})
  ).toMatchObject({ kind: 'study', studyId: 'study' })
  expect(
    createReaderPreview(
      { type: 'externalLink', linkId: 'link', sourceKey: 'link', url: 'https://example.com' },
      'LSG',
      'Note',
      () => {}
    )
  ).toMatchObject({ kind: 'link', linkId: 'link' })
})

it.each(['ios', 'android'] as const)('keeps native reader navigation on %s', platform => {
  Platform.OS = platform
  expect(
    createReaderPreview(
      { type: 'externalLink', linkId: 'link', sourceKey: 'link', url: 'https://example.com' },
      'LSG',
      'Lien',
      () => {}
    )
  ).toBeUndefined()
  expect(
    createReaderPreview({ type: 'note', noteId: 'note' }, 'LSG', 'Note', () => {})
  ).toBeUndefined()
  expect(
    createReaderPreview({ type: 'verse', verseKeys: ['43-3-16'] }, 'LSG', 'Note', () => {})
  ).toBeUndefined()
})

it('previews Nave and dictionary relations in the resource language', () => {
  expect(
    createReaderPreview(
      { type: 'nave', nameLower: 'love', resourceLanguage: 'en' },
      'LSG',
      'Note',
      () => {}
    )
  ).toMatchObject({ kind: 'nave', name: 'love', source: { language: 'en' } })
  expect(
    createReaderPreview({ type: 'dictionary', word: 'Amour' }, 'LSG', 'Note', () => {})
  ).toMatchObject({
    kind: 'dictionary',
    word: 'Amour',
    source: { work: 'westphal', language: 'fr' },
  })
  expect(
    createReaderPreview({ type: 'dictionary', word: 'Love' }, 'LSG', 'Note', () => {}, {
      nave: 'fr',
      dictionary: 'en',
    })
  ).toMatchObject({ kind: 'dictionary', source: { work: 'easton-webster', language: 'en' } })
})
it.each(['ios', 'android'] as const)(
  'keeps study, dictionary and Nave links direct on %s',
  platform => {
    Platform.OS = platform
    expect(
      createReaderPreview({ type: 'study', studyId: 's' }, 'LSG', 'Note', () => {})
    ).toBeUndefined()
    expect(
      createReaderPreview({ type: 'nave', nameLower: 'love' }, 'LSG', 'Note', () => {})
    ).toBeUndefined()
    expect(
      createReaderPreview({ type: 'dictionary', word: 'Love' }, 'LSG', 'Note', () => {})
    ).toBeUndefined()
  }
)
