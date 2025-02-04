import React, { memo, useEffect } from 'react'

import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { Book } from '~assets/bible_versions/books-desc'
import { getVersions, Version } from '~helpers/bibleVersions'
import { BibleTab, useIsCurrentTab, VersionCode } from '../../../state/tabs'
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
}

const BibleFooter = ({
  bibleAtom,
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  disabled,
  version,
}: BibleFooterProps) => {
  const bibleVersion = getVersions()[version] as Version
  const canSwitch = bibleVersion?.hasAudio
  const [audioMode, setAudioMode] = React.useState<'url' | 'tts' | undefined>()
  const playingBibleTabId = useAtomValue(playingBibleTabIdAtom)
  const isTabPlaying = playingBibleTabId === bibleAtom.toString()
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(bibleAtom)

  useEffect(() => {
    setAudioMode(canSwitch ? 'url' : 'tts')
  }, [version, canSwitch])

  if (!isCurrentTab && !isTabPlaying) {
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
        goToNextChapter={goToNextChapter}
        goToPrevChapter={goToPrevChapter}
        disabled={disabled}
        version={version}
        onChangeMode={canSwitch ? setAudioMode : undefined}
      />
    )
  }

  return null
}

export default memo(BibleFooter)
