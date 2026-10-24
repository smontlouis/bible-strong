import AddToStudyAction from '~features/studies/AddToStudyAction'
import { useTranslation } from 'react-i18next'
import { personalContentIcons } from '~common/personalContent'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import ActionsLayout from './ActionsLayout'
import ActionItem from './ActionItem'
import VerseTagsAction from './VerseTagsAction'
import VerseBookmarkAction from './VerseBookmarkAction'
import type { VerseIds } from '~common/types'
import type { VerseActiveStates } from '../types'
import { formatShortcut } from '~features/keyboard-shortcuts/keymap'

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
  moreThanOneVerseSelected,
  activeStates,
}: AnnotateTabProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { hasBookmark } = activeStates

  return (
    <ActionsLayout width={screenWidth}>
      <ActionItem
        name="file-plus"
        tintColor={resolveUniverseColors(theme.colors, 'notes').foreground}
        label={t('Note')}
        onPress={onCreateNoteClick}
        shortcut={formatShortcut('note')}
      />
      <VerseTagsAction selectedVerses={selectedVerses} reference={reference} onPress={addTag} />
      <ActionItem
        name={personalContentIcons.links}
        tintColor={resolveUniverseColors(theme.colors, 'links').foreground}
        label={t('Lien')}
        onPress={onCreateLinkClick}
        shortcut={formatShortcut('link')}
      />
      <ActionItem
        name="git-merge"
        label={t('Relation')}
        onPress={onCreateStudyRelationClick}
        shortcut={formatShortcut('relation')}
      />
      <VerseBookmarkAction
        selectedVerses={selectedVerses}
        version={version}
        onPress={onAddBookmark}
        disabled={moreThanOneVerseSelected}
        isActive={hasBookmark}
      />
      <AddToStudyAction onPress={onAddToStudy} onSelect={onSelectStudy} reference={reference} />
    </ActionsLayout>
  )
}

export default AnnotateTab
