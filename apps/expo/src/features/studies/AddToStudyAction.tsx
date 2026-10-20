import { useTranslation } from 'react-i18next'
import { resolveUniverseColors } from '~themes/universeColors'
import { useTheme } from '~themes/ThemeProvider'
import { personalContentIcons } from '~common/personalContent'
import ActionItem from '~features/bible/SelectedVersesModal/components/ActionItem'
export type AddToStudyActionProps = {
  onPress: () => void
  onSelect?: (studyId: string, format: 'inline' | 'block') => Promise<void>
  reference?: string
}
export default function AddToStudyAction({ onPress }: AddToStudyActionProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <ActionItem
      name={personalContentIcons.study}
      tintColor={resolveUniverseColors(theme.colors, 'study').foreground}
      label={t('study.addToStudy')}
      onPress={onPress}
    />
  )
}
