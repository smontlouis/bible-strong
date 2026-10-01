/** Experimental, target-blind refinement. No target annotations, dictionaries,
 * caches, edition labels or I/O are accepted by this common engine. */
import type { CanonicalOccurrenceDecision } from "./strongCanonicalResolution.js";
import type { CarrierPlacement } from "./strongCarriers.js";
import { normalizeWord, tokenizeText } from "./tokenize.js";

export interface ReconstructionPlacement extends CarrierPlacement {
  id: string;
  originalOccurrenceId?: string;
  targetWordIndices?: number[];
}
export interface ReconstructionVerse {
  ref: string;
  text: string;
  words: string[];
  placements: ReconstructionPlacement[];
  units: CanonicalOccurrenceDecision[];
  issues: string[];
  unownedAnnotationIds: string[];
}
export interface ReconstructionWitness {
  name: string;
  family: string;
  words: string[];
  placements: CarrierPlacement[];
}
export interface PhraseHeadEvidence {
  strong: string;
  phrase: string[];
  offset: number;
  families: string[];
  attestations: Array<{ ref: string; witness: string; family: string }>;
}

/** Learn display boundaries from actual tagged spans, not surrounding n-grams.
 * Correlated witnesses at the same verse count once. Every observed shape must
 * agree on the same single-word carrier, with at least three family/verse pairs.
 */
export function learnWitnessDisplayHeads(
  requests: Array<{ strong: string; phrase: string[] }>,
  witnesses: Iterable<ReconstructionWitness & { ref: string }>
): PhraseHeadEvidence[] {
  const wanted = new Map<string, Set<string>>();
  for (const r of requests) {
    const key = r.phrase.map(normalizeWord).join(" ");
    wanted.set(key, new Set([...(wanted.get(key) ?? []), r.strong]));
  }
  const observations = new Map<
    string,
    {
      strong: string;
      phrase: string[];
      shapes: Set<string>;
      attestations: Map<
        string,
        { ref: string; witness: string; family: string }
      >;
    }
  >();
  for (const w of witnesses) {
    const normalized = w.words.map(normalizeWord);
    for (let start = 0; start < normalized.length; start++) {
      for (
        let length = 2;
        length <= 4 && start + length <= normalized.length;
        length++
      ) {
        const phrase = normalized.slice(start, start + length);
        const strongs = wanted.get(phrase.join(" "));
        if (!strongs) continue;
        for (const strong of strongs) {
          const ps = w.placements.filter(
            (p) =>
              p.strong === strong &&
              p.kind !== "empty" &&
              p.startWordIndex! <= start + length - 1 &&
              p.endWordIndex! >= start
          );
          if (!ps.length) continue;
          const key = `${strong}:${phrase.join(" ")}`;
          const entry = observations.get(key) ?? {
            strong,
            phrase,
            shapes: new Set<string>(),
            attestations: new Map()
          };
          const p = ps[0];
          entry.shapes.add(
            ps.length === 1 && p.kind === "word"
              ? String(p.startWordIndex! - start)
              : "phrase-or-ambiguous"
          );
          entry.attestations.set(`${w.family}:${w.ref}`, {
            ref: w.ref,
            witness: w.name,
            family: w.family
          });
          observations.set(key, entry);
        }
      }
    }
  }
  return [...observations.values()].flatMap((v) => {
    const offset = Number([...v.shapes][0]);
    return v.shapes.size === 1 &&
      Number.isInteger(offset) &&
      offset >= 0 &&
      offset < v.phrase.length &&
      v.attestations.size >= 3
      ? [
          {
            strong: v.strong,
            phrase: v.phrase,
            offset,
            families: [
              ...new Set([...v.attestations.values()].map((a) => a.family))
            ].sort(),
            attestations: [...v.attestations.values()]
          }
        ]
      : [];
  });
}
export interface RefinementPolicy {
  numeric: boolean;
  phraseHeads: boolean;
  accountability: boolean;
  minimumHeadFamilies: number;
}
export interface RefinementChange {
  rule:
    | "numeric-bijection-v1"
    | "witness-display-head-v1"
    | "source-accountability-v1";
  sourceUnitId?: string;
  before: ReconstructionPlacement[];
  after: ReconstructionPlacement[];
  /** Translation relation and display carrier remain separate. */
  relationWordIndices: number[];
  evidence: string[];
}
export const CONCORDANCE_REFINEMENT_VERSION = "concordance-blind-refinement-v1";

const englishCardinals = new Map<string, number>([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
  ["twenty", 20],
  ["thirty", 30],
  ["forty", 40],
  ["fifty", 50],
  ["sixty", 60],
  ["seventy", 70],
  ["eighty", 80],
  ["ninety", 90],
  ["hundred", 100],
  ["thousand", 1000]
]);
const span = (p: CarrierPlacement) =>
  p.kind === "empty"
    ? []
    : Array.from(
        { length: p.endWordIndex! - p.startWordIndex! + 1 },
        (_, i) => p.startWordIndex! + i
      );
