import { getSelectionSheetBounds } from '../selectionSheetBounds'

it('reserves both sidebars when the main reader owns the selection', () => {
  expect(
    getSelectionSheetBounds({ left: 260, right: 1000, top: 0, bottom: 900 }, 1500, 900)
  ).toEqual({ left: 260, right: 500, bottom: 0, width: 740, height: 900 })
})
it('confines a sidebar reader to its own pane', () => {
  expect(
    getSelectionSheetBounds({ left: 1000, right: 1500, top: 54, bottom: 850 }, 1500, 900)
  ).toEqual({ left: 1000, right: 0, bottom: 50, width: 500, height: 796 })
})
it('clips partially visible readers and collapses offscreen readers', () => {
  expect(
    getSelectionSheetBounds({ left: -100, right: 300, top: -50, bottom: 1000 }, 1500, 900)
  ).toEqual({ left: 0, right: 1200, bottom: 0, width: 300, height: 900 })
  expect(
    getSelectionSheetBounds({ left: 1600, right: 2000, top: 0, bottom: 900 }, 1500, 900).width
  ).toBe(0)
})
