import { useSetAtom } from 'jotai/react'
import { Share } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { createStrongEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import generateUUID from '~helpers/generateUUID'
import { createStrongIdentity } from '~helpers/strongIdentities'
import { unifiedTagsModalAtom } from '~state/app'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

type Props = {
  context: StrongDetailRouteContext
  entry: StrongLexiconEntry
}

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

const StrongEntryMenu = ({ context, entry }: Props) => {
  const { t } = useTranslation()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const openEntityRelations = useOpenEntityRelations()
  const openInNewTab = useOpenInNewTab()
  const { menuTitle, toggleLanguage } = useStrongLexiconLanguage()
  const stepStrongCode = entry.stepCode
  const stepStrongIdentity = createStrongIdentity(stepStrongCode, entry.language)
  const strongEndpoint = createStrongEndpoint({
    language: entry.language,
    code: stepStrongCode,
    labelFallback: entry.gloss,
    originalWord: entry.original,
  })

  const shareEntry = () => {
    const lines = [
      `${stepStrongCode} — ${entry.gloss}`,
      `${entry.original} · ${entry.transliteration}`,
      entry.definitionHtml ? stripHtml(entry.definitionHtml) : '',
      'https://bible-strong.app',
    ].filter(Boolean)
    Share.share({ message: lines.join('\n\n') })
  }

  const openTags = () => {
    setUnifiedTagsModal({
      mode: 'select',
      id: stepStrongCode,
      title: entry.gloss,
      entity: entry.language === 'greek' ? 'strongsGrec' : 'strongsHebreu',
    })
  }

  const openStrongInNewTab = () => {
    openInNewTab({
      id: `strong-${generateUUID()}`,
      title: entry.gloss,
      isRemovable: true,
      type: 'strong',
      data: {
        ...context,
        book: entry.language === 'hebrew' ? 1 : 40,
        reference: stepStrongCode,
        identityKind: stepStrongIdentity.kind,
        identityCode: stepStrongCode,
      },
    })
  }

  return (
    <MenuView
      actions={
        [
          { id: 'language', title: menuTitle, image: 'globe' },
          { id: 'tags', title: t('Étiquettes'), image: 'tag' },
          {
            id: 'relations',
            title: t('Éditer les relations'),
            image: 'arrow.triangle.merge',
          },
          { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
          {
            id: 'open-tab',
            title: t('tab.openInNewTab'),
            image: 'arrow.up.forward.square',
          },
        ] as MenuAction[]
      }
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === 'language') toggleLanguage()
        if (nativeEvent.event === 'tags') openTags()
        if (nativeEvent.event === 'relations') openEntityRelations(strongEndpoint)
        if (nativeEvent.event === 'share') shareEntry()
        if (nativeEvent.event === 'open-tab') openStrongInNewTab()
      }}
    >
      <Box row center height={60} width={60}>
        <FeatherIcon name="more-vertical" size={18} />
      </Box>
    </MenuView>
  )
}

export default StrongEntryMenu
