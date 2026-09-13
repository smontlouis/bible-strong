import {
  isBibleShortcut,
  nextAvailableStrongMode,
  parseVerseDestination,
} from '../bibleKeyboardActions'

describe('Bible keyboard actions', () => {
  it('cycles through all available modes in order', () => {
    expect(nextAvailableStrongMode('hidden', true, true)).toBe('visible')
    expect(nextAvailableStrongMode('visible', true, true)).toBe('reverse-interlinear')
    expect(nextAvailableStrongMode('reverse-interlinear', true, true)).toBe('hidden')
  })
  it('skips missing resources and returns to text when resources disappear', () => {
    expect(nextAvailableStrongMode('visible', true, false)).toBe('hidden')
    expect(nextAvailableStrongMode('hidden', false, true)).toBe('hidden')
    expect(nextAvailableStrongMode('reverse-interlinear', false, false)).toBe('hidden')
  })
  it('accepts only an existing verse in the current chapter', () => {
    expect(parseVerseDestination(' 18 ', 24)).toBe(18)
    expect(parseVerseDestination('24', 24)).toBe(24)
    for (const input of ['', '0', '-1', '25', '1.8', '1e1', 'Jean 3:18']) {
      expect(parseVerseDestination(input, 24)).toBeUndefined()
    }
    expect(parseVerseDestination('18')).toBeUndefined()
  })
  it('ignores held keys, modifiers and composition', () => {
    const event = {
      key: 's',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      repeat: false,
      isComposing: false,
    }
    expect(isBibleShortcut(event, 's')).toBe(true)
    expect(isBibleShortcut({ ...event, key: 'v' }, 'v')).toBe(true)
    expect(isBibleShortcut(event, 'v')).toBe(false)
    for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'repeat', 'isComposing']) {
      expect(isBibleShortcut({ ...event, [flag]: true }, 's')).toBe(false)
    }
  })
})
