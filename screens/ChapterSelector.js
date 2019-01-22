// @flow
import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { ScrollView, StyleSheet } from 'react-native'
import { connect } from 'react-redux'
import * as BibleActions from '@modules/bible'

import SelectorItem from '@components/SelectorItem'

const styles = StyleSheet.create({
  container: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 20,
    paddingLeft: 10,
    paddingRight: 10
  }
})

class ChapterSelector extends Component {
  static navigationOptions = {
    tabBarLabel: 'Chapitre'
  }

  onChapterChange = (chapter: number) => {
    this.props.navigation.navigate('verset')
    this.props.setTempSelectedChapter(chapter)
  }

  render () {
    const { selectedBook, selectedChapter } = this.props

    const array = Array(...Array(selectedBook.Chapitres)).map((_, i) => i)

    return (
      <ScrollView contentContainerStyle={styles.container}>
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
