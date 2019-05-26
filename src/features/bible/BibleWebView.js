import React, { Component, createRef } from 'react'
import { WebView } from 'react-native'

import bibleWebView from './bibleWebView/dist/index.html'
import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  SEND_INITIAL_DATA,
  TOGGLE_SELECTED_VERSE,
  CONSOLE_LOG
} from './bibleWebView/src/dispatch'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
class BibleWebView extends Component {
  webViewRef = createRef();

  dispatchToWebView = (message) => {
    const webView = this.webViewRef.current

    if (webView === null) {
      return
    }

    webView.postMessage(JSON.stringify(message))
  }

  state = {
    webViewOpacity: 0
  }

  componentDidMount () {
    this.enableWebViewOpacity()
  }

  enableWebViewOpacity = async () => {
    await sleep(500)
    this.setState({ webViewOpacity: 1 })
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
      case NAVIGATE_TO_VERSE_NOTES: {
        const { navigation } = this.props
        navigation.navigate('BibleVerseNotes', { verse: action.payload })
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
      case CONSOLE_LOG: {
        console.log(action.payload)
      }
    }
  }

  isVerseSelected = (verseId) => {
    const { selectedVerses } = this.props
    return !!selectedVerses[verseId]
  }

  sendDataToWebView = () => {
    const {
      arrayVerses,
      selectedVerses,
      highlightedVerses,
      notedVerses,
      settings,
      verseToScroll
    } = this.props

    this.dispatchToWebView({
      type: SEND_INITIAL_DATA,
      verses: arrayVerses,
      selectedVerses,
      highlightedVerses,
      notedVerses,
      settings,
      verseToScroll
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
        style={{ opacity: this.state.webViewOpacity }}
      />
    )
  }
}

export default BibleWebView
