import { PrimitiveAtom } from 'jotai/vanilla'
import { BibleTab, SelectedVerses, VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import { ComputedPlanItem, ComputedReadingSlice, StrongReference } from '~common/types'

type AppSwitcherScreenProps = {
    openMenu: () => void
    openHome: () => void
}

type MoreScreenProps = {
    closeMenu: () => void
}

type HomeScreenProps = {
    closeHome: () => void
}

type VersionSelectorProps = {
    parallelVersionIndex?: number
    bibleAtom: PrimitiveAtom<BibleTab>
}

type BibleVerseDetailScreenProps = {
    book: number
    chapter: number
    verse: number
}

type BibleVerseNotesScreenProps = {
    book: number
    chapter: number
    verse: number
}

type StrongScreenProps = {
    book: number
    reference: string
    strongReference: StrongReference
}

interface Verse {
    Livre: string
    Chapitre: string
    Verset: number
}

type DictionnaireVerseDetailScreenProps = {
    verse: Verse
}

type ConcordanceByBookScreenProps = {
    strongReference: StrongReference
    book: number
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

type CompareVersesScreenProps = {
    selectedVerses: SelectedVerses
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

type ConcordanceScreenProps = {
    strongReference: StrongReference
    book: number
}

type CommentariesScreenProps = {
    verse: string
}

export type MainStackProps = {
    AppSwitcher: AppSwitcherScreenProps
    More: MoreScreenProps
    Home: HomeScreenProps
    BibleSelect: undefined
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
    Concordance: ConcordanceScreenProps
    Commentaries: CommentariesScreenProps
    BibleShareOptions: undefined
}