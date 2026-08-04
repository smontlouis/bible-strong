import { createStrongSelectionPreviewCard } from '../strongSelectionPreviewCard'

describe('createStrongSelectionPreviewCard', () => {
  it('keeps only non-redundant lexical information in the card', () => {
    const card = createStrongSelectionPreviewCard(
      {
        gloss: 'commencement',
        original: 'רֵאשִׁית',
        transliteration: 're.Shit',
        stepCode: 'H7225G',
      },
      ['HNcfsa', 'HTd']
    )

    expect(card).toEqual({
      gloss: 'commencement',
      morphology: 'HNcfsa · HTd',
      original: 'רֵאשִׁית',
      transliteration: 're.Shit',
    })
    expect(card).not.toHaveProperty('stepCode')
    expect(card.morphology).not.toContain('Morphologie')
  })

  it('omits the morphology line when no contextual code exists', () => {
    expect(
      createStrongSelectionPreviewCard(
        {
          gloss: 'Dieu',
          original: 'θεός',
          transliteration: 'theos',
          stepCode: 'G2316',
        },
        []
      ).morphology
    ).toBeUndefined()
  })
})
