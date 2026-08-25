import {
  createExternalLinkEndpoint,
  createNoteEndpoint,
  createStudyEndpoint,
  createVerseEndpoint,
} from '~features/studyRelations/endpoints'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import { createStudyEntityEmbedPayload, getStudyEntityBlockDescription } from '../studyEntityEmbeds'
import {
  refreshStudyEntityEmbedPayload,
  refreshStudyEntityEmbeds,
} from '../refreshStudyEntityEmbeds'

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~features/search/BibleReferenceWidget', () => ({
  parseBibleReference: () => [],
}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

const resourceLanguages = {
  STRONG: 'fr',
  DICTIONNAIRE: 'fr',
  NAVE: 'fr',
  MHY: 'fr',
  TIMELINE: 'fr',
  COMMENTARIES: 'fr',
} as const

const createResources = (
  loadVerseTexts = jest.fn().mockResolvedValue({}),
  loadStrongPreview = jest.fn().mockResolvedValue([])
) =>
  ({
    bibleContent: { loadVerseTexts },
    strongLexicon: { loadPreview: loadStrongPreview },
    nave: { loadItem: jest.fn().mockResolvedValue(undefined) },
    dictionary: { loadItem: jest.fn().mockResolvedValue(undefined) },
  }) as unknown as ResourceAccessRegistry

