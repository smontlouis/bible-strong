import { createPassageExport } from '../createPassageExport'
import {
  createExternalLinkEndpoint,
  createNoteEndpoint,
  createSystemRelation,
  createVerseEndpoint,
  normalizeRelation,
} from '~features/studyRelations/domain'

jest.mock('~assets/bible_versions/books-desc', () => [
  { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
  { Numero: 2, Nom: 'Exode', Chapitres: 40 },
])

const translations: Record<string, string> = {
  'studyRelations.type.linked': 'lié à',
  'studyRelations.type.explains': 'explique',
  'studyRelations.type.explainedBy': 'est expliqué par',
  'passageExport.section.bibleText': 'TEXTE BIBLIQUE',
  'passageExport.section.notes': 'NOTES',
  'passageExport.section.links': 'LIENS',
  'passageExport.section.relations': 'RELATIONS',
  'passageExport.section.tags': 'ÉTIQUETTES',
  'passageExport.extendsBeyondScope': 'Lié aussi hors du périmètre exporté.',
  'passageExport.verseTextUnavailable': '[Texte biblique indisponible]',
}

jest.mock('~i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options?: Record<string, unknown>) =>
      options?.bookNumber ? `Livre ${options.bookNumber}` : translations[key] || key,
  },
}))

const note = {
  id: 'note-1',
  title: 'Une promesse',
  description: 'Dieu prend les devants.',
  date: 1,
  tags: {
    grace: { id: 'grace', name: 'Grâce' },
  },
}

const link = {
  id: 'link-1',
  url: 'https://example.com/grace',
  customTitle: 'La grâce',
  linkType: 'website' as const,
  date: 1,
}

const verseEndpoint = createVerseEndpoint(['1-1-1', '1-1-2'])
const noteEndpoint = createNoteEndpoint('note-1', note.title)
const linkEndpoint = createExternalLinkEndpoint(verseEndpoint, 'link-1', link)

const relations = {
  note: createSystemRelation({
    id: 'system-note',
    type: 'annotates',
    endpoints: [noteEndpoint, verseEndpoint],
    createdAt: 1,
    updatedAt: 1,
  }),
  noteSecondAttachment: createSystemRelation({
    id: 'system-note-second-attachment',
    type: 'annotates',
    endpoints: [noteEndpoint, createVerseEndpoint(['1-1-2', '1-2-1'])],
    createdAt: 1,
    updatedAt: 1,
  }),
  link: createSystemRelation({
    id: 'system-link',
    type: 'externalLink',
    endpoints: [linkEndpoint, verseEndpoint],
    createdAt: 1,
    updatedAt: 1,
  }),
  manual: normalizeRelation({
    id: 'manual-relation',
    kind: 'manual',
    type: 'explains',
    direction: 'forward',
    endpoints: [createVerseEndpoint(['1-1-2']), createVerseEndpoint(['2-1-1'], 'Exode 1:1')],
    createdAt: 1,
    updatedAt: 1,
  }),
}

