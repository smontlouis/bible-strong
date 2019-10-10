import React, { Component } from 'react'
import { Alert } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { WebView } from 'react-native-webview'
import AssetUtils from 'expo-asset-utils'
import * as Animatable from 'react-native-animatable'
// import * as Haptics from 'expo-haptics'
import * as Sentry from 'sentry-expo'

import {
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  SEND_INITIAL_DATA,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE,
  CONSOLE_LOG,
  THROW_ERROR
} from './bibleWebView/src/dispatch'

const INJECTED_JAVASCRIPT = `(function() {
  // This is the important part!
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window['ReactABI33_0_0NativeWebView'];
  }
  // End of the important part! Now continue using it as usual
})();`

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
class BibleWebView extends Component {
  webview = null

  state = {
    isHTMLFileLoaded: false
  }

  dispatchToWebView = message => {
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
    webViewOpacity: 0,
    isHTMLFileLoaded: false
  }

  componentDidMount() {
    this.enableWebViewOpacity()
    this.loadHTMLFile()
  }

  loadHTMLFile = async () => {
    const { localUri } = await AssetUtils.resolveAsync(require('./bibleWebView/dist/index.html'))
    this.HTMLFile = await FileSystem.readAsStringAsync(localUri)
    this.setState({ isHTMLFileLoaded: true })
  }

  injectFont = async () => {
    const { localUri } = await AssetUtils.resolveAsync(require('~assets/fonts/LiterataBook.otf'))

    const fontRule = `@font-face { font-family: 'LiterataBook'; src: local('LiterataBook'), url('${localUri}') format('opentype');}`

    this.webview.injectJavaScript(`
    (function() {
      setTimeout(() => {
        var style = document.createElement("style");
        style.innerHTML = "${fontRule}";
        document.head.appendChild(style);
      }, 0)
    })()
    `)
  }

  enableWebViewOpacity = async () => {
    await sleep(500)
    this.setState({ webViewOpacity: 1 })
  }

  componentDidUpdate() {
    this.sendDataToWebView()
  }

  // Receives all data from webview
  receiveDataFromWebView = e => {
    const action = JSON.parse(e.nativeEvent.data)

    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        const { navigation } = this.props
        const { Livre, Chapitre, Verset } = action.params.verse
        navigation.navigate({
          routeName: 'BibleVerseDetail',
          params: action.params,
          key: `bible-verse-detail-${Livre}-${Chapitre}-${Verset}`
        })

        break
      }
      case NAVIGATE_TO_VERSE_NOTES: {
        const { navigation } = this.props
        navigation.navigate('BibleVerseNotes', {
          verse: action.payload,
          withBack: true
        })
        break
      }
      case TOGGLE_SELECTED_VERSE: {
        // try {
        //   Platform.OS === 'ios' ? Haptics.selectionAsync() : Vibration.vibrate(5)
        // } catch (e) {
        //   console.log('No vibration')
        // }
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
        break
      }
      case THROW_ERROR: {
        Alert.alert(
          `Une erreur est survenue, impossible de charger la bible: ${action.payload} \n Le développeur en a été informé.`
        )
        console.log('WEBVIEW: ', action.payload)
        Sentry.captureMessage(action.payload)
        break
      }
      default: {
        break
      }
    }
  }

  isVerseSelected = verseId => {
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
      chapter,
      isSelectionMode
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
      chapter,
      isSelectionMode
    })
  }

  render() {
    if (!this.state.isHTMLFileLoaded) {
      return null
    }

    return (
      <Animatable.View
        transition="opacity"
        style={{
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          overflow: 'hidden',
          flex: 1,
          opacity: this.state.webViewOpacity
        }}>
        <WebView
          useWebKit
          onLoad={this.sendDataToWebView}
          onLoadEnd={this.injectFont}
          onMessage={this.receiveDataFromWebView}
          originWhitelist={['*']}
          ref={ref => {
            this.webview = ref
          }}
          onError={syntheticEvent => {
            const { nativeEvent } = syntheticEvent
            console.warn('WebView error: ', nativeEvent)
          }}
          source={{ html: this.HTMLFile }}
          injectedJavaScript={INJECTED_JAVASCRIPT}
          domStorageEnabled
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          allowFileAccess
        />
      </Animatable.View>
    )
  }
}

export default BibleWebView
