import React from 'react'
import renderer, { act } from 'react-test-renderer'
import { createStore, Provider } from 'jotai'
import { useAssistantResourceContext } from '../useAssistantResourceContext.web'
import { resourceContextsAtom } from '../readingContextRegistry'
import type { ReadingContext } from '../conversations'
let mockFocused = true
jest.mock('expo-router', () => ({
  usePathname: () => '/commentary-entry',
  useIsFocused: () => mockFocused,
}))
const first: ReadingContext = { key: 'one', kind: 'commentary', label: 'Clarke', detail: 'Clarke' }
const second: ReadingContext = { key: 'two', kind: 'dictionary', label: 'Bost', detail: 'Bost' }
function Publisher({ scope, context }: { scope: string; context: ReadingContext }) {
  useAssistantResourceContext(scope, context)
  return null
}
it('updates the actual displayed resource and removes unfocused/unmounted panel publications', async () => {
  const store = createStore()
  let root!: renderer.ReactTestRenderer
  const tree = (scope: string, context: ReadingContext) => (
    <Provider store={store}>
      <Publisher scope={scope} context={context} />
    </Provider>
  )
  mockFocused = true
  await act(async () => {
    root = renderer.create(tree('panel', first))
  })
  expect(Object.values(store.get(resourceContextsAtom))[0].context.key).toBe('one')
  await act(async () => {
    root.update(tree('panel', second))
  })
  expect(Object.values(store.get(resourceContextsAtom))).toHaveLength(1)
  expect(Object.values(store.get(resourceContextsAtom))[0].context.key).toBe('two')
  mockFocused = false
  await act(async () => {
    root.update(tree('panel', second))
  })
  expect(Object.values(store.get(resourceContextsAtom))).toEqual([])
  await act(async () => {
    root.update(tree('tab:reader', first))
  })
  expect(Object.values(store.get(resourceContextsAtom))[0].scope).toBe('tab:reader')
  await act(async () => {
    root.unmount()
  })
  expect(Object.values(store.get(resourceContextsAtom))).toEqual([])
})
