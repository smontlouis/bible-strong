// @flow
import React, { Component } from 'react'
import { View, StyleSheet } from 'react-native'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { pure, compose } from 'recompose'

import Loading from '~common/Loading'
import BibleFooter from './BibleFooter'
import BibleWebView from './BibleWebView'
import SelectedVersesModal from './SelectedVersesModal'

import loadBible from '~helpers/loadBible'
import * as BibleActions from '~redux/modules/bible'
import * as UserActions from '~redux/modules/user'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollView: {
    paddingTop: 30,
    paddingBottom: 60

  },
  textContainer: {
    maxWidth: 320,
    width: '100%'
  },
  fixedButton: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0
  },
  webView: {
    alignItems: 'stretch'
  }
})

class BibleViewer extends Component {
  state = {
    isLoading: true,
    verses: []
  }

  componentWillMount () {
    setTimeout(() => this.loadVerses(), 500)
    this.props.clearSelectedVerses()
  }

  componentWillReceiveProps (oldProps) {
    if (
      this.props.chapter !== oldProps.chapter ||
      this.props.book.Numero !== oldProps.book.Numero ||
      this.props.version !== oldProps.version
    ) {
      setTimeout(() => this.loadVerses(), 0)
      this.props.clearSelectedVerses()
    }

    // Scroll ONLY when verse change ALONE
    if (
      this.props.verse !== oldProps.verse &&
      this.props.chapter === oldProps.chapter &&
      this.props.book.Numero === oldProps.book.Numero
    ) {
      setTimeout(() => this.scrollToVerse(), 0)
    }
  }

  // DEPECRATED, SCROLL IN WEBVIEW
  scrollToVerse = () => {

  }

  loadVerses = async () => {
    const { book, chapter, version } = this.props
    let tempVerses
    this.setState({ isLoading: true })

    const res = await loadBible(version)
    const versesByChapter = res[book.Numero][chapter]
    tempVerses = []
    tempVerses = Object.keys(versesByChapter).map(v => ({
      Verset: v,
      Texte: versesByChapter[v],
      Livre: book.Numero,
      Chapitre: chapter
    }))
    this.setState({ isLoading: false, verses: tempVerses })
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

  renderVerses = () => {
    const {
      arrayVerses,
      book,
      chapter,
      navigation,
      addSelectedVerse,
      removeSelectedVerse,
      setSelectedVerse,
      selectedVerses,
      highlightedVerses
    } = this.props
    let array = this.state.verses

    if (
      arrayVerses &&
      book.Numero === arrayVerses.book.Numero &&
      chapter === arrayVerses.chapter
    ) {
      array = array.filter(v =>
        arrayVerses.verses.find(aV => aV === Number(v.Verset))
      )
    }

    return (
      <BibleWebView
        navigation={navigation}
        arrayVerses={array}
        addSelectedVerse={addSelectedVerse}
        removeSelectedVerse={removeSelectedVerse}
        setSelectedVerse={setSelectedVerse}
        selectedVerses={selectedVerses}
        highlightedVerses={highlightedVerses}
      />
    )
  }

  render () {
    const { isLoading } = this.state
    const {
      book,
      chapter,
      goToPrevChapter,
      goToNextChapter,
      isReadOnly,
      modalIsVisible,
      isSelectedVerseHighlighted,
      addHighlight,
      removeHighlight,
      clearSelectedVerses,
      navigation,
      selectedVerses
    } = this.props

    if (isLoading) {
      return <Loading />
    }

    return (
      <View style={styles.container}>
        {this.renderVerses()}
        {!isReadOnly && (
          <BibleFooter
            disabled={isLoading}
            book={book}
            chapter={chapter}
            goToPrevChapter={goToPrevChapter}
            goToNextChapter={goToNextChapter}
          />
        )}
        <SelectedVersesModal
          navigation={navigation}
          selectedVerses={selectedVerses}
          setSelectedVerse={this.props.setSelectedVerse}
          isVisible={modalIsVisible}
          isSelectedVerseHighlighted={isSelectedVerseHighlighted}
          addHighlight={addHighlight}
          removeHighlight={removeHighlight}
          clearSelectedVerses={clearSelectedVerses}
        />
      </View>
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
      isSelectedVerseHighlighted: !!getHighlightInSelected(state)
    }),
    { ...BibleActions, ...UserActions }
  )
)(BibleViewer)
