import styled from '@emotion/native'
import React from 'react'
import { connectHighlight } from 'react-instantsearch-native'

// import { useNavigation } from 'react-navigation-hooks'
import { useNavigation } from '@react-navigation/native'
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

const Highlight = ({ attribute, hit, highlight }) => {
  const navigation = useNavigation()
  const highlights = highlight({
    highlightProperty: '_highlightResult',
    attribute,
    hit,
  })

  const [book, chapter, verse] = hit.ref.split('-')
  const { title } = formatVerseContent([
    { Livre: book, Chapitre: chapter, Verset: verse },
  ])
  const onPress = () =>
    navigation.navigate('BibleView', {
      isReadOnly: true,
      book: books[book - 1],
      chapter: Number(chapter),
      verse: Number(verse),
      focusVerses: [Number(verse)],
    })
  return (
    <Container onPress={onPress}>
      <Text title fontSize={16} marginBottom={5}>
        {title}
      </Text>
      <Paragraph small>
        {highlights.map(({ value, isHighlighted }, index) => {
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
