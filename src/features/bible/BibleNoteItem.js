import React from 'react'
import styled from '@emotion/native'
import { Icon } from 'expo'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Menu } from 'react-native-paper'

import Paragraph from '~common/ui/Paragraph'
import theme from '~themes/default'

const NoteContainer = styled.View(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class BibleNoteItem extends React.Component {
  state = {
    isMenuOpen: false
  }

  openModal = () => { this.setState({ isModalOpen: true }) }
  closeModal = () => { this.setState({ isMenuOpen: false }) }

  render () {
    const { item, openNoteEditor, deleteNote } = this.props
    const { isMenuOpen } = this.state

    return (
      <NoteContainer style={{ marginBottom: 10 }}>
        <Box row style={{ justifyContent: 'space-between' }}>
          <Text color='darkGrey' bold fontSize={14}>
            {item.reference}
          </Text>
          <Menu
            visible={isMenuOpen}
            onDismiss={this.closeModal}
            anchor={
              <Icon.Feather
                name={'more-vertical'}
                size={19}
                style={{ paddingHorizontal: 10, paddingBottom: 5 }}
                color={theme.colors.tertiary}
                // onPress={openModal}
                // onPress={() => openNoteEditor(item.noteId)}
                onPress={() => deleteNote(item.noteId)}
              />
            }
          >
            <Menu.Item onPress={() => openNoteEditor(item.noteId)} title='Éditer' />
            <Menu.Item onPress={() => deleteNote(item.noteId)} title='Supprimer' />
          </Menu>
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