describe('study entity embeds', () => {
  it('keeps Strong blocks limited to their short identifying metadata', async () => {
    const loadStrongPreview = jest.fn().mockResolvedValue([
      {
        gloss: 'Aaron',
        stepCode: 'G0002',
        original: 'Ἀαρών',
        transliteration: 'Aarṓn',
        definitionHtml: 'Aaron (hébr. אַהֲרֹן), indécl. (chez FlJ, -ῶνος)...',
      },
    ])
    const payload = createStudyEntityEmbedPayload({
      id: 'strong:greek:2',
      type: 'strong',
      iconType: 'strong',
      title: 'Aaron',
      chip: 'G0002',
      subtitle: 'Grec',
      description: 'Ἀαρών',
      endpoint: {
        type: 'strong',
        language: 'greek',
        code: '2',
        labelFallback: 'Aaron',
      },
    })

    const refreshed = await refreshStudyEntityEmbedPayload(payload, {
      resources: createResources(jest.fn().mockResolvedValue({}), loadStrongPreview),
      defaultBibleVersion: 'LSG',
      resourceLanguages,
    })

    expect(refreshed.display).toEqual({
      typeLabel: 'Strong',
      title: 'Aaron',
      subtitle: 'Aarṓn',
      chip: 'G0002',
      description: 'Ἀαρών',
    })
    expect(JSON.stringify(refreshed.display)).not.toContain('indécl')
  })

  it('keeps note and study blocks compact', () => {
    const note = createStudyEntityEmbedPayload({
      id: 'note:note-1',
      type: 'notes',
      iconType: 'notes',
      title: 'Une note',
      subtitle: 'Note',
      description: 'Le contenu complet de la note',
      endpoint: createNoteEndpoint('note-1', 'Une note'),
    })
    const study = createStudyEntityEmbedPayload({
      id: 'study:study-1',
      type: 'studies',
      iconType: 'studies',
      title: 'Une étude',
      subtitle: 'Étude',
      description: 'Le contenu complet de l’étude',
      endpoint: createStudyEndpoint('study-1', 'Une étude'),
    })

    expect(getStudyEntityBlockDescription(note)).toBeUndefined()
    expect(getStudyEntityBlockDescription(study)).toBeUndefined()
  })

  it('shows the URL instead of the link preview description', () => {
    const link = createStudyEntityEmbedPayload({
      id: 'link:link-1',
      type: 'links',
      iconType: 'links',
      title: 'BibleProject',
      subtitle: 'Lien',
      description: 'Une longue description Open Graph',
      endpoint: createExternalLinkEndpoint({
        linkId: 'link-1',
        url: 'https://bibleproject.com/francais/',
        labelFallback: 'BibleProject',
      }),
    })

    expect(getStudyEntityBlockDescription(link)).toBe('https://bibleproject.com/francais/')
  })

  it('stores a durable endpoint with a display fallback', () => {
    const payload = createStudyEntityEmbedPayload({
      id: 'note:note-1',
      type: 'notes',
      iconType: 'notes',
      title: 'Grâce',
      subtitle: 'Note',
      description: 'Ancien aperçu',
      endpoint: createNoteEndpoint('note-1', 'Grâce'),
    })

    expect(payload).toMatchObject({
      schemaVersion: 1,
      endpoint: { type: 'note', noteId: 'note-1' },
      fallback: { title: 'Grâce', description: 'Ancien aperçu' },
      display: { title: 'Grâce', description: 'Ancien aperçu' },
    })
  })

  it('reloads current user-owned data when the study opens', async () => {
    const payload = createStudyEntityEmbedPayload({
      id: 'note:note-1',
      type: 'notes',
      iconType: 'notes',
      title: 'Ancien titre',
      description: 'Ancien texte',
      endpoint: createNoteEndpoint('note-1', 'Ancien titre'),
    })
    const content = { ops: [{ insert: { 'block-entity': payload } }] }

    const refreshed = await refreshStudyEntityEmbeds(content, {
      resources: createResources(),
      defaultBibleVersion: 'LSG',
      resourceLanguages,
      notes: {
        'note-1': {
          title: 'Titre actuel',
          description: 'Texte actuel',
          date: 1,
        },
      },
    })

    expect(refreshed?.ops[0]).toMatchObject({
      insert: {
        'block-entity': {
          fallback: { title: 'Ancien titre', description: 'Ancien texte' },
          display: { title: 'Titre actuel', description: 'Texte actuel' },
        },
      },
    })
  })

  it('reloads current verse text while keeping legacy embeds untouched', async () => {
    const loadVerseTexts = jest.fn().mockResolvedValue({
      '1-1-1': 'Au commencement, Dieu créa les cieux et la terre.',
    })
    const payload = createStudyEntityEmbedPayload({
      id: 'verse:1-1-1',
      type: 'passages',
      iconType: 'passages',
      title: 'Genèse 1:1',
      endpoint: createVerseEndpoint(['1-1-1'], 'Genèse 1:1', 'LSG'),
    })
    const legacyEmbed = {
      insert: {
        'block-verse': {
          title: 'Genèse 1:1',
          verses: ['1-1-1'],
          content: 'Ancien contenu',
          version: 'LSG',
        },
      },
    }

    const refreshed = await refreshStudyEntityEmbeds(
      {
        ops: [
          { insert: 'Texte sélectionné', attributes: { 'inline-entity': payload } },
          legacyEmbed,
        ],
      },
      {
        resources: createResources(loadVerseTexts),
        defaultBibleVersion: 'NBS',
        resourceLanguages,
      }
    )

    expect(loadVerseTexts).toHaveBeenCalledWith({ version: 'LSG', verseKeys: ['1-1-1'] })
    expect(refreshed?.ops[0]).toMatchObject({
      insert: 'Texte sélectionné',
      attributes: {
        'inline-entity': {
          display: {
            title: 'Genèse 1:1',
            subtitle: 'LSG',
            description: 'Au commencement, Dieu créa les cieux et la terre.',
          },
        },
      },
    })
    expect(refreshed?.ops[1]).toEqual(legacyEmbed)
  })

  it('resolves the selected verse version before inserting a block', async () => {
    const loadVerseTexts = jest.fn().mockResolvedValue({
      '1-1-2': 'La terre était informe et vide.',
    })
    const payload = createStudyEntityEmbedPayload({
      id: 'verse:1-1-2',
      type: 'passages',
      iconType: 'passages',
      title: 'Genèse 1:2',
      endpoint: createVerseEndpoint(['1-1-2'], 'Genèse 1:2', 'NBS'),
    })

    const refreshed = await refreshStudyEntityEmbedPayload(payload, {
      resources: createResources(loadVerseTexts),
      defaultBibleVersion: 'LSG',
      resourceLanguages,
    })

    expect(loadVerseTexts).toHaveBeenCalledWith({ version: 'NBS', verseKeys: ['1-1-2'] })
    expect(refreshed).toMatchObject({
      endpoint: { type: 'verse', version: 'NBS' },
      display: {
        title: 'Genèse 1:2',
        subtitle: 'NBS',
        description: 'La terre était informe et vide.',
      },
    })
  })

  it('uses the stored fallback when current data is unavailable', async () => {
    const payload = createStudyEntityEmbedPayload({
      id: 'note:missing',
      type: 'notes',
      iconType: 'notes',
      title: 'Note supprimée',
      endpoint: createNoteEndpoint('missing', 'Note supprimée'),
    })

    const refreshed = await refreshStudyEntityEmbeds(
      {
        ops: [
          {
            insert: 'Libellé existant',
            attributes: {
              'inline-entity': { ...payload, display: { title: 'Obsolète' } },
            },
          },
        ],
      },
      {
        resources: createResources(),
        defaultBibleVersion: 'LSG',
        resourceLanguages,
      }
    )

    expect(refreshed?.ops[0]).toMatchObject({
      insert: 'Libellé existant',
      attributes: { 'inline-entity': { display: { title: 'Note supprimée' } } },
    })
  })

  it('migrates the initial atomic inline embed without losing its target', async () => {
    const payload = createStudyEntityEmbedPayload({
      id: 'note:note-1',
      type: 'notes',
      iconType: 'notes',
      title: 'Grâce',
      endpoint: createNoteEndpoint('note-1', 'Grâce'),
    })

    const refreshed = await refreshStudyEntityEmbeds(
      { ops: [{ insert: { 'inline-entity': payload } }] },
      {
        resources: createResources(),
        defaultBibleVersion: 'LSG',
        resourceLanguages,
      }
    )

    expect(refreshed?.ops[0]).toMatchObject({
      insert: 'Grâce',
      attributes: { 'inline-entity': { endpoint: { type: 'note', noteId: 'note-1' } } },
    })
  })
})
