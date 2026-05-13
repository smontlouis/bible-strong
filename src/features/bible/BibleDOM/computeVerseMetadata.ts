import { TagsObj, Verse } from '~common/types'
import { HighlightsObj, NotesObj, LinksObj } from '~redux/modules/user'
import type { TaggedVerse, NotedVerse, LinkedVerse, WebViewProps } from './BibleDOMWrapper'

export interface AnnotationNotesInfo {
  versesWithAnnotationNotes: Record<string, boolean>
  annotationNotesCountByVerse: { [key: string]: number }
}

export function sortVersesToTags(highlightedVerses: HighlightsObj): TaggedVerse[] | null {
  if (!highlightedVerses) return null

  const grouped = Object.keys(highlightedVerses).reduce(
    (
      arr: {
        date: number
        color: string
        verseIds: string[]
        tags: TagsObj
      }[],
      verse
    ) => {
      const entry = highlightedVerses[verse]
      let dateGroup = arr.find(a => a.date === entry.date)

      if (!dateGroup) {
        dateGroup = {
          date: entry.date,
          color: entry.color,
          verseIds: [],
          tags: {},
        }
        arr.push(dateGroup)
      }

      dateGroup.verseIds.push(verse)
      dateGroup.tags = { ...dateGroup.tags, ...entry.tags }

      return arr
    },
    []
  )

  // Sort once after grouping is complete (not inside each reduce iteration)
  grouped.sort((a, b) => Number(b.date) - Number(a.date))
  grouped.forEach(group => {
    group.verseIds.sort((a: string, b: string) => {
      const aVerset = Number(a.split('-')[2])
      const bVerset = Number(b.split('-')[2])
      return aVerset - bVerset
    })
  })

  return grouped.map(group => ({
    ...group,
    lastVerse: group.verseIds[group.verseIds.length - 1],
    tags: Object.values(group.tags),
  }))
}

export function getAnnotationNotesInfo(
  verses: Verse[],
  wordAnnotations: WebViewProps['wordAnnotations'],
  version: string
): AnnotationNotesInfo {
  const versesWithAnnotationNotes: Record<string, boolean> = {}
  const annotationNotesCountByVerse: { [key: string]: number } = {}

  if (!verses?.length || !wordAnnotations) {
    return { versesWithAnnotationNotes, annotationNotesCountByVerse }
  }

  const { Livre, Chapitre } = verses[0]

  Object.values(wordAnnotations).forEach(annotation => {
    if (annotation.version !== version || !annotation.noteId) return

    annotation.ranges.forEach(range => {
      const [bookStr, chapterStr, verseStr] = range.verseKey.split('-')
      if (parseInt(bookStr) === Livre && parseInt(chapterStr) === Chapitre) {
        versesWithAnnotationNotes[verseStr] = true
        annotationNotesCountByVerse[verseStr] = (annotationNotesCountByVerse[verseStr] || 0) + 1
      }
    })
  })

  return { versesWithAnnotationNotes, annotationNotesCountByVerse }
}

export function getNotedVersesCount(
  verses: Verse[],
  notedVerses: NotesObj,
  annotationNotesCountByVerse: { [key: string]: number }
): { [key: string]: number } {
  const newNotedVerses: { [key: string]: number } = {}
  if (!verses?.length) return newNotedVerses

  const { Livre, Chapitre } = verses[0]

  // Count classic verse notes
  Object.keys(notedVerses).forEach(key => {
    // Ignore annotation notes (counted separately)
    if (key.startsWith('annotation:')) return

    const firstVerseRef = key.split('/')[0]
    const [bookStr, chapterStr, verseStr] = firstVerseRef.split('-')
    const bookNumber = parseInt(bookStr)
    const chapterNumber = parseInt(chapterStr)

    if (bookNumber === Livre && chapterNumber === Chapitre) {
      newNotedVerses[verseStr] = (newNotedVerses[verseStr] || 0) + 1
    }
  })

  // Add annotation notes (already calculated)
  Object.entries(annotationNotesCountByVerse).forEach(([verseStr, count]) => {
    newNotedVerses[verseStr] = (newNotedVerses[verseStr] || 0) + count
  })

  return newNotedVerses
}

