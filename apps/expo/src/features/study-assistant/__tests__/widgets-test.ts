import { textDifferences } from '../widgets/textDifferences'
import { parseStudyWidget } from '@bible-strong/ai-contract/contract'
import { loadWidgetPassage } from '../widgets/passageData'
import type { Conversation } from '../conversations'
const p = { book: 43, chapter: 3, start: 16, end: 16, version: 'LSG' }
it('accepts Aquifer as a published commentary suggestion', () => {
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'further_resources',
      title: 'Pour aller plus loin',
      items: [
        {
          kind: 'commentary',
          label: 'Tyndale Open Study Notes',
          id: 'aquifer-fr',
          language: 'fr',
          book: 29,
          chapter: 1,
        },
      ],
    })
  ).toMatchObject({ items: [{ id: 'aquifer-fr' }] })
})
it('rejects impossible widget shapes and translation comparisons of different passages', () => {
  expect(() =>
    parseStudyWidget({ id: 'w1', kind: 'passage_comparison', title: 'Compare', passages: [p] })
  ).toThrow()
  expect(() =>
    parseStudyWidget({
      id: 'w1',
      kind: 'translation_comparison',
      title: 'Compare',
      passages: [p, { ...p, chapter: 4, version: 'KJV' }],
    })
  ).toThrow()
  expect(() =>
    parseStudyWidget({ id: 'w1', kind: 'passages', title: 'Read', passages: [{ ...p, book: 99 }] })
  ).toThrow()
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'translation_comparison',
      title: 'Compare',
      passages: [p, { ...p, version: 'KJV' }],
    })
  ).toMatchObject({ passages: [p, { ...p, version: 'KJV' }] })
})
it('renders only exact source text and fails on a missing verse', async () => {
  const access = { loadVerseTexts: jest.fn(async () => ({ '43-3-16': 'Exact source text' })) }
  const result = await loadWidgetPassage(p, access, new AbortController().signal)
  expect(result).toEqual([{ number: 16, text: 'Exact source text' }])
  await expect(
    loadWidgetPassage({ ...p, end: 17 }, access, new AbortController().signal)
  ).rejects.toThrow('PASSAGE_UNAVAILABLE')
})

