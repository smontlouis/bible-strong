import {
  getInterlinearLocalePriority,
  isInterlinearModeEnabled,
  normalizeInterlinearMode,
  shouldSuppressVerseGestures,
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

  it.each(['interlinear', 'strong', 'transliteration'] as const)(
    'suppresses verse gestures in BHG %s mode',
    mode => {
      expect(shouldSuppressVerseGestures('BHG', mode)).toBe(true)
    }
  )

  it('keeps verse gestures in the plain BHG text and other Bible versions', () => {
    expect(shouldSuppressVerseGestures('BHG', 'hidden')).toBe(false)
    expect(shouldSuppressVerseGestures('LSG', 'strong')).toBe(false)
  })

  it('prioritizes the requested gloss language before its fallback', () => {
    expect(getInterlinearLocalePriority('fr')).toEqual(['fr', 'en'])
    expect(getInterlinearLocalePriority('en')).toEqual(['en', 'fr'])
  })
})
