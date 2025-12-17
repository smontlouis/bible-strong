import { StackNavigationProp } from '@react-navigation/stack'
import { PrimitiveAtom } from 'jotai/vanilla'
import { MainStackProps } from '../../../../../navigation/type'
import { BibleTab, VersionCode } from '../../../../../state/tabs'
import { Book } from '../../../../../assets/bible_versions/books-desc'
import {
  Pericope,
  SelectedCode,
  StudyNavigateBibleType,
  Tag,
  Verse,
  VerseIds,
} from '../../../../../common/types'
import { RootState } from '../../../../../redux/modules/reducer'
import { HighlightsObj, NotesObj } from '../../../../../redux/modules/user'
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

export type Dispatch = (props: { type: string; [key: string]: any }) => Promise<void>

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
