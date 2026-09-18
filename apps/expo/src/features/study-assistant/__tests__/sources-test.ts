jest.mock('~i18n', () => ({
  getLanguage: () => 'fr',
  __esModule: true,
  default: { t: (key: string) => key },
}))
import {
  parseStudySource,
  sourceIdFromLink,
  sourceLink,
  type StudySource,
} from '@bible-strong/ai-contract/contract'
import { sourceRoute } from '../sourceNavigation'
import remarkBibleLinks from '../remarkBibleLinks'
const commentary: StudySource = {
  id: 's1',
  title: 'Clarke',
  excerpt: 'Extrait',
  kind: 'commentary',
  params: { resourceId: 'acbc', book: '9', chapter: '17', sectionId: 'section-40' },
}
it('opens the exact read section and rejects unknown destinations', () => {
  expect(sourceRoute(commentary)).toEqual({
    pathname: '/commentary-entry',
    params: { projectionId: 'acbc:fr', book: '9', chapter: '17', sectionId: 'section-40' },
  })
  expect(() =>
    parseStudySource({
      ...commentary,
      params: { ...commentary.params, url: 'https://evil.example' },
    })
  ).toThrow()
  expect(() =>
    parseStudySource({ ...commentary, params: { ...commentary.params, resourceId: 'unknown' } })
  ).toThrow()
  expect(sourceIdFromLink(sourceLink('s1'))).toBe('s1')
  expect(sourceIdFromLink('https://evil.example/assistant-source/s1')).toBeUndefined()
})
it('links Bible text nodes without modifying code or existing source links', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: 'Lire 1 Samuel 17:40.' }] },
      { type: 'code', value: 'Jean 3:16' },
      { type: 'link', url: sourceLink('s1'), children: [{ type: 'text', value: 'Jean 3:16' }] },
    ],
  }
  remarkBibleLinks()(tree)
  expect(JSON.stringify(tree.children[0])).toContain('assistant-passage')
  expect(tree.children[1]).toEqual({ type: 'code', value: 'Jean 3:16' })
  expect(tree.children[2].children).toEqual([{ type: 'text', value: 'Jean 3:16' }])
})

it('keeps citation destinations across reload but excludes response-local links from model history', async () => {
  const { loadConversations, saveConversations } = await import('../conversations')
  const { prepareMemory } = await import('../conversationMemory')
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  const conversation = {
    id: 'c',
    title: 'Question',
    updatedAt: 1,
    messages: [
      {
        id: 'q',
        role: 'user' as const,
        text: 'Question',
        state: 'complete' as const,
        createdAt: 1,
      },
      {
        id: 'a',
        role: 'assistant' as const,
        text: `Selon [Clarke](${sourceLink('s1')}), réponse.`,
        state: 'complete' as const,
        createdAt: 2,
        sources: [commentary],
      },
    ],
  }
  saveConversations(storage, 'test', [conversation])
  const restored = loadConversations(storage, 'test')[0]
  expect(restored.messages[1].sources).toEqual([commentary])
  const memory = await prepareMemory(
    restored,
    async () => {
      throw new Error('unexpected')
    },
    new AbortController().signal,
    () => {},
    () => {}
  )
  expect(memory.history[1].content).toBe('Selon Clarke, réponse.')
})
it('preserves precise lexicon identity and dictionary work when navigating', () => {
  expect(
    sourceRoute({
      id: 's1',
      kind: 'strong',
      title: 'H7050A',
      excerpt: '',
      params: { code: 'H7050A', identityKind: 'dstrong' },
    }).params
  ).toMatchObject({ identityCode: 'H7050A', identityKind: 'dstrong' })
  expect(
    sourceRoute({
      id: 's2',
      kind: 'dictionary',
      title: 'Fronde · Bost',
      excerpt: '',
      params: { work: 'bost', entryId: '123', word: 'Fronde' },
    })
  ).toEqual({
    pathname: '/dictionnary-detail',
    params: { work: 'bost', entryId: '123', word: 'Fronde', language: 'fr' },
  })
})
it('opens the version actually read instead of relabelling KJV as LSG', () => {
  expect(
    sourceRoute({
      id: 's1',
      kind: 'passage',
      title: 'John',
      excerpt: 'Abide',
      version: 'KJV',
      params: { book: '43', chapter: '15', start: '4', end: '4' },
    })
  ).toMatchObject({ params: { version: 'KJV' } })
})
