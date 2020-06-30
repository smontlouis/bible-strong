import React from 'react'
import { TouchableOpacity } from 'react-native'
import distanceInWords from 'date-fns/formatDistance'
import { fr, enGB } from 'date-fns/locale'
import styled from '@emotion/native'
import { withNavigation } from 'react-navigation'
import { useSelector } from 'react-redux'

import TagList from '~common/TagList'
import { FeatherIcon } from '~common/ui/Icon'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import truncate from '~helpers/truncate'
import formatVerseContent from '~helpers/formatVerseContent'
import books from '~assets/bible_versions/books-desc'
import useBibleVerses from '~helpers/useBibleVerses'
import { removeBreakLines } from '~helpers/utils'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

const DateText = styled.Text(({ theme }) => ({
  color: theme.colors.tertiary,
}))

const Circle = styled(Box)(({ colors, color }) => ({
  width: 15,
  height: 15,
  borderRadius: 3,
  backgroundColor: colors[color],
  marginRight: 5,
}))

const Container = styled(Box)(({ theme }) => ({
  margin: 20,
  paddingBottom: 20,
  marginBottom: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
}))

const VerseComponent = ({
  color,
  date,
  verseIds,
  stringIds,
  tags,
  navigation,
  setSettings,
}) => {
  const verses = useBibleVerses(verseIds)
  const { t } = useTranslation()
  const isFR = useLanguage()
  const { colors } = useSelector(state => ({
    colors: state.user.bible.settings.colors[state.user.bible.settings.theme],
  }))

  if (!verses.length) {
    return null
  }

  const { title, content } = formatVerseContent(verses)
  const formattedDate = distanceInWords(Number(date), Date.now(), {
    locale: isFR ? fr : enGB,
  })
  const { Livre, Chapitre, Verset } = verses[0]
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('BibleView', {
          isReadOnly: true,
          book: books[Livre - 1],
          chapter: Chapitre,
          verse: Verset,
        })
      }
    >
      <Container>
        <Box row style={{ marginBottom: 10 }} alignItems="center">
          <Box flex row alignItems="center">
            <Circle colors={colors} color={color} />
            <Text fontSize={14} marginLeft={5} title>
              {title}
            </Text>
          </Box>
          <DateText style={{ fontSize: 10 }}>
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </DateText>
          {setSettings && (
            <LinkBox
              p={4}
              ml={10}
              onPress={() =>
                setSettings({
                  stringIds,
                  verseIds,
                  color,
                  date,
                  tags,
                })
              }
            >
              <FeatherIcon name="more-vertical" size={20} />
            </LinkBox>
          )}
        </Box>
        <Paragraph scale={-2} medium marginBottom={15}>
          {truncate(removeBreakLines(content), 200)}
        </Paragraph>
        <TagList tags={tags} />
      </Container>
    </TouchableOpacity>
  )
}

export default withNavigation(VerseComponent)
