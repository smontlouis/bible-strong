import React, { Component } from 'react'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import { pure, compose } from 'recompose'

import getDB from '@helpers/database'
import * as BibleActions from '@modules/bible'
import SelectorItem from '@components/SelectorItem'

class VerseSelector extends Component {
  static navigationOptions = {
    tabBarLabel: 'Verset'
  }

  state = {
    isLoaded: false
  }

  componentWillMount () {
    this.db = getDB()
    this.loadVerses()
  }

  componentDidUpdate (oldProps) {
    if (
      this.props.selectedChapter !== oldProps.selectedChapter ||
      this.props.selectedBook.Numero !== oldProps.selectedBook.Numero
    ) {
      this.loadVerses()
    }
  }

  onValidate = (verse: number) => {
    this.props.setTempSelectedVerse(verse)
    this.props.validateSelected()
    setTimeout(() => this.props.screenProps.mainNavigation.goBack(), 0)
  }

  loadVerses () {
    const { selectedBook, selectedChapter } = this.props
    const part = selectedBook.Numero > 39 ? 'LSGSNT2' : 'LSGSAT2'
    this.verses = []
    this.setState({ isLoaded: false })
    this.db.transaction(
      tx => {
        tx.executeSql(
          `SELECT count(*) as count FROM ${part} WHERE Livre = ${
            selectedBook.Numero
          } AND Chapitre = ${selectedChapter}`,
          [],
          (_, { rows: { _array } }) => {
            this.verses = _array
            this.setState({ isLoaded: true })
          },
          (txObj, error) => console.log(error)
        )
      },
      error => console.log('something went wrong:' + error),
      () => console.log('db transaction is a success')
    )
  }

  render () {
    const { isLoaded } = this.state
    const { selectedVerse } = this.props

    if (!isLoaded) {
      return null
    }

    const array = Array(...Array(this.verses[0].count)).map((_, i) => i)

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
