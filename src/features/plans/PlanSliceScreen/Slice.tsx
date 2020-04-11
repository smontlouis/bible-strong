import React from 'react'
import { EntitySlice } from 'src/common/types'
import ChapterSlice from './ChapterSlice'
import VerseSlice from './VerseSlice'
import VideoSlice from './VideoSlice'
import ImageSlice from './ImageSlice'

const Slice = (slice: EntitySlice) => {
  switch (slice.type) {
    case 'Chapter':
      return <ChapterSlice {...slice} />
    case 'Video':
      return <VideoSlice {...slice} />
    case 'Image':
      return <ImageSlice {...slice} />
    case 'Verse':
      return <VerseSlice {...slice} />
    case 'Text':
    default:
      console.log(`No component for type ${slice.type}`)
      return null
  }
}

export default Slice
