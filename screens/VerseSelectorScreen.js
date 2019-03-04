import React, { Component } from 'react'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import { pure, compose } from 'recompose'

import loadCountVerses from '@helpers/loadCountVerses'
import * as BibleActions from '@modules/bible'
import SelectorItem from '@components/SelectorItem'

class VerseSelector extends Component {
  static navigationOptions = {
    tabBarLabel: 'Verset'
  }

  state = {
    versesInCurrentChapter: undefined
  }

  async componentDidMount () {
    const { selectedBook, selectedChapter } = this.props
    const { versesInCurrentChapter } = await loadCountVerses(
      selectedBook.Numero,
      selectedChapter
    )
    this.setState({ versesInCurrentChapter })
  }

  async componentDidUpdate (oldProps) {
    if (
      this.props.selectedChapter !== oldProps.selectedChapter ||
      this.props.selectedBook.Numero !== oldProps.selectedBook.Numero
    ) {
      const { selectedBook, selectedChapter } = this.props
      const { versesInCurrentChapter } = await loadCountVerses(
        selectedBook.Numero,
        selectedChapter
      )
      this.setState({ versesInCurrentChapter })
    }
  }

  onValidate = (verse: number) => {
    this.props.setTempSelectedVerse(verse)
    this.props.validateSelected()
    setTimeout(() => this.props.screenProps.mainNavigation.goBack(), 0)
  }

  render () {
    const { versesInCurrentChapter } = this.state
    const { selectedVerse } = this.props

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
          padding: 20,
          paddingLeft: 10,
          paddingRight: 10
        }}
      >
        {array.map(v => (
          <SelectorItem
            key={v}
            item={v + 1}
            isSelected={selectedVerse === v + 1}
            onChange={this.onValidate}
          />
        ))}
      </ScrollView>
    )
  }
}

export default compose(
  pure,
  connect(
    ({ bible: { temp } }) => ({
      selectedBook: temp.selectedBook,
      selectedChapter: temp.selectedChapter,
      selectedVerse: temp.selectedVerse
    }),
    { ...BibleActions }
  )
)(VerseSelector)
