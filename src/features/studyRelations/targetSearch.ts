import { parseBibleReference } from '~features/search/BibleReferenceWidget'
import type { NotesObj, StudiesObj } from '~redux/modules/user'
import type { RelationEndpoint, RelationEndpointType } from './domain'
import { normalizeStrongCode } from './domain'
import verseToReference from '~helpers/verseToReference'

export type RelationTargetResult = {
  id: string
  type: RelationEndpointType
  title: string
  subtitle?: string
  endpoint: RelationEndpoint
}

type SearchData = {
  notes?: NotesObj
  studies?: StudiesObj
}

const createVerseKeys = (book: number, chapter: number, startVerse: number, endVerse: number) =>
  Array.from(
    { length: endVerse - startVerse + 1 },
    (_, index) => `${book}-${chapter}-${startVerse + index}`
  )

const searchVerseTargets = (query: string): RelationTargetResult[] =>
  parseBibleReference(query).map((segment, index) => {
    const verseKeys = createVerseKeys(
      segment.book,
      segment.chapter,
      segment.startVerse,
      segment.endVerse
    )
    const title = verseToReference(verseKeys)

    return {
      id: `verse:${verseKeys.join('/')}:${index}`,
      type: 'verse',
      title,
      subtitle: 'Passage biblique',
      endpoint: {
        type: 'verse',
        verseKeys,
        label: title,
      },
    }
  })

const searchStrongTargets = (query: string): RelationTargetResult[] => {
  const match = query.trim().match(/^([gh])\s*0*(\d+)$/i)
  if (!match) return []

  const language = match[1].toUpperCase() === 'G' ? 'greek' : 'hebrew'
  const code = normalizeStrongCode(match[2])
  const prefix = language === 'greek' ? 'G' : 'H'

  return [
    {
      id: `strong:${language}:${code}`,
      type: 'strong',
      title: `${prefix}${code}`,
      subtitle: language === 'greek' ? 'Strong grec' : 'Strong hébreu',
      endpoint: {
        type: 'strong',
        language,
        code,
        label: `${prefix}${code}`,
      },
    },
  ]
}

const normalizeText = (text: string) => text.toLowerCase().trim()

const searchNoteTargets = (query: string, notes: NotesObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return Object.entries(notes)
    .filter(([, note]) => {
      const title = normalizeText(note.title || '')
      const description = normalizeText(note.description || '')
      return title.includes(normalizedQuery) || description.includes(normalizedQuery)
    })
    .slice(0, 12)
    .map(([noteId, note]) => {
      const title = note.title || note.description || 'Note sans titre'
      return {
        id: `note:${noteId}`,
        type: 'note',
        title,
        subtitle: 'Note',
        endpoint: {
          type: 'note',
          noteId,
          label: title,
        },
      }
    })
}

const searchStudyTargets = (query: string, studies: StudiesObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return Object.values(studies)
    .filter(study => normalizeText(study.title || '').includes(normalizedQuery))
    .slice(0, 12)
    .map(study => ({
      id: `study:${study.id}`,
      type: 'study',
      title: study.title || 'Étude sans titre',
      subtitle: 'Étude',
      endpoint: {
        type: 'study',
        studyId: study.id,
        label: study.title || 'Étude sans titre',
      },
    }))
}

export const searchRelationTargets = (
  query: string,
  data: SearchData = {}
): RelationTargetResult[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  return [
    ...searchVerseTargets(trimmed),
    ...searchStrongTargets(trimmed),
    ...searchNoteTargets(trimmed, data.notes),
    ...searchStudyTargets(trimmed, data.studies),
  ]
}
