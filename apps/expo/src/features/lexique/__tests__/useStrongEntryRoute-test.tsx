import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { useStrongEntryRoute } from '../useStrongEntryRoute'

const mockAccess = {
  getModuleAvailability: jest.fn(async () => ({ status: 'available', moduleId: 'simple-fr' })),
  loadEntry: jest.fn(),
  loadEntryExtras: jest.fn(),
}
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ strongLexicon: mockAccess }),
}))
jest.mock('../useStrongLexiconLanguage', () => ({
  useStrongLexiconLanguage: () => ({ language: 'fr' }),
}))
const definition = {
  stepCode: 'H2416E',
  definitionHtml: 'historical',
  detailedDefinitionHtml: 'specific',
  relations: [],
  resources: [],
  modules: {},
} as unknown as StrongLexiconEntry
let state: ReturnType<typeof useStrongEntryRoute>
function Probe({ code }: { code: string }) {
  const current = useStrongEntryRoute({ reference: code }, true)
  useEffect(() => {
    state = current
  }, [current])
  return null
}
let tree: ReactTestRenderer | undefined
let client: QueryClient
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
const originalRequestFrame = global.requestAnimationFrame
const originalCancelFrame = global.cancelAnimationFrame
const render = async (code = 'H2416E') => {
  await act(async () => {
    const view = (
      <QueryClientProvider client={client}>
        <Probe code={code} />
      </QueryClientProvider>
    )
    if (tree) tree.update(view)
    else tree = create(view)
  })
  await flush()
}
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10))
  })
}
const paint = async () => {
  await act(async () => {
    const current = [...frames.values()]
    frames.clear()
    current.forEach(callback => callback(0))
  })
}
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  jest.resetAllMocks()
  mockAccess.getModuleAvailability.mockResolvedValue({ status: 'available', moduleId: 'simple-fr' })
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  frames = new Map()
  nextFrame = 0
  global.requestAnimationFrame = jest.fn(callback => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  global.cancelAnimationFrame = jest.fn(id => {
    if (id != null) frames.delete(id)
  })
  mockAccess.loadEntry.mockResolvedValue(definition)
  mockAccess.loadEntryExtras.mockResolvedValue({ resources: [{ id: 1 }], modules: {} })
})
afterEach(async () => {
  await act(async () => tree?.unmount())
  tree = undefined
  client.clear()
  global.requestAnimationFrame = originalRequestFrame
  global.cancelAnimationFrame = originalCancelFrame
  jest.restoreAllMocks()
})
it('shows Essential before automatically requesting extras after paint', async () => {
  await render()
  expect(state.entry?.definitionHtml).toBe('historical')
  expect(state.backgroundReady).toBe(false)
  expect(mockAccess.loadEntryExtras).not.toHaveBeenCalled()
  await paint()
  expect(mockAccess.loadEntryExtras).not.toHaveBeenCalled()
  await paint()
  await flush()
  expect(mockAccess.loadEntryExtras).toHaveBeenCalledTimes(1)
  expect(state.entry?.resources).toEqual([{ id: 1 }])
  expect(state.entry?.definitionHtml).toBe('historical')
  expect(state.entry?.detailedDefinitionHtml).toBe('specific')
})
it('retains Essential and exposes retry when extras fail', async () => {
  mockAccess.loadEntryExtras.mockRejectedValueOnce(new Error('network'))
  await render()
  await paint()
  await paint()
  await flush()
  expect(state.extrasError).toBe(true)
  expect(state.entryQuery.isError).toBe(false)
  expect(state.entry?.definitionHtml).toBe('historical')
  await act(async () => {
    await state.retryExtras()
  })
  await flush()
  expect(state.extrasError).toBe(false)
})
it('cancels scheduled reads for an entry left before its first paint', async () => {
  await render('H2416E')
  await paint()
  await render('H0349A')
  await paint()
  await paint()
  await flush()
  expect(mockAccess.loadEntryExtras).toHaveBeenCalledTimes(1)
  expect(mockAccess.loadEntryExtras.mock.calls[0][0]).toMatchObject({ code: 'H0349A' })
})

it('does not offer missing addons for a simple-only offline entry', async () => {
  mockAccess.loadEntry.mockResolvedValue({
    ...definition,
    detailedDefinitionHtml: undefined,
    detailedEntryAvailable: false,
  })
  await render()
  await paint()
  await paint()
  await flush()
  expect(state.backgroundReady).toBe(true)
  expect(state.extrasLoading).toBe(false)
  expect(state.extrasError).toBe(false)
  expect(mockAccess.loadEntryExtras).not.toHaveBeenCalled()
})

it('does not merge a late addon response into the next word', async () => {
  let resolveFirst!: (value: unknown) => void
  mockAccess.loadEntry.mockImplementation(async (identity: { code: string }) => ({
    ...definition,
    stepCode: identity.code,
    definitionHtml: identity.code,
  }))
  mockAccess.loadEntryExtras.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveFirst = resolve
      })
  )
  await render('H2416E')
  await paint()
  await paint()
  await render('H0349A')
  await paint()
  await paint()
  await flush()
  await act(async () => {
    resolveFirst({ resources: [{ id: 999 }], modules: {} })
  })
  await flush()
  expect(state.entry?.stepCode).toBe('H0349A')
  expect(state.entry?.definitionHtml).toBe('H0349A')
  expect(state.entry?.resources).toEqual([{ id: 1 }])
})
