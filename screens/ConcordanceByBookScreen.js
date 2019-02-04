import React, { Component } from 'react'
import { FlatList } from 'react-native'

import Container from '@ui/Container'
import Box from '@ui/Box'

import Header from '@components/Header'
import Loading from '@components/Loading'
import ConcordanceVerse from '@components/ConcordanceVerse'

import books from '@versions/books-desc'
import loadFoundVersesByBook from '@helpers/loadFoundVersesByBook'
import truncate from '@helpers/truncate'

class ConcordanceByBook extends Component {
  async componentDidMount () {
    const {
      book,
      strongReference: { Code }
    } = this.props.navigation.state.params

    const verses = await loadFoundVersesByBook(book, Code)
    this.setState({ verses })
  }

  state = { verses: [] }

  render () {
    const {
      book,
      strongReference: { Code, Mot }
    } = this.props.navigation.state.params
    return (
      <Container>
        <Header
          hasBackButton
          title={`${truncate(Mot, 7)} dans ${books[book - 1].Nom}`}
        />
        {!this.state.verses.length && (
          <Box flex>
            <Loading />
          </Box>
        )}
        {!!this.state.verses.length && (
          <FlatList
            style={{ padding: 20 }}
            removeClippedSubviews
            data={this.state.verses}
            keyExtractor={item =>
              `${item.Livre}-${item.Chapitre}-${item.Verset}`
            }
            renderItem={({ item }) => (
              <ConcordanceVerse
                navigation={this.props.navigation}
                concordanceFor={Code}
                verse={item}
              />
            )}
          />
        )}
      </Container>
    )
  }
}

export default ConcordanceByBook
