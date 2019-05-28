import React, { Component } from 'react'
import { View, FlatList, Alert } from 'react-native'
import { connect } from 'react-redux'
import styled from '@emotion/native'
import { Icon } from 'expo'
import { Provider, Menu } from 'react-native-paper'

import BibleNoteModal from './BibleNoteModal'
import getVersesRef from '~helpers/getVersesRef'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import theme from '~themes/default'

const NoteContainer = styled.View(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

class BibleVerseNotes extends Component {
  componentDidMount () {
    this.loadPage(this.props)
  }
  componentWillReceiveProps (nextProps) {
    this.loadPage(nextProps)
  }

  state = {
    title: '',
    verse: {},
    notes: [],
    isModalOpen: false,
    isEditNoteOpen: false
  }

  loadPage = async (props) => {
    const { verse } = props.navigation.state.params || {}
    let { title } = await getVersesRef({ [verse]: true })
    let notes = []

    await Promise.all(Object.entries(props.notes).map(async (note, index) => {
      let firstVerseRef = note[0].split('/')[0]
      let verseNumbers = {}
      note[0].split('/').map(ref => { verseNumbers[ref] = true })
      if (firstVerseRef === verse) {
        const { title: reference } = await getVersesRef(verseNumbers)
        notes.push({ reference, notes: note[1] })
      }
    }))
    this.setState({ title, verse, notes })
  }

  openModal = () => { this.setState({ isModalOpen: true }) }

  closeModal = () => { this.setState({ isModalOpen: false }) }

  toggleEditNote = () => { this.setState({ isEditNoteOpen: !this.state.isEditNoteOpen }) }

  deleteNote = () => {
    Alert.alert('Attention', 'Voulez-vous vraiment supprimer cette note?',
      [ { text: 'Non', onPress: () => null, style: 'cancel' },
        { text: 'Oui', onPress: () => null }
      ])
  }

  renderNote ({ item, index }) {
    return (
      <NoteContainer style={{ marginBottom: 10 }}>
        <Box row style={{ justifyContent: 'space-between' }}>
          <Text color='darkGrey' bold fontSize={14}>
            {item.reference}
          </Text>
          <Icon.Feather
            name={'more-vertical'}
            size={19}
            style={{ paddingHorizontal: 10, paddingBottom: 5 }}
            color={theme.colors.tertiary}
            onPress={this.openModal}
          />
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

  render () {
    const { title, notes, isModalOpen, isEditNoteOpen } = this.state
    return (
      <Provider>
        <Container>
          <Header hasBackButton noBorder title={title ? `Notes sur ${title}` : 'Chargement...'} />
          <Menu
            visible={isModalOpen}
            onDismiss={this.closeModal}
            anchor={<View />}
          >
            <Menu.Item onPress={this.toggleEditNote} title='Éditer' />
            <Menu.Item onPress={this.deleteNote} title='Supprimer' />
          </Menu>
          <FlatList data={notes}
            renderItem={this.renderNote.bind(this)}
            keyExtractor={(item, index) => index.toString()}
            style={{ paddingBottom: 30 }}
          />
          <BibleNoteModal
            onClosed={this.toggleEditNote}
            isOpen={isEditNoteOpen}
          />
        </Container>
      </Provider>
    )
  }
}

export default connect(
  (state) => ({
    notes: state.user.bible.notes
  })
)(BibleVerseNotes)
