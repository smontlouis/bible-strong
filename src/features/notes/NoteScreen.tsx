import { useLocalSearchParams, useRouter } from 'expo-router'
import { atom } from 'jotai'
import { useRef } from 'react'
import type { NotesTab } from '~state/tabs'
import NoteDetailTabScreen from './NoteDetailTabScreen'
import { parseNoteVerseKeysParam } from './routeParams'
import { IS_FORM_SHEET } from '~helpers/constants'

const createNoteRouteAtom = (noteId?: string) =>
  atom<NotesTab>({
    id: 'note-route',
    title: 'Note',
    type: 'notes',
    isRemovable: true,
    data: { noteId },
  })

const NoteScreen = () => {
  const router = useRouter()
  const { noteId, verseKeys } = useLocalSearchParams<{ noteId?: string; verseKeys?: string }>()
  const notesAtomRef = useRef(createNoteRouteAtom(noteId))
  const initialVerseKeys = parseNoteVerseKeysParam(verseKeys)

  return (
    <NoteDetailTabScreen
      notesAtom={notesAtomRef.current}
      noteId={noteId}
      initialVerseKeys={initialVerseKeys}
      onBackPress={router.back}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default NoteScreen
