import { PrimitiveAtom } from 'jotai/vanilla'
import React, { useState } from 'react'
import { BibleTab } from 'src/state/tabs'
import Box from '~common/ui/Box'
import { Slide, Slides } from '~common/ui/Slider'
import BibleSelectTabBar from './BibleSelectTabBar'
import BookSelector from './BookSelector'
import ChapterSelector from './ChapterSelector'
import VerseSelector from './VerseSelector'

export interface BibleSelectProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onComplete: () => void
  onLongPressComplete?: (verse: number) => void
}

const BibleSelect = ({ bibleAtom, onComplete, onLongPressComplete }: BibleSelectProps) => {
  const [index, setIndex] = useState(0)
  return (
    <Box flex>
      <BibleSelectTabBar index={index} onChange={setIndex} />
      <Slides index={index}>
        <Slide key="book" flex>
          <BookSelector bibleAtom={bibleAtom} onNavigate={setIndex} />
        </Slide>
        <Slide key="chapter" flex>
          <ChapterSelector bibleAtom={bibleAtom} onNavigate={setIndex} />
        </Slide>
        <Slide key="verse" flex>
          <VerseSelector
            bibleAtom={bibleAtom}
            onComplete={onComplete}
            onLongPressComplete={onLongPressComplete}
          />
        </Slide>
      </Slides>
    </Box>
  )
}

export default BibleSelect
