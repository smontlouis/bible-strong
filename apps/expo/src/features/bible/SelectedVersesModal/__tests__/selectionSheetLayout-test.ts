import { getSelectionSheetMaxWidth } from '../selectionSheetLayout'

it('uses the available Bible panel width, including narrow sidebars', () => {
  expect(getSelectionSheetMaxWidth(240)).toBe(240)
  expect(getSelectionSheetMaxWidth(500)).toBe(500)
  expect(getSelectionSheetMaxWidth(900)).toBe(900)
})

it('caps the palette at three groups plus horizontal margins', () => {
  expect(getSelectionSheetMaxWidth(932)).toBe(932)
  expect(getSelectionSheetMaxWidth(1400)).toBe(932)
})
