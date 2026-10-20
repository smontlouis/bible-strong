import verseToReference from '~helpers/verseToReference'
import { getNoteTitle } from '~helpers/getNoteTitle'
import type { RelationsObj } from '~features/studyRelations/domain'
import type { Note, NotesObj } from '~redux/modules/user'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'

export type NoteListRow = {
  id: string
  noteId: string
  /** The passage, labelled as an annotation when the note annotates words: searched and shown. */
  reference: string
  /** The passage alone, for a list that marks annotations by other means. */
  passage: string
  isAnnotation: boolean
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
    let passage = ''
    const isAnnotation = noteId.startsWith('annotation:')

    if (isAnnotation) {
      const annotation = wordAnnotations[noteId.slice('annotation:'.length)]
      const firstRange = annotation?.ranges[0]
      if (!firstRange) continue
      passage = verseToReference({ [firstRange.verseKey]: true })
    } else {
      const verseKeys = verseKeysByNoteId[noteId]
      if (verseKeys?.size) {
        passage = verseToReference(Object.fromEntries(Array.from(verseKeys, key => [key, true])))
      }
    }
    const reference = isAnnotation ? `${passage} (${annotationLabel})` : passage

    rows.push({
      id: noteId,
      noteId,
      reference,
      passage,
      isAnnotation,
      note,
      title: getNoteTitle(note, reference),
      description: note.description,
      date: Number(note.date || 0),
    })
  }

  return rows
}
