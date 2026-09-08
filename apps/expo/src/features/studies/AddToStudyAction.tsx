import { useTranslation } from 'react-i18next'
import ActionItem from '~features/bible/SelectedVersesModal/components/ActionItem'
export type AddToStudyActionProps = {
  onPress: () => void
  onSelect?: (studyId: string, format: 'inline' | 'block') => Promise<void>
  reference?: string
}
export default function AddToStudyAction({ onPress }: AddToStudyActionProps) {
  const { t } = useTranslation()
  return <ActionItem name="feather" label={t('study.addToStudy')} onPress={onPress} />
}
