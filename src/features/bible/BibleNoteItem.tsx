import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import enGB from 'date-fns/locale/en-GB'
import fr from 'date-fns/locale/fr'
import React from 'react'

import * as Icon from '@expo/vector-icons'

import books from '~assets/bible_versions/books-desc'
import Link from '~common/Link'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Paragraph from '~common/ui/Paragraph'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'

const NoteLink = styled(Link)(({ theme }) => ({
  paddingVertical: 20,
  padding: 20,
  paddingRight: 0,
  flexDirection: 'row',
}))

const BibleNoteItem = ({ item, setNoteSettings }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const isFR = useLanguage()

  const [Livre, Chapitre, Verset] = item.noteId.split('/')[0].split('-')
  const formattedDate = distanceInWords(Number(item.notes.date), Date.now(), {
    locale: isFR ? fr : enGB,
  })

  return (
    <Box>
      <NoteLink
        route="BibleView"
        params={{
          isReadOnly: true,
          book: books[Livre - 1],
          chapter: Number(Chapitre),
          verse: Number(Verset),
          focusVerses: [Number(Verset)],
        }}
      >
        <Box flex>
          <Box row justifyContent="space-between">
            <Text color="darkGrey" bold fontSize={11}>
              {item.reference} -{' '}
              {t('Il y a {{formattedDate}}', { formattedDate })}
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
          <Icon.Feather
            name="more-vertical"
            size={20}
            color={theme.colors.tertiary}
          />
        </Link>
      </NoteLink>
      <Border marginHorizontal={20} />
    </Box>
  )
}
export default BibleNoteItem
