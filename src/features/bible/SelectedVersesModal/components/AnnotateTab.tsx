import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import ActionItem from './ActionItem'
import type { VerseActiveStates } from '../types'

interface AnnotateTabProps {
  screenWidth: number
  onCreateNoteClick: () => void
  addTag: () => void
  onCreateLinkClick: () => void
  onAddBookmark: () => void
  onAddToStudy: () => void
  onPinVerses: () => void
  onEnterAnnotationMode?: () => void
  moreThanOneVerseSelected: boolean
  activeStates: VerseActiveStates
}

const AnnotateTab = ({
  screenWidth,
  onCreateNoteClick,
  addTag,
  onCreateLinkClick,
  onAddBookmark,
  onAddToStudy,
  onPinVerses,
  onEnterAnnotationMode,
  moreThanOneVerseSelected,
  activeStates,
}: AnnotateTabProps) => {
  const { t } = useTranslation()
  const { hasNote, hasTags, hasLink, hasBookmark, hasFocus } = activeStates

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={{ width: screenWidth }}
    >
      <ActionItem
        name={hasNote ? 'file-text' : 'file-plus'}
        label={t('Note')}
        onPress={onCreateNoteClick}
        isActive={hasNote}
      />
      <ActionItem name="tag" label={t('Tag')} onPress={addTag} isActive={hasTags} />
      <ActionItem name="link" label={t('Lien')} onPress={onCreateLinkClick} isActive={hasLink} />
      <ActionItem
        name="bookmark"
        label={t('Marque-page')}
        onPress={onAddBookmark}
        disabled={moreThanOneVerseSelected}
        isActive={hasBookmark}
      />
      <ActionItem name="feather" label={t('study.addToStudy')} onPress={onAddToStudy} />
      <ActionItem name="crosshair" label={t('Focus')} onPress={onPinVerses} isActive={hasFocus} />
      {onEnterAnnotationMode && (
        <ActionItem
          name="edit-2"
          label={t('Mode libre')}
          onPress={onEnterAnnotationMode}
          variant="emphasized"
        />
      )}
    </ScrollView>
  )
}

export default AnnotateTab
