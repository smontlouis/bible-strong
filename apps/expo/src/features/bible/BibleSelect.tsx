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
    <Box flex pt={20}>
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
