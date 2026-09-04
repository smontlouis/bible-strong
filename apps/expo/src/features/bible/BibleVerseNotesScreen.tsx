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
import { getNoteTitle } from '~helpers/getNoteTitle'
import { RootState } from '~redux/modules/reducer'
import { selectRelationCountsByEndpointIdentity } from '~redux/selectors/bible'
import { selectNoteListRows } from '~redux/selectors/notes'
import type { NoteListRow } from '~features/entityListQuery/noteListRows'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { createNoteEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useOpenNote } from '~features/notes/useOpenNote'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import { queryEntityList, type EntityListSort } from '~features/entityListQuery/entityListQuery'
import {
  defaultNotesListQueryState,
  notesListQueryAtom,
  shouldClearPersistedReferenceFilter,
} from '~state/entityListFilters'

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

  const notes = useSelector((state: RootState) => selectNoteListRows(state, t('annotation')))
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const tagsReady = useSelector((state: RootState) => !state.user.id || state.user.sync.loaded.tags)
  const selectedChip = queryState.tagId ? tags[queryState.tagId] || null : null

  useEffect(() => {
    if (
      shouldClearPersistedReferenceFilter({
        hasReference: Boolean(queryState.tagId),
        referenceExists: Boolean(queryState.tagId && tags[queryState.tagId]),
        referenceDataReady: tagsReady,
      })
    ) {
      setQueryState(state => ({ ...state, tagId: null }))
    }
  }, [queryState.tagId, setQueryState, tags, tagsReady])
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
  const matchingNotes = notes.filter(item =>
    selectedChip ? Boolean(item.note.tags?.[selectedChip.id]) : true
  )
  const filteredNotes = queryEntityList(matchingNotes, queryState)
  const openNoteSettings = (noteId: string) => {
    setNoteSettingsId(noteId)
    noteSettingsModal.open()
  }

  const openNoteEditor = (noteId: string) => {
    if (isNewTabSelection) {
      const note = notes.find(candidate => candidate.noteId === noteId)

      resolveNewTabSelection({
        id: newTabId || 'new',
        title: getNoteTitle(note?.note, t('Notes')),
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

  const renderNote = ({ item }: { item: NoteListRow }) => {
    const endpoint: Extract<RelationEndpoint, { type: 'note' }> = createNoteEndpoint(
      item.noteId,
      getNoteTitle(item.note, item.reference)
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
          hasBackButton={hasBackButton}
          onReset={() => setQueryState(defaultNotesListQueryState)}
          filters={[
            ...queryFilters.filters,
            {
              key: 'tags',
              icon: 'tag',
              label: t('Tags'),
              value: selectedChip?.name || t('Tous'),
              active: Boolean(queryState.tagId),
              onPress: openTagsModal,
            },
          ]}
        />
        {queryFilters.modals}
        {filteredNotes.length ? (
          <FlatList
            data={filteredNotes}
            renderItem={renderNote}
            keyExtractor={(item: NoteListRow) => item.noteId}
            style={{ paddingBottom: 30 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/note.svg')}
            message={
              notes.length
                ? queryState.query.trim()
                  ? t('Aucun résultat trouvé pour "{{query}}"', { query: queryState.query })
                  : t('entityList.noFilterMatch')
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