function numericValue(u: CanonicalOccurrenceDecision): number | undefined {
  const morph = u.source.morphology;
  if (!morph.split("/").some((p) => /^H?Ac/u.test(p)) && morph !== "A-NUI")
    return;
  const matches = [
    ...new Set(
      (u.source.gloss.toLowerCase().match(/[a-z]+/gu) ?? []).flatMap((w) =>
        englishCardinals.has(w) ? [englishCardinals.get(w)!] : []
      )
    )
  ];
  // Compound values and conversions require group semantics, never substring
  // matching a component of 125 cm against 2.5 cubits.
  return matches.length === 1 ? matches[0] : undefined;
}
function integerTargets(text: string): Map<number, number[]> {
  const targets = new Map<number, number[]>();
  let offset = 0,
    index = 0;
  for (const token of tokenizeText(text)) {
    const start = offset;
    offset += token.text.length;
    if (token.kind !== "word") continue;
    const current = index++;
    if (!/^[1-9]\d*$/u.test(token.text)) continue;
    if (
      /\d[.,:/]\s*$/u.test(text.slice(0, start)) ||
      /^\s*[.,:/]\d/u.test(text.slice(offset))
    )
      continue;
    const n = Number(token.text);
    if (Number.isSafeInteger(n))
      targets.set(n, [...(targets.get(n) ?? []), current]);
  }
  return targets;
}

