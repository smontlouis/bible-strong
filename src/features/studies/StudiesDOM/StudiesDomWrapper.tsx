import { useRouter } from 'expo-router'
import type { JSONValue } from 'expo/build/dom/dom.types'
import { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller'
import { WebViewMessageEvent } from 'react-native-webview'
import { useTheme } from '@emotion/react'

import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab, TabItem, useIsCurrentTab } from 'src/state/tabs'
import { StudyNavigateBibleType } from '~common/types'
import { timeout } from '~helpers/timeout'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import i18n from '~i18n'
import { EditStudyScreenProps } from '~navigation/type'
import { Study } from '~redux/modules/user'
import Box from '~common/ui/Box'
import { currentStudyIdAtom } from '../atom'
import StudyFooter from '../StudyFooter'
import StudiesDOMComponent, { StudyDOMRef } from './StudiesDOMComponent'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  params: Readonly<EditStudyScreenProps>
  isReadOnly: boolean
  onDeltaChangeCallback: (
    delta: Study['content'],
    deltaChange: string | null,
    deltaOld: string | null,
    changeSource: string | null
  ) => void
  contentToDisplay: Study['content']
  fontFamily: string
  studyAtom?: PrimitiveAtom<StudyTab>
  studyId: string
  isFormSheet?: boolean
}

type StudyDomMessage = {
  type: string
  payload?: Record<string, unknown>
}

type RouterParams = Record<string, string | number | (string | number)[] | null | undefined>

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
  isFormSheet = false,
}: Props) {
  const ref = useRef<StudyDOMRef>(null)
  const router = useRouter()
  const theme = useTheme()
  const isKeyboardOpened = useKeyboardState(state => state.isVisible)
  const keyboardHeight = useKeyboardState(state => state.height)
  const [activeFormats, setActiveFormats] = useState({})
  const { colorScheme } = useCurrentThemeSelector()

  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = studyAtom ? getIsCurrentTab(studyAtom as PrimitiveAtom<TabItem>) : false

  useEffect(() => {
    console.log('[Studies] isCurrentTab', isCurrentTab)

    if (ref.current?.reloadEditor && isCurrentTab) {
      console.log('[Studies] Reloading editor')
      ref.current.reloadEditor(contentToDisplay ?? { ops: [] })
    }
  }, [isCurrentTab])

  function dispatchToWebView(type: string, payload?: JSONValue): void {
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
    try {
      const msgData = JSON.parse(event.nativeEvent.data) as StudyDomMessage
      console.log('[Studies] DISPATCH:', msgData.type)

      switch (msgData.type) {
        case 'TEXT_CHANGED': {
          if (onDeltaChangeCallback && msgData.payload) {
            const { delta, deltaChange, deltaOld, changeSource } = msgData.payload
            onDeltaChangeCallback(
              delta as Study['content'],
              typeof deltaChange === 'string' ? deltaChange : null,
              typeof deltaOld === 'string' ? deltaOld : null,
              typeof changeSource === 'string' ? changeSource : null
            )
          }
          break
        }

        case 'VIEW_BIBLE_VERSE': {
          const arrayVerses = (
            typeof msgData.payload?.arrayVerses === 'string'
              ? JSON.parse(msgData.payload.arrayVerses)
              : msgData.payload?.arrayVerses
          ) as string[]
          const [book, chapter, verse] = arrayVerses[0].split('-')
          const focusVerses = arrayVerses
            .filter(verseKey => {
              const [keyBook, keyChapter] = verseKey.split('-')
              return keyBook === book && keyChapter === chapter
            })
            .map(verseKey => Number(verseKey.split('-')[2]))

          router.push({
            pathname: '/bible-view',
            params: {
              contextDisplayMode: 'focused',
              book,
              chapter,
              verse,
              focusVerses: JSON.stringify(focusVerses),
            },
          })
          return
        }

        case 'VIEW_BIBLE_STRONG': {
          router.push({
            pathname: '/strong',
            params: msgData.payload as RouterParams | undefined,
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
          if (typeof msgData.payload === 'string') {
            setActiveFormats(JSON.parse(msgData.payload))
          }
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

  const footer = isKeyboardOpened ? (
    <StudyFooter
      navigateBibleView={navigateToSelectionMode}
      dispatchToWebView={dispatchToWebView}
      activeFormats={activeFormats}
      keyboardHeight={keyboardHeight - 20}
    />
  ) : null

  const editor = (
    <StudiesDOMComponent
      ref={ref}
      fontFamily={fontFamily}
      language={i18n.language}
      contentToDisplay={contentToDisplay ?? { ops: [] }}
      isReadOnly={isReadOnly}
      colorScheme={colorScheme}
      dom={{
        useExpoDOMWebView: false,
        onMessage: handleMessage,
        keyboardDisplayRequiresUserAction: false,
        bounces: false,
        scrollEnabled: true,
        hideKeyboardAccessoryView: true,
        containerStyle: {
          flex: 1,
          backgroundColor: theme.colors.reverse,
        },
      }}
    />
  )

  if (isFormSheet) {
    return (
      <Box flex bg="reverse" pb={isKeyboardOpened ? 50 : 0}>
        {editor}
        {footer && (
          <KeyboardStickyView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {footer}
          </KeyboardStickyView>
        )}
      </Box>
    )
  }

  return (
    <KeyboardAvoidingView
      automaticOffset
      behavior="padding"
      style={{
        flex: 1,
        backgroundColor: theme.colors.reverse,
      }}
    >
      <>
        {editor}
        {footer}
      </>
    </KeyboardAvoidingView>
  )
}
