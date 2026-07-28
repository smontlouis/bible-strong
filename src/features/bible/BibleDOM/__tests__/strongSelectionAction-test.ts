import { getStrongSelectionWordFromTextSegment } from '../strongSelectionAction'

describe('getStrongSelectionWordFromTextSegment', () => {
  it('keeps the complete translated segment associated with a Strong group', () => {
    expect(getStrongSelectionWordFromTextSegment(' Au commencement ')).toBe('Au commencement')
    expect(getStrongSelectionWordFromTextSegment(' et la terre ')).toBe('et la terre')
  })

  it('removes punctuation around the translated segment', () => {
    expect(getStrongSelectionWordFromTextSegment(' , “la parole” ')).toBe('la parole')
  })
})
