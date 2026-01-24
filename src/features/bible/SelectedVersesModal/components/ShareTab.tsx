import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import ActionItem from './ActionItem'

interface ShareTabProps {
  screenWidth: number
  copyToClipboard: () => void
  shareVerse: () => void
  selectAllVerses: () => void
}

const ShareTab = ({ screenWidth, copyToClipboard, shareVerse, selectAllVerses }: ShareTabProps) => {
  const { t } = useTranslation()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={{ width: screenWidth }}
    >
      <ActionItem name="copy" label={t('Copier')} onPress={copyToClipboard} />
      <ActionItem name="share-2" label={t('Partager')} onPress={shareVerse} />
      <ActionItem name="check-square" label={t('Tout sélect.')} onPress={selectAllVerses} />
    </ScrollView>
  )
}

export default ShareTab
