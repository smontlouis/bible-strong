import { afterEach, expect, it, vi } from 'vitest'
import { LANGUAGE_KEY, loadLanguage, saveLanguage } from './language'

afterEach(() => vi.unstubAllGlobals())

it('detects supported browser preferences in order, including regional variants', () => {
  vi.stubGlobal('localStorage', { getItem: () => null })
  for (const [languages, expected] of [
    [['fr-CA', 'en'], 'fr'],
    [['en-GB', 'fr'], 'en'],
    [['de-DE', 'fr-FR'], 'fr'],
    [['es-ES'], 'en'],
  ] as const) {
    vi.stubGlobal('navigator', { languages })
    expect(loadLanguage()).toBe(expected)
  }
  vi.stubGlobal('navigator', { language: 'fr-FR' })
  expect(loadLanguage()).toBe('fr')
})

it('persists the initial selection and gives later manual choices priority over the browser', () => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  vi.stubGlobal('navigator', { languages: ['fr-FR'] })
  saveLanguage(loadLanguage())
  expect(values.get(LANGUAGE_KEY)).toBe('fr')
  saveLanguage('en')
  expect(loadLanguage()).toBe('en')
})

it('ignores invalid saved values and tolerates unavailable browser APIs', () => {
  vi.stubGlobal('navigator', undefined)
  vi.stubGlobal('localStorage', { getItem: () => 'de' })
  expect(loadLanguage()).toBe('en')
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error('blocked')
    },
    setItem: () => {
      throw Error('blocked')
    },
  })
  expect(loadLanguage()).toBe('en')
  expect(() => saveLanguage('fr')).not.toThrow()
  vi.stubGlobal('navigator', { languages: ['fr'] })
  expect(loadLanguage()).toBe('fr')
})
