import { TagsObj, Verse } from '~common/types'
import { HighlightsObj, NotesObj, LinksObj, StudyRelationsObj } from '~redux/modules/user'
import {
  endpointIdentity,
  getEndpointFallbackLabel,
  type RelationEndpoint,
} from '~features/studyRelations/domain'
import type {
  TaggedVerse,
  NotedVerse,
  LinkedVerse,
  VerseRelationItem,
  WebViewProps,
} from './BibleDOMWrapper'

export interface AnnotationNotesInfo {
  versesWithAnnotationNotes: Record<string, boolean>
  annotationNotesCountByVerse: { [key: string]: number }
}

type VerseItemDisplayMode = 'inline' | 'block'

const getVerseRefsFromMetadataKey = (key: string): string[] => key.split('#')[0].split('/')

const getAnchorVerseRef = (verseRefs: string[], displayMode: VerseItemDisplayMode): string =>
  displayMode === 'inline' ? verseRefs[verseRefs.length - 1] : verseRefs[0]

const relationTargetOrder: Record<string, number> = {
  note: 0,
  externalLink: 1,
  study: 2,
  verse: 3,
  strong: 4,
  nave: 5,
  dictionary: 6,
  word: 7,
}

const getRelationAnchorVerse = (
  endpoint: Extract<RelationEndpoint, { type: 'verse' }>,
  displayMode: VerseItemDisplayMode
) => getAnchorVerseRef(endpoint.verseKeys, displayMode)

const getRelationTargetEndpoint = (
  relation: StudyRelationsObj[string],
  activeEndpoint: RelationEndpoint
) => {
  const activeKey = endpointIdentity(activeEndpoint)
  return relation.endpoints.find(endpoint => endpointIdentity(endpoint) !== activeKey)
}

const getTargetEntityExists = (
  endpoint: RelationEndpoint,
  data: { notes?: NotesObj; links?: LinksObj }
) => {
  switch (endpoint.type) {
    case 'note':
      return Boolean(
        data.notes?.[endpoint.noteId] ||
        Object.values(data.notes || {}).some(note => note.id === endpoint.noteId)
      )
    case 'externalLink':
      return Boolean(
        data.links?.[endpoint.linkId] ||
        Object.values(data.links || {}).some(link => link.id === endpoint.linkId)
      )
    default:
      return true
  }
}

const getRelationTargetLabel = (
  endpoint: RelationEndpoint,
  data: { notes?: NotesObj; links?: LinksObj }
) => {
  switch (endpoint.type) {
    case 'note': {
      const note =
        data.notes?.[endpoint.noteId] ||
        Object.values(data.notes || {}).find(note => note.id === endpoint.noteId)
      return note?.title || note?.description || getEndpointFallbackLabel(endpoint)
    }
    case 'externalLink': {
      const link =
        data.links?.[endpoint.linkId] ||
        Object.values(data.links || {}).find(link => link.id === endpoint.linkId)
      return (
        link?.customTitle || link?.ogData?.title || link?.url || getEndpointFallbackLabel(endpoint)
      )
    }
    default:
      return getEndpointFallbackLabel(endpoint)
  }
}

const sortRelationItems = (items: VerseRelationItem[]) =>
  items.sort((a, b) => {
    const orderDiff =
      (relationTargetOrder[a.targetEndpoint.type] ?? 99) -
      (relationTargetOrder[b.targetEndpoint.type] ?? 99)
    if (orderDiff) return orderDiff
    return b.updatedAt - a.updatedAt
  })

