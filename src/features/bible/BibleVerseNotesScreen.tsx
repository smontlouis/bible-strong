import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useSetAtom } from 'jotai/react'

import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import BibleNoteItem from './BibleNoteItem'

import { Tag } from '~common/types'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { unifiedTagsModalAtom } from '~state/app'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import { selectRelationCountsByEndpointIdentity } from '~redux/selectors/bible'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useOpenNote } from '~features/notes/useOpenNote'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'

export type TNote = {
  noteId: string
  reference: string
  notes: Note
}

type BibleVerseNotesProps = {
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
}

const BibleVerseNotes = ({
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
}: BibleVerseNotesProps) => {
  const { t } = useTranslation()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true

  const [selectedChip, setSelectedChip] = useState<Tag | null>(null)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)
  const openEntityRelations = useOpenEntityRelations()
  const openNote = useOpenNote()

  const notesObj = useSelector((state: RootState) => state.user.bible.notes)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const relations = useSelector((state: RootState) => state.user.bible.relations)
  const relationCountsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)

  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const noteSettingsModal = useBottomSheetModal()

  const openTagsModal = useCallback(() => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setSelectedChip(tag ?? null),
    })
  }, [selectedChip, setUnifiedTagsModal])

  // Compute notes directly (React Compiler handles memoization)
  const notes: TNote[] = []

  Object.entries(notesObj).forEach(([noteKey, note]) => {
    // Handle annotation notes (key format: annotation:{annotationId})
    if (noteKey.startsWith('annotation:')) {
      const annotationId = noteKey.replace('annotation:', '')
      const annotation = wordAnnotations[annotationId]

      if (!annotation) {
        // Skip orphaned annotation notes
        return
      }

      const firstRange = annotation.ranges[0]
      const reference = `${verseToReference({ [firstRange.verseKey]: true })} (${t('annotation')})`
      notes.push({ noteId: noteKey, reference, notes: note })
      return
    }

    const relation = Object.values(relations).find(
      candidate =>
        candidate.kind === 'system' &&
        candidate.type === 'annotates' &&
        candidate.endpoints.some(
          endpoint => endpoint.type === 'note' && endpoint.noteId === noteKey
        )
    )
    const verseEndpoint = relation?.endpoints.find(endpoint => endpoint.type === 'verse')
    const verseNumbers =
      verseEndpoint?.type === 'verse'
        ? Object.fromEntries(verseEndpoint.verseKeys.map(key => [key, true]))
        : {}

    notes.push({ noteId: noteKey, reference: verseToReference(verseNumbers), notes: note })
  })

  // Sort by date, newest first
  notes.sort((a, b) => Number(b.notes.date) - Number(a.notes.date))

  // Filter by selected tag
  const filteredNotes = selectedChip
    ? notes.filter(s => s.notes.tags && s.notes.tags[selectedChip.id])
    : notes

  const openNoteSettings = (noteId: string) => {
    setNoteSettingsId(noteId)
    noteSettingsModal.open()
  }

  const openNoteEditor = (noteId: string) => {
    if (isNewTabSelection) {
      const note = notes.find(candidate => candidate.noteId === noteId)

      resolveNewTabSelection({
        id: newTabId || 'new',
        title: note?.notes.title || t('Notes'),
        isRemovable: true,
        type: 'notes',
        data: {
          noteId,
        },
      })
      return
    }

    openNote({ noteId })
  }

  const renderNote = ({ item }: { item: TNote }) => {
    const endpoint: Extract<RelationEndpoint, { type: 'note' }> = {
      type: 'note',
      noteId: item.noteId,
      label: item.notes.title || item.notes.description || item.reference,
    }

    return (
      <BibleNoteItem
        item={item}
        onPress={openNoteEditor}
        onMenuPress={openNoteSettings}
        relationCount={relationCountsByEndpoint[endpointIdentity(endpoint)] || 0}
        onRelationPress={() => openEntityRelations(endpoint)}
      />
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <FiltersHeader
          title="Notes"
          filterLabel={selectedChip?.name}
          hasBackButton={hasBackButton}
          hasActiveFilters={Boolean(selectedChip)}
          onReset={() => setSelectedChip(null)}
          filters={[
            {
              key: 'tags',
              icon: 'tag',
              label: t('Tags'),
              value: selectedChip?.name || t('Tous'),
              onPress: openTagsModal,
            },
          ]}
        />
        {filteredNotes.length ? (
          <FlatList
            data={filteredNotes}
            renderItem={renderNote}
            keyExtractor={(item: TNote) => item.noteId}
            style={{ paddingBottom: 30 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/note.svg')}
            message={t("Vous n'avez pas encore de notes...")}
          />
        )}
        <BibleNotesSettingsModal
          ref={noteSettingsModal.getRef()}
          noteId={noteSettingsId}
          onClosed={() => setNoteSettingsId(null)}
        />
      </Box>
    </FormSheetScreen>
  )
}

export default BibleVerseNotes
