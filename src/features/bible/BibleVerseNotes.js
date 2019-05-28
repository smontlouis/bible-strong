import React, { Component } from 'react'
import { FlatList, Alert } from 'react-native'
import { connect } from 'react-redux'

import BibleNoteModal from './BibleNoteModal'
import BibleNoteItem from './BibleNoteItem'
import getVersesRef from '~helpers/getVersesRef'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import * as BibleActions from '~redux/modules/bible'
import * as UserActions from '~redux/modules/user'

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
    isEditNoteOpen: false,
    noteVerses: {}
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
        notes.push({ noteId: note[0], reference, notes: note[1] })
      }
    }))
    if (!notes.length) props.navigation.goBack()
    else this.setState({ title, verse, notes })
  }

  openNoteEditor = (noteId) => {
    const noteVerses = noteId.split('/').reduce((accuRefs, key) => {
      accuRefs[key] = true
      return accuRefs
    }, {})
    this.setState({ isEditNoteOpen: true, noteVerses })
  }

  closeNoteEditor = () => { this.setState({ isEditNoteOpen: false }) }

  deleteNote = (noteId) => {
    Alert.alert('Attention', 'Voulez-vous vraiment supprimer cette note?',
      [ { text: 'Non', onPress: () => null, style: 'cancel' },
        { text: 'Oui', onPress: () => this.props.deleteNote(noteId) }
      ])
  }

  renderNote = ({ item, index }) => {
    return (
      <BibleNoteItem
        key={index}
        item={item}
        openNoteEditor={this.openNoteEditor}
        deleteNote={this.deleteNote}
      />
    )
  }

  render () {
    const { title, notes } = this.state
    return (
      <Container>
        <Header hasBackButton noBorder title={title ? `Notes sur ${title}` : 'Chargement...'} />
        <FlatList data={notes}
          renderItem={this.renderNote}
          keyExtractor={(item, index) => index.toString()}
          style={{ paddingBottom: 30 }}
        />
        <BibleNoteModal
          onClosed={this.closeNoteEditor}
          isOpen={this.state.isEditNoteOpen}
          noteVerses={this.state.noteVerses}
        />
      </Container>
    )
  }
}

export default connect(
  (state) => ({
    notes: state.user.bible.notes
  }),
  { ...BibleActions, ...UserActions }
)(BibleVerseNotes)
