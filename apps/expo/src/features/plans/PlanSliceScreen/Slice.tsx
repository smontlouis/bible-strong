import React from 'react'
import { EntitySlice, Plan } from 'src/common/types'
import ChapterSlice from './ChapterSlice'
import VerseSlice from './VerseSlice'
import VideoSlice from './VideoSlice'
import ImageSlice from './ImageSlice'
import TextSlice from './TextSlice'

type SliceProps = EntitySlice & {
  planLanguage?: Plan['lang']
}

const Slice = ({ planLanguage, ...slice }: SliceProps) => {
  switch (slice.type) {
    case 'Chapter':
      return <ChapterSlice {...slice} />
    case 'Video':
      return <VideoSlice {...slice} planLanguage={planLanguage} />
    case 'Image':
      return <ImageSlice {...slice} />
    case 'Verse':
      return <VerseSlice {...slice} />
    case 'Text':
      return <TextSlice {...slice} planLanguage={planLanguage} />
    default:
      console.log(`[Plans] No component for type ${slice.type}`)
      return null
  }
}

export default Slice
