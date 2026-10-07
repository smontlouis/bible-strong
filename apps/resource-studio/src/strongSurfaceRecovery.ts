/** Additional carriers from attested French surfaces, preserving existing decisions. */
import type {
  ReconstructionPlacement,
  ReconstructionVerse
} from "./strongConcordanceRefinement.js";
import type {
  RecoveryAttestation,
  RecoveryLexicon
} from "./strongWitnessRecovery.js";
import { isUnsafeRecoverySurface } from "./strongWitnessRecovery.js";
import { refinePredicateRelations } from "./strongPredicateRelations.js";
import { tokenizeText } from "./tokenize.js";
import {
  unambiguousFrenchLemma,
  type FrenchInflectionIndex,
  type InflectionLexicon
} from "./strongInflectionEvidence.js";
import type { WitnessInventory } from "./strongInflectionEvidence.js";

export const SURFACE_RECOVERY_POLICY = "attested-surface-recovery-v2";
export interface SurfaceRecoveryPolicy {
  clitics: boolean;
  repeated: boolean;
  minimumFamilies: 1 | 2;
  inflections?: boolean;
  inflectionConsensus?: boolean;
  clauseBoundaries?: boolean;
  requireVerseSupport?: boolean;
}
export const CONSENSUS_SURFACE_RECOVERY: SurfaceRecoveryPolicy = {
  clitics: true,
  repeated: true,
  inflections: true,
  inflectionConsensus: true,
  clauseBoundaries: true,
  requireVerseSupport: true,
  minimumFamilies: 2
};
export interface SurfaceRecoveryChange {
  sourceUnitId: string;
  placement: ReconstructionPlacement;
  form: string;
  normalization:
    | "exact"
    | "attached-pronoun"
    | "demonstrative-suffix"
    | "dictionary-inflection";
  lemma?: string;
  verseSupport?: { ref: string; families: string[] };
  repeated: boolean;
  attestations: RecoveryAttestation[];
  anchors: string[];
}
const form = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/^(?:c|d|j|l|m|n|qu|s|t)'/u, "");
const pos = (s: string) =>
  s.startsWith("H")
    ? (s
        .slice(1)
        .split("/")
        .filter((x) => !x.startsWith("S"))
        .at(-1) ?? "")
    : s;
const lexical = (u: ReconstructionVerse["units"][number]) =>
  !u.source.readingUnresolved &&
  u.strong.length === 1 &&
  u.occurrenceIds.length === 1 &&
  /^(?:N|V|A)/u.test(pos(u.source.morphology));
const grammatical = isUnsafeRecoverySurface;

/** Recognize French grammatical attachments; never split arbitrary compounds or names. */
export function detachedFrenchHead(
  surface: string,
  morphology: string
): {
  head: string;
  normalization: SurfaceRecoveryChange["normalization"];
} | null {
  const parts = form(surface).split(/[-‐‑]/u);
  if (parts.length < 2 || !/^\p{L}{3,}$/u.test(parts[0])) return null;
  const suffix = parts.slice(1).join("-");
  if (
    /^V/u.test(pos(morphology)) &&
    /^(?:(?:t-)?(?:il|elle|on|ils|elles|je|tu|nous|vous)|(?:le|la|les)-(?:moi|toi|lui|nous|vous|leur)|moi|toi|lui|leur|le|la|les|en|y)$/u.test(
      suffix
    )
  )
    return { head: parts[0], normalization: "attached-pronoun" };
  if (/^(?:N|A)/u.test(pos(morphology)) && /^(?:ci|là)$/u.test(suffix))
    return { head: parts[0], normalization: "demonstrative-suffix" };
  return null;
}

