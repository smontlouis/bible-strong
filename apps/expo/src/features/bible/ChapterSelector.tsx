import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { ScrollView } from 'react-native'

import { BibleTab, useBibleTabActions } from '../../state/tabs'
import SelectorItem from './SelectorItem'
import { getAvailableChapters } from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'

interface ChapterSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onNavigate: (index: number) => void
  coverage?: BibleVersionCoverage
}

const ChapterSelector = ({ bibleAtom, onNavigate, coverage }: ChapterSelectorScreenProps) => {
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const {
    data: {
      temp: { selectedChapter, selectedBook },
    },
  } = bible

  const onChapterChange = (chapter: number) => {
    onNavigate(2)
    actions.setTempSelectedChapter(chapter)
  }

  const chapters = getAvailableChapters(selectedBook, coverage)

  return (
    <ScrollView
      contentContainerStyle={{
        flexWrap: 'wrap',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: 10,
      }}
    >
      {chapters.map(chapter => (
        <SelectorItem
          key={chapter}
          item={chapter}
          isSelected={selectedChapter === chapter}
          onChange={onChapterChange}
        />
      ))}
    </ScrollView>
  )
}

export default ChapterSelector
