import React from 'react'

import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import type { Verse } from '~common/types'
import { Book } from '~assets/bible_versions/books-desc'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { getVersions, Version } from '~helpers/bibleVersions'
import { BibleTab, useIsCurrentTab, VersionCode } from '~state/tabs'
import { playingBibleTabIdAtom } from './atom'
import AudioTTSFooter from './AudioTTSFooter'
import AudioUrlFooter from './AudioUrlFooter'
import BackToAudioFooter from './BackToAudioFooter'

type BibleFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  goToChapter: (x: { book: Book; chapter: number }) => void
  disabled?: boolean
  version: VersionCode
  bibleAtom: PrimitiveAtom<BibleTab>
  chapterVerses?: Verse[]
  coverage?: BibleVersionCoverage
  isInTab?: boolean
}

const BibleFooter = ({
  bibleAtom,
  chapterVerses,
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  disabled,
  version,
  coverage,
  isInTab = true,
}: BibleFooterProps) => {
  const bibleTab = useAtomValue(bibleAtom)
  const bibleVersion = getVersions()[version] as Version
  const canSwitch = bibleVersion?.hasAudio
  const [audioPreference, setAudioPreference] = React.useState<{
    version: VersionCode
    mode: 'url' | 'tts'
  }>()
  const audioMode =
    audioPreference?.version === version ? audioPreference.mode : canSwitch ? 'url' : 'tts'
  const setAudioMode = (mode: 'url' | 'tts') => setAudioPreference({ version, mode })
  const playingBibleTabId = useAtomValue(playingBibleTabIdAtom)
  // Use stable tab.id instead of atom.toString()
  const isTabPlaying = playingBibleTabId === bibleTab.id
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(bibleAtom)

  if (isInTab && !isCurrentTab && !isTabPlaying) {
    return null
  }

  if (playingBibleTabId && !isTabPlaying) {
    return (
      <BackToAudioFooter
        book={book}
        chapter={chapter}
        goToNextChapter={goToNextChapter}
        goToPrevChapter={goToPrevChapter}
        disabled={disabled}
        coverage={coverage}
        version={version}
      />
    )
  }

  if (audioMode === 'url') {
    return (
      <AudioUrlFooter
        book={book}
        chapter={chapter}
        goToNextChapter={goToNextChapter}
        goToPrevChapter={goToPrevChapter}
        goToChapter={goToChapter}
        disabled={disabled}
        version={version}
        coverage={coverage}
        onChangeMode={canSwitch ? setAudioMode : undefined}
        bibleAtom={bibleAtom}
      />
    )
  }

  if (audioMode === 'tts') {
    return (
      <AudioTTSFooter
        book={book}
        chapter={chapter}
        chapterVerses={chapterVerses}
        goToNextChapter={goToNextChapter}
        goToPrevChapter={goToPrevChapter}
        disabled={disabled}
        version={version}
        coverage={coverage}
        onChangeMode={canSwitch ? setAudioMode : undefined}
        bibleAtom={bibleAtom}
      />
    )
  }

  return null
}

export default BibleFooter