export function recoverAttestedSurfaceCarriers(options: {
  initial: ReconstructionVerse;
  lexicon: RecoveryLexicon;
  inflections?: { index: FrenchInflectionIndex; lexicon: InflectionLexicon };
  witnessInventory?: WitnessInventory;
  display: "heads" | "expressions";
  policy?: SurfaceRecoveryPolicy;
}) {
  const initial = options.initial;
  const policy = options.policy ?? CONSENSUS_SURFACE_RECOVERY;
  const prediction = structuredClone(initial);
  const changes: SurfaceRecoveryChange[] = [];
  if (initial.issues.length || initial.unownedAnnotationIds.length)
    return { prediction, changes };
  const peers = (u: ReconstructionVerse["units"][number]) =>
    initial.units.filter((v) => v.strong.includes(u.strong[0]));
  const owned = (u: ReconstructionVerse["units"][number]) =>
    initial.placements.filter(
      (p) =>
        u.occurrenceIds.includes(p.originalOccurrenceId ?? "") &&
        p.kind !== "empty"
    );
  const occupied = (index: number) =>
    initial.placements.some(
      (p) =>
        p.kind !== "empty" &&
        p.startWordIndex! <= index &&
        index <= p.endWordIndex!
    ) ||
    initial.units.some(
      (u) => u.state === "visible" && u.targetWordIndices.includes(index)
    );
  let offset = 0;
  const ranges = tokenizeText(initial.text).flatMap((t) => {
    const start = offset;
    offset += t.text.length;
    return t.kind === "word" ? [{ start, end: offset }] : [];
  });
  const proposals: SurfaceRecoveryChange[] = [];
  for (let index = 0; index < initial.units.length; index++) {
    const unit = initial.units[index];
    if (
      unit.state !== "unresolved" ||
      !lexical(unit) ||
      owned(unit).length ||
      unit.assurance !== "unresolved" ||
      !unit.reasons.includes("missing-carrier-is-not-absent-translation")
    )
      continue;
    const repeated = peers(unit).length > 1;
    const sourceRef =
      unit.sourceUnitId.match(/^(?:TAHOT|TAGNT)\.([^.]+\.\d+\.\d+)\./u)?.[1] ??
      initial.ref;
    const verseFamilies =
      options.witnessInventory?.get(sourceRef)?.get(unit.strong[0]) ??
      new Set<string>();
    // A morphological similarity must not decide a source-identity discrepancy
    // that the allowed witnesses do not corroborate in this native verse.
    if (
      policy.requireVerseSupport &&
      verseFamilies.size < policy.minimumFamilies
    )
      continue;
    if (repeated && (!policy.repeated || peers(unit).some((u) => !lexical(u))))
      continue;
    const anchor = (direction: -1 | 1) => {
      for (
        let at = index + direction;
        at >= 0 && at < initial.units.length && Math.abs(at - index) <= 8;
        at += direction
      ) {
        const other = initial.units[at],
          placements = owned(other);
        if (
          other.state === "visible" &&
          lexical(other) &&
          peers(other).length === 1 &&
          placements.length === 1 &&
          placements[0].kind === "word"
        )
          return { unit: other, position: placements[0].startWordIndex! };
      }
      return undefined;
    };
    const left = anchor(-1),
      right = anchor(1);
    if (
      !left ||
      !right ||
      left.position >= right.position ||
      right.position - left.position > 14 ||
      (policy.clauseBoundaries ? /[.,;:!?«»]/u : /[.;:!?«»]/u).test(
        initial.text.slice(
          ranges[left.position].end,
          ranges[right.position].start
        )
      )
    )
      continue;
    const candidates: Array<
      SurfaceRecoveryChange & { consensusSupported: boolean }
    > = [];
    for (let at = left.position + 1; at < right.position; at++) {
      if (occupied(at)) continue;
      const detached = policy.clitics
        ? detachedFrenchHead(initial.words[at], unit.source.morphology)
        : null;
      if (!repeated && !detached && !policy.inflections) continue;
      const head = detached?.head ?? form(initial.words[at]);
      if (!/^\p{L}{3,}$/u.test(head) || grammatical(head)) continue;
      let attestations: RecoveryAttestation[] = (
        options.lexicon.get(unit.strong[0])?.get(head) ?? []
      ).filter((a) => a.ref !== initial.ref && a.ref !== sourceRef);
      let lemma: string | undefined;
      if (policy.inflections && options.inflections) {
        const sourcePos = pos(unit.source.morphology);
        const frenchPos = sourcePos.startsWith("V")
          ? "verb"
          : sourcePos.startsWith("N")
            ? "noun"
            : "adj";
        lemma = unambiguousFrenchLemma(
          options.inflections.index,
          head,
          frenchPos
        );
        if (lemma) {
          attestations = (
            options.inflections.lexicon
              .get(unit.strong[0])
              ?.get(`${frenchPos}:${lemma}`) ?? []
          ).filter((a) => a.ref !== initial.ref && a.ref !== sourceRef);
        }
      }
      if (!repeated && !detached && !lemma) continue;
      let consensusSupported = true;
      if (lemma && policy.inflectionConsensus) {
        const familiesByRef = new Map<string, Set<string>>();
        for (const a of attestations) {
          const families = familiesByRef.get(a.ref) ?? new Set<string>();
          families.add(a.family);
          familiesByRef.set(a.ref, families);
        }
        // Two witnesses from different families must agree in each of two other
        // passages. Separate, unrelated uses of a polysemous verb do not suffice.
        consensusSupported =
          [...familiesByRef.values()].filter(
            (f) => f.size >= policy.minimumFamilies
          ).length >= 2;
      }
      if (
        new Set(attestations.map((a) => a.family)).size <
          policy.minimumFamilies ||
        new Set(attestations.map((a) => a.ref)).size < 2
      )
        continue;
      candidates.push({
        consensusSupported,
        sourceUnitId: unit.sourceUnitId,
        form: head,
        normalization:
          detached?.normalization ??
          (lemma ? "dictionary-inflection" : "exact"),
        ...(lemma ? { lemma } : {}),
        ...(policy.requireVerseSupport
          ? {
              verseSupport: {
                ref: sourceRef,
                families: [...verseFamilies].sort()
              }
            }
          : {}),
        repeated,
        attestations,
        anchors: [left.unit.sourceUnitId, right.unit.sourceUnitId],
        placement: {
          id: `recovery:surface:${unit.occurrenceIds[0]}`,
          originalOccurrenceId: unit.occurrenceIds[0],
          strong: unit.strong[0],
          kind: "word",
          startWordIndex: at,
          endWordIndex: at,
          confidence: 0,
          source: SURFACE_RECOVERY_POLICY
        }
      });
    }
    if (candidates.length === 1) {
      const { consensusSupported, ...proposal } = candidates[0];
      if (consensusSupported) proposals.push(proposal);
    }
  }
  const unique = proposals.filter(
    (p) =>
      proposals.filter(
        (q) => q.placement.startWordIndex === p.placement.startWordIndex
      ).length === 1
  );
  const assigned = new Map(unique.map((p) => [p.sourceUnitId, p]));
  const accepted = unique.filter((p) => {
    if (!p.repeated) return true;
    const family = initial.units.filter((u) =>
      u.strong.includes(p.placement.strong)
    );
    let previous = -1;
    for (const u of family) {
      const visible = owned(u);
      const position =
        u.state === "visible" &&
        visible.length === 1 &&
        visible[0].kind === "word"
          ? visible[0].startWordIndex
          : assigned.get(u.sourceUnitId)?.placement.startWordIndex;
      if (position === undefined || position <= previous) return false;
      previous = position;
    }
    return true;
  });
  for (const proposal of accepted) {
    const unit = prediction.units.find(
      (u) => u.sourceUnitId === proposal.sourceUnitId
    )!;
    prediction.placements.push(proposal.placement);
    unit.state = "visible";
    unit.assurance = SURFACE_RECOVERY_POLICY;
    unit.targetWordIndices = [proposal.placement.startWordIndex!];
    unit.annotationIds.push(proposal.placement.id);
    unit.reasons = [
      SURFACE_RECOVERY_POLICY,
      `surface:${proposal.normalization}:${proposal.form}`,
      ...proposal.attestations.map((a) => `${a.family}:${a.ref}`),
      ...proposal.anchors.map((a) => `neighbor:${a}`)
    ];
    unit.exploration.methods.push(SURFACE_RECOVERY_POLICY);
    unit.exploration.remainingReason = null;
    delete unit.anchor;
    delete unit.grammaticalRelation;
  }
  // Apply the existing nominal/predicate guard, then copy only new decisions.
  // Existing placements and complete translation relations are left byte-for-byte intact.
  const guarded = refinePredicateRelations({
    initial: prediction,
    display: options.display
  }).prediction;
  const final = structuredClone(initial);
  const safe = accepted.filter((p) => {
    const unit = guarded.units.find((u) => u.sourceUnitId === p.sourceUnitId)!;
    return unit.state === "visible" && !unit.targetWordIndices.some(occupied);
  });
  const safeIds = new Set(safe.map((p) => p.sourceUnitId));
  for (const proposal of safe) {
    if (
      proposal.repeated &&
      accepted.some(
        (p) =>
          p.placement.strong === proposal.placement.strong &&
          !safeIds.has(p.sourceUnitId)
      )
    )
      continue;
    const unit = guarded.units.find(
      (u) => u.sourceUnitId === proposal.sourceUnitId
    )!;
    const placement = guarded.placements.find(
      (p) => p.id === proposal.placement.id
    )!;
    final.units[
      final.units.findIndex((u) => u.sourceUnitId === unit.sourceUnitId)
    ] = unit;
    final.placements.push(placement);
    changes.push({ ...proposal, placement });
  }
  return { prediction: final, changes };
}
