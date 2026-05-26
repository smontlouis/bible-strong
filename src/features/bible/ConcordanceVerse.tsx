import React from 'react'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'

import Loading from '~common/Loading'
import verseToStrong from '~helpers/verseToStrong'
import type { TFunction } from 'react-i18next'
import { Router } from 'expo-router'
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
  router: Router
  t: TFunction<'translation', undefined>
  verse: Verse
  concordanceFor: string
}

type ConcordanceVerseState = {
  formattedTexte: React.ReactNode
}

class ConcordanceVerse extends React.Component<Props, ConcordanceVerseState> {
  state: ConcordanceVerseState = { formattedTexte: '' }
  t = this.props.t

  componentDidMount() {
    const { verse, concordanceFor } = this.props
    this.formatVerse(verse, concordanceFor)
  }

  formatVerse = async (strongVerse: Verse, concordanceFor: string) => {
    const { formattedTexte } = await verseToStrong(
      { ...strongVerse, Livre: Number(strongVerse.Livre) },
      concordanceFor,
      true
    )
    this.setState({ formattedTexte })
  }

  render() {
    const { verse, router } = this.props
    const bookNumber = Number(verse.Livre)
    const chapterNumber = Number(verse.Chapitre)
    const verseNumber = Number(verse.Verset)

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <Container
        onPress={() =>
          router.push({
            pathname: '/bible-view',
            params: {
              contextDisplayMode: 'focused',
              book: JSON.stringify(books[bookNumber - 1]),
              chapter: String(chapterNumber),
              verse: String(verseNumber),
              focusVerses: JSON.stringify([verseNumber]),
            },
          })
        }
      >
        <Text title fontSize={16} marginBottom={5}>
          {this.t(books[bookNumber - 1].Nom)} {chapterNumber}:{verseNumber}
        </Text>
        <VerseText>{this.state.formattedTexte}</VerseText>
      </Container>
    )
  }
}

export default ConcordanceVerse