export function getNotedVersesText(
  verses: Verse[],
  notedVerses: NotesObj
): { [key: string]: NotedVerse[] } {
  const newNotedVerses: { [key: string]: NotedVerse[] } = {}

  if (!verses?.length) return newNotedVerses

  const { Livre, Chapitre } = verses[0]
  Object.entries(notedVerses).forEach(([key, value]) => {
    const versesInArray = key.split('/')

    const lastVerseRef = versesInArray[versesInArray.length - 1]
    const bookNumber = parseInt(lastVerseRef.split('-')[0])
    const chapterNumber = parseInt(lastVerseRef.split('-')[1])
    const verseNumber = lastVerseRef.split('-')[2]

    if (bookNumber === Livre && chapterNumber === Chapitre) {
      const verseToPush = {
        key,
        verses:
          versesInArray.length > 1
            ? `${versesInArray[0].split('-')[2]}-${
                versesInArray[versesInArray.length - 1].split('-')[2]
              }`
            : versesInArray[0].split('-')[2],
        ...value,
      }
      if (newNotedVerses[verseNumber]) {
        newNotedVerses[verseNumber].push(verseToPush)
      } else {
        newNotedVerses[verseNumber] = [verseToPush]
      }
    }
  })

  return newNotedVerses
}

export function getLinkedVersesCount(
  verses: Verse[],
  linkedVerses: LinksObj | undefined
): { [key: string]: number } {
  const newLinkedVerses: { [key: string]: number } = {}
  if (!verses?.length || !linkedVerses) return newLinkedVerses

  const { Livre, Chapitre } = verses[0]
  Object.keys(linkedVerses).forEach(key => {
    const firstVerseRef = key.split('/')[0]
    const bookNumber = parseInt(firstVerseRef.split('-')[0])
    const chapterNumber = parseInt(firstVerseRef.split('-')[1])
    const verseNumber = firstVerseRef.split('-')[2]
    if (bookNumber === Livre && chapterNumber === Chapitre) {
      newLinkedVerses[verseNumber] = (newLinkedVerses[verseNumber] || 0) + 1
    }
  })

  return newLinkedVerses
}

export function getLinkedVersesText(
  verses: Verse[],
  linkedVerses: LinksObj | undefined
): { [key: string]: LinkedVerse[] } {
  const newLinkedVerses: { [key: string]: LinkedVerse[] } = {}

  if (!verses?.length || !linkedVerses) return newLinkedVerses

  const { Livre, Chapitre } = verses[0]
  Object.entries(linkedVerses).forEach(([key, value]) => {
    const versesInArray = key.split('/')

    const lastVerseRef = versesInArray[versesInArray.length - 1]
    const bookNumber = parseInt(lastVerseRef.split('-')[0])
    const chapterNumber = parseInt(lastVerseRef.split('-')[1])
    const verseNumber = lastVerseRef.split('-')[2]

    if (bookNumber === Livre && chapterNumber === Chapitre) {
      const formattedUrl = value.url?.replace(/^https?:\/\//, '')
      const title = value.customTitle || value.ogData?.title || formattedUrl
      const verseToPush: LinkedVerse = {
        key,
        verses:
          versesInArray.length > 1
            ? `${versesInArray[0].split('-')[2]}-${
                versesInArray[versesInArray.length - 1].split('-')[2]
              }`
            : versesInArray[0].split('-')[2],
        url: value.url,
        title,
        linkType: value.linkType || 'website',
        date: value.date,
        tags: value.tags,
      }
      if (newLinkedVerses[verseNumber]) {
        newLinkedVerses[verseNumber].push(verseToPush)
      } else {
        newLinkedVerses[verseNumber] = [verseToPush]
      }
    }
  })

  return newLinkedVerses
}

/**
 * Transform comment keys so that each comment is associated with the verse
 * number BEFORE the next comment starts (i.e., the last verse of its section).
 */
export function transformComments(
  comments: { [key: string]: string } | null,
  versesLength: number
): { [key: string]: string } | null {
  if (!comments) return null

  const entries = Object.entries(comments)
  const result: { [key: string]: string } = {}

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i]

    if (key === '0') {
      result[key] = value
      continue
    }

    const nextEntry = entries[i + 1]
    if (nextEntry) {
      const newKey = Number(nextEntry[0]) - 1
      result[newKey] = value
    } else {
      result[versesLength] = value
    }
  }

  return result
}
