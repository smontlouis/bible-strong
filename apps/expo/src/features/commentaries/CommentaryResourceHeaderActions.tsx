import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView } from '~common/ui/MenuView'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import type { CommentaryProjectionId } from './commentarySelection'
import CommentaryAvatar from './CommentaryAvatar'

const CommentaryResourceHeaderActions = ({
  entry,
  projectionId,
  language,
  book,
  chapter,
  sectionId,
  showAvatar = true,
}: {
  entry: CommentaryCatalogEntry
  projectionId: CommentaryProjectionId
  language: string
  book: number
  chapter: number
  sectionId?: string
  showAvatar?: boolean
}) => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  return (
    <Box row alignItems="center">
      {showAvatar ? (
        <CommentaryAvatar
          resourceCode={`${entry.publicationId}:${language}`}
          author={entry.author}
          fallback={entry.shortName}
          size={42}
        />
      ) : null}
      <MenuView
        actions={[
          {
            id: 'open-tab',
            title: t('tab.openInNewTab'),
            image: 'arrow.up.forward.square',
          },
        ]}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event !== 'open-tab') return
          openInNewTab({
            id: `commentary-resource-${generateUUID()}`,
            title: entry.shortName,
            isRemovable: true,
            type: 'commentary-resource',
            data: { projectionId, book, chapter, sectionId },
          })
        }}
      >
        <Box width={50} height={54} center>
          <FeatherIcon name="more-vertical" size={18} />
        </Box>
      </MenuView>
    </Box>
  )
}

export default CommentaryResourceHeaderActions
