import { PrimitiveAtom } from 'jotai/vanilla'
import { BibleTab, VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import { ComputedPlanItem, ComputedReadingSlice, StrongReference } from '~common/types'

type VersionSelectorProps = {
    parallelVersionIndex?: number
    bibleAtom: PrimitiveAtom<BibleTab>
}

type StrongScreenProps = {
    book: number
    reference: string
    strongReference: StrongReference
}

type BibleScreenProps = {
    focusVerses?: string[]
    isSelectionMode?: boolean
    isReadOnly?: boolean
    book: Book | number
    chapter: number
    verse: number
    version: VersionCode
}

type StudiesScreenProps = {
    studyId?: string
  }

type LexiqueScreenProps = {}

type EditStudyScreenProps = {
    studyId: string
    canEdit?: boolean
    hasBackButton?: boolean
    openedFromTab?: boolean
}

type DictionaryDetailScreenProps = {
    word: string
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
    planId: string
    readingSlice: ComputedReadingSlice
}

type TimelineScreenProps = {
    goTo: number
}

type CommentariesScreenProps = {
    verse: string
}

export type MainStackProps = {
    AppSwitcher: undefined
    More: undefined
    Home: undefined
    BibleSelect: undefined
    VersionSelector: VersionSelectorProps
    BibleVerseDetail: { book: number; chapter: number; verse: number }
    BibleVerseNotes: { book: number; chapter: number; verse: number }
    Highlights: undefined
    Strong: StrongScreenProps
    DictionnaireVerseDetail: { book: number; chapter: number; verse: number }
    ConcordanceByBook: { book: number; chapter: number }
    BibleView: BibleScreenProps
    BibleCompareVerses: undefined
    Studies: StudiesScreenProps
    Lexique: LexiqueScreenProps
    EditStudy: EditStudyScreenProps
    DictionnaryDetail: DictionaryDetailScreenProps
    Login: undefined
    Support: undefined
    ModifyColors: undefined
    Changelog: undefined
    ImportExport: undefined
    Pericope: undefined
    History: undefined
    Tags: undefined
    Tag: { tag: string }
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
    Concordance: undefined
    Commentaries: CommentariesScreenProps
    BibleShareOptions: undefined
}