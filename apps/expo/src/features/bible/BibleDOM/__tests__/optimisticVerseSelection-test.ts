import {
  applyVerseToggles,
  createVerseToggle,
  isVerseToggleConfirmed,
  type OptimisticVerseToggle,
  type VerseSelection,
} from '../optimisticVerseSelection'

const empty: VerseSelection = { selectedVerses: {}, selectedVersesVersion: 'LSG' }

const toggle = (
  overrides: Partial<OptimisticVerseToggle> & Pick<OptimisticVerseToggle, 'verseKey'>
): OptimisticVerseToggle => ({
  version: 'LSG',
  selected: true,
  held: false,
  updatedAt: 0,
  ...overrides,
})

describe('optimistic verse selection', () => {
  it('selects a tapped verse before the native side answers', () => {
    const shown = applyVerseToggles(empty, [toggle({ verseKey: '1-1-1' })])

    expect(shown).toEqual({ selectedVerses: { '1-1-1': true }, selectedVersesVersion: 'LSG' })
  })

  it('unselects a selected verse', () => {
    const selection = {
      selectedVerses: { '1-1-1': true, '1-1-2': true },
      selectedVersesVersion: 'LSG',
    }
    const shown = applyVerseToggles(selection, [toggle({ verseKey: '1-1-1', selected: false })])

    expect(shown.selectedVerses).toEqual({ '1-1-2': true })
  })

  it('starts a new selection for a verse of another version, as the native side does', () => {
    const selection = { selectedVerses: { '1-1-1': true }, selectedVersesVersion: 'LSG' }
    const shown = applyVerseToggles(selection, [toggle({ verseKey: '1-1-2', version: 'KJV' })])

    expect(shown).toEqual({ selectedVerses: { '1-1-2': true }, selectedVersesVersion: 'KJV' })
  })

  it('toggles the verse of the version tapped', () => {
    const selection = { selectedVerses: { '1-1-1': true }, selectedVersesVersion: 'LSG' }

    expect(
      createVerseToggle(selection, { verseKey: '1-1-1', version: 'LSG' }, false, 0).selected
    ).toBe(false)
    expect(
      createVerseToggle(selection, { verseKey: '1-1-1', version: 'KJV' }, false, 0).selected
    ).toBe(true)
  })

  it('keeps a sent toggle until the selection coming back shows it', () => {
    const sent = toggle({ verseKey: '1-1-1' })

    expect(isVerseToggleConfirmed(empty, sent)).toBe(false)
    expect(
      isVerseToggleConfirmed(
        { selectedVerses: { '1-1-1': true }, selectedVersesVersion: 'LSG' },
        sent
      )
    ).toBe(true)
  })

  it('keeps a held toggle, which the native side has not received', () => {
    const held = toggle({ verseKey: '1-1-1', held: true })

    expect(
      isVerseToggleConfirmed(
        { selectedVerses: { '1-1-1': true }, selectedVersesVersion: 'LSG' },
        held
      )
    ).toBe(false)
  })
})
