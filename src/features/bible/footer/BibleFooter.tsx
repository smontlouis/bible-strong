import React, { memo } from 'react'

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
  disabled?: boolean
  version: VersionCode
}

const BibleFooter = ({
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  disabled,
  version,
}: BibleFooterProps) => {
  const bibleVersion = getVersions()[version] as Version
  const hasAudio = bibleVersion.hasAudio

  if (hasAudio) {
    return (
      <AudioUrlFooter
        book={book}
        chapter={chapter}
        goToNextChapter={goToNextChapter}
        goToPrevChapter={goToPrevChapter}
        disabled={disabled}
        version={version}
      />
    )
  }

  return (
    <AudioTTSFooter
      book={book}
      chapter={chapter}
      goToNextChapter={goToNextChapter}
      goToPrevChapter={goToPrevChapter}
      disabled={disabled}
      version={version}
    />
  )
}

export default memo(BibleFooter)
