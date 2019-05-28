import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

import Paragraph from '~common/ui/Paragraph'
import theme from '~themes/default'

const NoteContainer = styled.View(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class BibleNoteItem extends React.Component {
  openModal = () => { this.setState({ isModalOpen: true }) }
  closeModal = () => { this.setState({ isMenuOpen: false }) }

  render () {
    const { item, openNoteEditor, deleteNote } = this.props

    return (
      <NoteContainer style={{ marginBottom: 10 }}>
        <Box row style={{ justifyContent: 'space-between' }}>
          <Text color='darkGrey' bold fontSize={14}>
            {item.reference}
          </Text>
          <Box row>
            <Icon.Feather
              name={'trash-2'}
              size={15}
              style={{ paddingHorizontal: 10, paddingBottom: 5 }}
              color={theme.colors.tertiary}
              onPress={() => deleteNote(item.noteId)}
            />
            <Icon.Feather
              name={'edit-2'}
              size={15}
              style={{ paddingHorizontal: 10, paddingBottom: 5 }}
              color={theme.colors.tertiary}
              onPress={() => openNoteEditor(item.noteId)}
            />
          </Box>
        </Box>
        {!!item.notes.title && <Paragraph scale={-2} style={{ fontWeight: 'bold' }}>
          {item.notes.title}
        </Paragraph>}
        {!!item.notes.description && <Paragraph scale={-3} scaleLineHeight={-2}>
          {item.notes.description}
        </Paragraph>}
      </NoteContainer>
    )
  }
}

export default BibleNoteItem
