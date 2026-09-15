import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { usePassageFilterChoices } from '../usePassageFilterChoices'
import { DEFAULT_BIBLE_VERSION_FILTER } from '~state/searchVersionFilter'

let mockConnected = true
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~helpers/useConnection', () => () => mockConnected)
jest.mock('~state/useDefaultBibleVersion', () => ({ useDefaultBibleVersion: () => 'LSG' }))
jest.mock('~helpers/bibleVersions', () => ({
  versions: { LSG: {}, KJV: {}, TOB: {} },
  getBibleVersionCanonId: (version: string) =>
    version === 'TOB' ? 'catholic-73' : 'protestant-66',
}))
jest.mock('~helpers/bibleBookCatalog', () => ({
  getBooksForCanon: (canon: string) => [
    { Numero: canon === 'catholic-73' ? 67 : 1, Nom: 'Book', Chapitres: 1 },
  ],
}))
jest.mock('~features/resources/useOfflineResourceRegistry', () => ({
  useOfflineResourceRegistry: () => ({
    resources: new Map([
      [
        'LSG',
        { resource: { kind: 'bible', versionId: 'LSG' }, availability: { status: 'available' } },
      ],
    ]),
  }),
}))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({
    capabilities: { getOnlineAccess: () => ({ status: 'remotely-readable' }) },
  }),
}))
let choices: ReturnType<typeof usePassageFilterChoices>
function Probe() {
  const value = usePassageFilterChoices('', 'LSG')
  useEffect(() => {
    choices = value
  })
  return null
}

it('shares version, canon, book and ordering choices and respects offline availability', () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<Probe />)
    })
    expect(choices.versionChoices.map(choice => choice.value)).toEqual([
      DEFAULT_BIBLE_VERSION_FILTER,
      'LSG',
      'KJV',
      'TOB',
    ])
    expect(choices.canonChoices.map(choice => choice.value)).toEqual([
      '',
      'protestant-66',
      'catholic-73',
    ])
    expect(choices.sortOrderChoices.map(choice => choice.value)).toEqual(['relevance', 'book'])
    expect(choices.bookChoices.map(choice => choice.value)).toEqual([0, 1])
    mockConnected = false
    act(() => tree.update(<Probe />))
    expect(choices.versionChoices.map(choice => choice.value)).toEqual([
      DEFAULT_BIBLE_VERSION_FILTER,
      'LSG',
    ])
    expect(choices.canonChoices.map(choice => choice.value)).toEqual(['', 'protestant-66'])
  } finally {
    act(() => tree?.unmount())
    mockConnected = true
  }
})
