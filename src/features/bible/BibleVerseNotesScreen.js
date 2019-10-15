import React, { Component } from 'react'
import { Alert } from 'react-native'
import { connect } from 'react-redux'

import BibleNoteModal from './BibleNoteModal'
import BibleNoteItem from './BibleNoteItem'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import Header from '~common/Header'
import Empty from '~common/Empty'
import MultipleTagsModal from '~common/MultipleTagsModal'

import * as BibleActions from '~redux/modules/bible'
import * as UserActions from '~redux/modules/user'

import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'
import verseToReference from '~helpers/verseToReference'

class BibleVerseNotes extends Component {
  componentDidMount() {
    this.loadPage(this.props)
  }

  componentWillReceiveProps(nextProps) {
    this.loadPage(nextProps)
  }

  state = {
    title: '',
    notes: [],
    isEditNoteOpen: false,
    noteVerses: null,
    isTagsOpen: false,
    selectedChip: null,
    isNoteSettingsOpen: false,
    multipleTagsItem: false
  }

  setTagsIsOpen = value => this.setState({ isTagsOpen: value })

  setSelectedChip = value => this.setState({ selectedChip: value })

  setNoteSettings = value => this.setState({ isNoteSettingsOpen: value })

  setMultipleTagsItem = value => this.setState({ multipleTagsItem: value })

  loadPage = async props => {
    const { verse } = props.navigation.state.params || {}
    let title
    const notes = []

    if (verse) {
      title = verseToReference(verse)
      title = `Notes sur ${title}...`
    } else {
      title = 'Notes'
    }

    await Promise.all(
      Object.entries(props.notes)
        .filter(note => {
          if (verse) {
            const firstVerseRef = note[0].split('/')[0]
            return firstVerseRef === verse
          }
          return true
        })
        .map(note => {
          const verseNumbers = {}
          note[0].split('/').map(ref => {
            verseNumbers[ref] = true
          })

          const reference = verseToReference(verseNumbers)
          notes.push({ noteId: note[0], reference, notes: note[1] })
        })
    )
    this.setState({ title, notes })
  }

  openNoteEditor = noteId => {
    const noteVerses = noteId.split('/').reduce((accuRefs, key) => {
      accuRefs[key] = true
      return accuRefs
    }, {})
    this.setState({ isEditNoteOpen: true, noteVerses })
  }

  closeNoteEditor = () => {
    this.setState({ isEditNoteOpen: false })
  }

  deleteNote = noteId => {
    Alert.alert('Attention', 'Voulez-vous vraiment supprimer cette note?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      { text: 'Oui', onPress: () => this.props.deleteNote(noteId), style: 'destructive' }
    ])
  }

  renderNote = ({ item, index }) => {
    return (
      <BibleNoteItem
        key={index}
        item={item}
        openNoteEditor={this.openNoteEditor}
        setNoteSettings={this.setNoteSettings}
        deleteNote={this.deleteNote}
      />
    )
  }

  render() {
    const { withBack, verse } = this.props.navigation.state.params || {}
    const {
      title,
      notes,
      isTagsOpen,
      selectedChip,
      isNoteSettingsOpen,
      multipleTagsItem
    } = this.state

    const filteredNotes = notes.filter(s =>
      selectedChip ? s.notes.tags && s.notes.tags[selectedChip.id] : true
    )

    return (
      <Container>
        {verse ? (
          <Header hasBackButton={withBack} title={title || 'Chargement...'} />
        ) : (
          <TagsHeader
            title="Notes"
            setIsOpen={this.setTagsIsOpen}
            isOpen={isTagsOpen}
            selectedChip={selectedChip}
            hasBackButton
          />
        )}
        {filteredNotes.length ? (
          <FlatList
            data={filteredNotes}
            renderItem={this.renderNote}
            keyExtractor={(item, index) => index.toString()}
            style={{ paddingBottom: 30 }}
          />
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Vous n'avez pas encore de notes..."
          />
        )}
        {this.state.isEditNoteOpen && (
          <BibleNoteModal
            onClosed={this.closeNoteEditor}
            isOpen={this.state.isEditNoteOpen}
            noteVerses={this.state.noteVerses}
          />
        )}
        <TagsModal
          isVisible={isTagsOpen}
          onClosed={() => this.setTagsIsOpen(false)}
          onSelected={chip => this.setSelectedChip(chip)}
          selectedChip={selectedChip}
        />
        <BibleNotesSettingsModal
          isOpen={isNoteSettingsOpen}
          onClosed={() => this.setNoteSettings(false)}
          setMultipleTagsItem={this.setMultipleTagsItem}
          openNoteEditor={this.openNoteEditor}
        />
        <MultipleTagsModal
          multiple
          item={multipleTagsItem}
          onClosed={() => this.setMultipleTagsItem(false)}
        />
      </Container>
    )
  }
}

export default connect(
  state => ({
    notes: state.user.bible.notes
  }),
  { ...BibleActions, ...UserActions }
)(BibleVerseNotes)
