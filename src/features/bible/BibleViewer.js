// @flow
import React, { Component } from 'react'
import { ScrollView, View, StyleSheet, Button } from 'react-native'
import { connect } from 'react-redux'
import { pure, compose } from 'recompose'

import Loading from '~common/Loading'
import BibleVerse from './BibleVerse'
import BibleFooter from './BibleFooter'
// import SelectedVersesModal from '~common/SelectedVersesModal'

import loadBible from '~helpers/loadBible'
import * as BibleActions from '~redux/modules/bible'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollView: {
    paddingTop: 20,
    paddingBottom: 40
  },
  button: {
    marginTop: 10,
    marginBottom: 30,
    marginLeft: 20,
    backgroundColor: 'white',
    borderColor: 'red',
    borderRadius: 5,
    borderWidth: 2
  },
  buttonText: {
    color: 'red'
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

  getPosition = (numVerset: number, measures: Object) => {
    this.versesMeasure[`verse${numVerset}`] = measures
    // We need to wait 'til every Bible verse component get calculated
    if (Object.keys(this.versesMeasure).length === this.state.verses.length) {
      setTimeout(() => this.scrollToVerse(), 0)
    }
  }

  scrollToVerse = () => {
    const { verse } = this.props
    if (this.versesMeasure[`verse${verse}`] && this.scrollView) {
      const scrollHeight = this.contentHeight - this.scrollViewHeight + 20
      const y = verse === 1 ? 0 : this.versesMeasure[`verse${verse}`].py - 100

      this.scrollView.scrollTo({
        x: 0,
        y: y >= scrollHeight ? scrollHeight : y,
        animated: true
      })
    }
  }

  loadVerses = async () => {
    const { book, chapter, version } = this.props
    let tempVerses
    this.versesMeasure = {}

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

  renderVerses = () => {
    const {
      version,
      arrayVerses,
      book,
      chapter,
      navigation,
      isReadOnly
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

    return array.map(verse => (
      <BibleVerse
        isReadOnly={isReadOnly}
        navigation={navigation}
        version={version}
        verse={verse}
        key={`${verse.Verset}${verse.Livre}${verse.Chapitre}`}
        getPosition={this.getPosition}
      />
    ))
  }

  render () {
    const { isLoading } = this.state
    const {
      book,
      chapter,
      arrayVerses,
      navigation,
      goToPrevChapter,
      goToNextChapter,
      isReadOnly
    } = this.props

    if (isLoading) {
      return <Loading />
    }

    return (
      <View style={styles.container}>
        <ScrollView
          ref={r => {
            this.scrollView = r
          }}
          onContentSizeChange={(w, h) => {
            this.contentHeight = h
          }}
          onLayout={ev => {
            this.scrollViewHeight = ev.nativeEvent.layout.height
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollView}
        >
          {this.renderVerses()}
          {!!arrayVerses && (
            <Button
              title='Lire le chapitre entier'
              buttonStyle={styles.button}
              textStyle={styles.buttonText}
              onPress={() =>
                navigation.navigate('bible', {
                  hasBack: true,
                  verse: arrayVerses.verses[0]
                })
              }
            />
          )}
        </ScrollView>
        {!isReadOnly && (
          <BibleFooter
            disabled={isLoading}
            book={book}
            chapter={chapter}
            goToPrevChapter={goToPrevChapter}
            goToNextChapter={goToNextChapter}
          />
        )}
        {/* <SelectedVersesModal verses={this.state.verses} /> */}
      </View>
    )
  }
}

export default compose(
  pure,
  connect(
    null,
    BibleActions
  )
)(BibleViewer)
