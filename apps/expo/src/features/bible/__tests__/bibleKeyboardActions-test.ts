import {
  moveVerseSelection,
  nextAvailableStrongMode,
  parseVerseDestination,
} from '../bibleKeyboardActions'

describe('Bible keyboard actions', () => {
  it('cycles through all available modes in order', () => {
    expect(nextAvailableStrongMode('hidden', true, true)).toBe('visible')
    expect(nextAvailableStrongMode('visible', true, true)).toBe('transliteration')
    expect(nextAvailableStrongMode('transliteration', true, true)).toBe('reverse-interlinear')
    expect(nextAvailableStrongMode('reverse-interlinear', true, true)).toBe('hidden')
  })
  it('skips missing resources and returns to text when resources disappear', () => {
    expect(nextAvailableStrongMode('visible', true, false)).toBe('hidden')
    expect(nextAvailableStrongMode('hidden', false, true)).toBe('hidden')
    expect(nextAvailableStrongMode('reverse-interlinear', false, false)).toBe('hidden')
    expect(nextAvailableStrongMode('transliteration', true, false)).toBe('hidden')
  })
  it('accepts only an existing verse in the current chapter', () => {
    expect(parseVerseDestination(' 18 ', 24)).toBe(18)
    expect(parseVerseDestination('24', 24)).toBe(24)
    for (const input of ['', '0', '-1', '25', '1.8', '1e1', 'Jean 3:18']) {
      expect(parseVerseDestination(input, 24)).toBeUndefined()
    }
    expect(parseVerseDestination('18')).toBeUndefined()
  })
  const verses = ['1-1-1', '1-1-2', '1-1-3', '1-1-4', '1-1-5']
  it('moves a lone verse and stops at the ends of the chapter', () => {
    expect(moveVerseSelection(verses, ['1-1-2'], 1, false)).toEqual({
      keys: ['1-1-3'],
      head: '1-1-3',
    })
    expect(moveVerseSelection(verses, ['1-1-1'], -1, false)?.keys).toEqual(['1-1-1'])
    expect(moveVerseSelection(verses, ['1-1-5'], 1, false)?.keys).toEqual(['1-1-5'])
  })
  it('leaves the start to the caller when nothing on screen is selected', () => {
    expect(moveVerseSelection(verses, [], 1, false)).toBeUndefined()
    expect(moveVerseSelection(verses, ['1-2-1'], 1, false)).toBeUndefined()
  })
  it('extends from the end that moved last and shrinks back past the anchor', () => {
    const down = moveVerseSelection(verses, ['1-1-2'], 1, true)
    expect(down).toEqual({ keys: ['1-1-2', '1-1-3'], head: '1-1-3' })
    const further = moveVerseSelection(verses, down!.keys, 1, true, down!.head)
    expect(further?.keys).toEqual(['1-1-2', '1-1-3', '1-1-4'])
    const back = moveVerseSelection(verses, further!.keys, -1, true, further!.head)
    expect(back?.keys).toEqual(['1-1-2', '1-1-3'])
    const anchor = moveVerseSelection(verses, back!.keys, -1, true, back!.head)
    expect(anchor).toEqual({ keys: ['1-1-2'], head: '1-1-2' })
    const above = moveVerseSelection(verses, anchor!.keys, -1, true, anchor!.head)
    // The verse reached comes last: the reader scrolls to it and the menu follows it.
    expect(above).toEqual({ keys: ['1-1-2', '1-1-1'], head: '1-1-1' })
  })
  it('moves a lone verse from the bottom of a selection made by clicks', () => {
    expect(moveVerseSelection(verses, ['1-1-4', '1-1-2'], 1, false)?.keys).toEqual(['1-1-5'])
    expect(moveVerseSelection(verses, ['1-1-4', '1-1-2'], -1, false)?.keys).toEqual(['1-1-1'])
  })
})
