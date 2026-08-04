import { OPEN_STRONG_SELECTION } from '../dispatch'
import {
  dispatchStrongSelection,
  getStrongSelectionWordFromTextSegment,
} from '../strongSelectionAction'

describe('getStrongSelectionWordFromTextSegment', () => {
  it('keeps the complete translated segment associated with a Strong group', () => {
    expect(getStrongSelectionWordFromTextSegment(' Au commencement ')).toBe('Au commencement')
    expect(getStrongSelectionWordFromTextSegment(' et la terre ')).toBe('et la terre')
  })

  it('removes punctuation around the translated segment', () => {
    expect(getStrongSelectionWordFromTextSegment(' , “la parole” ')).toBe('la parole')
  })
})

describe('dispatchStrongSelection', () => {
  it('preserves contextual morphology in the bottom-sheet payload', () => {
    const dispatch = jest.fn()
    const identity = { kind: 'strong' as const, code: 'H7225' }

    dispatchStrongSelection(dispatch, [identity], 1, 'DBR', {
      word: 'au commencement',
      morphologies: [{ identity, codes: ['HNcfsa'] }],
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: OPEN_STRONG_SELECTION,
      payload: {
        book: 1,
        identities: [identity],
        morphologies: [{ identity, codes: ['HNcfsa'] }],
        reference: '7225',
        version: 'DBR',
        word: 'au commencement',
      },
    })
  })
})
