import React, { Component, createRef } from 'react'
import { WebView } from 'react-native'

import bibleWebView from './bibleWebView/dist/index.html'
import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  SEND_INITIAL_DATA,
  TOGGLE_SELECTED_VERSE
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

  componentDidUpdate () {
    this.sendDataToWebView()
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
        const verseId = action.payload
        const { addSelectedVerse, removeSelectedVerse } = this.props

        if (this.isVerseSelected(verseId)) {
          removeSelectedVerse(verseId)
        } else {
          addSelectedVerse(verseId)
        }
        break
      }
    }
  }

  isVerseSelected = (verseId) => {
    const { selectedVerses } = this.props
    return !!selectedVerses[verseId]
  }

  sendDataToWebView = () => {
    const { arrayVerses, selectedVerses, highlightedVerses } = this.props

    this.dispatchToWebView({
      type: SEND_INITIAL_DATA,
      verses: arrayVerses,
      selectedVerses,
      highlightedVerses
    })
  }

  render () {
    return (
      <WebView
        useWebKit
        onLoad={this.sendDataToWebView}
        onMessage={this.receiveDataFromWebView}
        originWhitelist={['*']}
        ref={this.webViewRef}
        source={bibleWebView}
      />
    )
  }
}

export default BibleWebView
