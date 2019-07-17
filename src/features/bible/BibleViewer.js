// @flow
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { pure, compose } from 'recompose'
import styled from '@emotion/native'

import Empty from '~common/Empty'
import getBiblePericope from '~helpers/getBiblePericope'
import Button from '~common/ui/Button'
import BibleFooter from './BibleFooter'
import BibleWebView from './BibleWebView'
import SelectedVersesModal from './SelectedVersesModal'

import loadBible from '~helpers/loadBible'
import * as BibleActions from '~redux/modules/bible'
import * as UserActions from '~redux/modules/user'

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
    verses: []
  }

  pericope = getBiblePericope('LSG')

  componentWillMount () {
    setTimeout(() => {
      this.loadVerses().catch(e => {
        this.setState({ error: true, isLoading: false })
      })
    }, 200)
    this.props.clearSelectedVerses()
  }

  componentWillReceiveProps (oldProps) {
    if (
      this.props.chapter !== oldProps.chapter ||
      this.props.book.Numero !== oldProps.book.Numero ||
      this.props.version !== oldProps.version
    ) {
      setTimeout(() => {
        this.loadVerses().catch(e => {
          this.setState({ error: true, isLoading: false })
        })
      }, 0)
      this.props.clearSelectedVerses()
    }
  }

  loadVerses = async () => {
    const { book, chapter, version } = this.props
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
  }

  openInBibleTab = () => {
    const {
      book,
      chapter,
      verse,
      navigation,
      setAllAndValidateSelected
    } = this.props
    setAllAndValidateSelected({
      book,
      chapter,
      verse
    })
    navigation.navigate('Bible')
  }

  render () {
    const { isLoading, error } = this.state
    const {
      book,
      chapter,
      goToPrevChapter,
      goToNextChapter,
      isReadOnly,
      isSelectionMode,
      modalIsVisible,
      isSelectedVerseHighlighted,
      addHighlight,
      removeHighlight,
      clearSelectedVerses,
      navigation,
      selectedVerses,
      version,
      onCreateNoteClick,
      addSelectedVerse,
      removeSelectedVerse,
      setSelectedVerse,
      highlightedVerses,
      notedVerses,
      settings,
      verse,
      arrayVerses,
      openNoteModal
    } = this.props

    let array = this.state.verses

    // When opening some verses, not whole chapter
    if (
      arrayVerses &&
      book.Numero === arrayVerses.book.Numero &&
      chapter === arrayVerses.chapter
    ) {
      array = array.filter(v =>
        arrayVerses.verses.find(aV => aV === Number(v.Verset))
      )
    }

    // TODO: At some point, send to WebView ONLY chapter based elements (notes, highlighted...)
    return (
      <Container>
        {
          error &&
          <Empty
            source={require('~assets/images/empty.json')}
            message="Désolé ! Ce chapitre n'existe pas dans cette version"
          />
        }
        {
          !error &&
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
            openNoteModal={openNoteModal}
          />
        }
        {!isReadOnly && (
          <BibleFooter
            disabled={isLoading}
            book={book}
            chapter={chapter}
            goToPrevChapter={goToPrevChapter}
            goToNextChapter={goToNextChapter}
          />
        )}
        {isReadOnly && (
          <ReadMeButton
            title='Ouvrir dans Bible'
            onPress={this.openInBibleTab}
          />
        )}
        {
          modalIsVisible &&
          <SelectedVersesModal
            isSelectionMode={isSelectionMode}
            setSelectedVerse={this.props.setSelectedVerse}
            onCreateNoteClick={onCreateNoteClick}
            isVisible={modalIsVisible}
            isSelectedVerseHighlighted={isSelectedVerseHighlighted}
            addHighlight={addHighlight}
            removeHighlight={removeHighlight}
            clearSelectedVerses={clearSelectedVerses}
            navigation={navigation}
            selectedVerses={selectedVerses}
            version={version}
          />}
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
