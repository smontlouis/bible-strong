import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
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
  canOpenInNewTab = true,
  onShare,
}: {
  entry: CommentaryCatalogEntry
  projectionId: CommentaryProjectionId
  language: string
  book: number
  chapter: number
  sectionId?: string
  showAvatar?: boolean
  canOpenInNewTab?: boolean
  onShare?: () => void
}) => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const actions: MenuAction[] = [
    ...(onShare
      ? [{ id: 'share', title: t('Partager'), image: 'square.and.arrow.up' as const }]
      : []),
    ...(canOpenInNewTab
      ? [
          {
            id: 'open-tab',
            title: t('tab.openInNewTab'),
            image: 'arrow.up.forward.square' as const,
          },
        ]
      : []),
  ]

  return (
    <Box className="overflow-hidden border-continuous flex-row items-center">
      {showAvatar ? (
        <CommentaryAvatar
          resourceCode={`${entry.publicationId}:${language}`}
          author={entry.author}
          fallback={entry.shortName}
          size={42}
        />
      ) : null}
      <MenuView
        tabActions
        actions={actions}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === 'share') onShare?.()
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
        <Box className="overflow-hidden border-continuous w-[50px] h-[54px] items-center justify-center">
          <FeatherIcon name="more-vertical" size={18} />
        </Box>
      </MenuView>
    </Box>
  )
}

export default CommentaryResourceHeaderActions
