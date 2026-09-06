import { loadAsync } from 'expo-font'
import { loadWebFonts } from '../loadWebFonts'

jest.mock('expo-font', () => ({ loadAsync: jest.fn(async () => undefined) }))
jest.mock('../appFonts', () => ({
  appFonts: { 'Literata Book': 1, 'eina-03-bold': 2, FiraCode: 3 },
}))

it('requests the bundled reading and title faces before completing web font preparation', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const load = jest.fn(async (_font: string) => [])
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { fonts: { load } } })
  try {
    await loadWebFonts()
    expect(loadAsync).toHaveBeenCalled()
    expect(load.mock.calls.map(call => call[0])).toEqual([
      '16px "Literata Book"',
      '16px "eina-03-bold"',
      '16px "FiraCode"',
    ])
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
