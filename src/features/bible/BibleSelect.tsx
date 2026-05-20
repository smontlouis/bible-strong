import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import React, { useState } from 'react'
import { BibleTab } from 'src/state/tabs'
import Box from '~common/ui/Box'
import { Slide, Slides } from '~common/ui/Slider'
import { getBibleVersionCoverage } from '~helpers/biblesDb'
import { useQuery } from '~helpers/react-query-lite'
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
  const bible = useAtomValue(bibleAtom)
  const version = bible.data.selectedVersion
  const { data: coverageData } = useQuery({
    queryKey: ['bible-version-coverage', version],
    queryFn: () => getBibleVersionCoverage(version),
    enabled: !!version,
  })

  return (
    <Box flex>
      <BibleSelectTabBar index={index} onChange={setIndex} />
      <Slides index={index}>
        <Slide key="book" flex>
          <BookSelector bibleAtom={bibleAtom} onNavigate={setIndex} coverage={coverageData} />
        </Slide>
        <Slide key="chapter" flex>
          <ChapterSelector bibleAtom={bibleAtom} onNavigate={setIndex} coverage={coverageData} />
        </Slide>
        <Slide key="verse" flex>
          <VerseSelector
            bibleAtom={bibleAtom}
            onComplete={onComplete}
            onLongPressComplete={onLongPressComplete}
            coverage={coverageData}
          />
        </Slide>
      </Slides>
    </Box>
  )
}

export default BibleSelect
