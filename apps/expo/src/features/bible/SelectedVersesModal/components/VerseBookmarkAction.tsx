import { useTranslation } from 'react-i18next'
import { resolveUniverseColors } from '~themes/universeColors'
import { useTheme } from '~themes/ThemeProvider'
import { personalContentIcons } from '~common/personalContent'
import type { VerseIds } from '~common/types'
import ActionItem from './ActionItem'
export type VerseBookmarkActionProps = {
  selectedVerses: VerseIds
  version: string
  disabled?: boolean
  isActive?: boolean
  onPress: () => void
}
export default function VerseBookmarkAction({
  onPress,
  disabled,
  isActive,
}: VerseBookmarkActionProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <ActionItem
      name={personalContentIcons.bookmarks}
      tintColor={resolveUniverseColors(theme.colors, 'bookmarks').foreground}
      label={t('Marque-page')}
      onPress={onPress}
      disabled={disabled}
      isActive={isActive}
    />
  )
}
