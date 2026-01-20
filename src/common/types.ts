import { logTypes } from '~helpers/changelog'

export type Status = 'Idle' | 'Pending' | 'Resolved' | 'Rejected'

export interface User {
  id: string
  displayName: string
  photoUrl: string
}

export interface Plan {
  id: string
  lastUpdate?: number
  downloads?: number
  title: string
  subTitle?: string
  image?: string
  description?: string
  sections: Section[]
  author: User
  type: 'yearly' | 'meditation'
  lang: 'fr' | 'en'
}

export interface OngoingPlan {
  id: string
  status: PlanStatus
  readingSlices: { [id: string]: PlanStatus }
}

type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export interface OnlinePlan extends WithOptional<Plan, 'sections'> {
  featured?: boolean
}

export type PlanStatus = 'Idle' | 'Next' | 'Progress' | 'Completed'

export interface ComputedPlanItem extends Omit<Plan, 'sections'> {
  status: PlanStatus
  progress: number
}
export interface ComputedPlan extends Omit<Plan, 'sections'> {
  status: PlanStatus
  progress: number
  sections: ComputedSection[]
}

export interface Section {
  id: string
  title: string
  subTitle: string
  description?: string
  image?: string
  readingSlices: ReadingSlice[]
}

export interface ComputedSection extends Omit<Section, 'readingSlices'> {
  progress: number
  data: ComputedReadingSlice[]
}

export type SliceType = 'Text' | 'Image' | 'Verse' | 'Chapter' | 'Video'

export interface ReadingSlice {
  id: string
  title?: string
  slices: EntitySlice[]
}

export interface ComputedReadingSlice extends ReadingSlice {
  status?: PlanStatus
}

export type EntitySlice =
  | TitleSlice
  | TextSlice
  | VerseSlice
  | ChapterSlice
  | VideoSlice
  | ImageSlice

export interface TitleSlice {
  id: string
  type: 'Title'
  title: string
}
export interface TextSlice {
  id: string
  type: 'Text'
  title?: string
  description: string
  subType?: string
}

export interface ImageSlice {
  id: string
  alt?: string
  src: string
  type: 'Image'
}

export interface VerseSlice {
  id?: string
  type?: 'Verse'
  verses: string
  subType?: string
}

export interface ChapterSlice {
  id: string
  type: 'Chapter'
  chapters: string
  subType?: string
}

export interface VideoSlice {
  id: string
  type: 'Video'
  title: string
  description?: string
  url: string
}

export interface OngoingReadingSlice {
  id: string
  status: PlanStatus
}

export type SubscriptionType = 'premium' | 'lifetime' | null

export interface Verse {
  Livre: string | number
  Chapitre: string | number
  Verset: string | number
  Texte: string
}

export interface Pericope {
  [book: string]: {
    [chapter: string]: {
      [verse: string]: {
        [key: string]: string
      }
    }
  }
}

export interface Tag {
  id: string
  name: string
  highlights?: {
    [verse: string]: true
  }
  date: number
  notes?: {
    [verse: string]: true
  }
  links?: {
    [verse: string]: true
  }
  studies?: {
    [id: string]: true
  }
  strongsHebreu?: {
    [id: string]: true
  }
  strongsGrec?: {
    [id: string]: true
  }
  words?: {
    [id: string]: true
  }
  naves?: {
    [id: string]: true
  }
  wordAnnotations?: {
    [id: string]: true
  }
}

export interface TagsObj {
  [id: string]: Tag
}

export interface VerseRefContent {
  title: string
  version: string
  content: string
  all: string
}

export type LogType = keyof typeof logTypes

export interface ChangelogItem {
  date: string
  description: string
  description_en: string
  title: string
  title_en: string
  type: LogType
}

export type PreferredColorScheme = 'light' | 'dark' | 'auto'
export type PreferredLightTheme = 'default' | 'sepia' | 'nature' | 'sunset'
export type PreferredDarkTheme = 'dark' | 'black' | 'night' | 'mauve'
export type CurrentTheme = PreferredLightTheme | PreferredDarkTheme

export type StrongReference = {
  Hebreu: string
  Grec: string
  Mot: string
  Code: string
  Phonetique: string
  Definition: string
  Type: string
  LSG: string
  Origine: string
  date: string
  book: string
  error?: string
}

export type StudyNavigateBibleType = 'verse' | 'verse-block' | 'strong' | 'strong-block'

export type VerseIds = {
  [verse: string]: true
}

export type BibleResource = 'strong' | 'commentary' | 'dictionary' | 'nave' | 'reference'

export type RemoteConfigValue = 'enable_tts_public'

export type SelectedCode = {
  reference: string
  book: number
}

export interface HighlightFilters {
  colorId?: string // 'color1', 'color2', 'custom-xxx', ou undefined (tous)
  tagId?: string // ID du tag, ou undefined (tous)
}
export interface Bookmark {
  id: string
  name: string
  color: string
  book: number
  chapter: number
  verse?: number // undefined pour les bookmarks de chapitre
  date: number
  version?: string
}

export interface BookmarksObj {
  [id: string]: Bookmark
}
