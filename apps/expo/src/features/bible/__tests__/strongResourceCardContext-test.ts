import { getStrongWordOccurrences } from '../strongResourceCardContext'

describe('getStrongWordOccurrences', () => {
  it('collects the surface word and contextual morphology for one Strong identity', () => {
    expect(
      getStrongWordOccurrences({
        Texte: 'Au commencement',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 3,
            length: 12,
            identities: [{ kind: 'strong', code: 'H07225' }],
            morphologies: [
              {
                identity: { kind: 'strong', code: 'H07225' },
                codes: ['HNcfsa', 'HTd'],
              },
            ],
          },
        ],
      })
    ).toEqual([
      {
        identity: { kind: 'strong', code: 'H07225' },
        clickedWord: 'Au commencement',
        morphologyCodes: ['HNcfsa', 'HTd'],
      },
    ])
  })

  it('keeps the word while omitting unavailable morphology', () => {
    expect(
      getStrongWordOccurrences({
        Texte: 'Dieu',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 4,
            identities: [{ kind: 'strong', code: 'H0430' }],
          },
        ],
      })
    ).toEqual([
      {
        identity: { kind: 'strong', code: 'H0430' },
        clickedWord: 'Dieu',
        morphologyCodes: [],
      },
    ])
  })

  it('keeps repeated Strong occurrences and their morphology separate', () => {
    expect(
      getStrongWordOccurrences({
        Texte: 'Dieu Dieu',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 4,
            identities: [{ kind: 'strong', code: 'H0430' }],
            morphologies: [{ identity: { kind: 'strong', code: 'H0430' }, codes: ['HNcmpa'] }],
          },
          {
            ordinal: 1,
            startOffset: 5,
            length: 4,
            identities: [{ kind: 'strong', code: 'H0430' }],
            morphologies: [{ identity: { kind: 'strong', code: 'H0430' }, codes: ['HVqp3ms'] }],
          },
        ],
      })
    ).toEqual([
      {
        identity: { kind: 'strong', code: 'H0430' },
        clickedWord: 'Dieu',
        morphologyCodes: ['HNcmpa'],
      },
      {
        identity: { kind: 'strong', code: 'H0430' },
        clickedWord: 'Dieu',
        morphologyCodes: ['HVqp3ms'],
      },
    ])
  })

  it('keeps zero-length Strong identities attached to the preceding visible word', () => {
    expect(
      getStrongWordOccurrences({
        Texte: 'Voici',
        StrongSpans: [
          {
            ordinal: 0,
            startOffset: 0,
            length: 5,
            identities: [{ kind: 'strong', code: 'H0428' }],
          },
          {
            ordinal: 1,
            startOffset: 5,
            length: 0,
            identities: [{ kind: 'strong', code: 'H9002' }],
          },
        ],
      })
    ).toEqual([
      {
        identity: { kind: 'strong', code: 'H0428' },
        clickedWord: 'Voici',
        morphologyCodes: [],
      },
      {
        identity: { kind: 'strong', code: 'H9002' },
        clickedWord: 'Voici',
        morphologyCodes: [],
      },
    ])
  })
})
