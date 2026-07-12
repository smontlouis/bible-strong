import { produce } from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import FiltersHeader, { getFiltersHeaderLabel } from '~common/FiltersHeader'
import { Tag } from '~common/types'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { useSheet } from '~helpers/useSheet'
import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import {
  getRelationVerseKeysForEntity,
  selectRelationCountsByEndpointIdentity,
} from '~redux/selectors/bible'
import { NotesTab } from '~state/tabs'
import { unifiedTagsModalAtom } from '~state/app'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { createNoteEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import BibleNoteItem from '../bible/BibleNoteItem'
import NotesSettingsModal from './NotesSettingsModal'
import { useEntityListQueryFilters } from '~common/EntityListQueryFilters'
import { queryEntityList, type EntityListSort } from '~features/entityListQuery/entityListQuery'
import { defaultNotesListQueryState, notesListQueryAtom } from '~state/entityListFilters'

type TNote = {
  noteId: string
  reference: string
  notes: Note
}

type AllNotesTabScreenProps = {
  hasBackButton?: boolean
  notesAtom: PrimitiveAtom<NotesTab>
}

const AllNotesTabScreen = ({ hasBackButton, notesAtom }: AllNotesTabScreenProps) => {
  const { t } = useTranslation()
  const [, setNotesTab] = useAtom(notesAtom)

  const [notes, setNotes] = useState<TNote[]>([])
  const [queryState, setQueryState] = useAtom(notesListQueryAtom)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)

  const _notes = useSelector((state: RootState) => state.user.bible.notes)
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
  const loadNotes = async () => {
    const formattedNotes: TNote[] = []

    await Promise.all(
      Object.entries(_notes).map(([noteKey, note]) => {
        // Handle annotation notes (key format: annotation:{annotationId})
        if (noteKey.startsWith('annotation:')) {
          const annotationId = noteKey.replace('annotation:', '')
          const annotation = wordAnnotations[annotationId]
          if (annotation) {
            const firstRange = annotation.ranges[0]
            const reference = `${verseToReference({ [firstRange.verseKey]: true })} (${t('annotation')})`
            formattedNotes.push({ noteId: noteKey, reference, notes: note })
          }
          // Skip orphaned annotation notes (annotation was deleted but note somehow remained)
          return
        }

        const verseKeys = getRelationVerseKeysForEntity(relations, 'note', noteKey, 'annotates')
        const verseNumbers = Object.fromEntries(verseKeys.map(key => [key, true]))

        const reference = verseToReference(verseNumbers)
        formattedNotes.push({ noteId: noteKey, reference, notes: note })
      })
    )

    // Sort by date, newest first
    formattedNotes.sort((a, b) => Number(b.notes.date) - Number(a.notes.date))

    setNotes(formattedNotes)
  }

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_notes, wordAnnotations, relations])

  const openNoteDetail = (noteId: string) => {
    setNotesTab(
      produce(draft => {
        draft.data.noteId = noteId
      })
    )
  }

  const renderNote = ({ item, index }: { item: TNote; index: number }) => {
    const endpoint: Extract<RelationEndpoint, { type: 'note' }> = createNoteEndpoint(
      item.noteId,
      getNoteTitle(item.notes, item.reference)
    )

    return (
      <BibleNoteItem
        key={index}
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
    selectedChip ? Boolean(s.notes.tags?.[selectedChip.id]) : true
  )
  const filteredNotes = queryEntityList(
    taggedNotes.map(item => ({
      ...item,
      id: item.noteId,
      title: getNoteTitle(item.notes, item.reference),
      description: item.notes.description,
      date: Number(item.notes.date || 0),
    })),
    queryState
  )
  const activeFilters = Boolean(
    queryState.query.trim() || queryState.tagId || queryState.sort !== 'newest'
  )
  const filterLabel = getFiltersHeaderLabel(
    [...queryFilters.activeLabels, selectedChip?.name],
    count => `${count} ${t('filtres')}`
  )

  return (
    <Container>
      <FiltersHeader
        title={t('Notes')}
        filterLabel={filterLabel}
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
          keyExtractor={(item: TNote, index: number) => item.noteId || index.toString()}
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
