import { getEntityChipListState } from '~common/entityChips'
import { webFontFamily } from '~helpers/webFontFamily'
import type { JSONValue } from 'expo/build/dom/dom.types'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { Platform, ScrollView } from 'react-native'
import { WebViewMessageEvent } from 'react-native-webview'
import { useTheme } from '~themes/ThemeProvider'
import { useAtomValue } from 'jotai/react'
import { useSelector } from 'react-redux'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { StudyTab, TabItem, useIsCurrentTab } from 'src/state/tabs'
import { StudyNavigateBibleType } from '~common/types'
import { timeout } from '~helpers/timeout'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import i18n from '~i18n'
import { EditStudyScreenProps } from '~navigation/type'
import { Study } from '~redux/modules/user'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { currentStudyIdAtom, pendingStudyVerseEntityAtom } from '../atom'
import StudyFooter from '../StudyFooter'
import StudiesDOMComponent, { StudyDOMRef } from './StudiesDOMComponent'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'
import CreateEntityRelationModal from '~features/studyRelations/CreateEntityRelationModal'
import { useOpenStudyObject } from '~features/studyRelations/useOpenStudyObject'
import type { RelationTargetResult } from '~features/studyRelations/targetSearch'
import { createPassageSelectionTarget } from '~features/search/passageSelection'
import { useSheet } from '~helpers/useSheet'
import { createStudyEntityEmbedPayload } from '../studyEntityEmbeds'
import {
  refreshStudyEntityEmbedPayload,
  refreshStudyEntityEmbeds,
} from '../refreshStudyEntityEmbeds'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { RootState } from '~redux/modules/reducer'
const IPAD_FORM_SHEET_KEYBOARD_OFFSET = -54

