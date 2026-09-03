import { produce } from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import { Tag } from '~common/types'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { useSheet } from '~helpers/useSheet'
import { getNoteTitle } from '~helpers/getNoteTitle'
import { RootState } from '~redux/modules/reducer'
import { selectRelationCountsByEndpointIdentity } from '~redux/selectors/bible'
import { selectNoteListRows } from '~redux/selectors/notes'
import type { NoteListRow } from '~features/entityListQuery/noteListRows'
import { NotesTab } from '~state/tabs'
import { unifiedTagsModalAtom } from '~state/app'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { createNoteEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import BibleNoteItem from '../bible/BibleNoteItem'
import NotesSettingsModal from './NotesSettingsModal'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import { queryEntityList, type EntityListSort } from '~features/entityListQuery/entityListQuery'
import {
  defaultNotesListQueryState,
  notesListQueryAtom,
  shouldClearPersistedReferenceFilter,
} from '~state/entityListFilters'

type AllNotesTabScreenProps = {
  hasBackButton?: boolean
  notesAtom: PrimitiveAtom<NotesTab>
}

const AllNotesTabScreen = ({ hasBackButton, notesAtom }: AllNotesTabScreenProps) => {
  const { t } = useTranslation()
  const [, setNotesTab] = useAtom(notesAtom)

  const [queryState, setQueryState] = useAtom(notesListQueryAtom)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)

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
  const openEntityRelations = useOpenEntityRelations()

  const openTagsModal = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setQueryState(state => ({ ...state, tagId: tag?.id || null })),
    })
  }

  const openNoteSettings = (noteId: string) => {
    setNoteSettingsId(noteId)
    noteSettingsModal.open()
  }
  const openNoteDetail = (noteId: string) => {
    setNotesTab(
      produce(draft => {
        draft.data.noteId = noteId
      })
    )
  }

  const renderNote = ({ item }: { item: NoteListRow }) => {
    const endpoint: Extract<RelationEndpoint, { type: 'note' }> = createNoteEndpoint(
      item.noteId,
      getNoteTitle(item.note, item.reference)
    )

    return (
      <BibleNoteItem
        key={item.noteId}
        item={item}
        onPress={openNoteDetail}
        onMenuPress={openNoteSettings}
        relationCount={relationCountsByEndpoint[endpointIdentity(endpoint)] || 0}
        onRelationPress={() => {
          openEntityRelations(endpoint)
        }}
      />
    )
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
  const taggedNotes = notes.filter(s =>
    selectedChip ? Boolean(s.note.tags?.[selectedChip.id]) : true
  )
  const filteredNotes = queryEntityList(taggedNotes, queryState)
  return (
    <Container>
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
      <NotesSettingsModal
        ref={noteSettingsModal.getRef()}
        noteId={noteSettingsId}
        onClosed={() => setNoteSettingsId(null)}
        notesAtom={notesAtom}
      />
    </Container>
  )
}

export default AllNotesTabScreen
