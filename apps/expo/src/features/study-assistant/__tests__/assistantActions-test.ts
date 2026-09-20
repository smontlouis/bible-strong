import {
  parseAssistantAction,
  parseStudyEvent,
  parseStudyRequest,
} from '@bible-strong/ai-contract/contract'
import { createTabForAssistantAction } from '../assistantActions'

jest.mock('~helpers/bibleVersions', () => ({ versions: { LSG: {}, DBY: {} } }))
jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => 'new-tab' }))
jest.mock('~state/tabs', () => ({
  getDefaultBibleTab: (version: string) => ({ type: 'bible', data: { selectedVersion: version } }),
}))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))

const examples = [
  ['strong', { kind: 'strong' }, {}],
  [
    'strong',
    { kind: 'strong', code: 'G0026' },
    { reference: 'G0026', identityCode: 'G0026', identityKind: 'strong', book: 40 },
  ],
  [
    'strong',
    { kind: 'strong', code: 'H0001', identityKind: 'dstrong' },
    { reference: 'H0001', identityKind: 'dstrong', book: 1 },
  ],
  ['dictionary', { kind: 'dictionary', language: 'fr' }, { directory: true, language: 'fr' }],
  [
    'dictionary',
    { kind: 'dictionary', language: 'fr', work: 'bost', entryId: 42, word: 'Amour' },
    { directory: false, language: 'fr', work: 'bost', entryId: 42, word: 'Amour' },
  ],
  [
    'nave',
    { kind: 'nave', language: 'en', normalizedName: 'love' },
    { language: 'en', name_lower: 'love' },
  ],
  ['commentary', { kind: 'commentary', book: 43, chapter: 3, verse: 16 }, { verse: '43-3-16' }],
  [
    'commentary-resource',
    {
      kind: 'commentary-resource',
      resourceId: 'barnes',
      language: 'en',
      book: 43,
      chapter: 3,
      sectionId: 'barnes-en-43-3-16-16',
    },
    { projectionId: 'barnes:en', book: 43, chapter: 3, sectionId: 'barnes-en-43-3-16-16' },
  ],
  ['timeline', { kind: 'timeline', language: 'fr' }, { language: 'fr' }],
  [
    'timeline',
    { kind: 'timeline', language: 'fr', eventSlug: 'la-creation' },
    { eventSlug: 'la-creation', language: 'fr' },
  ],
  ['search', { kind: 'search', query: 'amour' }, { searchValue: 'amour' }],
  [
    'plan',
    { kind: 'reading', planId: 'public-plan', readingId: 'day-1' },
    { planId: 'public-plan', readingSliceId: 'day-1' },
  ],
] as const

it.each(examples)(
  'opens the public %s target received through the stream',
  (tabType, target, data) => {
    const action = parseAssistantAction({ id: 'action-1', kind: 'open_tab', tabType, target })
    expect(parseStudyEvent({ type: 'action', action })).toEqual({ type: 'action', action })
    expect(createTabForAssistantAction(action)).toMatchObject({
      id: 'new-tab',
      isRemovable: true,
      type: tabType,
      data,
    })
  }
)

it.each(['notes', 'study', 'bookmark', 'highlight', 'tag', 'link', 'account', 'new'])(
  'rejects personal or unsupported %s tabs',
  tabType => {
    expect(() =>
      parseAssistantAction({
        id: 'a',
        kind: 'open_tab',
        tabType,
        target: { kind: tabType, id: 'private' },
      })
    ).toThrow('INVALID_ACTION')
  }
)

it.each([
  ['plan', { kind: 'reading', planId: 'public-plan', enroll: true }],
  ['plan', { kind: 'reading', planId: '../users/private' }],
  ['search', { kind: 'search', query: 'amour', sources: ['notes'] }],
  ['dictionary', { kind: 'dictionary', language: 'fr', entryId: 42 }],
  ['dictionary', { kind: 'dictionary', language: 'fr', work: 'bost', entryId: 0, word: 'Amour' }],
  ['strong', { kind: 'strong', code: 'private-note' }],
  ['nave', { kind: 'timeline', language: 'fr' }],
  ['timeline', { kind: 'timeline', language: 'fr', eventSlug: 'https://example.com' }],
  [
    'commentary-resource',
    { kind: 'commentary-resource', language: 'fr', resourceId: '../../users', book: 1, chapter: 1 },
  ],
])('rejects malformed %s targets', (tabType, target) => {
  expect(() => parseAssistantAction({ id: 'a', kind: 'open_tab', tabType, target })).toThrow(
    'INVALID_ACTION'
  )
})

it('rejects chapters outside the selected book at the application boundary', () => {
  const action = parseAssistantAction({
    id: 'a',
    kind: 'open_tab',
    tabType: 'commentary',
    target: { kind: 'commentary', book: 43, chapter: 150, verse: 1 },
  })
  expect(createTabForAssistantAction(action)).toBeUndefined()
})

it('advertises public tabs separately from legacy passage tabs', () => {
  expect(
    parseStudyRequest({
      question: 'Ouvre le lexique',
      clientCapabilities: ['open_tab', 'open_public_tab'],
    }).clientCapabilities
  ).toEqual(['open_tab', 'open_public_tab'])
})

it('starts Bible search without inheriting personal search filters', () => {
  const action = parseAssistantAction({
    id: 'a',
    kind: 'open_tab',
    tabType: 'search',
    target: { kind: 'search', query: 'amour' },
  })
  expect(createTabForAssistantAction(action)).toMatchObject({
    data: {
      filters: { itemFilters: { passages: true, notes: false, links: false, studies: false } },
    },
  })
})
