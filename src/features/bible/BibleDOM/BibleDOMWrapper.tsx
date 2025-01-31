import { StackNavigationProp } from '@react-navigation/stack'
import { PrimitiveAtom } from 'jotai/vanilla'
import { BibleTab, VersionCode } from 'src/state/tabs'
import { MainStackProps } from '~navigation/type'
import BibleDOMComponent from './BibleDOMComponent'
import books from '~assets/bible_versions/books'
import * as Haptics from 'expo-haptics'
import {
  Pericope,
  SelectedCode,
  StudyNavigateBibleType,
  Tag,
  Verse,
  VerseIds,
} from '~common/types'
import { HighlightsObj, NotesObj } from '~redux/modules/user'
import { Platform, View } from 'react-native'
import { RootState } from '~redux/modules/reducer'
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
} from './dispatch'
import Snackbar from '~common/SnackBar'
import * as Sentry from '@sentry/react-native'
import { Book } from '~assets/bible_versions/books-desc'
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
  } = props

  const dispatch: Dispatch = async action => {
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
        const { navigation, bibleAtom } = props
        const { version, index } = action.payload

        // index = 0 is Default one
        navigation.navigate('VersionSelector', {
          bibleAtom,
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
          key => books[key][0].toUpperCase() === action.bookCode
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
      case OPEN_HIGHLIGHT_TAGS: {
        const { setMultipleTagsItem } = props
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

  return (
    <View
      style={{
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <BibleDOMComponent
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
    </View>
  )
}
