import React from 'react'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { NotesTab } from '../../state/tabs'
import AllNotesTabScreen from './AllNotesTabScreen'
import NoteDetailTabScreen from './NoteDetailTabScreen'

interface NotesTabScreenProps {
  notesAtom: PrimitiveAtom<NotesTab>
}

const NotesTabScreen = ({ notesAtom }: NotesTabScreenProps) => {
  const [notesTab] = useAtom(notesAtom)

  const {
    data: { noteId },
    hasBackButton,
  } = notesTab

  if (!noteId) {
    return (
      <AllNotesTabScreen
        hasBackButton={hasBackButton}
        notesAtom={notesAtom}
      />
    )
  }

  return (
    <NoteDetailTabScreen
      notesAtom={notesAtom}
      noteId={noteId}
    />
  )
}

export default NotesTabScreen
