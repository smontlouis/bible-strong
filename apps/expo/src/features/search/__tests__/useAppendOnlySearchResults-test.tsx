import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { useAppendOnlySearchResults, passageResultKey } from '../useAppendOnlySearchResults'

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

it('deduplicates arrivals, appends later pages without moving rows, and resets for a new search', () => {
  let shown: string[] = []
  function Probe({ scope, items }: { scope: string; items: string[] }) {
    shown = useAppendOnlySearchResults(scope, items, item => item)
    return null
  }
  let tree!: ReactTestRenderer
  act(() => {
    tree = create(<Probe scope="a" items={['classic1']} />)
  })
  expect(shown).toEqual(['classic1'])
  act(() => tree.update(<Probe scope="a" items={['classic1', 'classic1', 'ai1']} />))
  expect(shown).toEqual(['classic1', 'ai1'])
  act(() => tree.update(<Probe scope="a" items={['classic1', 'classic2', 'ai1', 'ai2']} />))
  expect(shown).toEqual(['classic1', 'ai1', 'classic2', 'ai2'])
  act(() => tree.update(<Probe scope="b" items={['ai2', 'classic1']} />))
  expect(shown).toEqual(['ai2', 'classic1'])
  act(() => tree.unmount())
})

it('keeps different translations of the same verse distinct', () => {
  const verse = { book: 43, chapter: 3, verse: 16 }
  expect(passageResultKey({ ...verse, version: 'LSG' })).not.toBe(
    passageResultKey({ ...verse, version: 'KJV' })
  )
})
