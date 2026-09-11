import AddToStudyAction from '~features/studies/AddToStudyAction'
import { useTranslation } from 'react-i18next'
import ActionsLayout from './ActionsLayout'
import ActionItem from './ActionItem'
import VerseTagsAction from './VerseTagsAction'
import VerseBookmarkAction from './VerseBookmarkAction'
import type { VerseIds } from '~common/types'
import type { VerseActiveStates } from '../types'

interface AnnotateTabProps {
  selectedVerses: VerseIds
  version: string
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
  version,
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
    <ActionsLayout width={screenWidth}>
      <ActionItem name="file-plus" label={t('Note')} onPress={onCreateNoteClick} />
      <VerseTagsAction selectedVerses={selectedVerses} reference={reference} onPress={addTag} />
      <ActionItem name="link" label={t('Lien')} onPress={onCreateLinkClick} />
      <ActionItem name="git-merge" label={t('Relation')} onPress={onCreateStudyRelationClick} />
      <VerseBookmarkAction
        selectedVerses={selectedVerses}
        version={version}
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
    </ActionsLayout>
  )
}

export default AnnotateTab
