export interface TimelineSection {
  id: string
  image: string
  description: string
  descriptionEn: string
  startYear: number
  endYear: number
  interval: number
  title: string
  titleEn: string
  sectionTitle: string
  sectionTitleEn: string
  subTitle: string
  subTitleEn: string
  color: string
  events: TimelineEvent[]
}

export type ShallowTimelineSection = Omit<TimelineSection, 'events'>

export interface TimelineEvent {
  id: number
  title: string
  titleEn: string
  approx?: boolean
  image?: string
  slug: string
  start: number
  end: number
  row: number
  isFixed?: boolean
  type: 'major' | 'minor'
}

export interface TimelineEventDetail {
  title: string
  description: string
  article: string
  period: string
  slug: string
  id: string
  dates: string
  related: { slug: string; title: string }[]
  images: { caption: string; file: string }[]
  videos: { title: string; caption: string; filename: string }[]
  scriptures: string[]
}