describe('createPassageExport', () => {
  it('groups selected study data by enriched verse and omits empty selected verses', async () => {
    const loadVerseTexts = jest.fn(async (verseKeys: string[]) =>
      Object.fromEntries(verseKeys.map(key => [key, `Texte ${key}`]))
    )

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1', '1-1-2', '1-1-3'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: true, notes: true, links: true, relations: true, tags: true },
      data: {
        notes: { 'note-1': note },
        links: { 'link-1': link },
        relations,
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts,
    })

    expect(loadVerseTexts).toHaveBeenCalledWith(['1-1-1', '1-1-2'])
    expect(result.counts).toEqual({ notes: 1, links: 1, relations: 1, tags: 1 })
    expect(result.text).toContain('Genèse 1:1-3 — Bible Segond 1910 (LSG)')
    expect(result.text).toContain(
      'Genèse 1:1\n----------------------------------------\n\nTexte 1-1-1'
    )
    expect(result.text).not.toContain('Texte 1-1-3')
    expect(result.text).toContain('• Une promesse\n  Dieu prend les devants.')
    expect(result.text).toContain('ÉTIQUETTES\n----------\n• Grâce')
    expect(result.text).toContain('Lié aussi hors du périmètre exporté.')
    expect(result.text).toContain('• La grâce\n  https://example.com/grace')
    expect(result.text).toContain('• explique → [verse] Exode 1:1')
    expect(result.text).not.toContain('sur →')
    expect(result.text).not.toContain('lien vers →')
    expect(result.text).toContain(
      '----------------------------------------\nGenèse 1:1\n----------------------------------------\n\nTexte 1-1-1\n\nNOTES\n----------\n• Une promesse\n  Dieu prend les devants.'
    )
    expect(result.text).toContain(
      'LIENS\n----------\n• La grâce\n  https://example.com/grace\n\nÉTIQUETTES\n----------\n• Grâce\n\n----------------------------------------'
    )
    expect(result.text).toContain(
      'LIENS\n----------\n• La grâce\n  https://example.com/grace\n\nRELATIONS'
    )
    expect(result.text).toContain('RELATIONS\n----------\n• explique → [verse] Exode 1:1')

    const firstVerse = result.text.indexOf('Genèse 1:1')
    const firstVerseNotes = result.text.indexOf('NOTES', firstVerse)
    const secondVerse = result.text.indexOf('Genèse 1:2')
    expect(firstVerse).toBeGreaterThan(-1)
    expect(firstVerseNotes).toBeGreaterThan(firstVerse)
    expect(secondVerse).toBeGreaterThan(firstVerseNotes)
  })

  it('keeps enriched verse groups when Bible text is disabled', async () => {
    const loadVerseTexts = jest.fn(async () => ({}))

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: true, links: false, relations: false, tags: false },
      data: {
        notes: { 'note-1': note },
        links: {},
        relations: { note: relations.note },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts,
    })

    expect(loadVerseTexts).toHaveBeenCalledWith([])
    expect(result.verseKeys).toEqual(['1-1-1'])
    expect(result.text).toContain(
      'Genèse 1:1\n----------------------------------------\n\nNOTES\n----------\n• Une promesse'
    )
    expect(result.text).not.toContain('TEXTE BIBLIQUE')
  })

  it('discovers enriched verses when Bible text is the only selected content', async () => {
    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: true, notes: false, links: false, relations: false, tags: false },
      data: {
        notes: { 'note-1': note },
        links: {},
        relations: { note: relations.note },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async verseKeys =>
        Object.fromEntries(verseKeys.map(verseKey => [verseKey, `Texte ${verseKey}`])),
    })

    expect(result.verseKeys).toEqual(['1-1-1'])
    expect(result.text).toContain('Texte 1-1-1')
    expect(result.text).not.toContain('NOTES')
  })

  it('exports tags as independent passage content', async () => {
    const loadVerseTexts = jest.fn(async (verseKeys: string[]) =>
      Object.fromEntries(verseKeys.map(key => [key, `Texte ${key}`]))
    )

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1', '1-1-4'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: {
        bibleText: true,
        notes: false,
        links: false,
        relations: false,
        tags: true,
      },
      data: {
        notes: { 'note-1': note },
        links: {},
        relations: { note: relations.note },
        wordAnnotations: {},
        highlights: {
          '1-1-4': {
            color: '',
            date: 1,
            tags: { hope: { id: 'hope', name: 'Espérance' } },
          },
        },
        studies: {},
      },
      loadVerseTexts,
    })

    expect(loadVerseTexts).toHaveBeenCalledWith(['1-1-1', '1-1-4'])
    expect(result.counts.tags).toBe(2)
    expect(result.text).toContain(
      'Genèse 1:1\n----------------------------------------\n\nTexte 1-1-1'
    )
    expect(result.text).toContain('ÉTIQUETTES\n----------\n• Grâce')
    expect(result.text).toContain(
      'Genèse 1:4\n----------------------------------------\n\nTexte 1-1-4'
    )
    expect(result.text).toContain('ÉTIQUETTES\n----------\n• Espérance')
    expect(result.text).not.toContain('NOTES')
  })

  it('exports a chapter from an explicit context without a synthetic selected verse', async () => {
    const loadVerseTexts = jest.fn(async (verseKeys: string[]) =>
      Object.fromEntries(verseKeys.map(key => [key, `Texte ${key}`]))
    )

    const result = await createPassageExport({
      scope: 'chapter',
      selectedVerseKeys: [],
      scopeContext: { book: 1, chapter: 1 },
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: true, notes: false, links: false, relations: false, tags: true },
      data: {
        notes: {},
        links: {},
        relations: {},
        wordAnnotations: {},
        highlights: {
          '1-1-4': {
            color: '',
            date: 1,
            tags: { hope: { id: 'hope', name: 'Espérance' } },
          },
        },
        studies: {},
      },
      loadVerseTexts,
    })

    expect(result.reference).toBe('Genèse 1')
    expect(result.verseKeys).toEqual(['1-1-4'])
    expect(loadVerseTexts).toHaveBeenCalledWith(['1-1-4'])
  })

  it('projects an in-scope verse relation under both verse groups', async () => {
    const twoVerseRelation = normalizeRelation({
      id: 'two-verse-relation',
      kind: 'manual',
      type: 'explains',
      direction: 'forward',
      endpoints: [
        createVerseEndpoint(['1-1-1'], 'Genèse 1:1'),
        createVerseEndpoint(['1-1-2'], 'Genèse 1:2'),
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    const result = await createPassageExport({
      scope: 'chapter',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: false, links: false, relations: true, tags: false },
      data: {
        notes: {},
        links: {},
        relations: { [twoVerseRelation.id]: twoVerseRelation },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.counts.relations).toBe(1)
    expect(result.text).toContain(
      'Genèse 1:1\n----------------------------------------\n\nRELATIONS\n----------\n• explique → [verse] Genèse 1:2'
    )
    expect(result.text).toContain(
      'Genèse 1:2\n----------------------------------------\n\nRELATIONS\n----------\n• est expliqué par → [verse] Genèse 1:1'
    )
  })

  it('prints the target entity type before a relation label', async () => {
    const studyRelation = normalizeRelation({
      id: 'verse-study-relation',
      kind: 'manual',
      type: 'linked',
      direction: 'none',
      endpoints: [
        createVerseEndpoint(['1-1-1'], 'Genèse 1:1'),
        { type: 'study', studyId: 'study-1', labelFallback: 'Étude intéressante' },
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: false, links: false, relations: true, tags: false },
      data: {
        notes: {},
        links: {},
        relations: { [studyRelation.id]: studyRelation },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.text).toContain('• lié à → [study] Étude intéressante')
  })

  it('anchors annotation relations to the annotation ranges', async () => {
    const annotationRelation = normalizeRelation({
      id: 'annotation-study-relation',
      kind: 'manual',
      type: 'linked',
      direction: 'none',
      endpoints: [
        { type: 'annotation', annotationId: 'annotation-1', labelFallback: 'Au commencement' },
        { type: 'study', studyId: 'study-1', labelFallback: 'Étude création' },
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: false, links: false, relations: true, tags: false },
      data: {
        notes: {},
        links: {},
        relations: { [annotationRelation.id]: annotationRelation },
        wordAnnotations: {
          'annotation-1': {
            id: 'annotation-1',
            version: 'LSG',
            ranges: [
              { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1, text: 'Au commencement' },
            ],
            color: 'color1',
            type: 'underline',
            date: 1,
          },
        },
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.counts.relations).toBe(1)
    expect(result.text).toContain('• lié à → [study] Étude création')
  })

  it('does not anchor relations from annotations belonging to another Bible version', async () => {
    const annotationRelation = normalizeRelation({
      id: 'kjv-annotation-study-relation',
      kind: 'manual',
      type: 'linked',
      direction: 'none',
      endpoints: [
        { type: 'annotation', annotationId: 'annotation-kjv', labelFallback: 'In the beginning' },
        { type: 'study', studyId: 'study-1', labelFallback: 'Creation study' },
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: false, links: false, relations: true, tags: false },
      data: {
        notes: {},
        links: {},
        relations: { [annotationRelation.id]: annotationRelation },
        wordAnnotations: {
          'annotation-kjv': {
            id: 'annotation-kjv',
            version: 'KJV',
            ranges: [
              { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1, text: 'In the beginning' },
            ],
            color: 'color1',
            type: 'underline',
            date: 1,
          },
        },
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.counts.relations).toBe(0)
    expect(result.text).not.toContain('Creation study')
  })

  it('prints the Strong code with the target entity type', async () => {
    const strongRelation = normalizeRelation({
      id: 'verse-strong-relation',
      kind: 'manual',
      type: 'linked',
      direction: 'none',
      endpoints: [
        createVerseEndpoint(['1-1-1'], 'Genèse 1:1'),
        {
          type: 'strong',
          language: 'hebrew',
          code: 'H3023',
          labelFallback: 'a',
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: false, links: false, relations: true, tags: false },
      data: {
        notes: {},
        links: {},
        relations: { [strongRelation.id]: strongRelation },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.text).toContain('• lié à → [strong: H3023] a')
  })

  it('prints only the annotation fragment belonging to each verse group', async () => {
    const result = await createPassageExport({
      scope: 'chapter',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: true, links: false, relations: false, tags: false },
      data: {
        notes: {
          'annotation:multi': {
            id: 'annotation:multi',
            title: 'Deux fragments',
            description: '',
            date: 1,
          },
        },
        links: {},
        relations: {},
        wordAnnotations: {
          multi: {
            id: 'multi',
            version: 'LSG',
            ranges: [
              { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Au commencement' },
              { verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 0, text: 'La terre' },
            ],
            color: '#fff000',
            type: 'underline',
            date: 1,
            noteId: 'annotation:multi',
          },
        },
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.text).toContain(
      'Genèse 1:1\n----------------------------------------\n\nNOTES\n----------\n• Deux fragments — « Au commencement »'
    )
    expect(result.text).toContain(
      'Genèse 1:2\n----------------------------------------\n\nNOTES\n----------\n• Deux fragments — « La terre »'
    )
    expect(result.text).not.toContain('Au commencement La terre')
  })

  it('exports annotation notes and tags only for the current Bible version', async () => {
    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: true, links: false, relations: false, tags: true },
      data: {
        notes: {
          'annotation:lsg': {
            id: 'annotation:lsg',
            title: 'Note Segond',
            description: 'Visible dans cet export.',
            date: 1,
          },
          'annotation:kjv': {
            id: 'annotation:kjv',
            title: 'KJV note',
            description: 'Must stay hidden.',
            date: 1,
          },
        },
        links: {},
        relations: {},
        wordAnnotations: {
          lsg: {
            id: 'lsg',
            version: 'LSG',
            ranges: [
              { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1, text: 'Au commencement' },
            ],
            color: '#fff000',
            type: 'underline',
            date: 1,
            noteId: 'annotation:lsg',
            tags: { french: { id: 'french', name: 'Français' } },
          },
          kjv: {
            id: 'kjv',
            version: 'KJV',
            ranges: [
              { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1, text: 'In the beginning' },
            ],
            color: '#fff000',
            type: 'underline',
            date: 1,
            noteId: 'annotation:kjv',
            tags: { english: { id: 'english', name: 'English' } },
          },
        },
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.counts).toEqual({ notes: 1, links: 0, relations: 0, tags: 1 })
    expect(result.text).toContain('• Note Segond — « Au commencement »')
    expect(result.text).toContain('Visible dans cet export.')
    expect(result.text).toContain('ÉTIQUETTES\n----------\n• Français')
    expect(result.text).not.toContain('KJV note')
    expect(result.text).not.toContain('In the beginning')
    expect(result.text).not.toContain('English')
  })

  it('exports only enriched verses for a chapter or book scope', async () => {
    const loadVerseTexts = jest.fn(async (verseKeys: string[]) =>
      Object.fromEntries(verseKeys.map(key => [key, `Texte ${key}`]))
    )
    const data = {
      notes: {
        'annotation:annotation-1': {
          id: 'annotation:annotation-1',
          title: 'Mot important',
          description: 'Cette formulation compte.',
          date: 2,
        },
        'annotation:annotation-2': {
          id: 'annotation:annotation-2',
          title: 'Autre chapitre',
          description: 'Toujours dans le même livre.',
          date: 3,
        },
      },
      links: {},
      relations: {},
      wordAnnotations: {
        'annotation-1': {
          id: 'annotation-1',
          version: 'LSG' as const,
          ranges: [{ verseKey: '1-1-3', startWordIndex: 1, endWordIndex: 1, text: 'lumière' }],
          color: '#fff000',
          type: 'underline' as const,
          date: 2,
          noteId: 'annotation:annotation-1',
        },
        'annotation-2': {
          id: 'annotation-2',
          version: 'LSG' as const,
          ranges: [{ verseKey: '1-2-1', startWordIndex: 1, endWordIndex: 1, text: 'même livre' }],
          color: '#fff000',
          type: 'underline' as const,
          date: 3,
          noteId: 'annotation:annotation-2',
        },
      },
      studies: {},
    }

    const result = await createPassageExport({
      scope: 'chapter',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: true, notes: true, links: false, relations: false, tags: false },
      data,
      loadVerseTexts,
    })

    expect(loadVerseTexts).toHaveBeenCalledWith(['1-1-3'])
    expect(result.reference).toBe('Genèse 1')
    expect(result.counts.notes).toBe(1)
    expect(result.text).toContain(
      'Genèse 1:3\n----------------------------------------\n\nTexte 1-1-3\n\nNOTES\n----------\n• Mot important — « lumière »'
    )
    expect(result.text).not.toContain('même livre')

    loadVerseTexts.mockClear()
    const bookResult = await createPassageExport({
      scope: 'book',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: true, notes: true, links: false, relations: false, tags: false },
      data,
      loadVerseTexts,
    })

    expect(loadVerseTexts).toHaveBeenCalledWith(['1-1-3', '1-2-1'])
    expect(bookResult.reference).toBe('Genèse')
    expect(bookResult.counts.notes).toBe(2)
  })

  it('keeps generating when persisted notes, relations, annotations, and tags are malformed', async () => {
    const malformedData = {
      notes: {
        'note-1': { ...note, title: null, description: 42, tags: { broken: null } },
      },
      links: {},
      relations: {
        note: relations.note,
        nullRelation: null,
        brokenRelation: { id: 'broken', endpoints: 'not-an-array' },
      },
      wordAnnotations: {
        broken: { id: 'broken', version: 'LSG', ranges: [null, { text: 'sans verset' }] },
      },
      highlights: {
        '1-1-1': { color: '', date: 1, tags: { broken: null } },
      },
      studies: {},
    }

    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: true, links: true, relations: true, tags: true },
      data: malformedData as never,
      loadVerseTexts: async () => ({}),
    })

    expect(result.verseKeys).toEqual(['1-1-1'])
    expect(result.hasSkippedInvalidData).toBe(true)
  })

  it('skips a malformed Strong endpoint instead of exporting an invalid marker', async () => {
    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: false, links: false, relations: true, tags: false },
      data: {
        notes: {},
        links: {},
        relations: {
          brokenStrong: {
            id: 'broken-strong',
            kind: 'manual',
            type: 'linked',
            direction: 'none',
            endpoints: [
              createVerseEndpoint(['1-1-1']),
              { type: 'strong', language: 'hebrew', code: undefined },
            ],
            createdAt: 1,
            updatedAt: 1,
          },
        } as never,
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.hasSkippedInvalidData).toBe(true)
    expect(result.text).not.toContain('UNDEFINED')
  })

  it('marks missing Bible rows explicitly instead of silently omitting their text', async () => {
    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: true, notes: true, links: false, relations: false, tags: false },
      data: {
        notes: { 'note-1': note },
        links: {},
        relations: { note: relations.note },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.missingVerseTextKeys).toEqual(['1-1-1'])
    expect(result.text).toContain('[Texte biblique indisponible]')
  })

  it('preserves distinct tag identities and indents multiline user content', async () => {
    const multilineNote = {
      ...note,
      title: 'Titre\ncomplément',
      description: 'Première ligne\r\nDeuxième ligne',
      tags: {
        first: { id: 'first', name: 'Même nom' },
        second: { id: 'second', name: 'Même nom' },
      },
    }
    const result = await createPassageExport({
      scope: 'selection',
      selectedVerseKeys: ['1-1-1'],
      version: { code: 'LSG', name: 'Bible Segond 1910' },
      options: { bibleText: false, notes: true, links: false, relations: false, tags: true },
      data: {
        notes: { 'note-1': multilineNote },
        links: {},
        relations: { note: relations.note },
        wordAnnotations: {},
        studies: {},
      },
      loadVerseTexts: async () => ({}),
    })

    expect(result.counts.tags).toBe(2)
    expect(result.text).toContain('• Titre\n  complément\n  Première ligne\n  Deuxième ligne')
    expect(result.text.match(/• Même nom/g)).toHaveLength(2)
  })
})
