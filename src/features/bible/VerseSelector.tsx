import React from 'react'
import { ScrollView } from 'react-native'

import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useNavigation } from 'react-navigation-hooks'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import SelectorItem from './SelectorItem'

interface VerseSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onComplete: () => void
}

const VerseSelector = ({ bibleAtom, onComplete }: VerseSelectorScreenProps) => {
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const {
    data: {
      temp: { selectedChapter, selectedBook, selectedVerse },
    },
  } = bible

  const versesInCurrentChapter =
    countLsgChapters[`${selectedBook.Numero}-${selectedChapter}`]

  const onValidate = (verse: number) => {
    actions.setTempSelectedVerse(verse)
    actions.validateTempSelected()
    onComplete()
  }

  if (!versesInCurrentChapter) {
    return null
  }

  const array = Array(...Array(versesInCurrentChapter)).map((_, i) => i)

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
      {array.map(v => (
        <SelectorItem
          key={v}
          item={v + 1}
          isSelected={selectedVerse === v + 1}
          onChange={onValidate}
        />
      ))}
    </ScrollView>
  )
}

export default VerseSelector
