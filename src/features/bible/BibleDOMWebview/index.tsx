import * as Sentry from '@sentry/react-native'
import { Component } from 'react'
import { Alert, View } from 'react-native'
import { WebView } from 'react-native-webview'

import books from '../../../assets/bible_versions/books'
import SnackBar from '../../../common/SnackBar'
import { WebViewProps } from '../BibleDOM/BibleDOMWrapper'
import {
  ADD_PARALLEL_VERSION,
  NAVIGATE_TO_BIBLE_NOTE,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_BIBLE_VIEW,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_STRONG,
  NAVIGATE_TO_VERSE_NOTES,
  NAVIGATE_TO_VERSION,
  OPEN_HIGHLIGHT_TAGS,
  REMOVE_PARALLEL_VERSION,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  TOGGLE_SELECTED_VERSE,
} from '../BibleDOM/dispatch'
import bibleHTML from './bibleHTML'
import literata from './literata.js'

class BibleWebView extends Component<WebViewProps> {
  webview: WebView | null = null

  dispatchToWebView = (message: any) => {
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

  injectFont = () => {
    const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

    return `
        var style = document.createElement("style");
        style.innerHTML = "${fontRule}";
        document.head.appendChild(style);
        true;
    `
  }

  componentDidUpdate() {
    this.sendDataToWebView()
  }

  // Receives all data from webview
  receiveDataFromWebView = (e: any) => {
    const action = JSON.parse(e.nativeEvent.data)

    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        const { onChangeResourceTypeSelectVerse } = this.props
        const { Livre, Chapitre, Verset } = action.params.verse
        console.log(`${Livre}-${Chapitre}-${Verset}`)
        onChangeResourceTypeSelectVerse(
          'strong',
          `${Livre}-${Chapitre}-${Verset}`
        )

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
        const { navigation, bibleAtom } = this.props
        const { version, index } = action.payload

        // index = 0 is Default one
        navigation.navigate('VersionSelector', {
          bibleAtom,
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

        navigation.navigate('BibleView', {
          isReadOnly: true,
          book: parseInt(book, 10),
          chapter: parseInt(action.chapter, 10),
          verse: parseInt(action.verse, 10),
        })

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

      default: {
        break
      }
    }
  }

  isVerseSelected = (verseId: any) => {
    const { selectedVerses } = this.props
    return !!selectedVerses[verseId]
  }

  sendDataToWebView = () => {
    const dispatch = () => {}

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
      version,
      pericopeChapter,
      chapter,
      isSelectionMode,
      selectedCode,
      comments,
      isReadOnly,
    } = this.props

    this.dispatchToWebView({
      type: 'SEND_INITIAL_DATA',
      verses,
      parallelVerses,
      focusVerses,
      secondaryVerses,
      selectedVerses,
      highlightedVerses,
      notedVerses,
      settings,
      verseToScroll,
      version,
      pericopeChapter,
      chapter,
      isSelectionMode,
      selectedCode,
      comments,
      isReadOnly,
      dispatch,
    })
  }

  render() {
    return null
    return (
      <View
        style={{
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          overflow: 'hidden',
          flex: 1,
        }}
      >
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
          source={{
            html: bibleHTML,
          }}
          injectedJavaScript={this.injectFont()}
          onContentProcessDidTerminate={syntheticEvent => {
            const { nativeEvent } = syntheticEvent
            console.warn('Content process terminated, reloading...')
            this.webview?.reload()
          }}
          onRenderProcessGone={syntheticEvent => {
            const { nativeEvent } = syntheticEvent
            this.webview?.reload()
          }}
        />
      </View>
    )
  }
}

export default BibleWebView
