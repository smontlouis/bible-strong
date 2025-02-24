import { StackNavigationProp } from '@react-navigation/stack'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { BibleTab, VersionCode } from 'src/state/tabs'
import { MainStackProps } from '~navigation/type'
import BibleDOMComponent from './BibleDOMComponent'
import { useTheme } from '@emotion/react'
import * as Sentry from '@sentry/react-native'
import * as Haptics from 'expo-haptics'
import produce from 'immer'
import { useSetAtom } from 'jotai/react'
import { Alert, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isFullScreenBibleAtom, isFullScreenBibleValue } from 'src/state/app'
// @ts-expect-error
import books from '~assets/bible_versions/books'
import { Book } from '~assets/bible_versions/books-desc'
import Snackbar from '~common/SnackBar'
import {
  Pericope,
  SelectedCode,
  StudyNavigateBibleType,
  Tag,
  Verse,
  VerseIds,
} from '~common/types'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'
import { HighlightsObj, NotesObj } from '~redux/modules/user'
import { useBookAndVersionSelector } from '../BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
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
  SWIPE_DOWN,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_UP,
  TOGGLE_SELECTED_VERSE,
} from './dispatch'
export type ParallelVerse = {
  id: VersionCode
  verses: Verse[]
}

export type TaggedVerse = {
  lastVerse: any
  tags: Tag[]
  date: number
  color: string
  verseIds: any[]
}

export type RootStyles = {
  settings: RootState['user']['bible']['settings']
}

export type PericopeChapter = Pericope[string][string]

export type Dispatch = (props: {
  type: string
  [key: string]: any
}) => Promise<void>

export type WebViewProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  book: Book
  chapter: number
  isLoading: boolean
  navigation: StackNavigationProp<MainStackProps>
  addSelectedVerse: (id: string) => void
  removeSelectedVerse: (id: string) => void
  setSelectedVerse: (selectedVerse: number) => void
  version: VersionCode
  isReadOnly: boolean
  isSelectionMode: StudyNavigateBibleType | undefined
  verses: Verse[]
  parallelVerses: ParallelVerse[]

  focusVerses: (string | number)[] | undefined
  secondaryVerses: Verse[] | null
  selectedVerses: VerseIds
  highlightedVerses: HighlightsObj
  notedVerses: NotesObj
  settings: RootState['user']['bible']['settings']
  verseToScroll: number | undefined
  pericopeChapter: PericopeChapter
  openNoteModal: any
  setSelectedCode: (selectedCode: SelectedCode) => void
  selectedCode: SelectedCode | null
  comments: { [key: string]: string } | null
  removeParallelVersion: any
  addParallelVersion: any
  goToPrevChapter: any
  goToNextChapter: any
  setMultipleTagsItem: any
  onChangeResourceTypeSelectVerse: any
}

export type NotedVerse = {
  id?: string
  title: string
  description: string
  date: number
  tags?: {
    [x: string]: Tag
  }
  key: string
  verses: string
}

