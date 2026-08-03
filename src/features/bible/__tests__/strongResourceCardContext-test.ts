import { getStrongResourceCardContext } from '../strongResourceCardContext'

describe('getStrongResourceCardContext', () => {
  it('collects the surface word and contextual morphology for one Strong identity', () => {
    expect(
      getStrongResourceCardContext(
        {
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
        },
        { kind: 'strong', code: 'H07225' }
      )
    ).toEqual({
      clickedWord: 'commencement',
      morphologyCodes: ['HNcfsa', 'HTd'],
    })
  })

  it('keeps the word while omitting unavailable morphology', () => {
    expect(
      getStrongResourceCardContext(
        {
          Texte: 'Dieu',
          StrongSpans: [
            {
              ordinal: 0,
              startOffset: 0,
              length: 4,
              identities: [{ kind: 'strong', code: 'H0430' }],
            },
          ],
        },
        { kind: 'strong', code: 'H0430' }
      )
    ).toEqual({ clickedWord: 'Dieu', morphologyCodes: [] })
  })
})
