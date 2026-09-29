import type { StrongLexiconEntry } from '@bible-strong/resource-domain/strong-lexicon'
import {
  compareStrongDefinitions,
  countStrongDefinitionWords,
  describeStrongDefinition,
} from './strongDefinitionComparison'

type DefinitionEntry = Pick<
  StrongLexiconEntry,
  | 'definitionHtml'
  | 'detailedDefinitionHtml'
  | 'gloss'
  | 'stepCode'
  | 'eStrong'
  | 'classicStrong'
  | 'relations'
  | 'language'
>

// A specific-sense notice this short mostly restates the gloss (H0349A
// "adv interrog. comment ?", H7819B "abattage, mot douteux"), so the family
// definition remains the better summary.
const MIN_SPECIFIC_SENSE_WORDS = 6

export type StrongDefinitionPresentation = {
  /** The best short reading, shown at the essential level. */
  essentialHtml?: string
  /** The other definition, shown only at the deep level. */
  deep?: { kind: 'detailed' | 'general'; html: string }
}

/** A reversible reading order, never an instruction to delete source content. */
export function presentStrongDefinitions(entry: DefinitionEntry): StrongDefinitionPresentation {
  const simple = entry.definitionHtml?.trim() ? entry.definitionHtml : undefined
  const detailed = entry.detailedDefinitionHtml?.trim() ? entry.detailedDefinitionHtml : undefined
  if (!simple || !detailed) return { essentialHtml: simple ?? detailed }
  const comparison = compareStrongDefinitions({
    simpleHtml: simple,
    detailedHtml: detailed,
    gloss: entry.gloss,
  })
  if (comparison.reason === 'identical') return { essentialHtml: simple }
  // Near duplicates are read once, in their richer detailed wording.
  if (comparison.redundant) return { essentialHtml: detailed }
  // Relations explicitly identify siblings. A suffix alone does not establish
  // a narrower meaning, and entity-module availability must not change the policy.
  // An expanded Strong identity explicitly splits a classical family (H7819b).
  // This differs from merely finding a suffix on the display identity (dStrong).
  // Only Hebrew STEP notices describe each sense (one person per sibling). Greek
  // detailed text is the Abbott-Smith article for the whole lemma, identical for
  // every sibling (G3972G/G3972H both list Sergius Paulus and the apostle).
  const hasSenseSpecificNotices = entry.language === 'hebrew'
  const hasExpandedSense =
    Boolean(entry.eStrong && entry.classicStrong) && entry.eStrong !== entry.classicStrong
  const hasDistinctSenses =
    hasExpandedSense ||
    entry.relations.some(
      relation =>
        relation.stepCode !== entry.stepCode &&
        (relation.group === 'subentry' || relation.relationKind === 'same_estrong')
    )
  if (
    hasSenseSpecificNotices &&
    hasDistinctSenses &&
    countStrongDefinitionWords(detailed, entry.gloss) >= MIN_SPECIFIC_SENSE_WORDS
  ) {
    return { essentialHtml: detailed, deep: { kind: 'general', html: simple } }
  }
  return { essentialHtml: simple, deep: { kind: 'detailed', html: detailed } }
}

// Name meanings may carry useful nuances even when most words are shared.
export function isSameStrongDefinition(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false
  const a = describeStrongDefinition(left)
  const b = describeStrongDefinition(right)
  return Boolean(a.text) && a.text === b.text && a.references === b.references
}
