import { useLocalSearchParams, useRouter } from 'expo-router'
import { atom } from 'jotai'
import { useState } from 'react'
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
  const { noteId, verseKeys, version } = useLocalSearchParams<{
    noteId?: string
    verseKeys?: string
    version?: string
  }>()
  const [notesAtom] = useState(() => createNoteRouteAtom(noteId))
  const initialVerseKeys = parseNoteVerseKeysParam(verseKeys)

  return (
    <NoteDetailTabScreen
      notesAtom={notesAtom}
      noteId={noteId}
      initialVerseKeys={initialVerseKeys}
      initialVersion={version}
      onBackPress={router.back}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default NoteScreen
