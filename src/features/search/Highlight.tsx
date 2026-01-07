import styled from '@emotion/native'
import React from 'react'
import { connectHighlight } from 'react-instantsearch-native'

import { useRouter } from 'expo-router'
import books from '~assets/bible_versions/books-desc'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'

const Container = styled.TouchableOpacity(({ theme }) => ({
  margin: 20,
  paddingBottom: 20,
  marginBottom: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
}))

const StyledParagraph = styled(Paragraph)(({ theme, isLight }) => ({
  backgroundColor: isLight ? theme.colors.lightPrimary : 'transparent',
}))

const Highlight = ({ attribute, hit, highlight }: any) => {
  const router = useRouter()
  const highlights = highlight({
    highlightProperty: '_highlightResult',
    attribute,
    hit,
  })

  const [book, chapter, verse] = hit.ref.split('-')
  const { title } = formatVerseContent([{ Livre: book, Chapitre: chapter, Verset: verse }])
  const onPress = () =>
    router.push({
      pathname: '/bible-view',
      params: {
        isReadOnly: 'true',
        book: JSON.stringify(books[book - 1]),
        chapter: String(chapter),
        verse: String(verse),
        focusVerses: JSON.stringify([Number(verse)]),
      },
    })
  return (
    <Container onPress={onPress}>
      <Text title fontSize={16} marginBottom={5}>
        {title}
      </Text>
      <Paragraph small>
        {highlights.map(({ value, isHighlighted }: any, index: any) => {
          return (
            <StyledParagraph isLight={isHighlighted} small key={index}>
              {value}
            </StyledParagraph>
          )
        })}
      </Paragraph>
    </Container>
  )
}

export default connectHighlight(Highlight)
