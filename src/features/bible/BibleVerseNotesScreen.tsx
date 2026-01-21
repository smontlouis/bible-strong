import { useLocalSearchParams } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Header from '~common/Header'
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
  const params = useLocalSearchParams<{ withBack?: string; verse?: string }>()
  const withBack = params.withBack === 'true'
  const verse = params.verse || ''
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState<TNote[]>([])
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
  const _notes = useSelector((state: RootState) => state.user.bible.notes)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const noteModal = useBottomSheetModal()
  const annotationNoteModal = useBottomSheetModal()
  const tagsModal = useBottomSheetModal()
  const noteSettingsModal = useBottomSheetModal()

  const openNoteSettings = (noteId: string) => {
    setNoteSettingsId(noteId)
    noteSettingsModal.open()
  }

  useEffect(() => {
    loadPage()
  }, [verse, _notes, wordAnnotations])

  const loadPage = async () => {
    let title
    const filtered_notes: TNote[] = []

    if (verse) {
      title = verseToReference(verse)
      title = `${t('Notes sur')} ${title}...`
    } else {
      title = 'Notes'
    }

    Object.entries(_notes).forEach(([noteKey, note]) => {
      // Handle annotation notes (key format: annotation:{annotationId})
      if (noteKey.startsWith('annotation:')) {
        const annotationId = noteKey.replace('annotation:', '')
        const annotation = wordAnnotations[annotationId]

        if (!annotation) {
          // Skip orphaned annotation notes
          return
        }

        // If filtering by verse, check if annotation is on this verse
        if (verse) {
          const isOnVerse = annotation.ranges.some(range => range.verseKey === verse)
          if (!isOnVerse) {
            return
          }
        }

        const firstRange = annotation.ranges[0]
        const reference = `${verseToReference({ [firstRange.verseKey]: true })} (${t('annotation')})`
        filtered_notes.push({ noteId: noteKey, reference, notes: note })
        return
      }

      // Handle regular verse notes
      // If filtering by verse, check if note is on this verse
      if (verse) {
        const firstVerseRef = noteKey.split('/')[0]
        if (firstVerseRef !== verse) {
          return
        }
      }

      const verseNumbers: Record<string, boolean> = {}
      noteKey.split('/').forEach(ref => {
        verseNumbers[ref] = true
      })

      const reference = verseToReference(verseNumbers)
      filtered_notes.push({ noteId: noteKey, reference, notes: note })
    })

    // Sort by date, newest first
    filtered_notes.sort((a, b) => Number(b.notes.date) - Number(a.notes.date))

    setTitle(title)
    setNotes(filtered_notes)
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
    const noteVerses = noteId.split('/').reduce((accuRefs, key) => {
      accuRefs[key] = true
      return accuRefs
    }, {} as any)

    setNoteVerses(noteVerses)
    noteModal.open()
  }

  const renderNote = ({ item, index }: { item: TNote; index: number }) => {
    return (
      <BibleNoteItem
        key={index}
        item={item}
        onPress={openNoteEditor}
        onMenuPress={openNoteSettings}
      />
    )
  }

  const filteredNotes = notes.filter(s =>
    selectedChip ? s.notes.tags && s.notes.tags[selectedChip.id] : true
  )

  return (
    <Container>
      {verse ? (
        <Header hasBackButton={withBack} title={title || t('Chargement...')} />
      ) : (
        <TagsHeader
          title="Notes"
          setIsOpen={tagsModal.open}
          isOpen={false}
          selectedChip={selectedChip}
          hasBackButton
        />
      )}
      {filteredNotes.length ? (
        <FlatList
          data={filteredNotes}
          renderItem={renderNote}
          keyExtractor={(item: TNote, index: number) => index.toString()}
          style={{ paddingBottom: 30 }}
        />
      ) : (
        <Empty
          icon={require('~assets/images/empty-state-icons/note.svg')}
          message={t("Vous n'avez pas encore de notes...")}
        />
      )}
      <BibleNoteModal ref={noteModal.ref} noteVerses={noteVerses} />
      <AnnotationNoteModal
        ref={annotationNoteModal.ref}
        annotationId={selectedAnnotationNote?.annotationId ?? null}
        annotationText={selectedAnnotationNote?.text ?? ''}
        annotationVerseKey={selectedAnnotationNote?.verseKey ?? ''}
        existingNoteId={selectedAnnotationNote?.noteId}
        version={selectedAnnotationNote?.version as any}
      />
      <TagsModal
        ref={tagsModal.ref}
        onClosed={() => {}}
        onSelected={(chip: Tag | null) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <BibleNotesSettingsModal
        ref={noteSettingsModal.ref}
        noteId={noteSettingsId}
        onClosed={() => setNoteSettingsId(null)}
      />
    </Container>
  )
}

export default BibleVerseNotes
