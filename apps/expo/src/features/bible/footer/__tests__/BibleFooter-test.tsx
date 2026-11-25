import React from 'react'
import { act, create } from 'react-test-renderer'
import { atom, getDefaultStore } from 'jotai/vanilla'

import type { BibleTab } from '~state/tabs'
import { bibleAudioStateAtom } from '~features/bible-audio/atoms'
import BibleFooter from '../BibleFooter'

const mockListenToPassage = jest.fn()
const mockPause = jest.fn()
const mockPlay = jest.fn()
const mockOpenPlayer = jest.fn()
let mockIsCurrentTab = false

jest.mock('~helpers/atomWithAsyncStorage', () => {
  const { atom: createAtom } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  return (_key: string, initialValue: unknown) => createAtom(initialValue)
})

jest.mock('~helpers/bibleCoverage', () => ({
  getNextAvailableChapterLocation: () => ({}),
  getPreviousAvailableChapterLocation: () => ({}),
  resolveBibleCoverageCanonId: () => 'protestant-66',
}))

jest.mock('~helpers/bibleVersions', () => ({
  getBibleVersionCanonId: () => 'protestant-66',
}))

jest.mock('~state/tabs', () => ({
  useIsCurrentTab: () => () => mockIsCurrentTab,
}))

jest.mock('~features/bible-audio/audioCatalog', () => {
  const { atom } = jest.requireActual('jotai/vanilla')
  return {
    bibleAudioCatalogAtom: atom({ version: 1, recordings: [] }),
    bibleAudioChoiceByVersionAtom: atom({}),
    resolveBibleAudio: () => ({ source: 'recorded', recording: null }),
  }
})

jest.mock('~features/bible-audio/bibleAudioPlayer', () => ({
  listenToPassage: (...args: unknown[]) => mockListenToPassage(...args),
  pause: () => mockPause(),
  play: () => mockPlay(),
  openBibleAudioPlayer: () => mockOpenPlayer(),
}))

jest.mock('../BasicFooter', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('BasicFooter', props)
})

const book = { Numero: 49, Nom: 'Éphésiens', Chapitres: 6 }

const renderFooter = (props: { isInTab: boolean }) => {
  const bibleAtom = atom({ id: 'bible-tab', data: { parallelVersions: [] } } as unknown as BibleTab)
  let renderer: ReturnType<typeof create>
  act(() => {
    renderer = create(
      <BibleFooter
        bibleAtom={bibleAtom}
        book={book}
        chapter={2}
        goToPrevChapter={jest.fn()}
        goToNextChapter={jest.fn()}
        version="LSG"
        isInTab={props.isInTab}
      />
    )
  })
  return renderer!
}

describe('BibleFooter', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsCurrentTab = false
    getDefaultStore().set(bibleAudioStateAtom, {
      passage: null,
      source: 'recorded',
      recordingId: null,
      status: 'idle',
    })
  })

  it('listens to the chapter of a page opened over the app, without a tab to follow it', () => {
    const footer = renderFooter({ isInTab: false }).root.find(
      node => String(node.type) === 'BasicFooter'
    )

    act(() => footer.props.onPlay())

    expect(mockListenToPassage).toHaveBeenCalledWith(
      { version: 'LSG', book, chapter: 2 },
      { tabId: undefined }
    )
  })

  it('hands the tab to the player so that it follows the audio', () => {
    mockIsCurrentTab = true
    const footer = renderFooter({ isInTab: true }).root.find(
      node => String(node.type) === 'BasicFooter'
    )

    act(() => footer.props.onPlay())

    expect(mockListenToPassage).toHaveBeenCalledWith(
      { version: 'LSG', book, chapter: 2 },
      { tabId: 'bible-tab' }
    )
  })

  it('opens the player on the passage heard, without pausing it', () => {
    mockIsCurrentTab = true
    getDefaultStore().set(bibleAudioStateAtom, {
      passage: { version: 'LSG', book, chapter: 2 },
      source: 'recorded',
      recordingId: 'lsg-tresorsonore',
      status: 'playing',
    })
    const footer = renderFooter({ isInTab: true }).root.find(
      node => String(node.type) === 'BasicFooter'
    )

    act(() => footer.props.onPlay())

    expect(mockOpenPlayer).toHaveBeenCalled()
    expect(mockPause).not.toHaveBeenCalled()
    expect(mockPlay).not.toHaveBeenCalled()
    expect(mockListenToPassage).not.toHaveBeenCalled()
  })

  it('plays the passage heard again when it is paused, and opens the player', () => {
    mockIsCurrentTab = true
    getDefaultStore().set(bibleAudioStateAtom, {
      passage: { version: 'LSG', book, chapter: 2 },
      source: 'recorded',
      recordingId: 'lsg-tresorsonore',
      status: 'paused',
    })
    const footer = renderFooter({ isInTab: true }).root.find(
      node => String(node.type) === 'BasicFooter'
    )

    act(() => footer.props.onPlay())

    expect(mockPlay).toHaveBeenCalled()
    expect(mockOpenPlayer).toHaveBeenCalled()
  })

  it('draws nothing in a tab that is not the current one', () => {
    expect(renderFooter({ isInTab: true }).toJSON()).toBeNull()
  })
})
