import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import React from 'react'

import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import { Theme, useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import Paragraph from '~common/ui/Paragraph'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'

const NoteLink = styled(Link)(({ theme }: { theme: Theme }) => ({
  paddingVertical: 20,
  padding: 20,
  paddingRight: 0,
  flexDirection: 'row',
}))

type Props = {
  item: any
  onPress: (noteId: string) => void
  onMenuPress: (noteId: string) => void
}

const BibleNoteItem = ({ item, onPress, onMenuPress }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()

  const formattedDate = distanceInWords(Number(item.notes.date), Date.now(), {
    locale: getDateLocale(lang),
  })

  return (
    <Box>
      <NoteLink onPress={() => onPress(item.noteId)}>
        <Box flex>
          <Box row justifyContent="space-between">
            <Text color="darkGrey" bold fontSize={11}>
              {item.reference} - {t('Il y a {{formattedDate}}', { formattedDate })}
            </Text>
          </Box>
          {!!item.notes.title && (
            // @ts-ignore
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
        <Link padding onPress={() => onMenuPress(item.noteId)}>
          <Icon.Feather name="more-vertical" size={20} color={theme.colors.tertiary} />
        </Link>
      </NoteLink>
      <Border marginHorizontal={20} />
    </Box>
  )
}
export default BibleNoteItem
