import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import React, { useState } from 'react'
import { BibleTab } from 'src/state/tabs'
import Box from '~common/ui/Box'
import { Slide, Slides } from '~common/ui/Slider'
import { useQuery } from '@tanstack/react-query'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
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
  const resources = useResourceAccess()
  const version = bible.data.selectedVersion
  const { data: coverageData } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(version),
    queryFn: () => resources.bibleContent.loadCoverage(version),
    enabled: !!version,
    ...staticResourceQueryOptions,
  })

  return (
    <Box className="overflow-hidden border-continuous flex-[1] pt-[20px]">
      <BibleSelectTabBar index={index} onChange={setIndex} />
      <Slides index={index}>
        <Slide className="flex-[1]" key="book">
          <BookSelector bibleAtom={bibleAtom} onNavigate={setIndex} coverage={coverageData} />
        </Slide>
        <Slide className="flex-[1]" key="chapter">
          <ChapterSelector bibleAtom={bibleAtom} onNavigate={setIndex} coverage={coverageData} />
        </Slide>
        <Slide className="flex-[1]" key="verse">
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