export function getVerseRelationsMetadata(
  verses: Verse[],
  relations: StudyRelationsObj | undefined,
  displayMode: VerseItemDisplayMode = 'inline',
  data: { notes?: NotesObj; links?: LinksObj } = {}
): {
  counts: { [key: string]: number }
  items: { [key: string]: VerseRelationItem[] }
} {
  const counts: { [key: string]: number } = {}
  const items: { [key: string]: VerseRelationItem[] } = {}
  if (!verses?.length || !relations) return { counts, items }

  const { Livre, Chapitre } = verses[0]

  for (const relation of Object.values(relations)) {
    for (const endpoint of relation.endpoints) {
      if (endpoint.type !== 'verse') continue
      const anchorVerseRef = getRelationAnchorVerse(endpoint, displayMode)
      const [bookStr, chapterStr, verseStr] = anchorVerseRef.split('-')
      if (Number(bookStr) !== Livre || Number(chapterStr) !== Chapitre) continue

      const targetEndpoint = getRelationTargetEndpoint(relation, endpoint)
      if (!targetEndpoint) continue
      const targetEntityExists = getTargetEntityExists(targetEndpoint, data)

      counts[verseStr] = (counts[verseStr] || 0) + 1
      const item: VerseRelationItem = {
        key: `${relation.id}:${endpointIdentity(endpoint)}`,
        relationId: relation.id,
        relationType: relation.type,
        relationKind: relation.kind,
        targetEndpoint,
        targetType: targetEndpoint.type,
        label: getRelationTargetLabel(targetEndpoint, data),
        targetIsAvailable: targetEntityExists || targetEndpoint.type !== 'note',
        targetEntityExists,
        verseIds: endpoint.verseKeys,
        updatedAt: relation.updatedAt,
      }

      if (items[verseStr]) {
        items[verseStr].push(item)
      } else {
        items[verseStr] = [item]
      }
    }
  }

  Object.values(items).forEach(sortRelationItems)

  return { counts, items }
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
  annotationNotesCountByVerse: { [key: string]: number },
  displayMode: VerseItemDisplayMode = 'inline'
): { [key: string]: number } {
  const newNotedVerses: { [key: string]: number } = {}
  if (!verses?.length) return newNotedVerses

  const { Livre, Chapitre } = verses[0]

  // Count classic verse notes
  Object.keys(notedVerses).forEach(key => {
    // Ignore annotation notes (counted separately)
    if (key.startsWith('annotation:')) return

    const verseRef = getAnchorVerseRef(getVerseRefsFromMetadataKey(key), displayMode)
    const [bookStr, chapterStr, verseStr] = verseRef.split('-')
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
    const versesInArray = getVerseRefsFromMetadataKey(key)
    const anchorVerseRef = getAnchorVerseRef(versesInArray, 'inline')

    const verseToPush = {
      key,
      id: value.id,
      verses:
        versesInArray.length > 1
          ? `${versesInArray[0].split('-')[2]}-${
              versesInArray[versesInArray.length - 1].split('-')[2]
            }`
          : versesInArray[0].split('-')[2],
      verseIds: versesInArray,
      ...value,
    }

    const bookNumber = parseInt(anchorVerseRef.split('-')[0])
    const chapterNumber = parseInt(anchorVerseRef.split('-')[1])
    const verseNumber = anchorVerseRef.split('-')[2]

    if (bookNumber !== Livre || chapterNumber !== Chapitre) return

    if (newNotedVerses[verseNumber]) {
      newNotedVerses[verseNumber].push(verseToPush)
    } else {
      newNotedVerses[verseNumber] = [verseToPush]
    }
  })

  return newNotedVerses
}

export function getLinkedVersesCount(
  verses: Verse[],
  linkedVerses: LinksObj | undefined,
  displayMode: VerseItemDisplayMode = 'inline'
): { [key: string]: number } {
  const newLinkedVerses: { [key: string]: number } = {}
  if (!verses?.length || !linkedVerses) return newLinkedVerses

  const { Livre, Chapitre } = verses[0]
  Object.keys(linkedVerses).forEach(key => {
    const verseRef = getAnchorVerseRef(getVerseRefsFromMetadataKey(key), displayMode)
    const bookNumber = parseInt(verseRef.split('-')[0])
    const chapterNumber = parseInt(verseRef.split('-')[1])
    const verseNumber = verseRef.split('-')[2]
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
    const versesInArray = getVerseRefsFromMetadataKey(key)
    const anchorVerseRef = getAnchorVerseRef(versesInArray, 'inline')

    const formattedUrl = value.url?.replace(/^https?:\/\//, '')
    const title = value.customTitle || value.ogData?.title || formattedUrl
    const verseToPush: LinkedVerse = {
      key,
      id: value.id,
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

    const bookNumber = parseInt(anchorVerseRef.split('-')[0])
    const chapterNumber = parseInt(anchorVerseRef.split('-')[1])
    const verseNumber = anchorVerseRef.split('-')[2]

    if (bookNumber !== Livre || chapterNumber !== Chapitre) return

    if (newLinkedVerses[verseNumber]) {
      newLinkedVerses[verseNumber].push(verseToPush)
    } else {
      newLinkedVerses[verseNumber] = [verseToPush]
    }
  })

  return newLinkedVerses
}

export function getStudyRelationsCount(
  verses: Verse[] | undefined,
  studyRelations: StudyRelationsObj | undefined
): { [key: string]: number } {
  const counts: { [key: string]: number } = {}
  if (!verses?.length || !studyRelations) return counts

  const visibleVerseKeys = new Set(
    verses.map(verse => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`)
  )

  for (const relation of Object.values(studyRelations)) {
    const countedVerseKeys = new Set<string>()
    for (const endpoint of relation.endpoints) {
      if (endpoint.type !== 'verse') continue
      const verseKey = endpoint.verseKeys[0]
      if (verseKey && visibleVerseKeys.has(verseKey)) {
        countedVerseKeys.add(verseKey)
      }
    }

    for (const verseKey of countedVerseKeys) {
      const verse = verseKey.split('-')[2]
      counts[verse] = (counts[verse] || 0) + 1
    }
  }

  return counts
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
