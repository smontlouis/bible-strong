import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import type { RelationsObj } from '~features/studyRelations/domain'
import type { Note, NotesObj } from '~redux/modules/user'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'

export type NoteListRow = {
  id: string
  noteId: string
  reference: string
  note: Note
  title: string
  description: string
  date: number
}

const buildVerseKeysByNoteId = (relations: RelationsObj): Record<string, Set<string>> => {
  const verseKeysByNoteId: Record<string, Set<string>> = {}

  for (const relation of Object.values(relations)) {
    if (relation.type !== 'annotates') continue

    const noteEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'note')
    const verseEndpoint = relation.endpoints.find(endpoint => endpoint.type === 'verse')
    if (noteEndpoint?.type !== 'note' || verseEndpoint?.type !== 'verse') continue

    const verseKeys = verseKeysByNoteId[noteEndpoint.noteId] ?? new Set<string>()
    for (const verseKey of verseEndpoint.verseKeys) verseKeys.add(verseKey)
    verseKeysByNoteId[noteEndpoint.noteId] = verseKeys
  }

  return verseKeysByNoteId
}

export const buildNoteListRows = (
  notes: NotesObj,
  wordAnnotations: WordAnnotationsObj,
  relations: RelationsObj,
  annotationLabel: string
): NoteListRow[] => {
  const verseKeysByNoteId = buildVerseKeysByNoteId(relations)
  const rows: NoteListRow[] = []

  for (const [noteId, note] of Object.entries(notes)) {
    let reference = ''

    if (noteId.startsWith('annotation:')) {
      const annotation = wordAnnotations[noteId.slice('annotation:'.length)]
      const firstRange = annotation?.ranges[0]
      if (!firstRange) continue
      reference = `${verseToReference({ [firstRange.verseKey]: true })} (${annotationLabel})`
    } else {
      const verseKeys = verseKeysByNoteId[noteId]
      if (verseKeys?.size) {
        reference = verseToReference(Object.fromEntries(Array.from(verseKeys, key => [key, true])))
      }
    }

    rows.push({
      id: noteId,
      noteId,
      reference,
      note,
      title: getNoteTitle(note, reference),
      description: note.description,
      date: Number(note.date || 0),
    })
  }

  return rows
}
