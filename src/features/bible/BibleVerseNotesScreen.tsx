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

import * as UserActions from '~redux/modules/user'

import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'
import verseToReference from '~helpers/verseToReference'
import { withTranslation } from 'react-i18next'
import compose from 'recompose/compose'

class BibleVerseNotes extends Component {
  componentDidMount() {
    this.loadPage(this.props)
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.loadPage(nextProps)
  }

  state = {
    title: '',
    notes: [],
    noteVerses: null,
    isTagsOpen: false,
    selectedChip: null,
    isNoteSettingsOpen: false,
  }

  setTagsIsOpen = value => this.setState({ isTagsOpen: value })

  setSelectedChip = value => this.setState({ selectedChip: value })

  setNoteSettings = value => this.setState({ isNoteSettingsOpen: value })

  loadPage = async props => {
    const { verse } = props.navigation.state.params || {}
    let title
    const notes = []

    if (verse) {
      title = verseToReference(verse)
      title = `${props.t('Notes sur')} ${title}...`
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
    this.setState({ noteVerses })
  }

  closeNoteEditor = () => {
    this.setState({ noteVerses: undefined })
  }

  deleteNote = noteId => {
    const { t } = this.props
    Alert.alert(
      t('Attention'),
      t('Voulez-vous vraiment supprimer cette note?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => this.props.deleteNote(noteId),
          style: 'destructive',
        },
      ]
    )
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
    } = this.state

    const filteredNotes = notes.filter(s =>
      selectedChip ? s.notes.tags && s.notes.tags[selectedChip.id] : true
    )

    return (
      <Container>
        {verse ? (
          <Header
            hasBackButton={withBack}
            title={title || this.props.t('Chargement...')}
          />
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
            message={this.props.t("Vous n'avez pas encore de notes...")}
          />
        )}
        <BibleNoteModal
          onClosed={this.closeNoteEditor}
          noteVerses={this.state.noteVerses}
        />
        <TagsModal
          isVisible={isTagsOpen}
          onClosed={() => this.setTagsIsOpen(false)}
          onSelected={chip => this.setSelectedChip(chip)}
          selectedChip={selectedChip}
        />
        <BibleNotesSettingsModal
          isOpen={isNoteSettingsOpen}
          onClosed={() => this.setNoteSettings(false)}
          openNoteEditor={this.openNoteEditor}
        />
      </Container>
    )
  }
}

export default compose(
  connect(
    state => ({
      notes: state.user.bible.notes,
    }),
    UserActions
  ),
  withTranslation()
)(BibleVerseNotes)
