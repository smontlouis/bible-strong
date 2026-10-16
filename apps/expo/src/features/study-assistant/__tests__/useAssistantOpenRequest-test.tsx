import React from 'react'
import renderer, { act } from 'react-test-renderer'
import { createStore, Provider } from 'jotai'
import { assistantOpenRequestAtom } from '../assistantSheetContext'
import { useAssistantOpenRequest } from '../useAssistantOpenRequest'

const present = jest.fn()
const sheet = { current: { present } }
function Launcher() {
  useAssistantOpenRequest(sheet)
  return null
}

beforeEach(() => present.mockClear())

it('opens the sheet once per request, not again when the launcher remounts', async () => {
  const store = createStore()
  const tree = (
    <Provider store={store}>
      <Launcher />
    </Provider>
  )
  let root!: renderer.ReactTestRenderer
  await act(async () => {
    root = renderer.create(tree)
  })
  expect(present).not.toHaveBeenCalled()

  await act(async () => {
    store.set(assistantOpenRequestAtom, count => count + 1)
  })
  expect(present).toHaveBeenCalledTimes(1)
  expect(store.get(assistantOpenRequestAtom)).toBe(0)

  // Android: a back press unmounts the tree while the JavaScript, and the atom, survive.
  await act(async () => {
    root.unmount()
  })
  await act(async () => {
    root = renderer.create(tree)
  })
  expect(present).toHaveBeenCalledTimes(1)

  await act(async () => {
    store.set(assistantOpenRequestAtom, count => count + 1)
  })
  expect(present).toHaveBeenCalledTimes(2)
})

it('serves a request made before the launcher mounted', async () => {
  const store = createStore()
  store.set(assistantOpenRequestAtom, 1)
  await act(async () => {
    renderer.create(
      <Provider store={store}>
        <Launcher />
      </Provider>
    )
  })
  expect(present).toHaveBeenCalledTimes(1)
  expect(store.get(assistantOpenRequestAtom)).toBe(0)
})
