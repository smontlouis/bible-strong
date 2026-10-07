/** Target-blind alignment of a witnessed expression before choosing its carrier. */
import { tokenizeText } from "./tokenize.js";
import { isConcordanceFunctionWord } from "./strongConcordanceContext.js";
import { isUnsafeRecoverySurface } from "./strongWitnessRecovery.js";
import type {
  ReconstructionPlacement,
  ReconstructionVerse,
  ReconstructionWitness
} from "./strongConcordanceRefinement.js";

export const CLAUSE_ALIGNMENT_POLICY = "witness-clause-expression-v1";
export interface ClauseWitness extends ReconstructionWitness {
  ref: string;
  text: string;
}
export interface ClauseLexicalProof {
  kind:
    | "literal"
    | "inflection"
    | "reviewed-synset"
    | "reciprocal-synonym"
    | "source-definition";
  sourceTerms: string[];
  targetTerms: string[];
  provenance: string[];
}
export interface ClauseMatch {
  witness: string;
  family: string;
  nativeRef: string;
  witnessCarrier: number[];
  witnessContext: number[];
  targetCarrier: number[];
  targetContext: number[];
  anchors: Array<{
    sourceUnitId: string;
    witnessIndex: number;
    targetIndex: number;
  }>;
  fixedWords: number;
  lexical: ClauseLexicalProof;
  sharedWith: string[];
}
export interface ClauseChange {
  sourceUnitId: string;
  placement: ReconstructionPlacement;
  relationWordIndices: number[];
  matches: ClauseMatch[];
}
type Unit = ReconstructionVerse["units"][number];
export interface ClausePolicy {
  minimumFamilies: 1 | 2;
  maximumSlotWords: number;
  sharedCarriers: boolean;
  display?: "expression" | "lexical-head";
}
export const DEFAULT_CLAUSE_POLICY: ClausePolicy = {
  minimumFamilies: 2,
  maximumSlotWords: 4,
  sharedCarriers: false
};
/** Development-selected policy. Relations retain the complete aligned slot. */
export const CONSENSUS_CLAUSE_POLICY: ClausePolicy = {
  ...DEFAULT_CLAUSE_POLICY,
  display: "lexical-head"
};
const normal = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[‐‑‒–—]/gu, "-");
const nativeRef = (unit: Unit, fallback: string) =>
  unit.sourceUnitId.match(/^(?:TAHOT|TAGNT)\.([^.]+\.\d+\.\d+)\./u)?.[1] ??
  fallback;
export const clauseNativeRefs = (verse: ReconstructionVerse): string[] => [
  ...new Set(verse.units.map((u) => nativeRef(u, verse.ref)))
];
const sequence = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);
function boundaries(text: string) {
  let offset = 0;
  const ranges = tokenizeText(text).flatMap((t) => {
    const start = offset;
    offset += t.text.length;
    return t.kind === "word" ? [{ start, end: offset }] : [];
  });
  const gaps = ranges.slice(0, -1).map((r, i) => {
    const gap = text.slice(r.end, ranges[i + 1].start);
    return /[.;:!?«»]/u.test(gap) ? 2 : /,/u.test(gap) ? 1 : 0;
  });
  return gaps;
}
const covered = (p: ReconstructionPlacement, at: number) =>
  p.kind !== "empty" && p.startWordIndex! <= at && at <= p.endWordIndex!;

