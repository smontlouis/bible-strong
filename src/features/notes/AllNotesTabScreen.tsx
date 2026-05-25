import { produce } from 'immer'
import { PrimitiveAtom, useAtom, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import TagsHeader from '~common/TagsHeader'
import { Tag } from '~common/types'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import { selectRelationCountsByEndpointIdentity } from '~redux/selectors/bible'
import { NotesTab } from '~state/tabs'
import { unifiedTagsModalAtom } from '~state/app'
import EntityRelationsModal from '~features/studyRelations/EntityRelationsModal'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import BibleNoteItem from '../bible/BibleNoteItem'
import NotesSettingsModal from './NotesSettingsModal'

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
  const [selectedChip, setSelectedChip] = useState<Tag | null>(null)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)
  const [relationEndpoint, setRelationEndpoint] = useState<RelationEndpoint | null>(null)

  const _notes = useSelector((state: RootState) => state.user.bible.notes)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const relations = useSelector((state: RootState) => state.user.bible.relations)
  const relationCountsByEndpoint = useSelector(selectRelationCountsByEndpointIdentity)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const noteSettingsModal = useBottomSheetModal()
  const relationModal = useBottomSheetModal()

  const openTagsModal = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag: selectedChip ?? undefined,
      onSelect: (tag?: Tag) => setSelectedChip(tag ?? null),
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
    const endpoint: Extract<RelationEndpoint, { type: 'note' }> = {
      type: 'note',
      noteId: item.noteId,
      label: item.notes.title || item.notes.description || item.reference,
    }

    return (
      <BibleNoteItem
        key={index}
        item={item}
        onPress={openNoteDetail}
        onMenuPress={openNoteSettings}
        relationCount={relationCountsByEndpoint[endpointIdentity(endpoint)] || 0}
        onRelationPress={() => {
          setRelationEndpoint(endpoint)
          relationModal.open()
        }}
      />
    )
  }

  const filteredNotes = notes.filter(s =>
    selectedChip ? s.notes.tags && s.notes.tags[selectedChip.id] : true
  )

  return (
    <Container>
      <TagsHeader
        title={t('Notes')}
        setIsOpen={openTagsModal}
        isOpen={false}
        selectedChip={selectedChip}
        hasBackButton={hasBackButton}
      />
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
          message={t("Vous n'avez pas encore de notes...")}
        />
      )}
      <NotesSettingsModal
        ref={noteSettingsModal.getRef()}
        noteId={noteSettingsId}
        onClosed={() => setNoteSettingsId(null)}
        notesAtom={notesAtom}
      />
      <EntityRelationsModal ref={relationModal.getRef()} endpoint={relationEndpoint} />
    </Container>
  )
}

export default AllNotesTabScreen
