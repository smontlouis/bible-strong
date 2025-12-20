import { PrimitiveAtom } from 'jotai/vanilla'
import { TranslationProps } from 'react-i18next'
import { Insets } from 'react-native'
import { EdgeInsets } from 'react-native-safe-area-context'
import { BibleTab, SelectedVerses, VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import {
  ComputedPlanItem,
  ComputedReadingSlice,
  StrongReference,
  StudyNavigateBibleType,
} from '~common/types'
import { Theme } from '~themes/index'

interface Verse {
  Livre: string
  Chapitre: string
  Verset: number
}

type AppSwitcherScreenProps = {
  openMenu?: () => void
  openHome?: () => void
}

type MoreScreenProps = {
  closeMenu: () => void
}

type HomeScreenProps = {
  closeHome: () => void
}

type BibleSelectScreenProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
}

type VersionSelectorProps = {
  parallelVersionIndex?: number
  bibleAtom: PrimitiveAtom<BibleTab>
}

type BibleVerseDetailScreenProps = {
  book: number
  chapter: number
  verse: Verse
  isSelectionMode: boolean
  theme: Theme
  insets: EdgeInsets
}

type BibleVerseNotesScreenProps = {
  book?: number
  chapter?: number
  verse: string
  withBack: boolean
}

type StrongScreenProps =
  | {
      book: number
      reference: string
    }
  | {
      book: number
      strongReference: StrongReference
    }

type DictionnaireVerseDetailScreenProps = {
  verse: Verse
}

type ConcordanceByBookScreenProps = {
  strongReference: StrongReference
  book: number
}

type BibleScreenProps = {
  focusVerses?: number[]
  isSelectionMode?: StudyNavigateBibleType
  isReadOnly?: boolean
  hasBackButton?: boolean
  book?: Book | number
  chapter?: number
  verse?: number
  version?: VersionCode
}

type CompareVersesScreenProps = {
  selectedVerses: SelectedVerses
}

type StudiesScreenProps = {
  studyId?: string
}

type LexiqueScreenProps = {}

export type EditStudyScreenProps = {
  studyId: string
  canEdit?: boolean
  hasBackButton?: boolean
  openedFromTab?: boolean
}

type DictionaryDetailScreenProps = {
  word: string
}

type TagScreenProps = {
  tagId: string
}

type SearchScreenProps = {
  verse: string
}

type DictionaryScreenProps = {}

type NaveScreenProps = {}

type NaveDetailScreenProps = {
  name_lower: string
  name: string
}

type PlanScreenProps = {
  planId: string
  plan: ComputedPlanItem
}

type PlanSliceScreenProps = {
  readingSlice: ComputedReadingSlice & { planId: string }
}

type TimelineScreenProps = {
  goTo: number
}

type ConcordanceScreenProps = {
  strongReference: StrongReference
  book: number
}

type CommentariesScreenProps = {
  verse: string
}

export type MainStackProps = {
  AppSwitcher?: AppSwitcherScreenProps
  More: MoreScreenProps
  Home: HomeScreenProps
  BibleSelect: BibleSelectScreenProps
  VersionSelector: VersionSelectorProps
  BibleVerseDetail: BibleVerseDetailScreenProps
  BibleVerseNotes: BibleVerseNotesScreenProps
  Highlights: undefined
  Strong: StrongScreenProps
  DictionnaireVerseDetail: DictionnaireVerseDetailScreenProps
  ConcordanceByBook: ConcordanceByBookScreenProps
  BibleView: BibleScreenProps
  BibleCompareVerses: CompareVersesScreenProps
  Studies: StudiesScreenProps
  Lexique: LexiqueScreenProps
  EditStudy: EditStudyScreenProps
  DictionnaryDetail: DictionaryDetailScreenProps
  Login: undefined
  Support: undefined
  CustomHighlightColors: undefined
  Changelog: undefined
  ImportExport: undefined
  Pericope: undefined
  History: undefined
  Tags: undefined
  Bookmarks: undefined
  Tag: TagScreenProps
  Downloads: undefined
  Search: undefined
  LocalSearch: undefined
  Register: undefined
  Dictionnaire: DictionaryScreenProps
  FAQ: undefined
  Nave: NaveScreenProps
  NaveDetail: NaveDetailScreenProps
  NaveWarning: undefined
  ToggleCompareVerses: undefined
  Plan: PlanScreenProps
  Plans: undefined
  MyPlanList: undefined
  PlanSlice: PlanSliceScreenProps
  Timeline: TimelineScreenProps
  TimelineHome: undefined
  Concordance: ConcordanceScreenProps
  Commentaries: CommentariesScreenProps
  BibleShareOptions: undefined
  ResourceLanguage: undefined
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends MainStackProps {}
  }
}
