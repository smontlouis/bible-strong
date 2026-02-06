import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native'
import { WebViewMessageEvent } from 'react-native-webview'

import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab, TabItem, useIsCurrentTab } from 'src/state/tabs'
import { StudyNavigateBibleType } from '~common/types'
import { timeout } from '~helpers/timeout'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import i18n from '~i18n'
import { EditStudyScreenProps } from '~navigation/type'
import { currentStudyIdAtom } from '../atom'
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
  studyId: string
}

const SELECTION_MODE_MAP: Record<string, StudyNavigateBibleType> = {
  SELECT_BIBLE_VERSE: 'verse',
  SELECT_BIBLE_STRONG: 'strong',
  SELECT_BIBLE_VERSE_BLOCK: 'verse-block',
  SELECT_BIBLE_STRONG_BLOCK: 'strong-block',
}

export default function StudiesDomWrapper({
  params,
  isReadOnly,
  onDeltaChangeCallback,
  contentToDisplay,
  fontFamily,
  studyAtom,
  studyId,
}: Props) {
  const ref = useRef<StudyDOMRef>(null)
  const router = useRouter()
  const [isKeyboardOpened, setIsKeyboardOpened] = useState(false)
  const [activeFormats, setActiveFormats] = useState({})
  const { colorScheme } = useCurrentThemeSelector()

  useEffect(() => {
    const updateListener = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow'
    const resetListener = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide'

    const keyboardShowListener = Keyboard.addListener(updateListener, () =>
      setIsKeyboardOpened(true)
    )
    const keyboardHideListener = Keyboard.addListener(resetListener, () =>
      setIsKeyboardOpened(false)
    )

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

  function dispatchToWebView(type: string, payload?: any): void {
    if (ref.current) {
      console.log('[Studies] RN DISPATCH:', type)
      ref.current.dispatch({ type, payload })
    }
  }

  async function navigateToSelectionMode(selectionMode: StudyNavigateBibleType): Promise<void> {
    dispatchToWebView('BLUR_EDITOR')
    await timeout(300)
    getDefaultStore().set(currentStudyIdAtom, studyId)
    router.push({
      pathname: '/bible-view',
      params: { isSelectionMode: selectionMode },
    })
  }

  useEffect(() => {
    const paramsWithType = params as EditStudyScreenProps & { type?: string }
    if (!paramsWithType.type) return

    const isVerse = paramsWithType.type.includes('verse')
    const isBlock = paramsWithType.type.includes('block')

    dispatchToWebView('FOCUS_EDITOR')

    if (isVerse) {
      dispatchToWebView(isBlock ? 'GET_BIBLE_VERSES_BLOCK' : 'GET_BIBLE_VERSES', params)
    } else {
      dispatchToWebView(isBlock ? 'GET_BIBLE_STRONG_BLOCK' : 'GET_BIBLE_STRONG', params)
    }
  }, [JSON.stringify(params)])

  function handleMessage(event: WebViewMessageEvent): void {
    let msgData: any
    try {
      msgData = JSON.parse(event.nativeEvent.data)
      console.log('[Studies] DISPATCH:', msgData.type)

      switch (msgData.type) {
        case 'TEXT_CHANGED': {
          if (onDeltaChangeCallback) {
            delete msgData.payload.type
            const { delta, deltaChange, deltaOld, changeSource } = msgData.payload
            onDeltaChangeCallback(delta, deltaChange, deltaOld, changeSource)
          }
          break
        }

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

        case 'SELECT_BIBLE_VERSE':
        case 'SELECT_BIBLE_STRONG':
        case 'SELECT_BIBLE_VERSE_BLOCK':
        case 'SELECT_BIBLE_STRONG_BLOCK': {
          const selectionMode = SELECTION_MODE_MAP[msgData.type]
          navigateToSelectionMode(selectionMode)
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
          onMessage: handleMessage,
          keyboardDisplayRequiresUserAction: false,
          bounces: false,
          scrollEnabled: false,
          hideKeyboardAccessoryView: true,
        }}
      />
      {isKeyboardOpened && (
        <StudyFooter
          navigateBibleView={navigateToSelectionMode}
          dispatchToWebView={dispatchToWebView}
          activeFormats={activeFormats}
        />
      )}
    </KeyboardAvoidingView>
  )
}
