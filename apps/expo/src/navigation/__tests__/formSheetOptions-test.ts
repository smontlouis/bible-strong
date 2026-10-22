import { createFormSheetOptions } from '../formSheetOptions'
import type { Theme } from '~themes'

let mockIsPad = false
jest.mock('expo-router', () => ({ Stack: {} }))
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    get isPad() {
      return mockIsPad
    },
  },
}))

const theme = { colors: { reverse: '#fff' } } as Theme

it('lets an iPhone sheet leave the page behind it undimmed', () => {
  mockIsPad = false
  expect(createFormSheetOptions(theme, { sheetLargestUndimmedDetentIndex: 0 })).toMatchObject({
    presentation: 'formSheet',
    sheetLargestUndimmedDetentIndex: 0,
  })
})

it('always dims the page behind an iPad sheet', () => {
  mockIsPad = true
  const options = createFormSheetOptions(theme, {
    sheetLargestUndimmedDetentIndex: 0,
    sheetAllowedDetents: [1],
  })
  expect(options).toMatchObject({ presentation: 'formSheet', sheetAllowedDetents: [1] })
  expect(options).not.toHaveProperty('sheetLargestUndimmedDetentIndex')
})
