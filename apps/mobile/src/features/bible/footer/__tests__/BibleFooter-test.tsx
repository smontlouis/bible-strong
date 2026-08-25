import React from 'react'
import { act, create } from 'react-test-renderer'
import { atom } from 'jotai/vanilla'

import type { BibleTab } from '~state/tabs'
import BibleFooter from '../BibleFooter'

jest.mock('~helpers/bibleVersions', () => ({
  getVersions: () => ({ LSG: { hasAudio: false } }),
}))

jest.mock('~state/tabs', () => ({
  useIsCurrentTab: () => () => false,
}))

jest.mock('../atom', () => {
  const { atom: createAtom } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  return { playingBibleTabIdAtom: createAtom(undefined) }
})

jest.mock('../AudioTTSFooter', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('AudioTTSFooter', props)
})

jest.mock('../AudioUrlFooter', () => () => null)
jest.mock('../BackToAudioFooter', () => () => null)

describe('BibleFooter', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('renders on a standalone full-chapter screen outside the primary Bible tab', () => {
    const bibleAtom = atom({ id: 'standalone-bible', data: {} } as BibleTab)
    const chapterVerses = [
      { Livre: 49, Chapitre: 2, Verset: 1, Texte: 'Vous étiez morts.' },
    ] as never
    let renderer: ReturnType<typeof create>

    act(() => {
      renderer = create(
        <BibleFooter
          bibleAtom={bibleAtom}
          book={{ Numero: 49, Nom: 'Éphésiens', Chapitres: 6 }}
          chapter={2}
          chapterVerses={chapterVerses}
          goToPrevChapter={jest.fn()}
          goToNextChapter={jest.fn()}
          goToChapter={jest.fn()}
          version="LSG"
          isInTab={false}
        />
      )
    })

    expect(
      renderer!.root.find(node => String(node.type) === 'AudioTTSFooter').props.chapterVerses
    ).toBe(chapterVerses)
  })
})
