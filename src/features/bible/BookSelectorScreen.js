import React, { Component } from 'react'
import { ScrollView } from 'react-native'
import { connect } from 'react-redux'
import { pure, compose } from 'recompose'

import * as BibleActions from '~redux/modules/bible'
import books from '~assets/bible_versions/books-desc'

import BookSelectorItem from './BookSelectorItem'

class BookSelector extends Component {
  static navigationOptions = {
    tabBarLabel: 'LIVRE',
  }

  onBookChange = book => {
    this.props.navigation.navigate('Chapitre')
    this.props.setTempSelectedBook(book)
  }

  render() {
    const { selectedBook } = this.props

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
        {Object.values(books).map(book => (
          <BookSelectorItem
            isNT={book.Numero >= 40}
            key={book.Numero}
            onChange={this.onBookChange}
            book={book}
            isSelected={book.Numero === selectedBook.Numero}
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
    }),
    BibleActions
  )
)(BookSelector)
