import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useAtom, useSetAtom } from 'jotai/react'

import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import Box from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import BibleNoteItem from './BibleNoteItem'

import { Tag } from '~common/types'
import { useSheet } from '~helpers/useSheet'
import { unifiedTagsModalAtom } from '~state/app'
import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import {
  getRelationVerseKeysForEntity,
  selectRelationCountsByEndpointIdentity,
} from '~redux/selectors/bible'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { createNoteEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useOpenNote } from '~features/notes/useOpenNote'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import { queryEntityList, type EntityListSort } from '~features/entityListQuery/entityListQuery'
import { defaultNotesListQueryState, notesListQueryAtom } from '~state/entityListFilters'

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

  const [queryState, setQueryState] = useAtom(notesListQueryAtom)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)
  const openEntityRelations = useOpenEntityRelations()
  const openNote = useOpenNote()

  const notesObj = useSelector((state: RootState) => state.user.bible.notes)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const relations = useSelector((state: RootState) => state.user.bible.relations)
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const selectedChip = queryState.tagId ? tags[queryState.tagId] || null : null

  useEffect(() => {
    if (queryState.tagId && !tags[queryState.tagId]) {
      setQueryState(state => ({ ...state, tagId: null }))
    }
  }, [queryState.tagId, setQueryState, tags])
  const relationCountsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)

  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const noteSettingsModal = useSheet()

  const openTagsModal = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setQueryState(state => ({ ...state, tagId: tag?.id || null })),
    })
  }

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

    const verseKeys = getRelationVerseKeysForEntity(relations, 'note', noteKey, 'annotates')
    const verseNumbers = Object.fromEntries(verseKeys.map(key => [key, true]))

    notes.push({ noteId: noteKey, reference: verseToReference(verseNumbers), notes: note })
  })

  const sortOptions = [
    { value: 'newest', label: t('entityList.sort.newest') },
    { value: 'oldest', label: t('entityList.sort.oldest') },
    { value: 'title-asc', label: t('entityList.sort.titleAsc') },
    { value: 'title-desc', label: t('entityList.sort.titleDesc') },
  ] satisfies readonly { value: EntityListSort; label: string }[]
  const queryFilters = useEntityListQueryFilters({
    query: queryState.query,
    sort: queryState.sort,
    sortOptions,
    onQueryChange: query => setQueryState(state => ({ ...state, query })),
    onSortChange: sort => setQueryState(state => ({ ...state, sort })),
  })
  const filteredNotes = queryEntityList(
    notes.reduce<(TNote & { id: string; title: string; description: string; date: number })[]>(
      (result, item) => {
        if (selectedChip && !item.notes.tags?.[selectedChip.id]) return result
        result.push({
          ...item,
          id: item.noteId,
          title: getNoteTitle(item.notes, item.reference),
          description: item.notes.description,
          date: Number(item.notes.date || 0),
        })
        return result
      },
      []
    ),
    queryState
  )
  const activeFilters = Boolean(
    queryState.query.trim() || queryState.tagId || queryState.sort !== 'newest'
  )

  const openNoteSettings = (noteId: string) => {
    setNoteSettingsId(noteId)
    noteSettingsModal.open()
  }

  const openNoteEditor = (noteId: string) => {
    if (isNewTabSelection) {
      const note = notes.find(candidate => candidate.noteId === noteId)

      resolveNewTabSelection({
        id: newTabId || 'new',
        title: getNoteTitle(note?.notes, t('Notes')),
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
    const endpoint: Extract<RelationEndpoint, { type: 'note' }> = createNoteEndpoint(
      item.noteId,
      getNoteTitle(item.notes, item.reference)
    )

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
          title={t('Notes')}
          filterLabel={selectedChip?.name}
          hasBackButton={hasBackButton}
          hasActiveFilters={activeFilters}
          onReset={() => setQueryState(defaultNotesListQueryState)}
          filters={[
            ...queryFilters.filters,
            {
              key: 'tags',
              icon: 'tag',
              label: t('Tags'),
              value: selectedChip?.name || t('Tous'),
              onPress: openTagsModal,
            },
          ]}
        />
        {queryFilters.modals}
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
            message={
              notes.length
                ? t('Aucun résultat trouvé pour "{{query}}"', { query: queryState.query })
                : t("Vous n'avez pas encore de notes...")
            }
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
