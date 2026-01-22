import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import AnnotationNoteModal from './AnnotationNoteModal'
import BibleNoteItem from './BibleNoteItem'
import BibleNoteModal from './BibleNoteModal'

import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import { Tag, VerseIds } from '~common/types'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'

type TNote = {
  noteId: string
  reference: string
  notes: Note
}

const BibleVerseNotes = () => {
  const { t } = useTranslation()

  const [noteVerses, setNoteVerses] = useState<VerseIds | undefined>(undefined)
  const [selectedChip, setSelectedChip] = useState<Tag | null>(null)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)
  const [selectedAnnotationNote, setSelectedAnnotationNote] = useState<{
    annotationId: string
    text: string
    verseKey: string
    noteId: string
    version: string
  } | null>(null)

  const notesObj = useSelector((state: RootState) => state.user.bible.notes)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)

  const noteModal = useBottomSheetModal()
  const annotationNoteModal = useBottomSheetModal()
  const tagsModal = useBottomSheetModal()
  const noteSettingsModal = useBottomSheetModal()

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

    // Handle regular verse notes
    const verseNumbers: Record<string, boolean> = {}
    noteKey.split('/').forEach(ref => {
      verseNumbers[ref] = true
    })

    const reference = verseToReference(verseNumbers)
    notes.push({ noteId: noteKey, reference, notes: note })
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
    // Handle annotation notes with AnnotationNoteModal
    if (noteId.startsWith('annotation:')) {
      const annotationId = noteId.replace('annotation:', '')
      const annotation = wordAnnotations[annotationId]
      if (annotation) {
        setSelectedAnnotationNote({
          annotationId,
          text: annotation.ranges.map(r => r.text).join(' '),
          verseKey: annotation.ranges[0]?.verseKey || '',
          noteId,
          version: annotation.version,
        })
        annotationNoteModal.open()
      }
      return
    }

    // Handle regular verse notes with BibleNoteModal
    const verses = noteId.split('/').reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {} as VerseIds)

    setNoteVerses(verses)
    noteModal.open()
  }

  const renderNote = ({ item }: { item: TNote }) => (
    <BibleNoteItem item={item} onPress={openNoteEditor} onMenuPress={openNoteSettings} />
  )

  return (
    <Container>
      <TagsHeader
        title="Notes"
        setIsOpen={tagsModal.open}
        isOpen={false}
        selectedChip={selectedChip}
        hasBackButton
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
      <BibleNoteModal ref={noteModal.getRef()} noteVerses={noteVerses} />
      <AnnotationNoteModal
        ref={annotationNoteModal.getRef()}
        annotationId={selectedAnnotationNote?.annotationId ?? null}
        annotationText={selectedAnnotationNote?.text ?? ''}
        annotationVerseKey={selectedAnnotationNote?.verseKey ?? ''}
        existingNoteId={selectedAnnotationNote?.noteId}
        version={selectedAnnotationNote?.version as any}
      />
      <TagsModal
        ref={tagsModal.getRef()}
        onClosed={() => {}}
        onSelected={(chip: Tag | null) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <BibleNotesSettingsModal
        ref={noteSettingsModal.getRef()}
        noteId={noteSettingsId}
        onClosed={() => setNoteSettingsId(null)}
      />
    </Container>
  )
}

export default BibleVerseNotes
