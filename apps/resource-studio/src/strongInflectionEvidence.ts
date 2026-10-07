import type {
  RecoveryAttestation,
  RecoveryLexicon
} from "./strongWitnessRecovery.js";
import type { ReconstructionWitness } from "./strongConcordanceRefinement.js";

export type WitnessInventory = Map<string, Map<string, Set<string>>>;
export function learnWitnessInventory(
  corpus: Iterable<ReconstructionWitness & { ref: string }>
): WitnessInventory {
  const result: WitnessInventory = new Map();
  for (const witness of corpus) {
    const verse = result.get(witness.ref) ?? new Map<string, Set<string>>();
    for (const placement of witness.placements) {
      const families = verse.get(placement.strong) ?? new Set<string>();
      families.add(witness.family);
      verse.set(placement.strong, families);
    }
    result.set(witness.ref, verse);
  }
  return result;
}

export type FrenchInflectionIndex = Record<
  string,
  Partial<Record<"verb" | "noun" | "adj", string[]>>
>;
export interface InflectionAttestation extends RecoveryAttestation {
  surface: string;
  lemma: string;
  partOfSpeech: "verb" | "noun" | "adj";
}
export type InflectionLexicon = Map<
  string,
  Map<string, InflectionAttestation[]>
>;
export function unambiguousFrenchLemma(
  index: FrenchInflectionIndex,
  surface: string,
  pos: "verb" | "noun" | "adj"
): string | undefined {
  const lemmas = index[surface]?.[pos];
  return lemmas?.length === 1 ? lemmas[0] : undefined;
}
/** The Strong association comes exclusively from allowed witnesses; the dictionary supplies forms only. */
export function learnInflectionLexicon(
  lexicon: RecoveryLexicon,
  index: FrenchInflectionIndex
): InflectionLexicon {
  const result: InflectionLexicon = new Map();
  for (const [strong, forms] of lexicon) {
    const learned = new Map<string, InflectionAttestation[]>();
    for (const [surface, attestations] of forms)
      for (const pos of ["verb", "noun", "adj"] as const) {
        const lemma = unambiguousFrenchLemma(index, surface, pos);
        if (!lemma) continue;
        const key = `${pos}:${lemma}`;
        learned.set(key, [
          ...(learned.get(key) ?? []),
          ...attestations.map((a) => ({
            ...a,
            surface,
            lemma,
            partOfSpeech: pos
          }))
        ]);
      }
    result.set(strong, learned);
  }
  return result;
}
