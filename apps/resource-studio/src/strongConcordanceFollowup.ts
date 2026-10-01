import assert from "node:assert/strict";
import {
  refineStrongReconstruction,
  type ReconstructionVerse,
  type ReconstructionWitness,
  type ReconstructionPlacement,
  type PhraseHeadEvidence,
  type RefinementChange
} from "./strongConcordanceRefinement.js";
import { assessSourceReading } from "./strongSourceReading.js";
import type { SourceRow } from "./strongSourceUnits.js";
import type { ResolutionUnit } from "./strongResolution.js";
import { resolveDossier } from "./strongResolutionWorkflow.js";
import { normalizeWord, tokenizeText } from "./tokenize.js";

export const CONCORDANCE_FOLLOWUP_POLICY = "reading-expression-conjoin-v1";
export interface FollowupPolicy {
  minorReadings: boolean;
  functionExpressions: boolean;
  articleLinks: boolean;
  minimumHeadFamilies: number;
}
export interface FollowupChange {
  rule:
    "minor-source-reading" | "function-expression" | "source-conjoin-article";
  sourceUnitId: string;
  before: ReconstructionPlacement[];
  after: ReconstructionPlacement[];
  stateBefore?: string;
  stateAfter?: string;
  evidence: string[];
}
const indices = (p: ReconstructionPlacement) =>
  p.kind === "empty"
    ? []
    : Array.from(
        { length: p.endWordIndex! - p.startWordIndex! + 1 },
        (_, i) => p.startWordIndex! + i
      );
const unitFor = (u: ReconstructionVerse["units"][number]): ResolutionUnit => ({
  id: u.sourceUnitId,
  strong: u.strong,
  occurrenceIds: u.occurrenceIds,
  readingUnresolved: u.source.readingUnresolved,
  sourceEvidenceSha256: u.source.evidenceSha256
});

/** Protect grammatical locutions as relations; no list of target expressions. */
export function isGrammaticalExpressionMorphology(morphology: string): boolean {
  if (/^(?:CONJ|PREP)$/u.test(morphology)) return true;
  if (!morphology.startsWith("H")) return false;
  // A bound R/C/Td prefix does not change the lexical noun or verb into a
  // preposition. Pronominal suffixes follow the lexical component.
  const root = morphology
    .slice(1)
    .split("/")
    .filter((part) => !part.startsWith("S"))
    .at(-1);
  return /^(?:Tc|Tr|R)$/u.test(root ?? "");
}

// Closed grammatical forms that can already realize a relation by themselves.
// Neither Strong-specific translations nor a list of protected expressions.
const standaloneFrenchFunctions = new Set([
  "a",
  "au",
  "aux",
  "apres",
  "avant",
  "avec",
  "car",
  "chez",
  "comme",
  "contre",
  "dans",
  "de",
  "depuis",
  "derriere",
  "des",
  "devant",
  "donc",
  "du",
  "en",
  "entre",
  "envers",
  "et",
  "hors",
  "jusque",
  "lorsque",
  "mais",
  "malgre",
  "ni",
  "or",
  "ou",
  "par",
  "parmi",
  "pendant",
  "pour",
  "puis",
  "puisque",
  "quand",
  "que",
  "sans",
  "sauf",
  "selon",
  "si",
  "sous",
  "sur",
  "vers"
]);

/** Only an explicit, singular STEP conjoin edge is accepted. The arrow describes
 * source order, not French order. Multi-head links need a separate group model. */
export function sourceConjoinHead(
  row: SourceRow
): { index: number; strong: string } | undefined {
  const match = row.evidence.conjoin
    .trim()
    .match(/^#(\d+)([«»])(\d+):(G\d{4,5})$/u);
  if (!match || Number(match[1]) !== row.tokenIndex) return;
  const index = Number(match[3]);
  if (index === row.tokenIndex || (match[2] === "»") !== index > row.tokenIndex)
    return;
  return { index, strong: match[4] };
}

const articles = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "du",
  "des",
  "au",
  "aux"
]);
function wordRanges(text: string) {
  let offset = 0;
  return tokenizeText(text).flatMap((t) => {
    const start = offset;
    offset += t.text.length;
    return t.kind === "word" ? [{ start, end: offset }] : [];
  });
}

/** Pure refinement over a sealed initial reader. No target labels, edition name,
 * model calls, dictionary or filesystem are inputs to the common policy. */
