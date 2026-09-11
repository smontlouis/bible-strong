import { getPickerAllowedSources, getPickerResultTab } from '../pickerSelection'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'

jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => 'created-tab' }))
jest.mock('~helpers/bibleBookCatalog', () => ({
  getBook: () => ({ Numero: 43, Nom: 'Jean', Chapitres: 21 }),
}))
jest.mock('~state/tabs', () => ({
  getDefaultBibleTab: (version: string) => ({ type: 'bible', data: { selectedVersion: version } }),
}))

it('restricts each launcher to its authorized sources', () => {
  expect(getPickerAllowedSources('bible')).toEqual(['passages'])
  expect(getPickerAllowedSources('compare')).toEqual(['passages'])
  expect(getPickerAllowedSources('study')).toEqual(['studies'])
  expect(getPickerAllowedSources('plan')).toEqual(['plan'])
  expect(getPickerAllowedSources('commentary')).toEqual(['commentary'])
})
const passage: SearchEntityResult = {
  id: 'verse',
  title: 'Jean 3:16-17',
  type: 'passages',
  iconType: 'passages',
  endpoint: { type: 'verse', verseKeys: ['43-3-16', '43-3-17'], version: 'KJV' },
}
it('opens the same selected passage according to the caller intent', () => {
  expect(getPickerResultTab(passage, 'LSG', 'bible')).toMatchObject({
    type: 'bible',
    data: { selectedVersion: 'KJV', focusVerses: [16, 17] },
  })
  expect(getPickerResultTab(passage, 'LSG', 'compare')).toMatchObject({
    type: 'compare',
    data: { selectedVerses: { '43-3-16': true, '43-3-17': true } },
  })
})
it('rejects results outside the launcher allowed types', () => {
  expect(getPickerResultTab(passage, 'LSG', 'plan')).toBeUndefined()
})
