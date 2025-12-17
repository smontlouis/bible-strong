import { useNavigation } from '@react-navigation/native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native'
import { WebViewMessageEvent } from 'react-native-webview'

import { PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab, useIsCurrentTab } from 'src/state/tabs'
import books from '~assets/bible_versions/books-desc'
import { StudyNavigateBibleType } from '~common/types'
import { timeout } from '~helpers/timeout'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import i18n from '~i18n'
import { EditStudyScreenProps } from '~navigation/type'
import StudyFooter from '../StudyFooter'
import StudiesDOMComponent, { StudyDOMRef } from './StudiesDOMComponent'

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
  studyAtom?: PrimitiveAtom<StudyTab>
}
const StudiesDomWrapper = ({
  params,
  isReadOnly,
  onDeltaChangeCallback,
  contentToDisplay,
  fontFamily,
  studyAtom,
}: Props) => {
  const ref = useRef<StudyDOMRef>(null)
  const navigation = useNavigation()
  const [isKeyboardOpened, setIsKeyboardOpened] = useState(false)
  const [activeFormats, setActiveFormats] = useState({})
  const { colorScheme } = useCurrentThemeSelector()

  const navigateBibleView = async (type: StudyNavigateBibleType) => {
    dispatchToWebView('BLUR_EDITOR')
    await timeout(300)
    navigation.navigate('BibleView', {
      isSelectionMode: type,
    })
  }

  useEffect(() => {
    const updateListener = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow'
    const resetListener = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide'

    const showKeyboard = () => setIsKeyboardOpened(true)
    const hideKeyboard = () => setIsKeyboardOpened(false)

    const keyboardShowListener = Keyboard.addListener(updateListener, showKeyboard)
    const keyboardHideListener = Keyboard.addListener(resetListener, hideKeyboard)

    return () => {
      keyboardShowListener.remove()
      keyboardHideListener.remove()
    }
  }, [])

  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = studyAtom ? getIsCurrentTab(studyAtom) : false
  useEffect(() => {
    console.log('isCurrentTab', isCurrentTab)

    if (ref.current?.reloadEditor && isCurrentTab) {
      console.log('hehehe')
      ref.current.reloadEditor(contentToDisplay)
    }
  }, [isCurrentTab])

  useEffect(() => {
    // @ts-ignore
    if (!params?.type) return

    // @ts-ignore
    if (params.type.includes('verse')) {
      // @ts-ignore
      const isBlock = params.type.includes('block')
      dispatchToWebView('FOCUS_EDITOR')
      dispatchToWebView(isBlock ? 'GET_BIBLE_VERSES_BLOCK' : 'GET_BIBLE_VERSES', params)
    } else {
      // @ts-ignore
      const isBlock = params.type.includes('block')
      dispatchToWebView('FOCUS_EDITOR')
      dispatchToWebView(isBlock ? 'GET_BIBLE_STRONG_BLOCK' : 'GET_BIBLE_STRONG', params)
    }
  }, [params])

  const dispatchToWebView = useCallback((type: string, payload?: any) => {
    if (ref.current) {
      console.log('RN DISPATCH: ', type)
      console.log(ref.current)
      ref.current?.dispatch({ type, payload })
    }
  }, [])

  const dispatch = async (event: WebViewMessageEvent) => {
    let msgData
    try {
      msgData = JSON.parse(event.nativeEvent.data)

      console.log('DISPATCH: ', msgData.type)

      switch (msgData.type) {
        case 'TEXT_CHANGED':
          if (onDeltaChangeCallback) {
            delete msgData.payload.type
            const { delta, deltaChange, deltaOld, changeSource } = msgData.payload
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
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          navigation.navigate('BibleView', {
            isSelectionMode: 'verse',
          })
          return
        }
        case 'SELECT_BIBLE_STRONG': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          navigation.navigate('BibleView', {
            isSelectionMode: 'strong',
          })
          return
        }
        case 'SELECT_BIBLE_VERSE_BLOCK': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          navigation.navigate('BibleView', {
            isSelectionMode: 'verse-block',
          })
          return
        }
        case 'SELECT_BIBLE_STRONG_BLOCK': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          navigation.navigate('BibleView', {
            isSelectionMode: 'strong-block',
          })
          return
        }
        case 'ACTIVE_FORMATS': {
          setActiveFormats(JSON.parse(msgData.payload))
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
      <StudiesDOMComponent
        ref={ref}
        fontFamily={fontFamily}
        language={i18n.language}
        contentToDisplay={contentToDisplay}
        isReadOnly={isReadOnly}
        colorScheme={colorScheme}
        dom={{
          onMessage: dispatch,
          keyboardDisplayRequiresUserAction: false,
          bounces: false,
          scrollEnabled: false,
          hideKeyboardAccessoryView: true,
        }}
      />
      {isKeyboardOpened && (
        // @ts-ignore
        <StudyFooter
          navigateBibleView={navigateBibleView}
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
        />
      )}
    </KeyboardAvoidingView>
  )
}

export default StudiesDomWrapper
