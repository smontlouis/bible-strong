import { useTranslation } from 'react-i18next'
import type { VerseIds } from '~common/types'
import ActionItem from './ActionItem'
export type VerseTagsActionProps = {
  selectedVerses: VerseIds
  reference?: string
  onPress: () => void
}
export default function VerseTagsAction({ onPress }: VerseTagsActionProps) {
  const { t } = useTranslation()
  return <ActionItem name="tag" label={t('Tag')} onPress={onPress} />
}