export const BibleDOMWrapper = (props: WebViewProps) => {
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
    isLoading,
  } = props
  const { openVersionSelector } = useBookAndVersionSelector()
  const setIsFullScreenBible = useSetAtom(isFullScreenBibleAtom)
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const dispatch: Dispatch = async (action) => {
    switch (action.type) {
      case NAVIGATE_TO_BIBLE_VERSE_DETAIL: {
        const { onChangeResourceTypeSelectVerse } = props
        const { Livre, Chapitre, Verset } = action.params.verse
        console.log(`${Livre}-${Chapitre}-${Verset}`)
        onChangeResourceTypeSelectVerse(
          'strong',
          `${Livre}-${Chapitre}-${Verset}`
        )

        break
      }
      case NAVIGATE_TO_VERSE_NOTES: {
        const { navigation } = props
        navigation.navigate('BibleVerseNotes', {
          verse: action.payload,
          withBack: true,
        })
        break
      }
      case NAVIGATE_TO_PERICOPE: {
        const { navigation } = props
        navigation.navigate('Pericope')
        break
      }
      case NAVIGATE_TO_VERSION: {
        const { bibleAtom } = props
        const { version, index } = action.payload

        // index = 0 is Default one
        openVersionSelector({
          actions: {
            setSelectedVersion: (version: VersionCode) =>
              getDefaultStore().set(
                bibleAtom,
                produce((draft) => {
                  draft.data.selectedVersion = version
                })
              ),
            setParallelVersion: (version: VersionCode, index: number) =>
              getDefaultStore().set(
                bibleAtom,
                produce((draft) => {
                  draft.data.parallelVersions[index] = version
                })
              ),
          },
          data: getDefaultStore().get(bibleAtom).data,
          parallelVersionIndex: index === 0 ? undefined : index - 1,
        })
        break
      }
      case REMOVE_PARALLEL_VERSION: {
        const { removeParallelVersion } = props
        removeParallelVersion(action.payload - 1)
        break
      }
      case ADD_PARALLEL_VERSION: {
        const { addParallelVersion } = props
        addParallelVersion()
        break
      }
      case NAVIGATE_TO_STRONG: {
        const { setSelectedCode } = props
        setSelectedCode(action.payload) // { reference, book }
        break
      }
      case TOGGLE_SELECTED_VERSE: {
        if (Platform.OS === 'ios') {
          Haptics.selectionAsync()
        }
        const verseId = action.payload
        const { addSelectedVerse, removeSelectedVerse } = props

        const isVerseSelected = (verseId: any) => {
          const { selectedVerses } = props
          return !!selectedVerses[verseId]
        }

        if (isVerseSelected(verseId)) {
          removeSelectedVerse(verseId)
        } else {
          addSelectedVerse(verseId)
        }

        break
      }

      case NAVIGATE_TO_BIBLE_NOTE: {
        props.openNoteModal(action.payload)
        break
      }
      case NAVIGATE_TO_BIBLE_VIEW: {
        const { navigation } = props
        const book = Object.keys(books).find(
          (key) => books[key][0].toUpperCase() === action.bookCode
        )

        if (!book) {
          Snackbar.show("Erreur lors de l'ouverture du verset")
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
        const { goToNextChapter, book, chapter } = props
        const hasNextChapter = !(book.Numero === 66 && chapter === 22)

        if (hasNextChapter) {
          goToNextChapter()
        }
        break
      }
      case SWIPE_RIGHT: {
        const { goToPrevChapter, book, chapter } = props
        const hasPreviousChapter = !(book.Numero === 1 && chapter === 1)

        if (hasPreviousChapter) {
          goToPrevChapter()
        }
        break
      }
      case SWIPE_DOWN: {
        console.log('SWIPE_DOWN')
        setIsFullScreenBible(true)
        isFullScreenBibleValue.value = true
        break
      }
      case SWIPE_UP: {
        setIsFullScreenBible(false)
        isFullScreenBibleValue.value = false
        break
      }
      case OPEN_HIGHLIGHT_TAGS: {
        const { setMultipleTagsItem } = props
        const { verseIds } = action.payload
        const obj = {
          entity: 'highlights',
          ids: Object.fromEntries(verseIds.map((v: any) => [v, true])),
        }
        setMultipleTagsItem(obj)
        break
      }

      default: {
        break
      }
    }
  }

  // if (isLoading && !verses.length) {
  //   return (
  //     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  //       <ActivityIndicator />
  //     </View>
  //   )
  // }

  return (
    <BibleDOMComponent
      dom={{
        containerStyle: {
          flex: 1,
          backgroundColor: theme.colors.reverse,
          zIndex: -1,
          ...(Platform.OS === 'android' && {
            marginTop: insets.top,
            marginBottom: insets.bottom,
          }),
        },
        onError: (error) => {
          Alert.alert('Error', error.nativeEvent.description)
        },
        onRenderProcessGone(event) {
          Alert.alert('Render process gone', event.nativeEvent.didCrash)
        },
        renderError: (errorDomain, errorCode, errorDesc) => {
          return (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text>Error</Text>
              <Text>{errorDomain}</Text>
              <Text>{errorCode}</Text>
              <Text>{errorDesc}</Text>
            </View>
          )
        },
      }}
      verses={verses}
      parallelVerses={parallelVerses}
      focusVerses={focusVerses}
      secondaryVerses={secondaryVerses}
      selectedVerses={selectedVerses}
      highlightedVerses={highlightedVerses}
      notedVerses={notedVerses}
      settings={settings}
      verseToScroll={verseToScroll}
      isReadOnly={isReadOnly}
      version={version}
      pericopeChapter={pericopeChapter}
      chapter={chapter}
      isSelectionMode={isSelectionMode}
      selectedCode={selectedCode}
      comments={comments}
      dispatch={dispatch}
    />
  )
}
