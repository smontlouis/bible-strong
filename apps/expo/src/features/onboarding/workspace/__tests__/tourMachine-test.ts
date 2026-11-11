import { advanceTour, type TourSignals } from '../tourMachine'

const quiet: TourSignals = {
  paletteOpen: false,
  actionsOpen: false,
  guideOpen: false,
  tabChanged: false,
}

describe('advanceTour', () => {
  it('waits for the palette', () => {
    expect(advanceTour('palette', quiet)).toBe('palette')
    expect(advanceTour('palette', { ...quiet, paletteOpen: true })).toBe('passage')
  })

  it('waits for a tab opened from the palette, once the palette is closed', () => {
    expect(advanceTour('passage', { ...quiet, paletteOpen: true, tabChanged: true })).toBe(
      'passage'
    )
    expect(advanceTour('passage', { ...quiet, paletteOpen: false })).toBe('passage')
    expect(advanceTour('passage', { ...quiet, tabChanged: true })).toBe('actions')
  })

  it('takes the tab’s actions, then the guide, then ends', () => {
    expect(advanceTour('actions', { ...quiet, paletteOpen: true })).toBe('actions')
    expect(advanceTour('actions', { ...quiet, paletteOpen: true, actionsOpen: true })).toBe('guide')
    expect(advanceTour('guide', { ...quiet, guideOpen: true })).toBe('done')
    expect(advanceTour('done', { ...quiet, guideOpen: true })).toBe('done')
  })
})