type Props = {
  tags?: import('~common/types').TagsObj
  relationCount?: number
  onOpenRelations?: () => void
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

const encodeDeltaContent = (content: Study['content'] | undefined) =>
  encodeURIComponent(JSON.stringify(content ?? { ops: [] }))

export default function StudiesDomWrapper({
  tags,
  relationCount = 0,
  onOpenRelations,
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
  const pushRouteOnce = usePushRouteOnce()
  const openStudyObject = useOpenStudyObject()
  const entityPicker = useSheet()
  const resources = useResourceAccess()
  const defaultBibleVersion = useDefaultBibleVersion()
  const resourceLanguages = useAtomValue(resourcesLanguageAtom)
  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const links = useSelector((state: RootState) => state.user.bible.links)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const theme = useTheme()
  const [activeFormats, setActiveFormats] = useState({})
  const [entityInsertionMode, setEntityInsertionMode] = useState<'link' | 'block'>('link')
  const pendingBiblePickerModeRef = useRef<'link' | 'block' | null>(null)
  const isIPadFormSheet = isFormSheet && Platform.OS === 'ios' && Platform.isPad
  const { colorScheme } = useCurrentThemeSelector()
  const encodedContentToDisplay = encodeDeltaContent(contentToDisplay)

  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = studyAtom ? getIsCurrentTab(studyAtom as PrimitiveAtom<TabItem>) : false

  useEffect(() => {
    if (!isReadOnly || (studyAtom && !isCurrentTab)) return
    let active = true

    void refreshStudyEntityEmbeds(contentToDisplay, {
      resources,
      defaultBibleVersion,
      resourceLanguages,
      notes,
      links,
      studies,
      wordAnnotations,
    }).then(content => {
      if (!active || !content || !ref.current?.reloadEditor) return
      ref.current.reloadEditor(encodeDeltaContent(content))
    })

    return () => {
      active = false
    }
    // Refresh on entry/re-entry, not after each editor keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, isCurrentTab, isReadOnly])

  function dispatchToWebView(type: string, payload?: JSONValue): void {
    if (ref.current) {
      console.log('[Studies] RN DISPATCH:', type)
      ref.current.dispatch({ type, payload })
    }
  }

  async function navigateToSelectionMode(
    selectionMode: StudyNavigateBibleType,
    entityMode?: 'link' | 'block'
  ): Promise<void> {
    dispatchToWebView('BLUR_EDITOR')
    await timeout(300)
    getDefaultStore().set(currentStudyIdAtom, studyId)
    getDefaultStore().set(
      pendingStudyVerseEntityAtom,
      entityMode ? { studyId, mode: entityMode } : null
    )
    pushRouteOnce({
      pathname: '/bible-view',
      params: { isSelectionMode: selectionMode },
    })
  }

  function openEntityPicker(mode: 'link' | 'block'): void {
    setEntityInsertionMode(mode)
    entityPicker.open()
  }

  function openBibleVersePicker(): void {
    // The native sheet swallows navigation while it is still dismissing:
    // open the Bible once it is fully closed.
    pendingBiblePickerModeRef.current = entityInsertionMode
    entityPicker.close()
  }

  function handleEntityPickerDismiss(): void {
    const mode = pendingBiblePickerModeRef.current
    if (!mode) return
    pendingBiblePickerModeRef.current = null
    navigateToSelectionMode(mode === 'link' ? 'verse' : 'verse-block', mode)
  }

  async function insertEntity(
    target: RelationTargetResult,
    mode: 'link' | 'block' = entityInsertionMode
  ): Promise<void> {
    const payload = await refreshStudyEntityEmbedPayload(createStudyEntityEmbedPayload(target), {
      resources,
      defaultBibleVersion,
      resourceLanguages,
      notes,
      links,
      studies,
      wordAnnotations,
    })
    dispatchToWebView(
      mode === 'link' ? 'INSERT_ENTITY_LINK' : 'INSERT_ENTITY_BLOCK',
      payload as unknown as JSONValue
    )
    entityPicker.close()
  }

  useEffect(() => {
    const paramsWithType = params as EditStudyScreenProps & {
      type?: string
      verses?: string
      version?: string
    }
    if (!paramsWithType.type) return

    const isVerse = paramsWithType.type.includes('verse')
    const isBlock = paramsWithType.type.includes('block')

    dispatchToWebView('FOCUS_EDITOR')

    const store = getDefaultStore()
    const pendingEntity = store.get(pendingStudyVerseEntityAtom)
    if (isVerse && pendingEntity?.studyId === studyId) {
      store.set(pendingStudyVerseEntityAtom, null)
      const verseKeys = JSON.parse(paramsWithType.verses || '[]') as string[]
      if (verseKeys.length && paramsWithType.version) {
        void insertEntity(
          createPassageSelectionTarget(verseKeys, paramsWithType.version),
          pendingEntity.mode
        )
      }
      return
    }

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
          if (!arrayVerses.length) return

          pushRouteOnce({
            pathname: '/bible-view',
            params: getBibleViewParamsForVerseKeys(
              arrayVerses,
              typeof msgData.payload?.version === 'string' ? msgData.payload.version : undefined
            ),
          })
          return
        }

        case 'VIEW_BIBLE_STRONG': {
          pushRouteOnce({
            pathname: '/strong',
            params: msgData.payload as RouterParams | undefined,
          })
          return
        }

        case 'VIEW_STUDY_ENTITY': {
          const endpoint = msgData.payload?.endpoint
          if (endpoint && typeof endpoint === 'object') {
            openStudyObject({ endpoint: endpoint as RelationTargetResult['endpoint'] })
          }
          return
        }

        case 'SELECT_STUDY_ENTITY_LINK': {
          openEntityPicker('link')
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

  const footer = !isReadOnly ? (
    <StudyFooter
      onInsertEntity={openEntityPicker}
      dispatchToWebView={dispatchToWebView}
      activeFormats={activeFormats}
    />
  ) : null

  const editor = (
    <StudiesDOMComponent
      metadataItems={
        isReadOnly
          ? getEntityChipListState({ tags, relationCount, canOpenRelations: !!onOpenRelations })
              .items
          : []
      }
      metadataColor={theme.colors.primary}
      metadataBackgroundColor={theme.colors.lightPrimary}
      onMetadataPress={async (type, id) => {
        if (type === 'relation') onOpenRelations?.()
        else pushRouteOnce({ pathname: '/tag', params: { tagId: id } })
      }}
      onEditorMessage={async message =>
        handleMessage({ nativeEvent: { data: message } } as WebViewMessageEvent)
      }
      ref={ref}
      fontFamily={Platform.OS === 'web' ? webFontFamily(fontFamily) : fontFamily}
      language={i18n.language}
      encodedContentToDisplay={encodedContentToDisplay}
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

  return (
    <KeyboardAvoidingView
      automaticOffset
      behavior={isIPadFormSheet ? 'height' : 'padding'}
      keyboardVerticalOffset={isIPadFormSheet ? IPAD_FORM_SHEET_KEYBOARD_OFFSET : 0}
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: theme.colors.reverse,
      }}
    >
      <Box className="min-h-0 border-continuous flex-[1] bg-reverse">
        {Platform.OS === 'web' && <Box className="shrink-0 overflow-visible z-20">{footer}</Box>}
        {Platform.OS === 'web' ? (
          <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flexGrow: 1 }}>
            {editor}
          </ScrollView>
        ) : (
          editor
        )}
        {Platform.OS !== 'web' && footer}
        <CreateEntityRelationModal
          ref={entityPicker.getRef()}
          title={
            entityInsertionMode === 'link' ? i18n.t('Ajouter un lien') : i18n.t('Ajouter un bloc')
          }
          sourceEndpoint={null}
          onSelectTarget={target => insertEntity(target)}
          onDismiss={handleEntityPickerDismiss}
          searchAccessory={
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={i18n.t('Choisir dans la Bible')}
              onPress={openBibleVersePicker}
              className="overflow-hidden border-continuous items-center justify-center w-[44px] h-[44px] rounded-[14px] bg-[rgba(0,0,0,0.1)]"
            >
              <FeatherIcon name="book-open" size={20} />
            </TouchableBox>
          }
        />
      </Box>
    </KeyboardAvoidingView>
  )
}
