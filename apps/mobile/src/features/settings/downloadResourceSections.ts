import type { UnifiedDownloadItem } from './downloadBibleItems'

export type DownloadSectionLanguage = 'fr' | 'en' | 'other'

export interface DownloadResourceSubsection {
  key: string
  title: string
  data: UnifiedDownloadItem[]
}

export interface DownloadResourceSection {
  key: DownloadSectionLanguage
  title: string
  subsections: DownloadResourceSubsection[]
}

export interface DisplayDownloadItem extends UnifiedDownloadItem {
  occurrenceKey: string
  subsectionKey: string
  subsectionTitle: string
  startsSubsection: boolean
}

export interface DownloadResourceSectionInput {
  titles: {
    french: string
    english: string
    original: string
    bibles: string
    commentaries: string
    dictionaries: string
    studyTools: string
    otherResources: string
  }
  french: {
    bibles: UnifiedDownloadItem[]
    commentaries: UnifiedDownloadItem[]
    dictionaries: UnifiedDownloadItem[]
    otherResources: UnifiedDownloadItem[]
  }
  english: {
    bibles: UnifiedDownloadItem[]
    commentaries: UnifiedDownloadItem[]
    dictionaries: UnifiedDownloadItem[]
    otherResources: UnifiedDownloadItem[]
  }
  originalBibles: UnifiedDownloadItem[]
  sharedStudyTools: UnifiedDownloadItem[]
}

const withoutEmptySubsections = (
  subsections: DownloadResourceSubsection[]
): DownloadResourceSubsection[] => subsections.filter(subsection => subsection.data.length > 0)

/**
 * Shared study tools intentionally occur in both language sections with the same
 * resource id. Selection and installation state therefore remain synchronized,
 * while occurrenceKey keeps the two rendered rows distinct for React Native.
 */
export const buildDownloadResourceSections = ({
  titles,
  french,
  english,
  originalBibles,
  sharedStudyTools,
}: DownloadResourceSectionInput): DownloadResourceSection[] => [
  {
    key: 'fr',
    title: titles.french,
    subsections: withoutEmptySubsections([
      { key: 'bibles', title: titles.bibles, data: french.bibles },
      { key: 'commentaries', title: titles.commentaries, data: french.commentaries },
      { key: 'dictionaries', title: titles.dictionaries, data: french.dictionaries },
      { key: 'study-tools', title: titles.studyTools, data: sharedStudyTools },
      { key: 'other-resources', title: titles.otherResources, data: french.otherResources },
    ]),
  },
  {
    key: 'en',
    title: titles.english,
    subsections: withoutEmptySubsections([
      { key: 'bibles', title: titles.bibles, data: english.bibles },
      { key: 'commentaries', title: titles.commentaries, data: english.commentaries },
      { key: 'dictionaries', title: titles.dictionaries, data: english.dictionaries },
      { key: 'study-tools', title: titles.studyTools, data: sharedStudyTools },
      { key: 'other-resources', title: titles.otherResources, data: english.otherResources },
    ]),
  },
  {
    key: 'other',
    title: titles.original,
    subsections: withoutEmptySubsections([
      { key: 'bibles', title: titles.bibles, data: originalBibles },
    ]),
  },
]

export const flattenDownloadSubsections = (
  sectionKey: string,
  subsections: DownloadResourceSubsection[]
): DisplayDownloadItem[] =>
  subsections.flatMap(subsection =>
    subsection.data.map((item, index) => ({
      ...item,
      occurrenceKey: `${sectionKey}:${subsection.key}:${item.id}`,
      subsectionKey: subsection.key,
      subsectionTitle: subsection.title,
      startsSubsection: index === 0,
    }))
  )
