import { parseBibleReference } from '~features/search/BibleReferenceWidget'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import type { NotesObj, StudiesObj } from '~redux/modules/user'
import type { RelationEndpoint, RelationEndpointType } from './domain'
import { normalizeStrongCode } from './domain'
import verseToReference from '~helpers/verseToReference'
import i18n from '~i18n'

export type RelationTargetResult = {
  id: string
  type: RelationEndpointType
  title: string
  subtitle?: string
  description?: string
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
      subtitle: i18n.t('Passage biblique'),
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
      subtitle: language === 'greek' ? i18n.t('Strong grec') : i18n.t('Strong hébreu'),
      endpoint: {
        type: 'strong',
        language,
        code,
        label: `${prefix}${code}`,
      },
    },
  ]
}

export const searchReferenceAndStrongTargets = (query: string): RelationTargetResult[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  return [...searchVerseTargets(trimmed), ...searchStrongTargets(trimmed)]
}

const normalizeText = (text: string) => text.toLowerCase().trim()

export const getNoteTargetItems = (notes: NotesObj = {}): RelationTargetResult[] =>
  Object.entries(notes).map(([noteId, note]) => {
    const title = note.title || note.description || i18n.t('Note sans titre')
    return {
      id: `note:${noteId}`,
      type: 'note',
      title,
      subtitle: i18n.t('Note'),
      description: note.description,
      endpoint: {
        type: 'note',
        noteId,
        label: title,
      },
    }
  })

export const getStudyTargetItems = (studies: StudiesObj = {}): RelationTargetResult[] =>
  Object.entries(studies).map(([studyId, study]) => {
    const id = study.id || studyId
    const title = study.title || i18n.t('Étude sans titre')
    return {
      id: `study:${id}`,
      type: 'study',
      title,
      subtitle: i18n.t('Étude'),
      description: study.content?.ops
        ? deltaToPlainText(study.content.ops as Parameters<typeof deltaToPlainText>[0])
        : undefined,
      endpoint: {
        type: 'study',
        studyId: id,
        label: title,
      },
    }
  })

const searchNoteTargets = (query: string, notes: NotesObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return getNoteTargetItems(notes)
    .filter(note => normalizeText(`${note.title} ${note.subtitle || ''}`).includes(normalizedQuery))
    .slice(0, 12)
}

const searchStudyTargets = (query: string, studies: StudiesObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return getStudyTargetItems(studies)
    .filter(study => normalizeText(study.title).includes(normalizedQuery))
    .slice(0, 12)
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
