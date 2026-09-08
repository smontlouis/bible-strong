import AddToStudyAction from '~features/studies/AddToStudyAction'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import ActionItem from './ActionItem'
import VerseTagsAction from './VerseTagsAction'
import type { VerseIds } from '~common/types'
import type { VerseActiveStates } from '../types'

interface AnnotateTabProps {
  selectedVerses: VerseIds
  screenWidth: number
  onCreateNoteClick: () => void
  addTag: () => void
  onCreateLinkClick: () => void
  onCreateStudyRelationClick: () => void
  onAddBookmark: () => void
  onAddToStudy: () => void
  onSelectStudy?: (studyId: string, format: 'inline' | 'block') => Promise<void>
  reference?: string
  onPinVerses: () => void
  onEnterAnnotationMode?: () => void
  moreThanOneVerseSelected: boolean
  activeStates: VerseActiveStates
}

const AnnotateTab = ({
  selectedVerses,
  screenWidth,
  onCreateNoteClick,
  addTag,
  onCreateLinkClick,
  onCreateStudyRelationClick,
  onAddBookmark,
  onAddToStudy,
  onSelectStudy,
  reference,
  onPinVerses,
  onEnterAnnotationMode,
  moreThanOneVerseSelected,
  activeStates,
}: AnnotateTabProps) => {
  const { t } = useTranslation()
  const { hasBookmark, hasFocus } = activeStates

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={{ width: screenWidth }}
    >
      <ActionItem name="file-plus" label={t('Note')} onPress={onCreateNoteClick} />
      <VerseTagsAction selectedVerses={selectedVerses} reference={reference} onPress={addTag} />
      <ActionItem name="link" label={t('Lien')} onPress={onCreateLinkClick} />
      <ActionItem name="git-merge" label={t('Relation')} onPress={onCreateStudyRelationClick} />
      <ActionItem
        name="bookmark"
        label={t('Marque-page')}
        onPress={onAddBookmark}
        disabled={moreThanOneVerseSelected}
        isActive={hasBookmark}
      />
      <AddToStudyAction onPress={onAddToStudy} onSelect={onSelectStudy} reference={reference} />
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
