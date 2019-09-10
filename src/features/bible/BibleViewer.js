// @flow
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { pure, compose } from 'recompose'
import styled from '@emotion/native'
import Sentry from 'sentry-expo'

import Empty from '~common/Empty'
import getBiblePericope from '~helpers/getBiblePericope'
import Button from '~common/ui/Button'
import MultipleTagsModal from '~common/MultipleTagsModal'
import QuickTagsModal from '~common/QuickTagsModal'
import loadBible from '~helpers/loadBible'
import * as BibleActions from '~redux/modules/bible'
import * as UserActions from '~redux/modules/user'

import BibleNoteModal from './BibleNoteModal'
import BibleFooter from './BibleFooter'
import BibleWebView from './BibleWebView'
import SelectedVersesModal from './SelectedVersesModal'

const Container = styled.View({
  flex: 1,
  overflow: 'hidden'
})

const ReadMeButton = styled(Button)({
  marginBottom: 10
})

const getPericopeChapter = (pericope, book, chapter) => {
  if (pericope[book] && pericope[book][chapter] && pericope[book][chapter]) {
    return pericope[book][chapter]
  }

  return {}
}

class BibleViewer extends Component {
  state = {
    error: false,
    isLoading: true,
    verses: [],
    multipleTagsItem: false,
    quickTagsModal: false,
    isCreateNoteOpen: false,
    noteVerses: null
  }

  pericope = getBiblePericope('LSG')

  componentWillMount() {
    setTimeout(() => {
      this.loadVerses().catch(() => {
        this.setState({ error: true, isLoading: false })
      })
    }, 200)
    this.props.clearSelectedVerses()
  }

  componentWillReceiveProps(oldProps) {
    if (
      this.props.chapter !== oldProps.chapter ||
      this.props.book.Numero !== oldProps.book.Numero ||
      this.props.version !== oldProps.version
    ) {
      setTimeout(() => {
        this.loadVerses().catch(() => {
          this.setState({ error: true, isLoading: false })
        })
      }, 0)
      this.props.clearSelectedVerses()
    }
  }

  loadVerses = async () => {
    const { book, chapter, version, verse } = this.props
    this.pericope = getBiblePericope(version)
    let tempVerses
    this.setState({ isLoading: true })

    const res = await loadBible(version)
    const versesByChapter = res[book.Numero][chapter]

    if (!versesByChapter) {
      throw new Error('I crashed!')
    }

    tempVerses = []
    tempVerses = Object.keys(versesByChapter).map(v => ({
      Verset: v,
      Texte: versesByChapter[v],
      Livre: book.Numero,
      Chapitre: chapter
    }))
    this.setState({ isLoading: false, verses: tempVerses, error: false })
    this.props.setHistory({
      book: book.Numero,
      chapter,
      verse,
      version,
      type: 'verse'
    })
    Sentry.captureBreadcrumb({
      category: 'bible viewer',
      message: 'Load verses',
      data: { book: book.Numero, chapter, verse, version }
    })
  }

  openInBibleTab = () => {
    const { book, chapter, verse, navigation, setAllAndValidateSelected, version } = this.props
    setAllAndValidateSelected({
      book,
      chapter,
      verse,
      version
    })
    navigation.navigate('Bible')
  }

  addHiglightAndOpenQuickTags = color => {
    const { addHighlight, selectedVerses } = this.props

    setTimeout(() => {
      this.setQuickTagsModal({ ids: selectedVerses, entity: 'highlights' })
    }, 300)

    addHighlight(color)
  }

  toggleCreateNote = () => {
    this.setState(state => ({ isCreateNoteOpen: !state.isCreateNoteOpen, noteVerses: null }))
  }

  openNoteModal = noteId => {
    const noteVerses = noteId.split('/').reduce((accuRefs, key) => {
      accuRefs[key] = true
      return accuRefs
    }, {})
    this.setState(state => ({ isCreateNoteOpen: !state.isCreateNoteOpen, noteVerses }))
  }

  setMultipleTagsItem = value => this.setState({ multipleTagsItem: value })

  setQuickTagsModal = value => this.setState({ quickTagsModal: value })

  onSaveNote = id => {
    setTimeout(() => {
      this.setQuickTagsModal({ id, entity: 'notes' })
    }, 300)
  }

