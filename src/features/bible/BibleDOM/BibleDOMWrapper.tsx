import { StackNavigationProp } from '@react-navigation/stack'
import { PrimitiveAtom } from 'jotai/vanilla'
import { BibleTab, VersionCode } from 'src/state/tabs'
import { MainStackProps } from '~navigation/type'
import BibleDOMComponent from './BibleDOMComponent'
import { Book } from '~assets/bible_versions/books-desc'
import {
  Pericope,
  SelectedCode,
  StudyNavigateBibleType,
  Tag,
  Verse,
  VerseIds,
} from '~common/types'
import { HighlightsObj, NotesObj } from '~redux/modules/user'
import { View } from 'react-native'
import { RootState } from '~redux/modules/reducer'

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
  fontFamily: string
  verseToScroll: number | undefined
  pericopeChapter: PericopeChapter
  openNoteModal: any
  setSelectedCode: (selectedCode: SelectedCode) => void
  selectedCode: SelectedCode | null
  comments: any
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
    fontFamily,
  } = props

  const dispatch: Dispatch = async ({ type, payload }) => {
    console.log('dispatch', type, payload)
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
        fontFamily={fontFamily}
        dispatch={dispatch}
      />
    </View>
  )
}
