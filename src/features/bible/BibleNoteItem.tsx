import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import React from 'react'

import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'
import EntityChipList from '~common/EntityChipList'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import { Theme, useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Paragraph from '~common/ui/Paragraph'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import type { TNote } from './BibleVerseNotesScreen'

const NoteLink = styled(Link)(({ theme }: { theme: Theme }) => ({
  paddingVertical: 20,
  padding: 20,
  paddingRight: 0,
  flexDirection: 'row',
}))

type Props = {
  item: TNote
  onPress: (noteId: string) => void
  onMenuPress: (noteId: string) => void
  relationCount?: number
  onRelationPress?: () => void
}

const BibleNoteItem = ({ item, onPress, onMenuPress, relationCount, onRelationPress }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const formattedDate = distanceInWords(Number(item.notes.date), Date.now(), {
    locale: getDateLocale(lang),
  })
  const relativeDate = t('Il y a {{formattedDate}}', { formattedDate })
  const metadataLabel = item.reference ? `${item.reference} - ${relativeDate}` : relativeDate

  return (
    <Box>
      <NoteLink onPress={() => onPress(item.noteId)}>
        <Box flex>
          <Box row justifyContent="space-between">
            <Text color="darkGrey" bold fontSize={11}>
              {metadataLabel}
            </Text>
          </Box>
          {!!item.notes.title && (
            <Text title fontSize={16}>
              {item.notes.title}
            </Text>
          )}
          {!!item.notes.description && (
            <Paragraph scale={-3} scaleLineHeight={-1}>
              {truncate(item.notes.description, 100)}
            </Paragraph>
          )}
          <EntityChipList
            tags={item.notes.tags}
            relationCount={relationCount}
            onRelationPress={onRelationPress}
          />
        </Box>
        <Link padding onPress={() => onMenuPress(item.noteId)}>
          <Icon.Feather name="more-vertical" size={20} color={theme.colors.tertiary} />
        </Link>
      </NoteLink>
      <Border marginHorizontal={20} />
    </Box>
  )
}
export default BibleNoteItem
