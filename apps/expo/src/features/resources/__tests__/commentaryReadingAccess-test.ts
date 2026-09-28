import { createCommentaryReadingAccess } from '../commentaryReadingAccess'
import * as Schema from 'effect/Schema'
import { CommentaryReadingResourceIndex } from '@bible-strong/resource-domain/contracts/commentaryReadingContract'

const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__')
beforeAll(() => Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true }))
afterAll(() => {
  if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev)
  else Reflect.deleteProperty(globalThis, '__DEV__')
})

const consoleLog = jest.spyOn(console, 'log').mockImplementation()
beforeEach(() => consoleLog.mockClear())
afterAll(() => consoleLog.mockRestore())

const resource = { kind: 'commentary', resourceId: 'barnes', language: 'fr', revision: 'r1' }
const index = {
  resource,
  sections: [{ id: 'section', rangeStartVerse: 1, rangeEndVerse: 2, excerpt: 'Short preview' }],
}
const request = {
  book: 1,
  chapter: 1,
  resources: [{ resourceId: 'barnes', language: 'fr' as const }],
}
function harness() {
  const values = new Map<string, unknown>()
  const fetcher = jest.fn(
    async () => new Response(JSON.stringify({ ...request, indexes: [index], unavailable: [] }))
  )
  const isOnline = jest.fn(async () => true)
  const cache = {
    read: async (key: string) => values.get(key),
    write: async (key: string, value: unknown) => {
      values.set(key, value)
    },
  }
  return { values, fetcher, isOnline, cache }
}

it('works with React Native AbortSignal without the browser-only timeout method', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')!
  Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true })
  try {
    const h = harness()
    const access = createCommentaryReadingAccess({ ...h, baseUrl: 'https://resources.test' })
    expect((await access.loadIndex(request)).indexes).toHaveLength(1)
  } finally {
    Object.defineProperty(AbortSignal, 'timeout', descriptor)
  }
})

it('preserves selected order when some resources are installed and others are online', async () => {
  const h = harness()
  const offline = Schema.decodeUnknownSync(CommentaryReadingResourceIndex)({
    ...index,
    resource: { ...resource, resourceId: 'acbc' },
  })
  const access = createCommentaryReadingAccess({
    ...h,
    baseUrl: 'https://resources.test',
    local: {
      index: async resourceId => (resourceId === 'acbc' ? offline : undefined),
      section: async () => undefined,
    },
  })
  const result = await access.loadIndex({
    ...request,
    resources: [...request.resources, { resourceId: 'acbc', language: 'fr' }],
  })
  expect(result.indexes.map(value => value.resource.resourceId)).toEqual(['barnes', 'acbc'])
  expect(consoleLog.mock.calls).toEqual([
    [
      '[ResourceSource] Commentary · OFFLINE · loadIndex · resourceId=acbc book=1 chapter=1 language=fr',
    ],
    [
      '[ResourceSource] Commentary · ONLINE · loadIndex · resourceId=barnes book=1 chapter=1 language=fr',
    ],
  ])
})

it('batches online indexes, keeps a revision cache and uses excerpts offline without full downloads', async () => {
  const h = harness()
  const access = createCommentaryReadingAccess({ ...h, baseUrl: 'https://resources.test' })
  const result = await access.loadIndex(request)
  expect(result.indexes[0].sections[0].excerpt).toBe('Short preview')
  expect(h.fetcher).toHaveBeenCalledTimes(1)
  expect(h.fetcher.mock.calls[0]).toEqual(
    expect.arrayContaining(['https://resources.test/v1/commentaries/reading-index'])
  )
  h.isOnline.mockResolvedValue(false)
  const cached = await access.loadIndex(request)
  expect(cached.cached).toBe(true)
  expect(consoleLog).toHaveBeenLastCalledWith(
    '[ResourceSource] Commentary · CACHE · loadIndex · resourceId=barnes book=1 chapter=1 language=fr'
  )
  expect(cached.indexes[0].resource.revision).toBe('r1')
  expect(h.fetcher).toHaveBeenCalledTimes(1)
  await expect(
    access.loadSection({
      resourceId: 'barnes',
      language: 'fr',
      revision: 'r1',
      book: 1,
      chapter: 1,
      sectionId: 'section',
    })
  ).rejects.toMatchObject({ code: 'NETWORK_OFFLINE' })
})

it('rejects an index for a different chapter or resource', async () => {
  const h = harness()
  h.fetcher.mockResolvedValue(
    new Response(JSON.stringify({ ...request, chapter: 2, indexes: [index], unavailable: [] }))
  )
  const access = createCommentaryReadingAccess({ ...h, baseUrl: 'https://resources.test' })
  await expect(access.loadIndex(request)).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' })
  expect(consoleLog).not.toHaveBeenCalled()
})

it('rejects full content from a different revision', async () => {
  const h = harness()
  h.fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        resource: { ...resource, revision: 'r2' },
        book: 1,
        chapter: 1,
        section: {
          id: 'section',
          rangeStartVerse: 1,
          rangeEndVerse: 2,
          content: '<p>Wrong edition</p>',
        },
      })
    )
  )
  const access = createCommentaryReadingAccess({ ...h, baseUrl: 'https://resources.test' })
  await expect(
    access.loadSection({
      resourceId: 'barnes',
      language: 'fr',
      revision: 'r1',
      book: 1,
      chapter: 1,
      sectionId: 'section',
    })
  ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' })
})

it.each(['offline', 'online'] as const)(
  'logs a section from %s without its content',
  async source => {
    const h = harness()
    const sectionRequest = {
      resourceId: 'barnes',
      language: 'fr' as const,
      revision: 'r1',
      book: 1,
      chapter: 1,
      sectionId: 'section',
    }
    const response = {
      resource: { ...resource, kind: 'commentary' as const, language: 'fr' as const },
      book: 1,
      chapter: 1,
      section: {
        id: 'section',
        rangeStartVerse: 1,
        rangeEndVerse: 2,
        content: '<p>Private content</p>',
      },
    }
    h.fetcher.mockResolvedValue(new Response(JSON.stringify(response)))
    const access = createCommentaryReadingAccess({
      ...h,
      baseUrl: 'https://resources.test',
      local: {
        index: async () => undefined,
        section: async () => (source === 'offline' ? response : undefined),
      },
    })
    await expect(access.loadSection(sectionRequest)).resolves.toEqual(response)
    expect(consoleLog.mock.calls).toEqual([
      [
        `[ResourceSource] Commentary · ${source.toUpperCase()} · loadSection · resourceId=barnes sectionId=section book=1 chapter=1 language=fr`,
      ],
    ])
  }
)
