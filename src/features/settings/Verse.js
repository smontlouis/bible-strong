import React from 'react'
import { TouchableOpacity } from 'react-native'
import distanceInWords from 'date-fns/distance_in_words'
import frLocale from 'date-fns/locale/fr'
import styled from '@emotion/native'
import { withNavigation } from 'react-navigation'

import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import truncate from '~helpers/truncate'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'
import useBibleVerses from '~helpers/useBibleVerses'

const DateText = styled.Text(({ theme }) => ({
  color: theme.colors.tertiary
}))

const Circle = styled(Box)(({ theme, color }) => ({
  width: 15,
  height: 15,
  borderRadius: 3,
  backgroundColor: theme.colors[color],
  marginRight: 5,
  marginTop: 5
}))

const Container = styled(Box)(({ theme }) => ({
  padding: 20,
  marginBottom: 10,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

const VerseComponent = ({ color, date, verseIds, tags, navigation }) => {
  const verses = useBibleVerses(verseIds)

  if (!verses.length) {
    return null
  }

  const { title, content } = formatVerseContent(verses)
  const formattedDate = distanceInWords(Number(date), Date.now(), { locale: frLocale })
  const { Livre, Chapitre, Verset } = verses[0]
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('BibleView', {
          isReadOnly: true,
          book: books[Livre - 1],
          chapter: Chapitre,
          verse: Verset
        })
      }>
      <Container>
        <Box row style={{ marginBottom: 10 }}>
          <Box flex row alignContent="center">
            <Circle color={color} />
            <Text fontSize={14} marginLeft={5} title>
              {title}
            </Text>
          </Box>
          <DateText style={{ fontSize: 10 }}>Il y a {formattedDate}</DateText>
        </Box>
        <Text medium marginBottom={15}>
          {truncate(content, 200)}
        </Text>
        <TagList tags={tags} />
      </Container>
    </TouchableOpacity>
  )
}

export default withNavigation(VerseComponent)
