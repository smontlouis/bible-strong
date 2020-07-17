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

export interface OngoingPlan {
  id: string
  status: PlanStatus
  readingSlices: { [id: string]: PlanStatus }
}

export interface OngoingReadingSlice {
  id: string
  status: PlanStatus
}

export type SubscriptionType = 'premium' | 'lifetime' | null

export interface Verse {
  Livre: string
  Chapitre: string
  Verset: string
  Texte: string
}
