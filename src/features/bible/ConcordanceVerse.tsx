import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import CanonicalStrongVerseText from './CanonicalStrongVerseText'

import type { TFunction } from 'react-i18next'
import type { Verse } from '~common/types'

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
  onReady?: (verse: Verse) => void
  hiddenUntilReady?: boolean
  t: TFunction<'translation', undefined>
  verse: Verse
  concordanceFor: string
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
    const { verse, concordanceFor } = this.props
    if (
      previousProps.verse.Texte !== verse.Texte ||
      previousProps.verse.Livre !== verse.Livre ||
      previousProps.verse.Chapitre !== verse.Chapitre ||
      previousProps.verse.Verset !== verse.Verset ||
      previousProps.concordanceFor !== concordanceFor
    ) {
      this.setState({ formattedTexte: '' })
      this.formatVerse()
    }
  }

  componentWillUnmount() {
    this.formatRequest += 1
  }

  formatVerse = () => {
    const request = ++this.formatRequest
    const { verse: strongVerse, concordanceFor } = this.props
    const formattedTexte = (
      <CanonicalStrongVerseText
        verse={{ ...strongVerse, Livre: Number(strongVerse.Livre) }}
        concordanceFor={concordanceFor}
        small
      />
    )
    if (request !== this.formatRequest) return
    this.setState({ formattedTexte }, () => this.props.onReady?.(this.props.verse))
  }

  render() {
    const { verse, onOpenVerse, hiddenUntilReady } = this.props
    const bookNumber = Number(verse.Livre)
    const chapterNumber = Number(verse.Chapitre)
    const verseNumber = Number(verse.Verset)
    const book = getBook(bookNumber)
    const bookName = this.props.t(
      book?.Nom || 'Livre {{bookNumber}}',
      book ? undefined : { bookNumber }
    )

    if (!this.state.formattedTexte) {
      if (hiddenUntilReady) return null
      return (
        <Container disabled>
          <Text title fontSize={16} marginBottom={8}>
            {bookName} {chapterNumber}:{verseNumber}
          </Text>
          <Box height={14} width="72%" borderRadius={7} bg="lightGrey" />
        </Container>
      )
    }

    if (hiddenUntilReady) return null

    return (
      <Container onPress={() => onOpenVerse(verse)}>
        <Text title fontSize={16} marginBottom={5}>
          {bookName} {chapterNumber}:{verseNumber}
        </Text>
        <VerseText>{this.state.formattedTexte}</VerseText>
      </Container>
    )
  }
}

export default ConcordanceVerse
