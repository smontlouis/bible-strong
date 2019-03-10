import React from 'react'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'

import Loading from '~common/Loading'
import verseToStrong from '~helpers/verseToStrong'

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row'
}))

const Container = styled.TouchableOpacity(({ theme }) => ({
  paddingTop: 10,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border
}))

class ConcordanceVerse extends React.Component {
  state = { formattedTexte: '' }

  componentDidMount () {
    const { verse, concordanceFor } = this.props
    this.formatVerse(verse, concordanceFor)
  }

  formatVerse = async (strongVerse, concordanceFor) => {
    const { formattedTexte } = await verseToStrong(
      strongVerse,
      concordanceFor,
      true
    )
    this.setState({ formattedTexte })
  }

  render () {
    const { verse, navigation } = this.props

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <Container
        onPress={() =>
          navigation.navigate('BibleView', {
            isReadOnly: true,
            book: books[verse.Livre - 1],
            chapter: verse.Chapitre,
            verse: verse.Verset
          })
        }
      >
        <Text title fontSize={16} marginBottom={5}>
          {books[verse.Livre - 1].Nom} {verse.Chapitre}:{verse.Verset}
        </Text>
        <VerseText>{this.state.formattedTexte}</VerseText>
      </Container>
    )
  }
}

export default ConcordanceVerse
