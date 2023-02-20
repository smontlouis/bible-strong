import React, { memo, useEffect } from 'react'

import { VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import { getVersions, Version } from '~helpers/bibleVersions'
import AudioTTSFooter from './AudioTTSFooter'
import AudioUrlFooter from './AudioUrlFooter'

type BibleFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  goToChapter: (x: { book: Book; chapter: number }) => void
  disabled?: boolean
  version: VersionCode
}

const BibleFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  disabled,
  version,
}: BibleFooterProps) => {
  const bibleVersion = getVersions()[version] as Version
  const canSwitch = bibleVersion.hasAudio
  const [audioMode, setAudioMode] = React.useState<'url' | 'tts' | undefined>()

  useEffect(() => {
    setAudioMode(canSwitch ? 'url' : 'tts')
  }, [version, canSwitch])

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
