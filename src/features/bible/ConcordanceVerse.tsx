import React from 'react'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import books from '~assets/bible_versions/books-desc'

import Loading from '~common/Loading'
import verseToStrong from '~helpers/verseToStrong'
import { TFunction, useTranslation, withTranslation } from 'react-i18next'
import { Router } from 'expo-router'

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
  verse: any
  concordanceFor: any
}

class ConcordanceVerse extends React.Component<Props> {
  state = { formattedTexte: '' }
  t = this.props.t

  componentDidMount() {
    const { verse, concordanceFor } = this.props
    this.formatVerse(verse, concordanceFor)
  }

  formatVerse = async (strongVerse: any, concordanceFor: any) => {
    const { formattedTexte } = await verseToStrong(strongVerse, concordanceFor, true)
    this.setState({ formattedTexte })
  }

  render() {
    const { verse, router } = this.props

    if (!this.state.formattedTexte) {
      return <Loading />
    }

    return (
      <Container
        onPress={() =>
          router.push({
            pathname: '/bible-view',
            params: {
              isReadOnly: 'true',
              book: JSON.stringify(books[verse.Livre - 1]),
              chapter: String(verse.Chapitre),
              verse: String(verse.Verset),
              focusVerses: JSON.stringify([verse.Verset]),
            },
          })
        }
      >
        <Text title fontSize={16} marginBottom={5}>
          {this.t(books[verse.Livre - 1].Nom)} {verse.Chapitre}:{verse.Verset}
        </Text>
        <VerseText>{this.state.formattedTexte}</VerseText>
      </Container>
    )
  }
}

export default ConcordanceVerse
