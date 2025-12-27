import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import { StackNavigationProp } from '@react-navigation/stack'
import produce from 'immer'
import { PrimitiveAtom, useAtom } from 'jotai'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import { Tag } from '~common/types'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import verseToReference from '~helpers/verseToReference'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import { NotesTab } from '~state/tabs'
import BibleNoteItem from '../bible/BibleNoteItem'
import NotesSettingsModal from './NotesSettingsModal'

type TNote = {
  noteId: string
  reference: string
  notes: Note
}

type AllNotesTabScreenProps = {
  hasBackButton?: boolean
  navigation: StackNavigationProp<MainStackProps>
  notesAtom: PrimitiveAtom<NotesTab>
}

const AllNotesTabScreen = ({ hasBackButton, navigation, notesAtom }: AllNotesTabScreenProps) => {
  const { t } = useTranslation()
  const [, setNotesTab] = useAtom(notesAtom)

  const [notes, setNotes] = useState<TNote[]>([])
  const [selectedChip, setSelectedChip] = useState<Tag | null>(null)
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)

  const _notes = useSelector((state: RootState) => state.user.bible.notes)
  const tagsModal = useBottomSheetModal()
  const noteSettingsModal = useBottomSheetModal()

  const openNoteSettings = useCallback(
    (noteId: string) => {
      setNoteSettingsId(noteId)
      noteSettingsModal.open()
    },
    [noteSettingsModal]
  )

  useEffect(() => {
    loadNotes()
  }, [_notes])

  const loadNotes = async () => {
    const formattedNotes: TNote[] = []

    await Promise.all(
      Object.entries(_notes).map(([noteKey, note]) => {
        const verseNumbers: Record<string, boolean> = {}
        noteKey.split('/').forEach(ref => {
          verseNumbers[ref] = true
        })

        const reference = verseToReference(verseNumbers)
        formattedNotes.push({ noteId: noteKey, reference, notes: note })
      })
    )

    // Sort by date, newest first
    formattedNotes.sort((a, b) => Number(b.notes.date) - Number(a.notes.date))

    setNotes(formattedNotes)
  }

  const openNoteDetail = useCallback(
    (noteId: string) => {
      setNotesTab(
        produce(draft => {
          draft.data.noteId = noteId
        })
      )
    },
    [setNotesTab]
  )

  const renderNote = useCallback(
    ({ item, index }: { item: TNote; index: number }) => {
      return (
        <BibleNoteItem
          key={index}
          item={item}
          onPress={openNoteDetail}
          onMenuPress={openNoteSettings}
        />
      )
    },
    [openNoteDetail, openNoteSettings]
  )

  const filteredNotes = useMemo(
    () => notes.filter(s => (selectedChip ? s.notes.tags && s.notes.tags[selectedChip.id] : true)),
    [notes, selectedChip]
  )

  return (
    <Container>
      <TagsHeader
        title={t('Notes')}
        setIsOpen={tagsModal.open}
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
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore de notes...")}
        />
      )}
      <TagsModal
        ref={tagsModal.ref}
        onClosed={() => {}}
        onSelected={(chip: Tag | null) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <NotesSettingsModal
        ref={noteSettingsModal.ref}
        noteId={noteSettingsId}
        onClosed={() => setNoteSettingsId(null)}
        notesAtom={notesAtom}
      />
    </Container>
  )
}

export default AllNotesTabScreen
