import React, { Component } from 'react'
import * as Haptics from 'expo-haptics'
import { Vibration, Platform } from 'react-native'
import { WebView } from 'react-native-webview'

import bibleWebView from './bibleWebView/dist/index.html'

import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  SEND_INITIAL_DATA,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE,
  CONSOLE_LOG
} from './bibleWebView/src/dispatch'

const INJECTED_JAVASCRIPT = `(function() {
  // This is the important part!
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window['ReactABI33_0_0NativeWebView'];
  }
  // End of the important part! Now continue using it as usual
})();`

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
class BibleWebView extends Component {
  webview = null

  dispatchToWebView = (message) => {
    if (this.webview === null) {
      return
    }

    this.webview.injectJavaScript(`
    (function() {
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("messages", {
          detail: ${JSON.stringify(message)}
        }));
      }, 0)
    })()
    `)
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
        navigation.navigate('BibleVerseNotes', { verse: action.payload, withBack: true })
        break
      }
      case TOGGLE_SELECTED_VERSE: {
        try {
          Platform.OS === 'ios' ? Haptics.selectionAsync() : Vibration.vibrate(5)
        } catch (e) {
          console.log('No vibration')
        }
        const verseId = action.payload
        const { addSelectedVerse, removeSelectedVerse } = this.props

        if (this.isVerseSelected(verseId)) {
          removeSelectedVerse(verseId)
        } else {
          addSelectedVerse(verseId)
        }
        break
      }
      case NAVIGATE_TO_BIBLE_NOTE: {
        this.props.openNoteModal(action.payload)
        break
      }
      case CONSOLE_LOG: {
        console.log('WEBVIEW: ', action.payload)
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
      verseToScroll,
      isReadOnly,
      version,
      pericopeChapter,
      chapter
    } = this.props

    this.dispatchToWebView({
      type: SEND_INITIAL_DATA,
      verses: arrayVerses,
      selectedVerses,
      highlightedVerses,
      notedVerses,
      settings,
      verseToScroll,
      isReadOnly,
      version,
      pericopeChapter,
      chapter
    })
  }

  render () {
    return (
      <WebView
        useWebKit
        onLoad={this.sendDataToWebView}
        onMessage={this.receiveDataFromWebView}
        onError={(e) => console.log(e)}
        originWhitelist={['*']}
        ref={ref => (this.webview = ref)}
        source={bibleWebView}
        style={{ opacity: this.state.webViewOpacity }}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        domStorageEnabled
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        allowFileAccess
      />
    )
  }
}

export default BibleWebView
