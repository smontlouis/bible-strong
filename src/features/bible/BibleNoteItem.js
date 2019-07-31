import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/distance_in_words'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import truncate from '~helpers/truncate'
import Paragraph from '~common/ui/Paragraph'
import theme from '~themes/default'

const NoteContainer = styled.TouchableOpacity(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class BibleNoteItem extends React.Component {
  openModal = () => { this.setState({ isModalOpen: true }) }
  closeModal = () => { this.setState({ isMenuOpen: false }) }

  state = {
    isModalOpen: false,
    isMenuOpen: false
  }

  render () {
    const { item, openNoteEditor, deleteNote } = this.props
    const formattedDate = distanceInWords(Number(item.notes.date), Date.now(), { locale: frLocale })

    return (
      <NoteContainer onPress={() => openNoteEditor(item.noteId)}>
        <Box row justifyContent='space-between'>
          <Text color='darkGrey' bold fontSize={14}>
            {item.reference} - Il y a {formattedDate}
          </Text>
          <Box row>
            <Icon.Feather
              name={'trash-2'}
              size={15}
              style={{ paddingHorizontal: 10, paddingBottom: 5 }}
              color={theme.colors.tertiary}
              onPress={() => deleteNote(item.noteId)}
            />
          </Box>
        </Box>
        {
          !!item.notes.title &&
          <Text bold scale={-2}>
            {item.notes.title}
          </Text>
        }
        {
          !!item.notes.description &&
          <Paragraph scale={-3} scaleLineHeight={-2}>
            {truncate(item.notes.description, 100)}
          </Paragraph>
        }
      </NoteContainer>
    )
  }
}

export default BibleNoteItem
