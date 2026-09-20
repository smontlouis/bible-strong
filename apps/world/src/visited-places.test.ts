import { afterEach, expect, it, vi } from 'vitest'
import { loadVisitedPlaces, saveVisitedPlaces, VISITED_PLACES_KEY } from './visited-places'

afterEach(() => vi.unstubAllGlobals())

it('restores discovered places from local storage', () => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  expect(loadVisitedPlaces()).toEqual([])
  saveVisitedPlaces(['lexicon', 'themes'])
  expect(values.has(VISITED_PLACES_KEY)).toBe(true)
  expect(loadVisitedPlaces()).toEqual(['lexicon', 'themes'])
})

it('ignores duplicate and unknown places in stored data', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => JSON.stringify(['lexicon', 'lexicon', 'removed', null, 4, 'dictionary']),
  })
  expect(loadVisitedPlaces()).toEqual(['lexicon', 'dictionary'])
})

it('tolerates malformed or unavailable browser storage', () => {
  for (const value of ['{broken', '{}', 'null']) {
    vi.stubGlobal('localStorage', { getItem: () => value })
    expect(loadVisitedPlaces()).toEqual([])
  }
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error('blocked')
    },
    setItem: () => {
      throw Error('blocked')
    },
  })
  expect(loadVisitedPlaces()).toEqual([])
  expect(() => saveVisitedPlaces(['lexicon'])).not.toThrow()
})
