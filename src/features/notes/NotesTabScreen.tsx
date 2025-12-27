import React from 'react'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { StackNavigationProp } from '@react-navigation/stack'
import { NotesTab } from '../../state/tabs'
import AllNotesTabScreen from './AllNotesTabScreen'
import NoteDetailTabScreen from './NoteDetailTabScreen'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

interface NotesTabScreenProps {
  navigation: StackNavigationProp<MainStackProps>
  route: RouteProp<MainStackProps>
  notesAtom: PrimitiveAtom<NotesTab>
}

const NotesTabScreen = ({ notesAtom, navigation }: NotesTabScreenProps) => {
  const [notesTab] = useAtom(notesAtom)

  const {
    data: { noteId },
    hasBackButton,
  } = notesTab

  if (!noteId) {
    return (
      <AllNotesTabScreen
        hasBackButton={hasBackButton}
        navigation={navigation}
        notesAtom={notesAtom}
      />
    )
  }

  return (
    <NoteDetailTabScreen
      notesAtom={notesAtom}
      navigation={navigation}
      noteId={noteId}
    />
  )
}

export default NotesTabScreen
