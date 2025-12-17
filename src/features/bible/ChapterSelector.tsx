import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { ScrollView } from 'react-native'

import i18n from '~i18n'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import SelectorItem from './SelectorItem'

interface ChapterSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onNavigate: (index: number) => void
}

const ChapterSelector = ({ bibleAtom, onNavigate }: ChapterSelectorScreenProps) => {
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

  const array = Array(...Array(selectedBook.Chapitres)).map((_, i) => i)

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
      {array.map(c => (
        <SelectorItem
          key={c}
          item={c + 1}
          isSelected={selectedChapter === c + 1}
          onChange={onChapterChange}
        />
      ))}
    </ScrollView>
  )
}

export default ChapterSelector
