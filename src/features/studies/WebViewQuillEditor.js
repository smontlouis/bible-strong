import React, { createRef } from 'react'
import { Asset } from 'expo-asset'
import { withNavigation } from 'react-navigation'
import { View, Alert, Platform } from 'react-native'

import { WebView } from 'react-native-webview'
import books from '~assets/bible_versions/books-desc'
import KeyboardSpacer from '~common/KeyboardSpacer'

const INJECTED_JAVASCRIPT = `(function() {
  // This is the important part!
  if (!window.ReactNativeWebView) {
    window.ReactNativeWebView = window['ReactABI33_0_0NativeWebView'];
  }
  // End of the important part! Now continue using it as usual
})();`

class WebViewQuillEditor extends React.Component {
  webViewRef = createRef()

  state = {
    isHTMLFileLoaded: false
  }

  componentDidMount() {
    this.props.shareMethods(this.dispatchToWebView)

    this.HTMLFile = Asset.fromModule(require('~features/studies/studiesWebView/dist/index.html'))
    if (!this.HTMLFile.localUri) {
      Asset.loadAsync(require('~features/studies/studiesWebView/dist/index.html')).then(() => {
        this.HTMLFile = Asset.fromModule(
          require('~features/studies/studiesWebView/dist/index.html')
        )
        this.setState({ isHTMLFileLoaded: true })
      })
    } else {
      this.setState({ isHTMLFileLoaded: true })
    }
  }

  componentDidUpdate(prevProps) {
    const oldParams = prevProps.params || {}
    const newParams = this.props.params || {}

    if (JSON.stringify(oldParams) !== JSON.stringify(newParams)) {
      if (newParams.type.includes('verse')) {
        const isBlock = newParams.type.includes('block')
        this.dispatchToWebView('FOCUS_EDITOR')
        this.dispatchToWebView(isBlock ? 'GET_BIBLE_VERSES_BLOCK' : 'GET_BIBLE_VERSES', newParams)
      } else {
        const isBlock = newParams.type.includes('block')
        this.dispatchToWebView('FOCUS_EDITOR')
        this.dispatchToWebView(isBlock ? 'GET_BIBLE_STRONG_BLOCK' : 'GET_BIBLE_STRONG', newParams)
      }
    }

    if (prevProps.isReadOnly !== this.props.isReadOnly && !this.props.isReadOnly) {
      this.dispatchToWebView('CAN_EDIT')
      this.dispatchToWebView('FOCUS_EDITOR')
    }

    if (prevProps.isReadOnly !== this.props.isReadOnly && this.props.isReadOnly) {
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

  injectFont = async () => {
    const webView = this.webViewRef.current

    let { localUri } = Asset.fromModule(require('~assets/fonts/LiterataBook.otf'))

    if (!localUri) {
      await Asset.loadAsync(require('~assets/fonts/LiterataBook.otf'))
      localUri = Asset.fromModule(require('~assets/fonts/LiterataBook.otf')).localUri
    }

    const fontRule = `@font-face { font-family: 'LiterataBook'; src: local('LiterataBook'), url('${localUri}') format('opentype');}`

    webView.injectJavaScript(`
    (function() {
      setTimeout(() => {
        var style = document.createElement("style");
        style.innerHTML = "${fontRule}";
        document.head.appendChild(style);
      }, 0)
    })()
    `)
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
            const { delta, deltaChange, deltaOld, changeSource } = msgData.payload
            this.props.onDeltaChangeCallback(delta, deltaChange, deltaOld, changeSource)
          }
          break
        case 'VIEW_BIBLE_VERSE': {
          navigation.navigate('BibleView', {
            ...msgData.payload,
            book: books[msgData.payload.book - 1]
          })
          return
        }
        case 'VIEW_BIBLE_STRONG': {
          navigation.navigate('BibleStrongDetail', msgData.payload)
          return
        }
        case 'SELECT_BIBLE_VERSE': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'verse'
          })
          return
        }
        case 'SELECT_BIBLE_STRONG': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'strong'
          })
          return
        }
        case 'SELECT_BIBLE_VERSE_BLOCK': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'verse-block'
          })
          return
        }
        case 'SELECT_BIBLE_STRONG_BLOCK': {
          navigation.navigate('BibleView', {
            isSelectionMode: 'strong-block'
          })
          return
        }
        case 'ACTIVE_FORMATS': {
          this.props.setActiveFormats(msgData.payload)
          return
        }
        case 'CONSOLE_LOG': {
          console.log(`%c${msgData.payload}`, 'color:black;background-color:#81ecec')
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
    this.dispatchToWebView('LOAD_EDITOR')
  }

  editorLoaded = () => {
    if (this.props.contentToDisplay) {
      console.log('Content to Display: ', this.props.contentToDisplay)
      this.dispatchToWebView('SET_CONTENTS', {
        delta: this.props.contentToDisplay
      })
    }

    if (!this.props.isReadOnly) {
      this.dispatchToWebView('CAN_EDIT')
    }
  }

  onError = error => {
    Alert.alert('WebView onError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') }
    ])
  }

  renderError = error => {
    Alert.alert('WebView renderError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') }
    ])
  }

  render = () => {
    if (!this.state.isHTMLFileLoaded) {
      return null
    }

    const { localUri } = this.HTMLFile
    return (
      <View style={{ flex: 1 }}>
        <WebView
          useWebKit
          onLoad={this.onWebViewLoaded}
          onLoadEnd={this.injectFont}
          onMessage={this.handleMessage}
          originWhitelist={['*']}
          ref={this.webViewRef}
          source={{ uri: localUri }}
          injectedJavaScript={INJECTED_JAVASCRIPT}
          domStorageEnabled
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          allowFileAccess
          keyboardDisplayRequiresUserAction={false}
          renderError={this.renderError}
          onError={this.onError}
        />
        {Platform.OS === 'android' && <KeyboardSpacer />}
      </View>
    )
  }
}

// Specifies the default values for props:
WebViewQuillEditor.defaultProps = {
  theme: 'snow'
}

export default withNavigation(WebViewQuillEditor)
