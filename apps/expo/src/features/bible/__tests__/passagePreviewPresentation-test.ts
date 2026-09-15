import {
  getPassageContextHeaderHeight,
  getPassagePreviewMenuActions,
} from '../passagePreviewPresentation'

it('reserves the subheader height for a targeted passage and releases it when focus ends', () => {
  expect(getPassageContextHeaderHeight([35])).toBe(44)
  expect(getPassageContextHeaderHeight(['35'], true)).toBe(0)
  expect(getPassageContextHeaderHeight([])).toBe(0)
  expect(getPassageContextHeaderHeight(undefined)).toBe(0)
})

it('keeps every normal chapter action in order except parallel display', () => {
  const actions = ['params', 'parallel', 'history', 'bookmark', 'export', 'open-tab'].map(id => ({
    id,
  }))
  expect(getPassagePreviewMenuActions(actions).map(action => action.id)).toEqual([
    'params',
    'history',
    'bookmark',
    'export',
    'open-tab',
  ])
  expect(actions).toHaveLength(6)
})
