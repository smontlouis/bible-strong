import { useTranslation } from 'react-i18next'
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
  return (
    <ActionItem
      name="bookmark"
      label={t('Marque-page')}
      onPress={onPress}
      disabled={disabled}
      isActive={isActive}
    />
  )
}
