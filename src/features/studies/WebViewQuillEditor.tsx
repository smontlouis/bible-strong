import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Platform, Alert, KeyboardAvoidingView, Keyboard } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { WebView } from 'react-native-webview'
import { Asset } from 'expo-asset'
import * as Sentry from '@sentry/react-native'
import { useNavigation } from '@react-navigation/native'

import books from '~assets/bible_versions/books-desc'
import literata from '~assets/fonts/literata'
import StudyFooter from './StudyFooter'
import i18n from '~i18n'
import studiesHTML from './studiesWebView/studiesHTML'
import { EditStudyScreenProps } from '~navigation/type'
import { StudyNavigateBibleType } from '~common/types'

type Props = {
  params: Readonly<EditStudyScreenProps>
  isReadOnly: boolean
  onDeltaChangeCallback: (
    delta: string | null,
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => void
  contentToDisplay: {
    ops: string[]
  }
  fontFamily: string
  navigateBibleView: (type: StudyNavigateBibleType) => void
}
const WebViewQuillEditor = ({
  params,
  isReadOnly,
  onDeltaChangeCallback,
  contentToDisplay,
  fontFamily,
  navigateBibleView,
}: Props) => {
  const webViewRef = useRef<WebView>(null)
  const navigation = useNavigation()
  const [isKeyboardOpened, setIsKeyboardOpened] = useState(false)
  const [activeFormats, setActiveFormats] = useState({})

  useEffect(() => {
    const updateListener =
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow'
    const resetListener =
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide'

    const showKeyboard = () => setIsKeyboardOpened(true)
    const hideKeyboard = () => setIsKeyboardOpened(false)

    const keyboardShowListener = Keyboard.addListener(
      updateListener,
      showKeyboard
    )
    const keyboardHideListener = Keyboard.addListener(
      resetListener,
      hideKeyboard
    )

    return () => {
      keyboardShowListener.remove()
      keyboardHideListener.remove()
    }
  }, [])

  useEffect(() => {
    if (!params?.type) return

    if (params.type.includes('verse')) {
      const isBlock = params.type.includes('block')
      dispatchToWebView('FOCUS_EDITOR')
      dispatchToWebView(
        isBlock ? 'GET_BIBLE_VERSES_BLOCK' : 'GET_BIBLE_VERSES',
        params
      )
    } else {
      const isBlock = params.type.includes('block')
      dispatchToWebView('FOCUS_EDITOR')
      dispatchToWebView(
        isBlock ? 'GET_BIBLE_STRONG_BLOCK' : 'GET_BIBLE_STRONG',
        params
      )
    }
  }, [params])

  useEffect(() => {
    if (!isReadOnly) {
      dispatchToWebView('CAN_EDIT')
      dispatchToWebView('FOCUS_EDITOR')
    } else {
      dispatchToWebView('READ_ONLY')
      dispatchToWebView('BLUR_EDITOR')
    }
  }, [isReadOnly])

  const dispatchToWebView = useCallback((type: string, payload?: any) => {
    if (webViewRef.current) {
      console.log('RN DISPATCH: ', type)

      webViewRef.current.injectJavaScript(`
        (function() {
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent("messages", {
              detail: ${JSON.stringify({ type, payload })}
            }));
          }, 0)
        })()
      `)
    }
  }, [])

  const injectFont = () => {
    const fontRule = `@font-face { font-family: 'Literata Book'; src: local('Literata Book'), url('${literata}') format('woff');}`

    return `
        var style = document.createElement("style");
        style.innerHTML = "${fontRule}";
        document.head.appendChild(style);
        true;
    `
  }

  const handleMessage = event => {
    let msgData
    try {
      msgData = JSON.parse(event.nativeEvent.data)

      switch (msgData.type) {
        case 'EDITOR_LOADED':
          editorLoaded()
          break
        case 'TEXT_CHANGED':
          if (onDeltaChangeCallback) {
            delete msgData.payload.type
            const {
              delta,
              deltaChange,
              deltaOld,
              changeSource,
            } = msgData.payload
            onDeltaChangeCallback(delta, deltaChange, deltaOld, changeSource)
          }
          break
        case 'VIEW_BIBLE_VERSE': {
          navigation.navigate('BibleView', {
            ...msgData.payload,
            arrayVerses: null,
            book: books[msgData.payload.book - 1],
          })
          return
        }
        case 'VIEW_BIBLE_STRONG': {
          navigation.navigate('Strong', msgData.payload)
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
          setActiveFormats(JSON.parse(msgData.payload))
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

  const onWebViewLoaded = () => {
    dispatchToWebView('LOAD_EDITOR', {
      fontFamily,
      language: i18n.language,
    })
  }

  const editorLoaded = () => {
    if (contentToDisplay) {
      dispatchToWebView('SET_CONTENTS', {
        delta: contentToDisplay,
      })
    }

    if (!isReadOnly) {
      dispatchToWebView('CAN_EDIT')
    }
  }

  const onError = error => {
    Alert.alert('WebView onError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') },
    ])
  }

  const renderError = error => {
    Alert.alert('WebView renderError', error, [
      { text: 'OK', onPress: () => console.log('OK Pressed') },
    ])
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
        onLoad={onWebViewLoaded}
        onLoadEnd={injectFont}
        onMessage={handleMessage}
        originWhitelist={['*']}
        ref={webViewRef}
        source={{ html: studiesHTML }}
        injectedJavaScript={injectFont()}
        domStorageEnabled
        allowUniversalAccessFromFileURLs
        allowFileAccessFromFileURLs
        allowFileAccess
        keyboardDisplayRequiresUserAction={false}
        renderError={renderError}
        onError={onError}
        bounces={false}
        scrollEnabled={false}
        hideKeyboardAccessoryView
        onContentProcessDidTerminate={syntheticEvent => {
          console.warn('Content process terminated, reloading...')
          const { nativeEvent } = syntheticEvent
          webViewRef.current?.reload()
          Sentry.captureException(nativeEvent)
        }}
        onRenderProcessGone={syntheticEvent => {
          webViewRef.current?.reload()
          const { nativeEvent } = syntheticEvent
          Sentry.captureException(nativeEvent)
        }}
      />
      {isKeyboardOpened && (
        <StudyFooter
          navigateBibleView={navigateBibleView}
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
        />
      )}
    </KeyboardAvoidingView>
  )
}

WebViewQuillEditor.defaultProps = {
  theme: 'snow',
}

export default WebViewQuillEditor