it('persists descriptors and keeps the ordered references available for follow-up questions', async () => {
  const { conversationMetadata, hydrateConversation, persistableTurns } =
    await import('../conversations')
  const { prepareMemory } = await import('../conversationMemory')
  const widget = parseStudyWidget({
    id: 'w1',
    kind: 'passages',
    title: 'Deux passages',
    passages: [p, { ...p, book: 45, chapter: 8, start: 1, end: 1 }],
  })
  const conversation: Conversation = {
    id: 'c',
    title: 'T',
    updatedAt: 1,
    messages: [
      { id: 'q', role: 'user', text: 'Montre deux passages', state: 'complete', createdAt: 1 },
      {
        id: 'a',
        role: 'assistant',
        text: '',
        state: 'complete',
        createdAt: 2,
        widgets: [widget],
      },
    ],
  }
  const loaded = hydrateConversation(
    conversationMetadata(conversation),
    persistableTurns(conversation)
  )
  expect(loaded.messages[1].widgets).toEqual([widget])
  const memory = await prepareMemory(
    loaded,
    async () => {
      throw new Error('unexpected')
    },
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(memory.history[1].content).toContain('2) livre 45, 8:1-1, LSG')
})
it('keeps concordance scope explicit and rejects ambiguous suffixed family requests', () => {
  expect(() =>
    parseStudyWidget({
      id: 'w1',
      kind: 'concordance',
      title: 'Concordance',
      reference: 'H7050A',
      identityKind: 'strong',
      scope: 'classic_family',
      language: 'fr',
    })
  ).toThrow()
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'concordance',
      title: 'Concordance',
      reference: 'H7050',
      identityKind: 'strong',
      scope: 'classic_family',
      language: 'fr',
    })
  ).toMatchObject({ reference: 'H7050', scope: 'classic_family' })
  expect(
    parseStudyWidget({
      id: 'w2',
      kind: 'strong_entry',
      title: 'Fronde',
      reference: 'H7050A',
      identityKind: 'dstrong',
      scope: 'precise_identity',
      language: 'fr',
    })
  ).toMatchObject({ reference: 'H7050A', identityKind: 'dstrong' })
})
it('validates a contiguous verse-analysis passage and prevents cross-resource source groups', () => {
  expect(
    parseStudyWidget({ id: 'w1', kind: 'verse_analysis', title: 'Mots', passages: [p] })
  ).toMatchObject({ kind: 'verse_analysis' })
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'verse_analysis',
      title: 'Mots',
      passages: [{ ...p, end: 17 }],
    })
  ).toMatchObject({ passages: [{ start: 16, end: 17 }] })
  const source = {
    id: 's1',
    title: 'Fronde',
    excerpt: 'Source',
    kind: 'dictionary',
    params: { work: 'bost', word: 'Fronde', entryId: '1' },
  }
  expect(
    parseStudyWidget({
      id: 'w2',
      kind: 'dictionary_articles',
      title: 'Articles',
      sources: [source],
    })
  ).toMatchObject({ kind: 'dictionary_articles' })
  expect(() =>
    parseStudyWidget({
      id: 'w2',
      kind: 'commentary_comparison',
      title: 'Commentaires',
      sources: [source],
    })
  ).toThrow()
  expect(() =>
    parseStudyWidget({ id: 'w3', kind: 'nave_topic', title: 'Nave', topic: '', language: 'fr' })
  ).toThrow()
})
it('validates exact entity identifiers and bounded event lists', () => {
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'person_profile',
      title: 'Adam',
      entityKey: 'Adam@Gen.2.19-Jud',
      language: 'fr',
    })
  ).toMatchObject({ entityKey: 'Adam@Gen.2.19-Jud' })
  expect(() =>
    parseStudyWidget({
      id: 'w1',
      kind: 'place_profile',
      title: 'Place',
      entityKey: '../../private',
      language: 'fr',
    })
  ).toThrow()
  expect(() =>
    parseStudyWidget({
      id: 'w2',
      kind: 'event_timeline',
      title: 'History',
      events: Array.from({ length: 9 }, (_, i) => String(i)),
      language: 'fr',
    })
  ).toThrow()
  expect(
    parseStudyWidget({
      id: 'w2',
      kind: 'event_timeline',
      title: 'History',
      events: ['creation', 'creation'],
      language: 'fr',
    })
  ).toMatchObject({ events: ['creation'] })
})
it('validates editorial widgets and refuses arbitrary resource destinations', () => {
  expect(
    parseStudyWidget({
      id: 'w1',
      kind: 'reading_plan',
      title: 'Lire',
      planId: 'bible-strong-philippians-fr',
      readingId: 'day-001',
      language: 'fr',
    })
  ).toMatchObject({ readingId: 'day-001' })
  expect(() =>
    parseStudyWidget({
      id: 'w1',
      kind: 'meditation',
      title: 'Lire',
      planId: '../users',
      readingId: 'x',
      language: 'fr',
    })
  ).toThrow()
  expect(
    parseStudyWidget({
      id: 'w2',
      kind: 'further_resources',
      title: 'Ressources',
      items: [
        {
          kind: 'dictionary',
          label: 'Fronde',
          id: '123',
          work: 'bost',
          word: 'Fronde',
          language: 'fr',
        },
      ],
    })
  ).toMatchObject({ kind: 'further_resources' })
  expect(() =>
    parseStudyWidget({
      id: 'w2',
      kind: 'further_resources',
      title: 'Ressources',
      items: [{ kind: 'media', label: 'X', id: 'https://evil.example', language: 'fr' }],
    })
  ).toThrow()
})

it('aligns repeated words without changing exact verse text', () => {
  const parts = textDifferences('Dieu est amour et amour.', 'Dieu est amour.')
  expect(parts.map((part: { text: string }) => part.text).join('')).toBe('Dieu est amour et amour.')
  expect(
    parts
      .filter((part: { different: boolean }) => part.different)
      .map((part: { text: string }) => part.text)
  ).toEqual(['amour', 'et'])
  expect(
    textDifferences('Dieu est amour.', 'Dieu est amour.').some(
      (part: { different: boolean }) => part.different
    )
  ).toBe(false)
})
