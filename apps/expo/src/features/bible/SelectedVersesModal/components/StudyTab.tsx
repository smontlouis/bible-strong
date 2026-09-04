import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import ActionItem from './ActionItem'

interface StudyTabProps {
  screenWidth: number
  showStrongDetail: () => void
  showDictionaryDetail: () => void
  onOpenNave: () => void
  onOpenReferences: () => void
  openCommentariesScreen: () => void
  compareVerses: () => void
  moreThanOneVerseSelected: boolean
}

const StudyTab = ({
  screenWidth,
  showStrongDetail,
  showDictionaryDetail,
  onOpenNave,
  onOpenReferences,
  openCommentariesScreen,
  compareVerses,
  moreThanOneVerseSelected,
}: StudyTabProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={{ width: screenWidth }}
    >
      <ActionItem
        svgSource={require('~assets/images/tab-icons/lexique.svg')}
        tintColor={theme.colors.primary}
        label={t('Lexique')}
        onPress={showStrongDetail}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/dictionary.svg')}
        tintColor={theme.colors.secondary}
        label={t('Dictionnaire')}
        onPress={showDictionaryDetail}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/nave.svg')}
        tintColor={theme.colors.quint}
        label={t('Thèmes')}
        onPress={onOpenNave}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/references.svg')}
        tintColor={theme.colors.quart}
        label={t('Références')}
        onPress={onOpenReferences}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/comment.svg')}
        tintColor="#26A69A"
        label={t('Commentaire')}
        onPress={openCommentariesScreen}
        disabled={moreThanOneVerseSelected}
      />
      <ActionItem name="layers" label={t('Comparer')} onPress={compareVerses} />
    </ScrollView>
  )
}

export default StudyTab
