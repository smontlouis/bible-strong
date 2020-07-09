// @flow
import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import * as BibleActions from '~redux/modules/bible'

import SelectorItem from './SelectorItem'
import i18n from '~i18n'

class ChapterSelector extends Component {
  onChapterChange = (chapter: number) => {
    this.props.navigation.navigate('Verset')
    this.props.setTempSelectedChapter(chapter)
  }

  render() {
    const { selectedBook, selectedChapter } = this.props

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
            onChange={this.onChapterChange}
          />
        ))}
      </ScrollView>
    )
  }
}

const EnhancedChapterSelector = compose(
  pure,
  connect(
    state => ({
      selectedBook: state.bible.temp.selectedBook,
      selectedChapter: state.bible.temp.selectedChapter,
    }),
    { ...BibleActions }
  )
)(ChapterSelector)

EnhancedChapterSelector.navigationOptions = () => ({
  tabBarLabel: i18n.t('Chapitres'),
})

export default EnhancedChapterSelector