export function refineStrongReconstruction(
  input: ReconstructionVerse,
  witnesses: ReconstructionWitness[],
  policy: RefinementPolicy,
  displayEvidence: PhraseHeadEvidence[] = []
): { prediction: ReconstructionVerse; changes: RefinementChange[] } {
  if (
    policy.minimumHeadFamilies < 1 ||
    !Number.isInteger(policy.minimumHeadFamilies)
  )
    throw new Error("invalid-family-threshold");
  const prediction = structuredClone(input);
  const changes: RefinementChange[] = [];
  const owned = (u: CanonicalOccurrenceDecision) =>
    prediction.placements.filter(
      (p) =>
        p.originalOccurrenceId &&
        u.occurrenceIds.includes(p.originalOccurrenceId)
    );
  const owner = (p: ReconstructionPlacement) =>
    prediction.units.find(
      (u) =>
        p.originalOccurrenceId &&
        u.occurrenceIds.includes(p.originalOccurrenceId)
    );

  if (policy.numeric) {
    const targets = integerTargets(prediction.text);
    const values = new Map<number, CanonicalOccurrenceDecision[]>();
    for (const unit of prediction.units) {
      const value = numericValue(unit);
      if (value !== undefined)
        values.set(value, [...(values.get(value) ?? []), unit]);
    }
    for (const [value, units] of values) {
      if (
        units.some(
          (u) =>
            u.source.readingUnresolved ||
            u.strong.length !== 1 ||
            u.occurrenceIds.length !== 1
        )
      )
        continue;
      const positions = targets.get(value) ?? [];
      if (units.length !== positions.length) continue;
      // Existing source ownership must agree with the entire repeated group.
      if (
        units.some((u, i) =>
          owned(u).some(
            (p) =>
              p.kind !== "empty" &&
              (p.startWordIndex !== positions[i] ||
                p.endWordIndex !== positions[i])
          )
        )
      )
        continue;
      for (const [i, unit] of units.entries()) {
        const at = positions[i],
          previous = owned(unit);
        if (previous.some((p) => p.kind !== "empty") || unit.state === "empty")
          continue;
        if (prediction.placements.some((p) => span(p).includes(at))) continue;
        const sourceIndex = prediction.units.indexOf(unit);
        const noun = prediction.units
          .slice(sourceIndex + 1, sourceIndex + 3)
          .find(
            (u) =>
              !u.source.readingUnresolved &&
              /(?:^H|\/)N[cp]|^N-/u.test(u.source.morphology)
          );
        if (!noun || noun.state !== "visible") continue;
        const nounCarriers = owned(noun).filter((p) => p.kind !== "empty");
        if (
          nounCarriers.length !== 1 ||
          nounCarriers[0].startWordIndex! <= at ||
          nounCarriers[0].startWordIndex! - at > 3
        )
          continue;
        const placement: ReconstructionPlacement = {
          id: `numeric:${unit.sourceUnitId}`,
          strong: unit.strong[0],
          originalOccurrenceId: unit.occurrenceIds[0],
          kind: "word",
          startWordIndex: at,
          endWordIndex: at,
          source: "numeric-bijection-v1"
        };
        prediction.placements = prediction.placements.filter(
          (p) => !previous.includes(p)
        );
        prediction.placements.push(placement);
        unit.state = "visible";
        unit.assurance = "source-cardinal-with-local-noun";
        unit.targetWordIndices = [at];
        unit.annotationIds = [placement.id];
        delete unit.anchor;
        unit.reasons = [
          "Exact integer equals STEP cardinal; group cardinality and local noun carrier agree."
        ];
        changes.push({
          rule: "numeric-bijection-v1",
          sourceUnitId: unit.sourceUnitId,
          before: previous,
          after: [placement],
          relationWordIndices: [at],
          evidence: [
            `STEP:${unit.source.file}:${unit.source.line}`,
            `gloss:${unit.source.gloss}`,
            `morphology:${unit.source.morphology}`,
            `equal-value:${value}`,
            `equal-cardinality:${units.length}`,
            `noun:${noun.sourceUnitId}:${nounCarriers[0].id}`
          ]
        });
      }
    }
  }
  if (policy.phraseHeads) {
    for (const placement of [...prediction.placements]) {
      if (
        placement.kind !== "phrase" ||
        !placement.source?.startsWith("phrase-transfer:")
      )
        continue;
      const unit = owner(placement);
      if (
        !unit ||
        unit.source.readingUnresolved ||
        unit.strong.length !== 1 ||
        unit.occurrenceIds.length !== 1
      )
        continue;
      const phrase = span(placement).map((i) =>
        normalizeWord(prediction.words[i])
      );
      const learned = displayEvidence.find(
        (e) =>
          e.strong === placement.strong &&
          e.phrase.join(" ") === phrase.join(" ") &&
          e.families.length >= policy.minimumHeadFamilies
      );
      const observations = witnesses.flatMap((w) => {
        const ps = w.placements.filter((p) => p.strong === placement.strong);
        if (ps.length !== 1 || ps[0].kind !== "word") return [];
        const word = w.words[ps[0].startWordIndex!];
        return word
          ? [{ witness: w.name, family: w.family, word: normalizeWord(word) }]
          : [];
      });
      if (
        !learned &&
        (new Set(observations.map((o) => o.family)).size <
          policy.minimumHeadFamilies ||
          new Set(observations.map((o) => o.word)).size !== 1)
      )
        continue;
      const positions = learned
        ? [placement.startWordIndex! + learned.offset]
        : span(placement).filter(
            (i) => normalizeWord(prediction.words[i]) === observations[0].word
          );
      if (positions.length !== 1) continue;
      const at = positions[0];
      const narrowed = {
        ...placement,
        kind: "word" as const,
        startWordIndex: at,
        endWordIndex: at,
        source: "witness-display-head-v1"
      };
      delete narrowed.targetWordIndices;
      prediction.placements[prediction.placements.indexOf(placement)] =
        narrowed;
      // The original relation survives; only the display support is narrowed.
      changes.push({
        rule: "witness-display-head-v1",
        sourceUnitId: unit.sourceUnitId,
        before: [placement],
        after: [narrowed],
        relationWordIndices: unit.targetWordIndices.length
          ? [...unit.targetWordIndices]
          : span(placement),
        evidence: learned
          ? learned.attestations.map(
              (a) =>
                `${a.family}:${a.witness}:${a.ref}:offset=${learned.offset}`
            )
          : observations.map((o) => `${o.family}:${o.witness}:${o.word}`)
      });
    }
  }
  if (policy.accountability) {
    for (const placement of [...prediction.placements]) {
      const unit = owner(placement);
      const supported =
        unit &&
        (placement.kind === "empty"
          ? unit.state === "empty" && unit.anchor?.absenceEstablished
          : unit.state === "visible" && !unit.source.readingUnresolved);
      if (supported) continue;
      prediction.placements = prediction.placements.filter(
        (p) => p !== placement
      );
      changes.push({
        rule: "source-accountability-v1",
        sourceUnitId: unit?.sourceUnitId,
        before: [placement],
        after: [],
        relationWordIndices: unit?.targetWordIndices ?? [],
        evidence: [
          !unit
            ? "no-exact-source-owner"
            : placement.kind === "empty"
              ? "absence-in-target-not-established"
              : unit.source.readingUnresolved
                ? "unresolved-source-reading"
                : "unresolved-source-relation"
        ]
      });
    }
    // Canonical resolution can establish a grammatical empty while the legacy
    // reader projection hides it. Project that explicit decision with its own
    // anchor; never promote the fallback position of an unresolved unit.
    for (const unit of prediction.units) {
      if (
        unit.state !== "empty" ||
        !unit.anchor?.absenceEstablished ||
        unit.strong.length !== 1 ||
        unit.occurrenceIds.length !== 1 ||
        owned(unit).length
      )
        continue;
      const empty: ReconstructionPlacement = {
        id: `established-empty:${unit.sourceUnitId}`,
        strong: unit.strong[0],
        originalOccurrenceId: unit.occurrenceIds[0],
        kind: "empty",
        insertAfterWordIndex: unit.anchor.insertAfterWordIndex,
        source: "source-accountability-v1:established-grammatical-empty"
      };
      prediction.placements.push(empty);
      changes.push({
        rule: "source-accountability-v1",
        sourceUnitId: unit.sourceUnitId,
        before: [],
        after: [empty],
        relationWordIndices: unit.grammaticalRelation?.targetWordIndices ?? [],
        evidence: [
          `absence:${unit.assurance}`,
          `STEP:${unit.source.file}:${unit.source.line}`,
          `anchor:${unit.anchor.method}`,
          ...unit.anchor.reasons
        ]
      });
    }
    prediction.unownedAnnotationIds = prediction.unownedAnnotationIds.filter(
      (id) => prediction.placements.some((p) => p.id === id)
    );
  }
  return { prediction, changes };
}
