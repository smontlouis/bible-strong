import React, { createRef } from 'react'
import { withNavigation } from 'react-navigation'
import { Platform, Alert, KeyboardAvoidingView, Keyboard } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { WebView } from 'react-native-webview'
import AssetUtils from 'expo-asset-utils'
import * as Sentry from '@sentry/react-native'

import books from '~assets/bible_versions/books-desc'
import literata from '~assets/fonts/literata'
import StudyFooter from './StudyFooter'

class WebViewQuillEditor extends React.Component {
  webViewRef = createRef()

  state = {
    isHTMLFileLoaded: false,
    isKeyboardOpened: false,
    activeFormats: {},
  }

  componentDidMount() {
    const updateListener =
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow'
    const resetListener =
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide'
    this._listeners = [
      Keyboard.addListener(updateListener, () =>
        this.setState({ isKeyboardOpened: true })
      ),
      Keyboard.addListener(resetListener, () =>
        this.setState({ isKeyboardOpened: false })
      ),
    ]

    this.loadHTMLFile()
  }

  loadHTMLFile = async () => {
    const { localUri } = await AssetUtils.resolveAsync(
      require('~features/studies/studiesWebView/dist/index.html')
    )
    this.HTMLFile = await FileSystem.readAsStringAsync(localUri)

    this.setState({ isHTMLFileLoaded: true })
  }

  componentDidUpdate(prevProps) {
    const oldParams = prevProps.params || {}
    const newParams = this.props.params || {}

    if (JSON.stringify(oldParams) !== JSON.stringify(newParams)) {
      if (newParams.type.includes('verse')) {
        const isBlock = newParams.type.includes('block')
        this.dispatchToWebView('FOCUS_EDITOR')
        this.dispatchToWebView(
          isBlock ? 'GET_BIBLE_VERSES_BLOCK' : 'GET_BIBLE_VERSES',
          newParams
        )
      } else {
        const isBlock = newParams.type.includes('block')
        this.dispatchToWebView('FOCUS_EDITOR')
        this.dispatchToWebView(
          isBlock ? 'GET_BIBLE_STRONG_BLOCK' : 'GET_BIBLE_STRONG',
          newParams
        )
      }
    }

    if (
      prevProps.isReadOnly !== this.props.isReadOnly &&
      !this.props.isReadOnly
    ) {
      this.dispatchToWebView('CAN_EDIT')
      this.dispatchToWebView('FOCUS_EDITOR')
    }

    if (
      prevProps.isReadOnly !== this.props.isReadOnly &&
      this.props.isReadOnly
    ) {
      this.dispatchToWebView('READ_ONLY')
      this.dispatchToWebView('BLUR_EDITOR')
    }
  }

  dispatchToWebView = (type, payload) => {
    const webView = this.webViewRef.current

    if (webView) {
      console.log('RN DISPATCH: ', type)

      webView.injectJavaScript(`
        (function() {
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent("messages", {
              detail: ${JSON.stringify({ type, payload })}
            }));
          }, 0)
        })()
      `)
    }
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

  setActiveFormats = (formats = {}) => {
    this.setState({ activeFormats: JSON.parse(formats) })
  }

  handleMessage = event => {
    const { navigation } = this.props
    let msgData
    try {
      msgData = JSON.parse(event.nativeEvent.data)
      // console.log('RN RECEIVE: ', msgData.type)

      switch (msgData.type) {
        case 'EDITOR_LOADED':
          this.editorLoaded()
          break
        case 'TEXT_CHANGED':
          if (this.props.onDeltaChangeCallback) {
            delete msgData.payload.type
            const {
              delta,
              deltaChange,
              deltaOld,
              changeSource,
            } = msgData.payload
            this.props.onDeltaChangeCallback(
              delta,
              deltaChange,
              deltaOld,
              changeSource
            )
          }
          break
        case 'VIEW_BIBLE_VERSE': {
          navigation.navigate('BibleView', {
            ...msgData.payload,
            arrayVerses: null, // Remove arrayVerses
            book: books[msgData.payload.book - 1],
          })
          return
        }
        case 'VIEW_BIBLE_STRONG': {
          navigation.navigate('BibleStrongDetail', msgData.payload)
          return
        }
        case 'SELECT_BIBLE_VERSE': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'verse',
          })
          return
        }
        case 'SELECT_BIBLE_STRONG': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'strong',
          })
          return
        }
        case 'SELECT_BIBLE_VERSE_BLOCK': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'verse-block',
          })
          return
        }
        case 'SELECT_BIBLE_STRONG_BLOCK': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'strong-block',
          })
          return
        }
        case 'ACTIVE_FORMATS': {
          this.setActiveFormats(msgData.payload)
          return
        }
        case 'CONSOLE_LOG': {
          console.log(
            `%c${msgData.payload}`,
            'color:black;background-color:#81ecec'
          )
          return
        }
        case 'THROW_ERROR': {
          console.log(
            `%c${msgData.payload}`,
            'color:black;background-color:#81ecec'
          )
          Alert.alert(
            `Une erreur est survenue, impossible de charger la page: ${msgData.payload} \n Le développeur en a été informé.`
          )
          Sentry.captureMessage(msgData.payload)
          return
        }

        default:
          console.warn(
            `WebViewQuillEditor Error: Unhandled message type received "${msgData.type}"`
          )
      }
    } catch (err) {
      console.warn(err)
    }
  }

  onWebViewLoaded = () => {
    const { fontFamily } = this.props
    this.dispatchToWebView('LOAD_EDITOR', {
      fontFamily,
    })
  }

  editorLoaded = () => {
    if (this.props.contentToDisplay) {
      this.dispatchToWebView('SET_CONTENTS', {
        delta: this.props.contentToDisplay,
      })
    }

    if (!this.props.isReadOnly) {
      this.dispatchToWebView('CAN_EDIT')
    }
  }

  onError = error => {
    Alert.alert('WebView onError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') },
    ])
  }

  renderError = error => {
    Alert.alert('WebView renderError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') },
    ])
  }

  render = () => {
    if (!this.state.isHTMLFileLoaded) {
      return null
    }

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          overflow: 'hidden',
          flex: 1,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
        }}
      >
        <WebView
          useWebKit
          onLoad={this.onWebViewLoaded}
          onLoadEnd={this.injectFont}
          onMessage={this.handleMessage}
          originWhitelist={['*']}
          ref={this.webViewRef}
          source={{ html: this.HTMLFile }}
          injectedJavaScript={this.injectFont()}
          domStorageEnabled
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          allowFileAccess
          keyboardDisplayRequiresUserAction={false}
          renderError={this.renderError}
          onError={this.onError}
          bounces={false}
          scrollEnabled={false}
          hideKeyboardAccessoryView
        />
        {this.state.isKeyboardOpened && (
          <StudyFooter
            navigateBibleView={this.props.navigateBibleView}
            openBibleView={this.props.openBibleView}
            dispatchToWebView={this.dispatchToWebView}
            activeFormats={this.state.activeFormats}
          />
        )}
      </KeyboardAvoidingView>
    )
  }
}

// Specifies the default values for props:
WebViewQuillEditor.defaultProps = {
  theme: 'snow',
}

export default withNavigation(WebViewQuillEditor)
