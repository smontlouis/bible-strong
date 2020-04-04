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

export interface MyPlan extends Omit<Plan, 'sections'> {
  isComplete?: boolean
  progress?: number
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

export interface MySection {
  progress?: number
}

enum SliceType {
  Text = 'Text',
  Verse = 'Verse',
  Chapter = 'Chapter',
  Video = 'Video',
}

export interface ReadingSlice {
  id: string
  description: string
  slices: (TextSlice | VerseSlice | ChapterSlice | VideoSlice)[]
}

export interface TextSlice {
  id: string
  type: SliceType.Text
  title?: string
  description: string
}

export interface VerseSlice {
  id: string
  type: SliceType.Verse
  verses: string[]
}

export interface ChapterSlice {
  id: string
  type: SliceType.Chapter
  image?: string
  chapters: string[]
}

export interface VideoSlice {
  id: string
  type: SliceType.Video
  title: string
  description?: string
  url: string
}
