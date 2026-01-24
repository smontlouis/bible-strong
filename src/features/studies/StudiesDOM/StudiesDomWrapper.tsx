import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native'
import { WebViewMessageEvent } from 'react-native-webview'

import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab, TabItem, useIsCurrentTab } from 'src/state/tabs'
import books from '~assets/bible_versions/books-desc'
import { StudyNavigateBibleType } from '~common/types'
import { timeout } from '~helpers/timeout'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import i18n from '~i18n'
import { EditStudyScreenProps } from '~navigation/type'
import StudyFooter from '../StudyFooter'
import StudiesDOMComponent, { StudyDOMRef } from './StudiesDOMComponent'
import { currentStudyIdAtom } from '../atom'

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
  studyId: string
}
const StudiesDomWrapper = ({
  params,
  isReadOnly,
  onDeltaChangeCallback,
  contentToDisplay,
  fontFamily,
  studyAtom,
  studyId,
}: Props) => {
  const ref = useRef<StudyDOMRef>(null)
  const router = useRouter()
  const [isKeyboardOpened, setIsKeyboardOpened] = useState(false)
  const [activeFormats, setActiveFormats] = useState({})
  const { colorScheme } = useCurrentThemeSelector()

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
  const isCurrentTab = studyAtom ? getIsCurrentTab(studyAtom as PrimitiveAtom<TabItem>) : false
  useEffect(() => {
    console.log('[Studies] isCurrentTab', isCurrentTab)

    if (ref.current?.reloadEditor && isCurrentTab) {
      console.log('[Studies] Reloading editor')
      ref.current.reloadEditor(contentToDisplay)
    }
  }, [isCurrentTab])

  const dispatchToWebView = (type: string, payload?: any) => {
    if (ref.current) {
      console.log('[Studies] RN DISPATCH:', type)
      console.log('[Studies] Ref:', ref.current)
      ref.current?.dispatch({ type, payload })
    }
  }

  useEffect(() => {
    ;(async () => {
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
    })()
  }, [JSON.stringify(params)])

  const navigateBibleView = async (type: StudyNavigateBibleType) => {
    dispatchToWebView('BLUR_EDITOR')
    await timeout(300)
    // Store current studyId for dismissTo navigation
    getDefaultStore().set(currentStudyIdAtom, studyId)
    router.push({
      pathname: '/bible-view',
      params: { isSelectionMode: type },
    })
  }

  const dispatch = async (event: WebViewMessageEvent) => {
    let msgData
    try {
      msgData = JSON.parse(event.nativeEvent.data)

      console.log('[Studies] DISPATCH:', msgData.type)

      switch (msgData.type) {
        case 'TEXT_CHANGED':
          if (onDeltaChangeCallback) {
            delete msgData.payload.type
            const { delta, deltaChange, deltaOld, changeSource } = msgData.payload
            onDeltaChangeCallback(delta, deltaChange, deltaOld, changeSource)
          }
          break
        case 'VIEW_BIBLE_VERSE': {
          const arrayVerses = (
            typeof msgData.payload.arrayVerses === 'string'
              ? JSON.parse(msgData.payload.arrayVerses)
              : msgData.payload.arrayVerses
          ) as string[]

          router.push({
            pathname: '/bible-view',
            params: {
              isReadOnly: 'true',
              book: arrayVerses[0].split('-')[0],
              chapter: arrayVerses[0].split('-')[1],
              focusVerses: JSON.stringify(arrayVerses.map(verse => Number(verse.split('-')[2]))),
            },
          })
          return
        }
        case 'VIEW_BIBLE_STRONG': {
          router.push({
            pathname: '/strong',
            params: msgData.payload,
          })
          return
        }
        case 'SELECT_BIBLE_VERSE': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          router.push({
            pathname: '/bible-view',
            params: { isSelectionMode: 'verse' },
          })
          return
        }
        case 'SELECT_BIBLE_STRONG': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          router.push({
            pathname: '/bible-view',
            params: { isSelectionMode: 'strong' },
          })
          return
        }
        case 'SELECT_BIBLE_VERSE_BLOCK': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          router.push({
            pathname: '/bible-view',
            params: { isSelectionMode: 'verse-block' },
          })
          return
        }
        case 'SELECT_BIBLE_STRONG_BLOCK': {
          dispatchToWebView('BLUR_EDITOR')
          await timeout(300)
          router.push({
            pathname: '/bible-view',
            params: { isSelectionMode: 'strong-block' },
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
