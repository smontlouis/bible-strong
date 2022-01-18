import React, { Component } from 'react'
import { Alert, View, Platform } from 'react-native'
import * as AssetUtils from 'expo-asset-utils'
import { WebView } from 'react-native-webview'
import * as Sentry from '@sentry/react-native'

import literata from '../../assets/fonts/literata'
import books from '~assets/bible_versions/books'
import SnackBar from '~common/SnackBar'
import {
  NAVIGATE_TO_VERSION,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_VERSE_NOTES,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_BIBLE_VIEW,
  SEND_INITIAL_DATA,
  TOGGLE_SELECTED_VERSE,
  NAVIGATE_TO_BIBLE_NOTE,
  CONSOLE_LOG,
  NAVIGATE_TO_STRONG,
  THROW_ERROR,
  REMOVE_PARALLEL_VERSION,
  ADD_PARALLEL_VERSION,
  SWIPE_RIGHT,
  SWIPE_LEFT,
  OPEN_HIGHLIGHT_TAGS,
} from './bibleWebView/src/dispatch'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
class BibleWebView extends Component {
  webview = null

  state = {
    isHTMLFileLoaded: false,
  }

  dispatchToWebView = message => {
    if (this.webview === null) {
      return
    }

    const run = `
      (function() {
        document.dispatchEvent(new MessageEvent('message', {data: ${JSON.stringify(
          message
        )}}));
      })();
      true;
    `

    setTimeout(() => {
      this?.webview?.injectJavaScript(run)
    }, 0)
  }

  state = {
    webViewOpacity: 0,
    isHTMLFileLoaded: false,
  }

  componentDidMount() {
    this.enableWebViewOpacity()
    this.loadHTMLFile()
  }

  loadHTMLFile = async () => {
    const { localUri: fileUri } = await AssetUtils.resolveAsync(
      require('~assets/fonts/FiraCode-Regular.otf')
    ).catch(e => {
      SnackBar.show('Erreur lors de la lecture du fichier')
      Sentry.captureException(e)
    })

    this.fileUri = fileUri

    this.setState({ isHTMLFileLoaded: true })
  }

  injectFont = () => {
    const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

    return `
        var style = document.createElement("style");
        style.innerHTML = "${fontRule}";
        document.head.appendChild(style);
        true;
    `
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
          key: `bible-verse-detail-${Livre}-${Chapitre}-${Verset}`,
        })

        break
      }
      case NAVIGATE_TO_VERSE_NOTES: {
        const { navigation } = this.props
        navigation.navigate('BibleVerseNotes', {
          verse: action.payload,
          withBack: true,
        })
        break
      }
      case NAVIGATE_TO_PERICOPE: {
        const { navigation } = this.props
        navigation.navigate('Pericope')
        break
      }
      case NAVIGATE_TO_VERSION: {
        const { navigation } = this.props
        const { version, index } = action.payload

        // index = 0 is Default one
        navigation.navigate('VersionSelector', {
          version,
          parallelVersionIndex: index === 0 ? undefined : index - 1,
        })
        break
      }
      case REMOVE_PARALLEL_VERSION: {
        const { removeParallelVersion } = this.props
        removeParallelVersion(action.payload - 1)
        break
      }
      case ADD_PARALLEL_VERSION: {
        const { addParallelVersion } = this.props
        addParallelVersion()
        break
      }
      case NAVIGATE_TO_STRONG: {
        const { setSelectedCode } = this.props
        setSelectedCode(action.payload) // { reference, book }
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
      case NAVIGATE_TO_BIBLE_VIEW: {
        const { navigation } = this.props
        const book = Object.keys(books).find(
          key => books[key][0].toUpperCase() === action.bookCode
        )

        if (!book) {
          SnackBar.show("Erreur lors de l'ouverture du verset")
          Sentry.captureMessage(JSON.stringify(action))
          return
        }

        navigation.navigate({
          routeName: 'BibleView',
          params: {
            isReadOnly: true,
            book: parseInt(book, 10),
            chapter: parseInt(action.chapter, 10),
            verse: parseInt(action.verse, 10),
          },
          key: `bible-view-${book}-${action.chapter}-${action.verse}`,
        })
        break
      }
      case CONSOLE_LOG: {
        console.log(
          `WEBVIEW: %c${action.payload}`,
          'color:black;background-color:#81ecec'
        )
        break
      }
      case SWIPE_LEFT: {
        const { goToNextChapter, book, chapter } = this.props
        const hasNextChapter = !(book.Numero === 66 && chapter === 22)

        if (hasNextChapter) {
          goToNextChapter()
        }
        break
      }
      case SWIPE_RIGHT: {
        const { goToPrevChapter, book, chapter } = this.props
        const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)

        if (hasPreviousChapter) {
          goToPrevChapter()
        }
        break
      }
      case OPEN_HIGHLIGHT_TAGS: {
        const { setMultipleTagsItem } = this.props
        const { verseIds } = action.payload
        const obj = {
          entity: 'highlights',
          ids: Object.fromEntries(verseIds.map(v => [v, true])),
        }
        setMultipleTagsItem(obj)
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
      verses,
      parallelVerses,
      focusVerses,
      secondaryVerses,
      selectedVerses,
      highlightedVerses,
      notedVerses,
      settings,
      verseToScroll,
      isReadOnly,
      version,
      pericopeChapter,
      chapter,
      isSelectionMode,
      selectedCode,
      comments,
      fontFamily,
    } = this.props

    this.dispatchToWebView({
      type: SEND_INITIAL_DATA,
      verses,
      parallelVerses,
      focusVerses,
      secondaryVerses,
      selectedVerses,
      highlightedVerses,
      notedVerses,
      settings,
      verseToScroll,
      isReadOnly,
      version,
      pericopeChapter,
      chapter,
      isSelectionMode,
      selectedCode,
      comments,
      fontFamily,
    })
  }

  render() {
    return (
      <View
        style={{
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          overflow: 'hidden',
          flex: 1,
          opacity: this.state.webViewOpacity,
        }}
      >
        {this.state.isHTMLFileLoaded && (
          <WebView
            style={{ backgroundColor: 'transparent' }}
            onLoad={this.sendDataToWebView}
            onMessage={this.receiveDataFromWebView}
            originWhitelist={['*']}
            ref={ref => {
              this.webview = ref
            }}
            onError={syntheticEvent => {
              const { nativeEvent } = syntheticEvent
              console.warn('WebView error: ', nativeEvent)
            }}
            source={
              Platform.OS === 'android'
                ? { uri: 'file:///android_asset/index.html' }
                : require('./bibleWebView/dist/index.html')
            }
            injectedJavaScript={this.injectFont()}
            domStorageEnabled
            allowUniversalAccessFromFileURLs
            allowFileAccessFromFileURLs
            allowFileAccess
            onContentProcessDidTerminate={e => {
              console.warn('Content process terminated, reloading...')
              this.webview?.reload()
              Sentry.captureException(e)
            }}
            onRenderProcessGone={e => {
              this.webview?.reload()
              Sentry.captureException(e)
            }}
          />
        )}
      </View>
    )
  }
}

export default BibleWebView
