import React from 'react'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'

import Loading from '~common/Loading'
import verseToStrong from '~helpers/verseToStrong'
import type { TFunction } from 'react-i18next'
import type { Verse } from '~common/types'
import type { StrongLexiconEntry } from '~helpers/strongVerseParser'

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row',
}))

const Container = styled.TouchableOpacity(({ theme }) => ({
  paddingTop: 10,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

type Props = {
  onOpenVerse: (verse: Verse) => void
  t: TFunction<'translation', undefined>
  verse: Verse
  concordanceFor: string
  lexiconEntry: StrongLexiconEntry
}

type ConcordanceVerseState = {
  formattedTexte: React.ReactNode
}

class ConcordanceVerse extends React.Component<Props, ConcordanceVerseState> {
  state: ConcordanceVerseState = { formattedTexte: '' }
  formatRequest = 0

  componentDidMount() {
    this.formatVerse()
  }

  componentDidUpdate(previousProps: Props) {
    const { verse, concordanceFor, lexiconEntry } = this.props
    if (
      previousProps.verse.Texte !== verse.Texte ||
      previousProps.verse.Livre !== verse.Livre ||
      previousProps.verse.Chapitre !== verse.Chapitre ||
      previousProps.verse.Verset !== verse.Verset ||
      previousProps.concordanceFor !== concordanceFor ||
      previousProps.lexiconEntry.Code !== lexiconEntry.Code ||
      previousProps.lexiconEntry.LSG !== lexiconEntry.LSG
    ) {
      this.setState({ formattedTexte: '' })
      this.formatVerse()
    }
  }

  componentWillUnmount() {
    this.formatRequest += 1
  }

  formatVerse = async () => {
    const request = ++this.formatRequest
    const { verse: strongVerse, concordanceFor, lexiconEntry } = this.props
    const { formattedTexte } = await verseToStrong(
      { ...strongVerse, Livre: Number(strongVerse.Livre) },
      concordanceFor,
      true,
      [lexiconEntry]
    )
    if (request !== this.formatRequest) return
    this.setState({ formattedTexte })
  }

  render() {
    const { verse, onOpenVerse } = this.props
    const bookNumber = Number(verse.Livre)
    const chapterNumber = Number(verse.Chapitre)
    const verseNumber = Number(verse.Verset)

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <Container onPress={() => onOpenVerse(verse)}>
        <Text title fontSize={16} marginBottom={5}>
          {this.props.t(
            getBook(bookNumber)?.Nom || 'Livre {{bookNumber}}',
            getBook(bookNumber) ? undefined : { bookNumber }
          )}{' '}
          {chapterNumber}:{verseNumber}
        </Text>
        <VerseText>{this.state.formattedTexte}</VerseText>
      </Container>
    )
  }
}

export default ConcordanceVerse
