import type { ResolutionDossier } from "./strongResolutionWorkflow.js";
import type { ResolutionCarrier } from "./strongResolution.js";
import { tokenizeText } from "./tokenize.js";

export const GRAMMATICAL_EMPTY_RULE = "fr-bare-object-marker-v1";
export interface GrammaticalEmptyDecision {
  sourceUnitId: string;
  rule: typeof GRAMMATICAL_EMPTY_RULE;
  status: "supported" | "abstained";
  reasons: string[];
  evidence: {
    morphology: string;
    sourceFile: string;
    sourceLine: number;
    language: string;
  };
  /** A grammatical relation may survive without a separate lexical carrier. */
  grammaticalRelation?: {
    kind: "direct-object";
    verbUnitId: string;
    objectUnitId: string;
    verbCarrierId: string;
    objectCarrierId: string;
    targetWordIndices: number[];
  };
  absence?: {
    assurance: "linguistic-rule";
    rationale: string;
  };
  anchor?: {
    assurance: "convention-over-existing-carriers";
    insertAfterWordIndex: number;
    rationale: string;
  };
}

const determiner = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "ce",
  "cet",
  "cette",
  "ces",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "son",
  "sa",
  "ses",
  "notre",
  "nos",
  "votre",
  "vos",
  "leur",
  "leurs"
]);
const exact = (s: string) =>
  s.normalize("NFC").toLocaleLowerCase("fr-FR").replace(/’/gu, "'");
type DossierUnit = ResolutionDossier["units"][number];
function uniqueVisible(
  u: DossierUnit,
  d: ResolutionDossier
): ResolutionCarrier | undefined {
  if (
    u.unit.readingUnresolved ||
    u.unit.strong.length !== 1 ||
    u.unit.occurrenceIds.length !== 1
  )
    return;
  const owned = d.placements.filter(
    (p) => p.originalOccurrenceId === u.unit.occurrenceIds[0]
  );
  if (owned.length !== 1 || owned[0].kind === "empty") return;
  return owned[0];
}

/**
 * Narrow French editorial policy, never a universal H0853 -> NULL rule.
 * HTo is the unsuffixed object particle, distinct from H0854 ("with"), HC/To
 * (a conjunction plus particle), and HTo/Sp... (particle plus pronoun).
 * Source: OSHB morphology; unfoldingWord Hebrew Grammar, direct-object marker.
 * The projected position is an editorial convention, not a semantic probability.
 */
export function grammaticalEmptyDecisions(
  d: ResolutionDossier,
  language: string
): GrammaticalEmptyDecision[] {
  return d.units.flatMap((entry, index) => {
    if (!entry.unit.strong.includes("H0853")) return [];
    const decision: GrammaticalEmptyDecision = {
      sourceUnitId: entry.unit.id,
      rule: GRAMMATICAL_EMPTY_RULE,
      status: "abstained",
      reasons: [],
      evidence: {
        morphology: entry.morphology,
        sourceFile: entry.sourceFile,
        sourceLine: entry.sourceLine,
        language
      }
    };
    const abstain = (reason: string) => [{ ...decision, reasons: [reason] }];
    if (language !== "fr")
      return abstain("rule-requires-explicit-french-language");
    if (entry.morphology !== "HTo")
      return abstain("not-a-bare-unsuffixed-object-particle");
    if (
      entry.unit.readingUnresolved ||
      entry.unit.strong.length !== 1 ||
      entry.unit.occurrenceIds.length !== 1
    )
      return abstain("unresolved-source-identity");
    if (
      d.placements.some(
        (p) => p.originalOccurrenceId === entry.unit.occurrenceIds[0]
      )
    )
      return abstain("existing-carrier-or-anchor-preserved");
    if (
      d.placements.some((p) => p.strong === "H0853" && !p.originalOccurrenceId)
    )
      return abstain("unowned-marker-may-already-represent-this-occurrence");
    const previous = d.units[index - 1],
      next = d.units[index + 1];
    if (
      !previous ||
      !next ||
      !/^H(?:[Cc]\/)?V/u.test(previous.morphology) ||
      !/^H(?:Td\/)?N[cp]/u.test(next.morphology)
    )
      return abstain("source-is-not-adjacent-verb-particle-noun");
    const verb = uniqueVisible(previous, d),
      object = uniqueVisible(next, d);
    if (!verb || !object)
      return abstain("verb-or-object-carrier-not-unambiguous");
    const end = verb.endWordIndex!,
      start = object.startWordIndex!;
    if (end >= start || start - end > 2)
      return abstain("target-is-not-a-local-verb-object-sequence");
    const gap = d.words.slice(end + 1, start).map(exact);
    if (gap.some((w) => !determiner.has(w)))
      return abstain("intervening-word-may-express-a-relation");
    const objectFirst = exact(d.words[start]);
    if (
      /^(?:[dqsjcmt]|qu)'/u.test(objectFirst) ||
      [
        "à",
        "au",
        "aux",
        "de",
        "du",
        "dans",
        "en",
        "par",
        "pour",
        "avec",
        "sans",
        "sur",
        "sous",
        "chez",
        "contre",
        "vers"
      ].includes(objectFirst)
    )
      return abstain("object-carrier-starts-with-a-preposition-or-clitic");
    // Token proximity alone must not cross punctuation or an editorial boundary.
    let wordIndex = -1;
    for (const segment of tokenizeText(d.text)) {
      if (segment.kind === "word") wordIndex++;
      else if (wordIndex >= end && wordIndex < start && segment.text.trim())
        return abstain("punctuation-separates-verb-and-object");
    }
    const objectStart = end + 1;
    // A determiner already carrying another source relation cannot be absorbed
    // silently into the inferred object boundary.
    if (
      d.placements.some(
        (p) =>
          p.kind !== "empty" &&
          p.id !== verb.id &&
          p.id !== object.id &&
          p.startWordIndex! <= object.endWordIndex! &&
          p.endWordIndex! >= objectStart
      )
    )
      return abstain("object-span-has-competing-source-carriers");
    decision.status = "supported";
    decision.reasons = [
      "bare-object-particle-with-explicit-verb-and-object-in-french"
    ];
    decision.grammaticalRelation = {
      kind: "direct-object",
      verbUnitId: previous.unit.id,
      objectUnitId: next.unit.id,
      verbCarrierId: verb.id,
      objectCarrierId: object.id,
      targetWordIndices: Array.from(
        { length: object.endWordIndex! - objectStart + 1 },
        (_, i) => objectStart + i
      )
    };
    decision.absence = {
      assurance: "linguistic-rule",
      rationale:
        "H0853 is a bare HTo object particle, without conjunction or pronominal suffix. Its immediately adjacent source verb and noun have distinct French carriers in a local verb–object construction. Under the French display convention, the particle has no separate lexical carrier; its grammatical object relation is retained."
    };
    decision.anchor = {
      assurance: "convention-over-existing-carriers",
      insertAfterWordIndex: objectStart - 1,
      rationale:
        "Insert immediately before the French object group, including its single unassigned determiner when present. This display convention depends on the existing verb/object carriers and does not claim an independently reviewed position."
    };
    return [decision];
  });
}
