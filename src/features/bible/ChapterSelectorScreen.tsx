// @flow
import { PrimitiveAtom } from 'jotai'
import React from 'react'
import { ScrollView } from 'react-native'
import { NavigationStackScreenProps } from 'react-navigation-stack'

import i18n from '~i18n'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import SelectorItem from './SelectorItem'

interface ChapterSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
}

const ChapterSelector = ({
  navigation,
  screenProps,
}: NavigationStackScreenProps<{}, ChapterSelectorScreenProps>) => {
  const [bible, actions] = useBibleTabActions(screenProps.bibleAtom)

  const {
    data: { selectedChapter, selectedBook },
  } = bible

  const onChapterChange = (chapter: number) => {
    navigation.navigate('Verset')
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

ChapterSelector.navigationOptions = () => ({
  tabBarLabel: i18n.t('Chapitres'),
})

export default ChapterSelector
