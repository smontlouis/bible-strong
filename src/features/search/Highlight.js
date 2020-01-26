import React from 'react'
import styled from '@emotion/native'
import { withNavigation } from 'react-navigation'
import compose from 'recompose/compose'
import { connectHighlight } from 'react-instantsearch-native'

import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'

const Container = styled.TouchableOpacity(({ theme }) => ({
  margin: 20,
  paddingBottom: 20,
  marginBottom: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

const Highlight = ({ attribute, hit, highlight, navigation }) => {
  const highlights = highlight({
    highlightProperty: '_highlightResult',
    attribute,
    hit
  })

  const [book, chapter, verse] = hit.ref.split('-')
  const { title } = formatVerseContent([{ Livre: book, Chapitre: chapter, Verset: verse }])
  const onPress = () =>
    navigation.navigate('BibleView', {
      isReadOnly: true,
      book: books[book - 1],
      chapter: Number(chapter),
      verse: Number(verse)
    })
  return (
    <Container onPress={onPress}>
      <Text title fontSize={16} marginBottom={5}>
        {title}
      </Text>
      <Paragraph small>
        {highlights.map(({ value, isHighlighted }, index) => {
          const style = {
            backgroundColor: isHighlighted ? 'yellow' : 'transparent'
          }

          return (
            <Paragraph small key={index} style={style}>
              {value}
            </Paragraph>
          )
        })}
      </Paragraph>
    </Container>
  )
}

export default compose(
  connectHighlight,
  withNavigation
)(Highlight)
