import type { StrongLexiconRelation } from '~features/resources/strongLexiconAccess'

export type StrongLexicalRelationPresentation = {
  alternateSenses: StrongLexiconRelation[]
  relatedWords: StrongLexiconRelation[]
}

export const splitStrongLexicalRelations = (
  relations: StrongLexiconRelation[]
): StrongLexicalRelationPresentation => {
  const alternateSenses = uniqueByTarget(
    relations.filter(
      relation => relation.group === 'subentry' || relation.relationKind === 'same_estrong'
    )
  ).map(humanizeRelation)
  const alternateSenseCodes = new Set(alternateSenses.map(relation => relation.stepCode))
  const relatedWords = uniqueByTarget(
    relations
      .filter(
        relation => relation.group !== 'subentry' && !alternateSenseCodes.has(relation.stepCode)
      )
      .sort((left, right) => relationPriority(left) - relationPriority(right))
  ).map(humanizeRelation)

  return { alternateSenses, relatedWords }
}

const humanizeRelation = (relation: StrongLexiconRelation): StrongLexiconRelation => {
  const label = relation.label
    .replace(/\bSTEP\b(?:\s*[-–—]\s*)?/giu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim()

  return label === relation.label ? relation : { ...relation, label }
}

const relationPriority = (relation: StrongLexiconRelation): number => {
  if (relation.relationKind === 'step_related') return 30
  if (relation.group === 'identity') return 10
  return 20
}

const uniqueByTarget = (relations: StrongLexiconRelation[]): StrongLexiconRelation[] => {
  const seen = new Set<string>()
  return relations.filter(relation => {
    if (seen.has(relation.stepCode)) return false
    seen.add(relation.stepCode)
    return true
  })
}