export function alignWitnessClauses(options: {
  initial: ReconstructionVerse;
  witnesses: ClauseWitness[];
  lexicalProof: (
    unit: Unit,
    targetWords: string[],
    witnessWords: string[]
  ) => ClauseLexicalProof | undefined;
  policy?: ClausePolicy;
}) {
  const initial = options.initial,
    prediction = structuredClone(initial),
    policy = options.policy ?? DEFAULT_CLAUSE_POLICY;
  const changes: ClauseChange[] = [];
  const rejected: Array<{
    sourceUnitId: string;
    reason: string;
    targets: number[][];
  }> = [];
  if (initial.issues.length || initial.unownedAnnotationIds.length)
    return { prediction, changes, rejected };
  const tg = boundaries(initial.text);
  const unique = (strong: string) =>
    initial.units.filter((u) => u.strong.includes(strong)).length === 1;
  const owned = (u: Unit) =>
    initial.placements.filter(
      (p) =>
        u.occurrenceIds.includes(p.originalOccurrenceId ?? "") &&
        p.kind !== "empty"
    );
  const prepared = options.witnesses.map((w) => ({
    w,
    gaps: boundaries(w.text)
  }));
  const proposals: Array<{
    unit: Unit;
    matches: ClauseMatch[];
    target: number[];
  }> = [];
  for (const unit of initial.units) {
    if (
      unit.state !== "unresolved" ||
      unit.source.readingUnresolved ||
      unit.strong.length !== 1 ||
      unit.occurrenceIds.length !== 1 ||
      !unique(unit.strong[0]) ||
      owned(unit).length
    )
      continue;
    if (
      ![
        "unresolved",
        "unresolved-predicate-relation",
        "conflicting-clause"
      ].includes(unit.assurance)
    )
      continue;
    const ref = nativeRef(unit, initial.ref),
      strong = unit.strong[0];
    const all = new Map<string, ClauseMatch[]>();
    for (const { w, gaps } of prepared) {
      if (w.ref !== ref) continue;
      const carriers = w.placements.filter((p) => p.strong === strong);
      if (carriers.length !== 1 || carriers[0].kind === "empty") continue;
      const carrier = carriers[0],
        ps = carrier.startWordIndex!,
        pe = carrier.endWordIndex!;
      if (pe - ps > 3) continue;
      const anchors = initial.units.flatMap((other) => {
        if (
          other === unit ||
          other.state !== "visible" ||
          other.source.readingUnresolved ||
          other.strong.length !== 1 ||
          !unique(other.strong[0]) ||
          nativeRef(other, initial.ref) !== ref
        )
          return [];
        const op = owned(other),
          wp = w.placements.filter((p) => p.strong === other.strong[0]);
        if (
          op.length !== 1 ||
          wp.length !== 1 ||
          op[0].kind !== "word" ||
          wp[0].kind !== "word"
        )
          return [];
        const wi = wp[0].startWordIndex!,
          ti = op[0].startWordIndex!;
        if (wi >= ps && wi <= pe) return [];
        if (normal(w.words[wi]) !== normal(initial.words[ti])) return [];
        return [
          {
            sourceUnitId: other.sourceUnitId,
            witnessIndex: wi,
            targetIndex: ti
          }
        ];
      });
      if (!anchors.length) continue;
      const lexicalCache = new Map<string, ClauseLexicalProof | undefined>();
      for (let left = 0; left <= 4; left++)
        for (let right = 0; right <= 4; right++) {
          if (
            left + right < 2 ||
            left + right > 6 ||
            ps - left < 0 ||
            pe + right >= w.words.length
          )
            continue;
          const ws = ps - left,
            we = pe + right,
            wa = anchors.filter(
              (a) => ws <= a.witnessIndex && a.witnessIndex <= we
            );
          if (!wa.length) continue;
          for (let length = 1; length <= policy.maximumSlotWords; length++)
            for (const pivot of wa) {
              const delta = length - (pe - ps + 1);
              const start =
                pivot.targetIndex -
                (pivot.witnessIndex -
                  ws +
                  (pivot.witnessIndex > pe ? delta : 0));
              const ts = start + left,
                te = ts + length - 1,
                end = start + (we - ws) + delta;
              if (
                start < 0 ||
                end >= initial.words.length ||
                ts < 0 ||
                te >= initial.words.length
              )
                continue;
              // A suffix-only template must not jump to a new apposition while
              // dropping the subject/context before the witnessed predicate.
              if (ts > 0 && tg[ts - 1] && !(ps > 0 && gaps[ps - 1])) continue;
              if (
                tg.slice(ts, te).some(Boolean) ||
                gaps.slice(ps, pe).some(Boolean)
              )
                continue;
              const map = (at: number) =>
                start + (at - ws) + (at > pe ? delta : 0);
              let agrees = true;
              for (let at = ws; at <= we; at++) {
                if (at >= ps && at <= pe) continue;
                if (normal(w.words[at]) !== normal(initial.words[map(at)])) {
                  agrees = false;
                  break;
                }
              }
              if (
                !agrees ||
                wa.some((a) => map(a.witnessIndex) !== a.targetIndex)
              )
                continue;
              // A witnessed boundary may be reproduced, but a new target boundary
              // cannot silently move the unknown carrier into another proposition.
              for (let at = ws; at < we; at++) {
                if (at >= ps && at < pe) continue;
                const targetGap =
                  at === ps - 1 ? ts - 1 : at === pe ? te : map(at);
                if ((gaps[at] ?? 0) !== (tg[targetGap] ?? 0)) {
                  agrees = false;
                  break;
                }
              }
              if (!agrees) continue;
              const target = sequence(ts, te),
                claims = initial.placements.filter((p) =>
                  target.some((i) => covered(p, i))
                );
              const sharedWith: string[] = [];
              for (const claim of claims) {
                const other = initial.units.find((u) =>
                  u.occurrenceIds.includes(claim.originalOccurrenceId ?? "")
                );
                const witnessClaims = w.placements.filter(
                  (p) => p.strong === claim.strong
                );
                if (
                  !policy.sharedCarriers ||
                  !other ||
                  other.source.readingUnresolved ||
                  other.strong.length !== 1 ||
                  !unique(claim.strong) ||
                  claim.kind !== "word" ||
                  length !== 1 ||
                  ps !== pe ||
                  witnessClaims.length !== 1 ||
                  witnessClaims[0].kind !== "word" ||
                  witnessClaims[0].startWordIndex !== ps ||
                  nativeRef(other, initial.ref) !== ref
                ) {
                  agrees = false;
                  break;
                }
                sharedWith.push(other.sourceUnitId);
              }
              if (!agrees) continue;
              // An established but undisplayed complement is also owned. Sharing
              // requires the explicit witness carrier proof above.
              if (
                initial.units.some(
                  (u) =>
                    u.state === "visible" &&
                    !sharedWith.includes(u.sourceUnitId) &&
                    u.targetWordIndices.some((i) => target.includes(i))
                )
              )
                continue;
              const key = target.join(",");
              if (!lexicalCache.has(key))
                lexicalCache.set(
                  key,
                  options.lexicalProof(
                    unit,
                    initial.words.slice(ts, te + 1),
                    w.words.slice(ps, pe + 1)
                  )
                );
              const lexical = lexicalCache.get(key);
              if (!lexical) continue;
              const match: ClauseMatch = {
                witness: w.name,
                family: w.family,
                nativeRef: ref,
                witnessCarrier: sequence(ps, pe),
                witnessContext: sequence(ws, we),
                targetCarrier: target,
                targetContext: sequence(start, end),
                anchors: wa,
                fixedWords: left + right,
                lexical,
                sharedWith
              };
              const matches = all.get(key) ?? [];
              const old = matches.findIndex((m) => m.witness === w.name);
              if (old < 0) matches.push(match);
              else if (match.fixedWords > matches[old].fixedWords)
                matches[old] = match;
              all.set(key, matches);
            }
        }
    }
    if (all.size !== 1) {
      if (all.size)
        rejected.push({
          sourceUnitId: unit.sourceUnitId,
          reason: "competing-expression-alignments",
          targets: [...all.values()].map((m) => m[0].targetCarrier)
        });
      continue;
    }
    const matches = [...all.values()][0];
    if (new Set(matches.map((m) => m.family)).size < policy.minimumFamilies)
      continue;
    proposals.push({ unit, matches, target: matches[0].targetCarrier });
  }
  for (const proposal of proposals) {
    if (
      proposals.some(
        (other) =>
          other !== proposal &&
          other.target.some((i) => proposal.target.includes(i))
      )
    ) {
      rejected.push({
        sourceUnitId: proposal.unit.sourceUnitId,
        reason: "competing-source-occurrences",
        targets: [proposal.target]
      });
      continue;
    }
    const unit = prediction.units.find(
      (u) => u.sourceUnitId === proposal.unit.sourceUnitId
    )!;
    let display = proposal.target;
    const sourcePos = unit.source.morphology.startsWith("H")
      ? (unit.source.morphology
          .slice(1)
          .split("/")
          .filter((p) => !p.startsWith("S"))
          .at(-1) ?? "")
      : unit.source.morphology;
    if (
      policy.display === "lexical-head" &&
      sourcePos.startsWith("V") &&
      display.length > 1
    ) {
      const lexical = display.filter(
        (i) => !isUnsafeRecoverySurface(initial.words[i])
      );
      const content = lexical.length
        ? lexical
        : display.filter((i) => !isConcordanceFunctionWord(initial.words[i]));
      if (content.length === 1) display = content;
    }
    const placement: ReconstructionPlacement = {
      id: `clause:${unit.occurrenceIds[0]}`,
      originalOccurrenceId: unit.occurrenceIds[0],
      strong: unit.strong[0],
      kind: display.length === 1 ? "word" : "phrase",
      startWordIndex: display[0],
      endWordIndex: display.at(-1),
      targetWordIndices: display,
      confidence: 0,
      source: CLAUSE_ALIGNMENT_POLICY
    };
    prediction.placements.push(placement);
    unit.state = "visible";
    unit.assurance = CLAUSE_ALIGNMENT_POLICY;
    unit.targetWordIndices = proposal.target;
    unit.annotationIds.push(placement.id);
    unit.reasons = [
      CLAUSE_ALIGNMENT_POLICY,
      ...proposal.matches.map(
        (m) => `${m.family}:${m.nativeRef}:${m.lexical.kind}`
      )
    ];
    unit.exploration.methods.push(CLAUSE_ALIGNMENT_POLICY);
    unit.exploration.remainingReason = null;
    delete unit.anchor;
    delete unit.grammaticalRelation;
    changes.push({
      sourceUnitId: unit.sourceUnitId,
      placement,
      relationWordIndices: proposal.target,
      matches: proposal.matches
    });
  }
  return { prediction, changes, rejected };
}
