import React from 'react'
import { ScrollView } from 'react-native'

import { PrimitiveAtom } from 'jotai/vanilla'
import {
  NavigationStackProp,
  NavigationStackScreenProps,
} from 'react-navigation-stack'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import i18n from '~i18n'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import SelectorItem from './SelectorItem'
import { useAtomValue } from 'jotai/react'

interface VerseSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  mainNavigation: NavigationStackProp
}

const VerseSelector = ({
  navigation,
  screenProps,
}: NavigationStackScreenProps<{}, VerseSelectorScreenProps>) => {
  const bible = useAtomValue(screenProps.bibleAtom)
  const actions = useBibleTabActions(screenProps.bibleAtom)
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
    setTimeout(() => screenProps.mainNavigation.goBack(), 0)
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

VerseSelector.navigationOptions = () => ({
  tabBarLabel: i18n.t('Versets'),
})

export default VerseSelector
