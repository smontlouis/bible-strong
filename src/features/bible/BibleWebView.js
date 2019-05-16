import React, { Component, createRef } from 'react'
import { WebView } from 'react-native'
import { compose } from 'recompose'
import { connect } from 'react-redux'

import * as BibleActions from '~redux/modules/bible'
import bibleWebView from './bibleWebView/dist/index.html'
import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  SEND_INITIAL_DATA,
  TOGGLE_SELECTED_VERSE,
  SEND_HIGHLIGHTED_VERSES
} from './bibleWebView/src/dispatch'

class BibleWebView extends Component {
  webViewRef = createRef();

  dispatchToWebView = (message) => {
    const webView = this.webViewRef.current

    if (webView === null) {
      return
    }

    webView.postMessage(JSON.stringify(message))
  }

  // Receives all data from webview
  receiveDataFromWebView = (e) => {
    const action = JSON.parse(e.nativeEvent.data)

    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        const { setSelectedVerse, navigation } = this.props
        setSelectedVerse(Number(action.payload))
        navigation.navigate('BibleVerseDetail')
        break
      }
      case TOGGLE_SELECTED_VERSE: {
        console.log('Toggle', action.payload)
        const verseId = action.payload
        const { addSelectedVerse, removeSelectedVerse, highlightedVerses } = this.props
        if (this.isVerseSelected(verseId)) {
          console.log('remove')
          removeSelectedVerse(verseId)
        } else {
          console.log('add')
          addSelectedVerse(verseId)
        }

        this.dispatchToWebView({
          type: SEND_HIGHLIGHTED_VERSES,
          highlightedVerses
        })
        break
      }
    }
  }

  isVerseSelected = (verseId) => {
    const { highlightedVerses } = this.props
    return !!highlightedVerses[verseId]
  }

  onLoadWebView = () => {
    const { arrayVerses, highlightedVerses } = this.props

    this.dispatchToWebView({
      type: SEND_INITIAL_DATA,
      arrayVerses,
      highlightedVerses
    })
  }

  render () {
    return (
      <WebView
        useWebKit
        onLoad={this.onLoadWebView}
        onMessage={this.receiveDataFromWebView}
        originWhitelist={['*']}
        ref={this.webViewRef}
        source={bibleWebView}
      />
    )
  }
}

export default compose(
  connect(
    state => ({
      highlightedVerses: state.bible.highlightedVerses
    }),
    { ...BibleActions }
  )
)(BibleWebView)
