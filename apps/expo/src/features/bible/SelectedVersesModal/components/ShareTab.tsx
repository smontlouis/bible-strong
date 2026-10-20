import { useTranslation } from 'react-i18next'
import ActionsLayout from './ActionsLayout'
import ActionItem from './ActionItem'
import { COPY_SHORTCUT } from '../selectionShortcuts'

interface ShareTabProps {
  screenWidth: number
  copyToClipboard: () => void
  shareVerse: () => void
  exportPassage: () => void
  selectAllVerses: () => void
}

const ShareTab = ({
  screenWidth,
  copyToClipboard,
  shareVerse,
  exportPassage,
  selectAllVerses,
}: ShareTabProps) => {
  const { t } = useTranslation()

  return (
    <ActionsLayout width={screenWidth}>
      <ActionItem
        name="copy"
        label={t('Copier')}
        onPress={copyToClipboard}
        shortcut={COPY_SHORTCUT}
      />
      <ActionItem name="share-2" label={t('Partager')} onPress={shareVerse} />
      <ActionItem name="download" label={t('app.export')} onPress={exportPassage} />
      <ActionItem name="check-square" label={t('Tout sélect.')} onPress={selectAllVerses} />
    </ActionsLayout>
  )
}

export default ShareTab
