import { getStrongSelectionWordFromTextSegment, openStrongWord } from '../strongSelectionAction'

describe('getStrongSelectionWordFromTextSegment', () => {
  it('keeps the complete translated segment associated with a Strong group', () => {
    expect(getStrongSelectionWordFromTextSegment(' Au commencement ')).toBe('Au commencement')
    expect(getStrongSelectionWordFromTextSegment(' et la terre ')).toBe('et la terre')
  })

  it('removes punctuation around the translated segment', () => {
    expect(getStrongSelectionWordFromTextSegment(' , “la parole” ')).toBe('la parole')
  })
})

describe('openStrongWord', () => {
  it('opens the Strong entries of a word with its morphology, verse and version', () => {
    const send = jest.fn()
    const identity = { kind: 'strong' as const, code: 'H7225' }

    openStrongWord(send, [identity], 1, 'DBR', {
      word: 'au commencement',
      chapter: 1,
      verse: 1,
      morphologies: [{ identity, codes: ['HNcfsa'] }],
    })

    expect(send).toHaveBeenCalledWith({
      kind: 'open',
      origin: 'text',
      verseKey: '1-1-1',
      version: 'DBR',
      target: {
        kind: 'strong-word',
        identities: [identity],
        morphologies: [{ identity, codes: ['HNcfsa'] }],
        word: 'au commencement',
      },
    })
  })

  it('sends nothing for a word without a Strong code', () => {
    const send = jest.fn()

    openStrongWord(send, [{ kind: 'strong', code: 'unknown' }], 1, 'DBR')

    expect(send).not.toHaveBeenCalled()
  })
})
