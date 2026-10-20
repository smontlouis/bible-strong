import { useTranslation } from 'react-i18next'
import { resolveUniverseColors } from '~themes/universeColors'
import { useTheme } from '~themes/ThemeProvider'
import { personalContentIcons } from '~common/personalContent'
import type { VerseIds } from '~common/types'
import ActionItem from './ActionItem'
export type VerseTagsActionProps = {
  selectedVerses: VerseIds
  reference?: string
  onPress: () => void
}
export default function VerseTagsAction({ onPress }: VerseTagsActionProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <ActionItem
      name={personalContentIcons.tags}
      tintColor={resolveUniverseColors(theme.colors, 'tags').foreground}
      label={t('Tag')}
      onPress={onPress}
    />
  )
}
