import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Link from '~common/Link'
import books from '~assets/bible_versions/books-desc'

import truncate from '~helpers/truncate'
import Paragraph from '~common/ui/Paragraph'
import theme from '~themes/default'

const NoteLink = styled(Link)(({ theme }) => ({
  paddingVertical: 20,
  padding: 20,
  paddingRight: 0,
  flexDirection: 'row'
}))

class BibleNoteItem extends React.Component {
  render() {
    const { item, setNoteSettings } = this.props

    const [Livre, Chapitre, Verset] = item.noteId.split('-')
    const formattedDate = distanceInWords(Number(item.notes.date), Date.now(), { locale: frLocale })

    return (
      <Box>
        <NoteLink
          route="BibleView"
          params={{
            isReadOnly: true,
            book: books[Livre - 1],
            chapter: Number(Chapitre),
            verse: Number(Verset)
          }}>
          <Box flex>
            <Box row justifyContent="space-between">
              <Text color="darkGrey" bold fontSize={11}>
                {item.reference} - Il y a {formattedDate}
              </Text>
            </Box>
            {!!item.notes.title && (
              <Text title fontSize={16} scale={-2}>
                {item.notes.title}
              </Text>
            )}
            {!!item.notes.description && (
              <Paragraph scale={-3} scaleLineHeight={-1}>
                {truncate(item.notes.description, 100)}
              </Paragraph>
            )}
            <TagList tags={item.notes.tags} />
          </Box>
          <Link padding onPress={() => setNoteSettings(item.noteId)}>
            <Icon.Feather name="more-vertical" size={20} color={theme.colors.tertiary} />
          </Link>
        </NoteLink>
        <Border marginHorizontal={20} />
      </Box>
    )
  }
}

export default BibleNoteItem
