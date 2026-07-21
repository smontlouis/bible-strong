import type { RelationsObj } from '~features/studyRelations/domain'
import type { NotesObj } from '~redux/modules/user'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import { buildNoteListRows } from '../noteListRows'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

const notes: NotesObj = {
  recent: { title: '', description: 'Note récente', date: 30 },
  older: { title: 'Ancienne', description: '', date: 10 },
  'annotation:word-1': { title: '', description: 'Annotation', date: 20 },
  'annotation:missing': { title: '', description: 'Orpheline', date: 40 },
}

const wordAnnotations = {
  'word-1': {
    id: 'word-1',
    version: 'LSG',
    ranges: [{ verseKey: '1-2-3', startWordIndex: 0, endWordIndex: 0, text: 'mot' }],
    color: '#fff',
    type: 'background',
    date: 20,
  },
} as WordAnnotationsObj

const relations = {
  first: {
    type: 'annotates',
    endpoints: [
      { type: 'note', noteId: 'recent' },
      { type: 'verse', verseKeys: ['1-1-1'] },
    ],
  },
  second: {
    type: 'annotates',
    endpoints: [
      { type: 'verse', verseKeys: ['1-1-2'] },
      { type: 'note', noteId: 'recent' },
    ],
  },
  unrelated: {
    type: 'references',
    endpoints: [
      { type: 'note', noteId: 'older' },
      { type: 'verse', verseKeys: ['1-3-1'] },
    ],
  },
} as unknown as RelationsObj

describe('buildNoteListRows', () => {
  it('builds the visible note rows in date order from one relation collection', () => {
    const rows = buildNoteListRows(notes, wordAnnotations, relations, 'annotation')

    expect(rows.map(row => row.noteId)).toEqual(['recent', 'annotation:word-1', 'older'])
    expect(rows[0]).toMatchObject({
      reference: 'Genèse 1:1-2',
      title: 'Note récente',
      description: 'Note récente',
      date: 30,
    })
    expect(rows[1]).toMatchObject({
      reference: 'Genèse 2:3 (annotation)',
      title: 'Annotation',
    })
    expect(rows[2].reference).toBe('')
  })
})
