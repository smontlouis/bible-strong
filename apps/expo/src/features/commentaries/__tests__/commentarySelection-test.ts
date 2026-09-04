/* eslint-disable import/first */

jest.mock('~helpers/atomWithAsyncStorage', () => jest.fn(() => ({})))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))

import {
  DEFAULT_COMMENTARY_SELECTIONS,
  MAX_SELECTED_COMMENTARIES,
  migrateCommentarySelectionState,
  orderCommentarySelectionByPositions,
  reorderCommentarySelection,
  toggleCommentarySelection,
} from '../commentarySelection'

describe('commentary selection', () => {
  it('starts with the three requested classics for each language', () => {
    expect(DEFAULT_COMMENTARY_SELECTIONS.fr).toEqual(['barnes:fr', 'acbc:fr', 'mhy-fr:fr'])
    expect(DEFAULT_COMMENTARY_SELECTIONS.en).toEqual(['barnes:en', 'acbc:en', 'mhcc:en'])
  })

  it('never selects more than five commentaries', () => {
    const selected = ['barnes:fr', 'acbc:fr', 'mhcc:en', 'jfb:en', 'calvin:en'] as const

    expect(toggleCommentarySelection(selected, 'wesley:en')).toEqual({
      selected,
      limitReached: true,
    })
    expect(selected).toHaveLength(MAX_SELECTED_COMMENTARIES)
  })

  it('repairs persisted language mismatches and duplicates while preserving an empty choice', () => {
    expect(
      migrateCommentarySelectionState({
        fr: ['barnes', 'barnes', 'mhcc', 'bible-annotee'],
        en: [],
      })
    ).toEqual(['barnes:fr', 'bible-annotee:fr'])
  })

  it('keeps French and English projections of the same work as two choices', () => {
    expect(migrateCommentarySelectionState(['barnes:fr', 'barnes:en'])).toEqual([
      'barnes:fr',
      'barnes:en',
    ])
  })

  it('reorders commentaries without changing the selection', () => {
    expect(reorderCommentarySelection(['barnes:fr', 'acbc:fr', 'mhy-fr:fr'], 0, 2)).toEqual([
      'acbc:fr',
      'mhy-fr:fr',
      'barnes:fr',
    ])
  })

  it('ignores an invalid reorder destination', () => {
    expect(reorderCommentarySelection(['barnes:fr', 'acbc:fr'], 0, 3)).toEqual([
      'barnes:fr',
      'acbc:fr',
    ])
  })

  it('rebuilds the persisted order from DnD positions', () => {
    expect(
      orderCommentarySelectionByPositions(['barnes:fr', 'acbc:fr', 'mhy-fr:fr'], {
        'mhy-fr:fr': 0,
        'barnes:fr': 1,
        'acbc:fr': 2,
      })
    ).toEqual(['mhy-fr:fr', 'barnes:fr', 'acbc:fr'])
  })
})
