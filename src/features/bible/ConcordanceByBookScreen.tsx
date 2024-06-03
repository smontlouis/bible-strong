import React, { Component } from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import Header from '~common/Header'
import Loading from '~common/Loading'
import waitForStrongDB from '~common/waitForStrongDB'
import ConcordanceVerse from './ConcordanceVerse'

import books from '~assets/bible_versions/books-desc'
import loadFoundVersesByBook from '~helpers/loadFoundVersesByBook'
import truncate from '~helpers/truncate'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'
import { useTranslation } from 'react-i18next'

class ConcordanceByBook extends Component {
  navigation = useNavigation<StackNavigationProp<MainStackProps>>()
  route = useRoute<RouteProp<MainStackProps, 'ConcordanceByBook'>>()

  async componentDidMount() {
    const {
      book,
      strongReference: { Code },
    } = this.route.params // this.props.navigation.state.params

    const verses = await loadFoundVersesByBook(book, Code)
    this.setState({ verses })
  }

  state = { verses: [] }

  render() {
    const {
      book,
      strongReference: { Code, Mot },
    } = this.route.params // this.props.navigation.state.params
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
          <Box flex>
            <FlatList
              contentContainerStyle={{ padding: 20 }}
              removeClippedSubviews
              data={this.state.verses}
              keyExtractor={item =>
                `${item.Livre}-${item.Chapitre}-${item.Verset}`
              }
              renderItem={({ item }) => (
                <ConcordanceVerse
                  navigation={this.navigation}
                  concordanceFor={Code}
                  verse={item}
                />
              )}
            />
          </Box>
        )}
      </Container>
    )
  }
}

export default waitForStrongDB({
  hasBackButton: true,
  hasHeader: true,
})(ConcordanceByBook)
