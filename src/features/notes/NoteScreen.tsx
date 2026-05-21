import { useLocalSearchParams, useRouter } from 'expo-router'
import { atom } from 'jotai'
import { useRef } from 'react'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import type { NotesTab } from '~state/tabs'
import NoteDetailTabScreen from './NoteDetailTabScreen'

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
  const { noteId } = useLocalSearchParams<{ noteId?: string }>()
  const notesAtomRef = useRef(createNoteRouteAtom(noteId))

  if (!noteId) {
    return (
      <Container center px={20}>
        <Text color="grey">Note introuvable</Text>
      </Container>
    )
  }

  return (
    <NoteDetailTabScreen
      notesAtom={notesAtomRef.current}
      noteId={noteId}
      onBackPress={router.back}
    />
  )
}

export default NoteScreen
