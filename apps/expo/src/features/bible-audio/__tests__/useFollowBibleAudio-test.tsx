import React from 'react'
import { act, create } from 'react-test-renderer'
import { getDefaultStore } from 'jotai/vanilla'

import type { Book } from '~assets/bible_versions/books-desc'
import type { BiblePlanPassage } from '~state/tabs'
import { bibleAudioFollowingTabIdAtom, bibleAudioStateAtom } from '../atoms'
import { useFollowBibleAudio } from '../useFollowBibleAudio'

jest.mock('~helpers/atomWithAsyncStorage', () => {
  const { atom: createAtom } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  return (_key: string, initialValue: unknown) => createAtom(initialValue)
})

const genesis: Book = { Numero: 1, Nom: 'Genèse', Chapitres: 50 }
const exodus: Book = { Numero: 2, Nom: 'Exode', Chapitres: 40 }
const store = getDefaultStore()

type ReaderProps = {
  book: Book
  chapter: number
  version?: string
  planPassage?: BiblePlanPassage
  goToChapter: (target: { book: Book; chapter: number }) => void
}

const Reader = ({ book, chapter, version = 'LSG', planPassage, goToChapter }: ReaderProps) => {
  useFollowBibleAudio({
    tabId: 'tab-1',
    enabled: true,
    version,
    book,
    chapter,
    planPassage,
    goToChapter,
  })
  return null
}

const setAudioPassage = (book: Book, chapter: number, version = 'LSG') =>
  act(() => {
    store.set(bibleAudioStateAtom, {
      passage: { version, book, chapter },
      source: 'recorded',
      recordingId: 'lsg-topchretien',
      status: 'playing',
    })
  })

describe('useFollowBibleAudio', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    store.set(bibleAudioStateAtom, {
      passage: null,
      source: 'recorded',
      recordingId: null,
      status: 'idle',
    })
    store.set(bibleAudioFollowingTabIdAtom, 'tab-1')
  })

  it('turns the page of the following tab when the audio moves on', () => {
    const goToChapter = jest.fn()
    setAudioPassage(genesis, 3)
    act(() => {
      create(<Reader book={genesis} chapter={3} goToChapter={goToChapter} />)
    })

    setAudioPassage(genesis, 4)

    expect(goToChapter).toHaveBeenCalledWith({ book: genesis, chapter: 4 })
    expect(store.get(bibleAudioFollowingTabIdAtom)).toBe('tab-1')
  })

  it('lets go when the reader goes elsewhere, and the audio plays on', () => {
    const goToChapter = jest.fn()
    setAudioPassage(genesis, 3)
    let renderer: ReturnType<typeof create>
    act(() => {
      renderer = create(<Reader book={genesis} chapter={3} goToChapter={goToChapter} />)
    })

    act(() => {
      renderer.update(<Reader book={exodus} chapter={1} goToChapter={goToChapter} />)
    })

    expect(store.get(bibleAudioFollowingTabIdAtom)).toBe('')
    setAudioPassage(genesis, 4)
    expect(goToChapter).not.toHaveBeenCalled()
  })

  it('stays with the audio when its own page turn brings it along', () => {
    const goToChapter = jest.fn()
    setAudioPassage(genesis, 3)
    let renderer: ReturnType<typeof create>
    act(() => {
      renderer = create(<Reader book={genesis} chapter={3} goToChapter={goToChapter} />)
    })

    setAudioPassage(genesis, 4)
    act(() => {
      renderer.update(<Reader book={genesis} chapter={4} goToChapter={goToChapter} />)
    })

    expect(store.get(bibleAudioFollowingTabIdAtom)).toBe('tab-1')
  })

  it('lets go when the audio leaves the plan passage the tab reads', () => {
    const goToChapter = jest.fn()
    const planPassage = { book: 1, startChapter: 3, endChapter: 3 }
    setAudioPassage(genesis, 3)
    act(() => {
      create(
        <Reader book={genesis} chapter={3} planPassage={planPassage} goToChapter={goToChapter} />
      )
    })

    setAudioPassage(genesis, 4)

    expect(goToChapter).not.toHaveBeenCalled()
    expect(store.get(bibleAudioFollowingTabIdAtom)).toBe('')
  })

  it('lets go when the audio changes version', () => {
    const goToChapter = jest.fn()
    setAudioPassage(genesis, 3)
    act(() => {
      create(<Reader book={genesis} chapter={3} goToChapter={goToChapter} />)
    })

    setAudioPassage(genesis, 3, 'KJV')

    expect(store.get(bibleAudioFollowingTabIdAtom)).toBe('')
  })
})
