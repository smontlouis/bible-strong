import type { StrongLexiconRelation } from '~features/resources/strongLexiconAccess'
import { splitStrongLexicalRelations } from '../strongLexiconRelations'

const relation = (
  stepCode: string,
  group: StrongLexiconRelation['group'],
  relationKind: string,
  label: string
): StrongLexiconRelation => ({
  group,
  relationKind,
  label,
  stepCode,
  gloss: stepCode,
  original: '',
  transliteration: '',
})

describe('strongLexiconRelations', () => {
  it('moves same-eStrong targets to meanings and hides all related-word duplicates', () => {
    const presentation = splitStrongLexicalRelations([
      relation('H7218A', 'family', 'step_related', 'mot lié STEP'),
      relation('H7225H', 'family', 'step_related', 'mot lié STEP'),
      relation('H7225H', 'identity', 'has_meaning', 'sens associé'),
      relation('H7225H', 'subentry', 'same_estrong', 'autre sens STEP'),
      relation('H7218A', 'family', 'same_root', 'même racine'),
      relation('H7226', 'family', 'step_related', 'mot lié STEP'),
    ])

    expect(presentation.alternateSenses).toEqual([
      expect.objectContaining({
        stepCode: 'H7225H',
        relationKind: 'same_estrong',
        label: 'autre sens',
      }),
    ])
    expect(presentation.relatedWords).toEqual([
      expect.objectContaining({
        stepCode: 'H7218A',
        relationKind: 'same_root',
        label: 'même racine',
      }),
      expect.objectContaining({
        stepCode: 'H7226',
        relationKind: 'step_related',
        label: 'mot lié',
      }),
    ])
  })
})
