// @flow
import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import * as BibleActions from '@modules/bible'

import SelectorItem from '@components/SelectorItem'

class ChapterSelector extends Component {
  static navigationOptions = {
    tabBarLabel: 'CHAPITRE'
  }

  onChapterChange = (chapter: number) => {
    this.props.navigation.navigate('Verset')
    this.props.setTempSelectedChapter(chapter)
  }

  render () {
    const { selectedBook, selectedChapter } = this.props

    const array = Array(...Array(selectedBook.Chapitres)).map((_, i) => i)

    return (
      <ScrollView
        contentContainerStyle={{
          flexWrap: 'wrap',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          paddingTop: 10
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

export default compose(
  pure,
  connect(
    state => ({
      selectedBook: state.bible.temp.selectedBook,
      selectedChapter: state.bible.temp.selectedChapter
    }),
    { ...BibleActions }
  )
)(ChapterSelector)
