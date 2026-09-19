import { assistantLanguagePreferences, responseBibleVersion } from '../languagePreferences'
import {
  parseStudyRequest,
  parseStudyWidget,
  parseStudySource,
} from '@bible-strong/ai-contract/contract'
it('keeps the reading Bible, default Bible and default Strong Bible independent', () => {
  expect(assistantLanguagePreferences('en-US')).toEqual({
    appLanguage: 'en',
    defaultBibleVersion: 'KJV',
    defaultStrongBibleVersion: 'KJV',
  })
  expect(assistantLanguagePreferences('fr')).toEqual({
    appLanguage: 'fr',
    defaultBibleVersion: 'LSG',
    defaultStrongBibleVersion: 'LSG',
  })
  expect(assistantLanguagePreferences('fr', 'NBS', 'S21', 'KJV')).toEqual({
    appLanguage: 'fr',
    defaultBibleVersion: 'NBS',
    readingBibleVersion: 'S21',
    defaultStrongBibleVersion: 'KJV',
  })
  expect(assistantLanguagePreferences('en', 'S21', undefined, 'DBY')).toEqual({
    appLanguage: 'en',
    defaultBibleVersion: 'S21',
    defaultStrongBibleVersion: 'DBY',
  })
})
it('validates locale/version preferences and retains the actual source version', () => {
  expect(
    parseStudyRequest({ question: 'Read', appLanguage: 'en', bibleVersion: 'KJV' })
  ).toMatchObject({ appLanguage: 'en', bibleVersion: 'KJV' })
  expect(() => parseStudyRequest({ question: 'Read', appLanguage: 'xx' })).toThrow()
  expect(() => parseStudyRequest({ question: 'Read', bibleVersion: '../LSG' })).toThrow()
  expect(
    parseStudySource({
      id: 's1',
      kind: 'passage',
      title: 'John 15:4',
      excerpt: 'Abide',
      version: 'KJV',
      params: { book: '43', chapter: '15', start: '4', end: '4' },
    })
  ).toMatchObject({ version: 'KJV' })
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'concordance',
      title: 'G3306',
      reference: 'G3306',
      identityKind: 'strong',
      scope: 'classic_family',
      language: 'en',
      version: 'KJV',
    })
  ).toMatchObject({ version: 'KJV' })
})

it('validates all separate preference fields and retains older payload compatibility', () => {
  const preferences = {
    defaultBibleVersion: 'NBS',
    defaultStrongBibleVersion: 'KJV',
    readingBibleVersion: 'S21',
  }
  expect(parseStudyRequest({ question: 'Read', ...preferences })).toMatchObject(preferences)
  for (const field of Object.keys(preferences))
    expect(() => parseStudyRequest({ question: 'Read', [field]: '../LSG' })).toThrow()
  expect(parseStudyRequest({ question: 'Read', bibleVersion: 'KJV' })).toMatchObject({
    bibleVersion: 'KJV',
  })
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'concordance',
      title: 'G3306',
      reference: 'G3306',
      identityKind: 'strong',
      scope: 'classic_family',
      language: 'fr',
      version: 'DBY',
    })
  ).toMatchObject({ version: 'DBY' })
})

it('preserves a concordance edition in prose links without conflating mixed source editions', () => {
  const dbr = parseStudyWidget({
    id: 'w1',
    kind: 'concordance',
    title: 'G3306',
    reference: 'G3306',
    identityKind: 'strong',
    scope: 'classic_family',
    language: 'fr',
    version: 'DBR',
  })
  expect(responseBibleVersion([], [dbr])).toBe('DBR')
  expect(
    responseBibleVersion(
      [
        {
          id: 's1',
          kind: 'passage',
          title: 'John',
          excerpt: 'Text',
          version: 'KJV',
          params: { book: '43', chapter: '15', start: '4', end: '4' },
        },
      ],
      [dbr]
    )
  ).toBeUndefined()
})
