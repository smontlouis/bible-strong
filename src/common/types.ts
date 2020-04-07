export interface User {
  id: string
  displayName: string
  photoUrl: string
}

export interface Plan {
  id: string
  title: string
  sections: Section[]
  author: User
}

export enum Status {
  Idle = 'Idle',
  Next = 'Next',
  Progress = 'Progress',
  Completed = 'Completed',
}

export interface MyPlan extends Omit<Plan, 'sections'> {
  status: Status
  progress: number
  sections: MySection[]
}

export interface Section {
  id: string
  title: string
  subTitle: string
  description?: string
  image?: string
  readingSlices: ReadingSlice[]
}

export interface MySection extends Omit<Section, 'readingSlices'> {
  progress: number
  readingSlices: MyReadingSlice[]
}

export enum SliceType {
  Text = 'Text',
  Image = 'Image',
  Verse = 'Verse',
  Chapter = 'Chapter',
  Video = 'Video',
}

export interface ReadingSlice {
  id: string
  description?: string
  slices: EntitySlice[]
}

export interface MyReadingSlice extends ReadingSlice {
  status?: Status
}

export type EntitySlice =
  | TextSlice
  | VerseSlice
  | ChapterSlice
  | VideoSlice
  | ImageSlice
export type MyEntitySlice = EntitySlice & {
  status?: Status
}

export interface TextSlice {
  id: string
  type: SliceType.Text
  title?: string
  description: string
}

export interface ImageSlice {
  id: string
  alt?: string
  src: string
  type: SliceType.Image
}

export interface VerseSlice {
  id: string
  type: SliceType.Verse
  verses: string[] | string
  subType?: 'pray'
}

export interface ChapterSlice {
  id: string
  type: SliceType.Chapter
  chapters: string[] | string
  subType?: 'pray'
}

export interface VideoSlice {
  id: string
  type: SliceType.Video
  title: string
  description?: string
  url: string
}