export function refineConcordanceFollowup(options: {
  initial: ReconstructionVerse;
  sourceRows: ReadonlyMap<string, SourceRow>;
  witnesses: ReconstructionWitness[];
  displayEvidence: PhraseHeadEvidence[];
  policy: FollowupPolicy;
}): {
  prediction: ReconstructionVerse;
  changes: FollowupChange[];
  inheritedChanges: RefinementChange[];
} {
  const { sourceRows, witnesses, displayEvidence, policy } = options;
  let prediction = structuredClone(options.initial);
  const changes: FollowupChange[] = [];
  const owned = (u: ReconstructionVerse["units"][number]) =>
    prediction.placements.filter(
      (p) =>
        p.originalOccurrenceId &&
        u.occurrenceIds.includes(p.originalOccurrenceId)
    );
  const recovered: ReconstructionVerse["units"] = [];
  if (policy.minorReadings) {
    for (const u of prediction.units) {
      if (!u.source.readingUnresolved) continue;
      const row = sourceRows.get(u.sourceUnitId);
      if (!row) continue;
      assert.equal(row.surface, u.source.surface, "source-surface-drift");
      assert.equal(row.gloss, u.source.gloss, "source-gloss-drift");
      const assessment = assessSourceReading(row, u.source.morphology);
      u.source.readingAssessment = assessment;
      if (assessment.lexicalReadingUnresolved) continue;
      u.source.readingUnresolved = false;
      recovered.push(u);
    }
    if (recovered.length) {
      const knownIds = new Set(
        prediction.units.flatMap((u) => u.occurrenceIds)
      );
      const resolution = resolveDossier(
        {
          edition: "followup-fr-target",
          ref: prediction.ref,
          split: "authoring",
          text: prediction.text,
          words: prediction.words,
          units: prediction.units.map((u) => ({
            unit: unitFor(u),
            surface: u.source.surface,
            gloss: u.source.gloss,
            morphology: u.source.morphology,
            sourceFile: u.source.file ?? "unknown",
            sourceLine: u.source.line ?? 0
          })),
          placements: prediction.placements.filter(
            (p) =>
              !p.originalOccurrenceId || knownIds.has(p.originalOccurrenceId)
          ),
          witnesses: witnesses.map((w) => ({
            ...w,
            text: w.words.join(" "),
            placements: w.placements.map((p, i) => ({
              ...p,
              id: `${w.name}:${i}`
            }))
          }))
        },
        [],
        {
          applyExactWitness: false,
          applyAssistedReviews: false,
          applyGrammaticalEmpties: true,
          targetLanguage: "fr"
        }
      );
      for (const u of prediction.units) {
        const resolved = resolution.decisions.find(
          (d) => d.sourceUnitId === u.sourceUnitId
        )!;
        if (!recovered.includes(u) && u.state === resolved.state) continue;
        const before = owned(u),
          stateBefore = u.state;
        if (resolved.state === "visible") {
          u.state = "visible";
          u.targetWordIndices = resolved.targetWordIndices;
          u.assurance = "minor-source-variant-existing-carrier";
          delete u.anchor;
          u.exploration.remainingReason = null;
        } else if (resolved.grammaticalDecision?.status === "supported") {
          const grammatical = resolved.grammaticalDecision;
          u.state = "empty";
          u.assurance = "linguistic-rule";
          u.targetWordIndices = [];
          u.grammaticalRelation = grammatical.grammaticalRelation;
          u.anchor = {
            insertAfterWordIndex: grammatical.anchor!.insertAfterWordIndex,
            method: grammatical.rule,
            assurance: "editorial-convention",
            absenceEstablished: true,
            reasons: [grammatical.anchor!.rationale],
            relatedSourceUnits: [
              grammatical.grammaticalRelation!.verbUnitId,
              grammatical.grammaticalRelation!.objectUnitId
            ]
          };
          u.exploration.remainingReason = null;
        } else if (u.state === "unresolved")
          u.exploration.remainingReason = resolved.reasons.join("; ");
        u.reasons = [
          ...(u.source.readingAssessment?.reasons ?? [
            "minor-reading-context-recomputed"
          ]),
          ...resolved.reasons
        ];
        changes.push({
          rule: "minor-source-reading",
          sourceUnitId: u.sourceUnitId,
          before,
          after: before,
          stateBefore,
          stateAfter: u.state,
          evidence: [
            `STEP:${rowLocation(sourceRows, u.sourceUnitId)}`,
            ...u.reasons
          ]
        });
      }
    }
  }
  const inherited = refineStrongReconstruction(
    prediction,
    witnesses,
    {
      numeric: true,
      phraseHeads: true,
      accountability: false,
      minimumHeadFamilies: policy.minimumHeadFamilies
    },
    displayEvidence
  );
  prediction = inherited.prediction;
  if (policy.functionExpressions) {
    for (const change of inherited.changes) {
      if (change.rule !== "witness-display-head-v1") continue;
      const unit = prediction.units.find(
        (u) => u.sourceUnitId === change.sourceUnitId
      );
      if (!unit || !isGrammaticalExpressionMorphology(unit.source.morphology))
        continue;
      const narrowed = change.after[0],
        original = change.before[0];
      if (
        standaloneFrenchFunctions.has(
          normalizeWord(prediction.words[narrowed.startWordIndex!])
        )
      )
        continue;
      const position = prediction.placements.findIndex(
        (p) => p.id === narrowed.id
      );
      assert(position >= 0);
      prediction.placements[position] = { ...original };
      changes.push({
        rule: "function-expression",
        sourceUnitId: unit.sourceUnitId,
        before: change.after,
        after: change.before,
        evidence: [
          `source-morphology:${unit.source.morphology}`,
          "grammatical-expression-kept-as-whole",
          "no-target-expression-or-Strong-specific-list"
        ]
      });
    }
  }
  if (policy.articleLinks) {
    const ranges = wordRanges(prediction.text);
    const proposals: Array<{
      unit: ReconstructionVerse["units"][number];
      head: ReconstructionVerse["units"][number];
      old: ReconstructionPlacement;
      next: ReconstructionPlacement;
      evidence: string[];
    }> = [];
    for (const unit of prediction.units) {
      if (
        unit.source.readingUnresolved ||
        !/^T-/u.test(unit.source.morphology) ||
        unit.strong.length !== 1 ||
        unit.occurrenceIds.length !== 1
      )
        continue;
      const row = sourceRows.get(unit.sourceUnitId);
      if (!row || row.evidence.meaningVariants.trim()) continue;
      const link = sourceConjoinHead(row);
      if (!link) continue;
      const heads = prediction.units.filter((u) => {
        const source = sourceRows.get(u.sourceUnitId);
        return (
          source?.reference === row.reference &&
          source.tokenIndex === link.index &&
          u.strong.includes(link.strong)
        );
      });
      if (heads.length !== 1) continue;
      const head = heads[0];
      if (
        head.source.readingUnresolved ||
        head.state !== "visible" ||
        head.strong.length !== 1 ||
        head.occurrenceIds.length !== 1 ||
        !/^(?:N-|A-|V-[A-Z0-9]*P-[NAGDV])/u.test(head.source.morphology)
      )
        continue;
      if (
        prediction.units.filter((u) => u.strong.includes(link.strong))
          .length !== 1
      )
        continue;
      const hp = owned(head).filter((p) => p.kind !== "empty"),
        current = owned(unit);
      if (
        hp.length !== 1 ||
        hp[0].kind !== "word" ||
        !hp[0].source?.startsWith("reference-transfer:exact|") ||
        (hp[0].confidence ?? 0) < 0.9
      )
        continue;
      if (current.length !== 1 || current[0].kind !== "word") continue;
      const at = hp[0].startWordIndex! - 1;
      if (at < 0 || !articles.has(normalizeWord(prediction.words[at])))
        continue;
      // Resolve repeated forms, not a change from a possessive/relative or
      // collective construction into a different French realization.
      if (
        normalizeWord(prediction.words[current[0].startWordIndex!]) !==
        normalizeWord(prediction.words[at])
      )
        continue;
      if (
        !/^\s+$/u.test(
          prediction.text.slice(ranges[at].end, ranges[at + 1].start)
        )
      )
        continue;
      if (current[0].startWordIndex === at) continue;
      const next: ReconstructionPlacement = {
        ...current[0],
        startWordIndex: at,
        endWordIndex: at,
        source: "source-conjoin-article-v1"
      };
      delete next.confidence;
      delete next.targetWordIndices;
      proposals.push({
        unit,
        head,
        old: current[0],
        next,
        evidence: [
          `STEP:${row.file}:${row.line}`,
          `conjoin:${row.evidence.conjoin}`,
          `head:${head.sourceUnitId}:${hp[0].id}`,
          "unique-nominal-head-exactly-transferred",
          "adjacent-French-article-without-clause-boundary",
          "same-French-article-form-preserved"
        ]
      });
    }
    const accepted = new Map(proposals.map((p) => [p.old.id, p]));
    while (true) {
      const retained = prediction.placements.filter((p) => !accepted.has(p.id));
      const rejected = [...accepted.values()].filter(
        (p) =>
          retained.some((r) => indices(r).includes(p.next.startWordIndex!)) ||
          [...accepted.values()].some(
            (q) => q !== p && q.next.startWordIndex === p.next.startWordIndex
          )
      );
      if (!rejected.length) break;
      for (const p of rejected) accepted.delete(p.old.id);
    }
    prediction.placements = prediction.placements.map(
      (p) => accepted.get(p.id)?.next ?? p
    );
    for (const p of accepted.values()) {
      p.unit.state = "visible";
      p.unit.targetWordIndices = [p.next.startWordIndex!];
      delete p.unit.anchor;
      p.unit.exploration.remainingReason = null;
      p.unit.assurance = "explicit-source-conjoin-and-target-article";
      p.unit.reasons = p.evidence;
      changes.push({
        rule: "source-conjoin-article",
        sourceUnitId: p.unit.sourceUnitId,
        before: [p.old],
        after: [p.next],
        evidence: p.evidence
      });
    }
  }
  const accountable = refineStrongReconstruction(prediction, witnesses, {
    numeric: false,
    phraseHeads: false,
    accountability: true,
    minimumHeadFamilies: 1
  });
  return {
    prediction: accountable.prediction,
    changes,
    inheritedChanges: [...inherited.changes, ...accountable.changes]
  };
}

function rowLocation(rows: ReadonlyMap<string, SourceRow>, id: string) {
  const r = rows.get(id)!;
  return `${r.file}:${r.line}:${r.reading}`;
}
