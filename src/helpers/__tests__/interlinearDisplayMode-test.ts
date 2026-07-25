import {
  getInterlinearLocalePriority,
  isInterlinearModeEnabled,
  normalizeInterlinearMode,
} from '../interlinearDisplayMode'

describe('interlinear display modes', () => {
  it('normalizes the legacy visible mode to the detailed interlinear mode', () => {
    expect(normalizeInterlinearMode('visible')).toBe('interlinear')
  })

  it.each(['interlinear', 'strong', 'transliteration'] as const)(
    'enables token loading for %s mode',
    mode => {
      expect(isInterlinearModeEnabled(mode)).toBe(true)
    }
  )

  it('keeps hidden mode disabled', () => {
    expect(isInterlinearModeEnabled('hidden')).toBe(false)
  })

  it('prioritizes the requested gloss language before its fallback', () => {
    expect(getInterlinearLocalePriority('fr')).toEqual(['fr', 'en'])
    expect(getInterlinearLocalePriority('en')).toEqual(['en', 'fr'])
  })
})