  render() {
    const { isLoading, error, quickTagsModal, multipleTagsItem } = this.state
    const {
      book,
      chapter,
      goToPrevChapter,
      goToNextChapter,
      isReadOnly,
      isSelectionMode,
      modalIsVisible,
      isSelectedVerseHighlighted,
      removeHighlight,
      clearSelectedVerses,
      navigation,
      selectedVerses,
      version,
      addSelectedVerse,
      removeSelectedVerse,
      setSelectedVerse,
      highlightedVerses,
      notedVerses,
      settings,
      verse,
      arrayVerses
    } = this.props

    let array = this.state.verses

    // When opening some verses, not whole chapter
    if (arrayVerses) {
      array = array.filter(v =>
        arrayVerses.find(aV => aV === `${v.Livre}-${v.Chapitre}-${v.Verset}`)
      )
    }

    // TODO: At some point, send to WebView ONLY chapter based elements (notes, highlighted...)
    return (
      <Container>
        {error && (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Désolé ! Ce chapitre n'existe pas dans cette version"
          />
        )}
        {!error && (
          <BibleWebView
            isLoading={isLoading}
            navigation={navigation}
            addSelectedVerse={addSelectedVerse}
            removeSelectedVerse={removeSelectedVerse}
            setSelectedVerse={setSelectedVerse}
            version={version}
            isReadOnly={isReadOnly}
            isSelectionMode={isSelectionMode}
            arrayVerses={array}
            selectedVerses={selectedVerses}
            highlightedVerses={highlightedVerses}
            notedVerses={notedVerses}
            settings={settings}
            verseToScroll={verse}
            chapter={chapter}
            pericopeChapter={getPericopeChapter(this.pericope, book.Numero, chapter)}
            openNoteModal={this.openNoteModal}
          />
        )}
        {!isReadOnly && (
          <BibleFooter
            disabled={isLoading}
            book={book}
            chapter={chapter}
            goToPrevChapter={goToPrevChapter}
            goToNextChapter={goToNextChapter}
          />
        )}
        {isReadOnly && <ReadMeButton title="Ouvrir dans Bible" onPress={this.openInBibleTab} />}
        {modalIsVisible && (
          <SelectedVersesModal
            isSelectionMode={isSelectionMode}
            setSelectedVerse={this.props.setSelectedVerse}
            onCreateNoteClick={this.toggleCreateNote}
            isVisible={modalIsVisible}
            isSelectedVerseHighlighted={isSelectedVerseHighlighted}
            addHighlight={this.addHiglightAndOpenQuickTags}
            removeHighlight={removeHighlight}
            clearSelectedVerses={clearSelectedVerses}
            navigation={navigation}
            selectedVerses={selectedVerses}
            version={version}
          />
        )}
        <QuickTagsModal
          item={quickTagsModal}
          onClosed={() => this.setQuickTagsModal(false)}
          setMultipleTagsItem={this.setMultipleTagsItem}
        />
        <MultipleTagsModal
          multiple
          item={multipleTagsItem}
          onClosed={() => this.setMultipleTagsItem(false)}
        />
        {this.state.isCreateNoteOpen && (
          <BibleNoteModal
            onClosed={this.toggleCreateNote}
            isOpen={this.state.isCreateNoteOpen}
            noteVerses={this.state.noteVerses}
            onSaveNote={this.onSaveNote}
          />
        )}
      </Container>
    )
  }
}

const getSelectedVerses = state => state.bible.selectedVerses
const getHighlightedVerses = state => state.user.bible.highlights

const getHighlightInSelected = createSelector(
  [getSelectedVerses, getHighlightedVerses],
  (selected, highlighted) => Object.keys(selected).find(s => highlighted[s])
)

export default compose(
  pure,
  connect(
    state => ({
      modalIsVisible: !!Object.keys(state.bible.selectedVerses).length,
      selectedVerses: state.bible.selectedVerses,
      highlightedVerses: state.user.bible.highlights,
      notedVerses: state.user.bible.notes,
      isSelectedVerseHighlighted: !!getHighlightInSelected(state)
    }),
    { ...BibleActions, ...UserActions }
  )
)(BibleViewer)
