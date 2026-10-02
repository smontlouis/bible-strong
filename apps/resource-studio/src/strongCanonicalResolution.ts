import type { VerseCorrespondenceBlock } from "./verseCorrespondence.js";
import {
  readStepOriginalTokens,
  stepSourceIdentityForToken
} from "./stepOriginals.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { ReferenceSource } from "./align.js";
import type { OriginalStrongOccurrence } from "./completeAlignment.js";
import type { LexicalCandidateItem } from "./lexicalCandidateReport.js";
import type {
  StrongLedgerAnnotation,
  StrongLedgerVerse
} from "./strongLedger.js";
import {
  baseStrong,
  parseSourceRow,
  makeUnits,
  type SourceRow
} from "./strongSourceUnits.js";
import { extractGoldCarrierPlacements } from "./strongCarriers.js";
import { parseStrongOccurrences } from "./strongCsv.js";
import { withoutPublisherNotes } from "./strongReaderText.js";
import {
  resolveDossier,
  type ResolutionDossier
} from "./strongResolutionWorkflow.js";
import {
  resolutionTextHash,
  type ResolutionCarrier
} from "./strongResolution.js";
import { stripTags, tokenizeText } from "./tokenize.js";
import {
  witnessAttestedReading,
  type WitnessAttestedReading
} from "./strongWitnessAttestedReading.js";

export const CANONICAL_RESOLUTION_POLICY = "autonomous-fr-occurrences-v2";

/** Resolution refinements measured against Concordance.bible (2026-10-01). */
export interface CanonicalResolutionOptions {
  /**
   * A reading variant blocks the Strong decision only when it can change the
   * Strong identity or the word's presence in the base critical text.
   */
  readingInvariantVariants?: boolean;
  /**
   * Alternative identifiers of one source word never create two display
   * carriers: the carrier whose identifier the witnesses use is kept, then the
   * best-evidenced one; the others are hidden.
   */
  singleCarrierPerSourceIdentity?: boolean;
  /**
   * A word the witnesses leave untranslated, identified by its source
   * position, is established untranslated when its context recurs verbatim.
   */
  witnessEmpties?: boolean;
  /**
   * Source words also carry the identifiers that the witnesses give them
   * (identifier families); STEP's reading model ignores those identifiers.
   */
  strongIdentifierFamilies?: boolean;
  /**
   * A base-text word whose reading stays open is decided visible when its
   * exact witness carrier is attested by two witness families naming that
   * very source word (M, `strongWitnessAttestedReading.ts`).
   */
  witnessAttestedReadings?: boolean;
}

const strongBase = (code: string) => code.match(/^[GH]\d+/u)?.[0] ?? code;

/**
 * True when every reading recorded for this STEP word keeps the same Strong
 * identity and the word belongs to the base text (NA for TAGNT, the
 * Leningrad text or its Qere for TAHOT). Words absent from that base, or whose
 * variants name another Strong, remain unresolved.
 */
export function identityInvariantReading(row: SourceRow): boolean {
  const attested =
    row.source === "TAGNT"
      ? /N/u.test(row.reading)
      : /^[LQ]/u.test(row.reading);
  if (!attested || row.alternatives.length > 0) return false;
  const primary = new Set(row.primary.map(strongBase));
  if (primary.size !== 1) return false;
  const variantCodes = [
    ...`${row.evidence.meaningVariants} ${row.evidence.spellingVariants}`.matchAll(
      /[GH]\d{1,5}/gu
    )
  ].map((match) =>
    strongBase(match[0].replace(/^([GH])0*(\d)/u, (_, l, d) => `${l}${d}`))
  );
  const primaryLoose = new Set(
    [...primary].map((code) =>
      code.replace(/^([GH])0*(\d)/u, (_, l, d) => `${l}${d}`)
    )
  );
  return variantCodes.every((code) => primaryLoose.has(code));
}

const CARRIER_EVIDENCE_RANK: Record<string, number> = {
  "reference-transfer:exact": 6,
  "semantic-lexicon": 5,
  "reference-transfer:lexicon": 4,
  "reference-transfer:window": 4,
  "reference-transfer:stem": 3,
  "reference-learned:learned-translation": 2,
  "reference-learned:learned-translation-stem": 1,
  "phrase-transfer:learned-phrase": 1
};

function carrierEvidenceRank(a: StrongLedgerAnnotation): number {
  return (
    CARRIER_EVIDENCE_RANK[`${a.source}:${a.diagnostics[0] ?? ""}`] ??
    CARRIER_EVIDENCE_RANK[a.source] ??
    0
  );
}

/** Source occurrences grouped by physical STEP word (unresolved ones alone). */
export function sourceIdentityGroups(
  occurrences: OriginalStrongOccurrence[]
): Map<string, OriginalStrongOccurrence[]> {
  const groups = new Map<string, OriginalStrongOccurrence[]>();
  for (const o of occurrences) {
    const id = o.sourceIdentity ?? `unresolved:${o.occurrenceId}`;
    const values = groups.get(id) ?? [];
    values.push(o);
    groups.set(id, values);
  }
  return groups;
}

/** Strong identifiers that the reusable witnesses use anywhere in the verse. */
export function witnessAttestedStrongs(
  references: ReferenceSource[]
): Set<string> {
  return new Set(
    references.flatMap((reference) =>
      parseStrongOccurrences(reference.verse?.row.text ?? "").map((strong) =>
        strong.toUpperCase()
      )
    )
  );
}

/**
 * Keep one reader carrier per physical source word whose alternative Strong
 * identifiers were placed. The identifier used by the witnesses of the verse
 * wins first (it is the display convention for that form), then the evidence
 * rank and the confidence. On the same target words one carrier always stays;
 * on different words, ties stay untouched so the resolver keeps reporting the
 * competition.
 */
export function demoteAlternativeIdentityCarriers(
  annotations: StrongLedgerAnnotation[],
  groups: Map<string, OriginalStrongOccurrence[]>,
  attestedStrongs: ReadonlySet<string> = new Set()
): number {
  let demoted = 0;
  const attested = (a: StrongLedgerAnnotation) =>
    a.strong.split(/\s+/u).some((code) => attestedStrongs.has(code)) ? 1 : 0;
  const demote = (annotation: StrongLedgerAnnotation) => {
    annotation.visibility = "hidden";
    annotation.placement = "duplicate";
    annotation.reason =
      "Another identifier of the same source word already has a reader carrier that the witnesses or the evidence favour; alternative identifiers do not create a second occurrence.";
    annotation.diagnostics = [
      ...new Set([...annotation.diagnostics, "alternative-identifier-demoted"])
    ];
    demoted += 1;
  };
  const spanOf = (a: StrongLedgerAnnotation) =>
    `${a.startWordIndex ?? a.wordIndex}:${a.endWordIndex ?? a.wordIndex}`;
  for (const occurrences of groups.values()) {
    const ids = new Set(occurrences.map((o) => o.occurrenceId));
    if (new Set(occurrences.map((o) => o.strong)).size < 2) continue;
    const order = new Map(
      occurrences.map((o, index) => [o.occurrenceId, index])
    );
    const rank = (
      left: StrongLedgerAnnotation,
      right: StrongLedgerAnnotation
    ) =>
      attested(right) - attested(left) ||
      carrierEvidenceRank(right) - carrierEvidenceRank(left) ||
      right.confidence - left.confidence;
    const readerCarriers = () =>
      annotations.filter(
        (a) =>
          a.visibility === "reader" &&
          a.originalOccurrenceId !== undefined &&
          ids.has(a.originalOccurrenceId) &&
          (a.placement === "word" || a.placement === "phrase")
      );
    // Two identifiers of one source word on the same words name it twice: one
    // carrier stays even on a tie (the witnesses' identifier, then the best
    // evidenced, then STEP's first identifier).
    const bySpan = new Map<string, StrongLedgerAnnotation[]>();
    for (const carrier of readerCarriers())
      bySpan.set(spanOf(carrier), [
        ...(bySpan.get(spanOf(carrier)) ?? []),
        carrier
      ]);
    for (const same of bySpan.values()) {
      if (new Set(same.map((a) => a.strong)).size < 2) continue;
      const [kept] = [...same].sort(
        (left, right) =>
          rank(left, right) ||
          (order.get(left.originalOccurrenceId!) ?? 0) -
            (order.get(right.originalOccurrenceId!) ?? 0)
      );
      for (const annotation of same)
        if (annotation.strong !== kept!.strong) demote(annotation);
    }
    const carriers = readerCarriers();
    const spans = new Set(carriers.map(spanOf));
    if (spans.size < 2 || new Set(carriers.map((a) => a.strong)).size < 2)
      continue;
    const ranked = [...carriers].sort(rank);
    const [best, second] = ranked;
    if (
      !best ||
      !second ||
      (attested(best) === attested(second) &&
        carrierEvidenceRank(best) === carrierEvidenceRank(second) &&
        Math.abs(best.confidence - second.confidence) < 0.01)
    )
      continue;
    for (const annotation of ranked.slice(1)) demote(annotation);
  }
  return demoted;
}
export interface CanonicalResolutionInput {
  mapping?: VerseCorrespondenceBlock;
  occurrences: OriginalStrongOccurrence[];
  references: ReferenceSource[];
  issues: string[];
}
export interface CanonicalResolutionMetrics {
  verses: number;
  units: number;
  visible: number;
  empty: number;
  unresolved: number;
  policySupportedVerses: number;
  grammaticalEmpties: number;
  examinedLexicalCandidates: number;
  fullyAccountedVerses: number;
  sourceIssueVerses: number;
}
type WorkflowDecision = ReturnType<typeof resolveDossier>["decisions"][number];
export interface CanonicalOccurrenceDecision {
  sourceUnitId: string;
  occurrenceIds: string[];
  strong: string[];
  source: {
    file?: string;
    line?: number;
    surface: string;
    gloss: string;
    morphology: string;
    evidenceSha256: string;
    readingUnresolved: boolean;
    /**
     * The reading varies but cannot change this Strong identity, or it stays
     * open and two witness families attest the word in the target (M).
     */
    readingVariant?: "identity-invariant" | "witness-attested";
  };
  state: WorkflowDecision["state"];
  assurance: string;
  targetWordIndices: number[];
  reasons: string[];
  annotationIds: string[];
  placementEvidence: Array<{
    annotationId: string;
    method: string;
    confidence: number;
    reason: string;
    diagnostics: string[];
  }>;
  anchor?: {
    insertAfterWordIndex: number;
    method: string;
    assurance:
      | "editorial-convention"
      | "neighbor-supported"
      | "witness-context"
      | "existing-fallback";
    absenceEstablished: boolean;
    reasons: string[];
    relatedSourceUnits: string[];
  };
  grammaticalRelation?: NonNullable<
    WorkflowDecision["grammaticalDecision"]
  >["grammaticalRelation"];
  exploration: {
    status: "completed-locally";
    methods: string[];
    exactWitnessProposal: WorkflowDecision["proposal"] | null;
    lexicalCandidates: Array<{
      annotationId: string;
      target: string;
      startWordIndex: number;
      endWordIndex: number;
      score: number;
      occupied: boolean;
      evidence: LexicalCandidateItem["candidates"][number]["evidence"];
      disposition: string;
    }>;
    remainingReason: string | null;
  };
}
export interface CanonicalVerseResolution {
  mapping?: VerseCorrespondenceBlock;
  policy: typeof CANONICAL_RESOLUTION_POLICY;
  targetTextSha256: string;
  issues: string[];
  unownedAnnotationIds: string[];
  decisions: CanonicalOccurrenceDecision[];
  metrics: CanonicalResolutionMetrics;
}

export async function readCanonicalSourceRows(
  files: string[]
): Promise<Map<string, SourceRow>> {
  const rows = new Map<string, SourceRow>();
  for (const file of files) {
    const ids = new Map(
      (await readStepOriginalTokens(file)).map((t) => [
        t.sourceLineNumber,
        stepSourceIdentityForToken(t)
      ])
    );
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    for (const [i, line] of lines.entries()) {
      const row = parseSourceRow(line, file, i + 1);
      const id = ids.get(i + 1);
      if (!row || !id) continue;
      row.id = id;
      if (rows.has(id)) {
        const existing = rows.get(id)!;
        assert.deepEqual(
          { ...existing, line: 0 },
          { ...row, line: 0 },
          `conflicting-source-row:${id}`
        );
        continue;
      }
      rows.set(id, row);
    }
  }
  return rows;
}

export function canonicalCarrier(
  a: StrongLedgerAnnotation
): ResolutionCarrier | undefined {
  if (
    a.placement === "word" ||
    (a.placement === "duplicate" && a.wordIndex !== undefined)
  )
    return {
      id: a.id,
      strong: a.strong,
      originalOccurrenceId: a.originalOccurrenceId,
      kind: "word",
      startWordIndex: a.wordIndex,
      endWordIndex: a.wordIndex
    };
  if (a.placement === "phrase")
    return {
      id: a.id,
      strong: a.strong,
      originalOccurrenceId: a.originalOccurrenceId,
      kind: "phrase",
      startWordIndex: a.startWordIndex,
      endWordIndex: a.endWordIndex
    };
  if (
    a.placement === "empty" ||
    (a.placement === "duplicate" && a.insertAfterWordIndex !== undefined)
  )
    return {
      id: a.id,
      strong: a.strong,
      originalOccurrenceId: a.originalOccurrenceId,
      kind: "empty",
      insertAfterWordIndex: a.insertAfterWordIndex ?? -1
    };
  return undefined;
}

/** Resolve against actual projected source occurrences, never synthetic inventory-only witness tags. */
export function resolveCanonicalVerse(options: {
  bible: string;
  verse: Pick<StrongLedgerVerse, "ref" | "text" | "tokens" | "annotations">;
  input: CanonicalResolutionInput;
  sourceRows: Map<string, SourceRow>;
  lexicalItems: LexicalCandidateItem[];
  policy?: CanonicalResolutionOptions;
}): CanonicalVerseResolution {
  const { verse, input, sourceRows } = options;
  const issues = [...input.issues];
  if (input.mapping?.reason?.includes("fallback-after-ambiguous"))
    issues.push("native-coordinate-used-after-ambiguous-text-alignment");
  const groups = sourceIdentityGroups(input.occurrences);
  if (options.policy?.singleCarrierPerSourceIdentity)
    demoteAlternativeIdentityCarriers(
      verse.annotations,
      groups,
      witnessAttestedStrongs(input.references)
    );
  const invariantReadings = new Set<string>();
  const attestedReadings = new Map<string, WitnessAttestedReading>();
  const units: ResolutionDossier["units"] = [...groups].map(
    ([id, occurrences]) => {
      const row = sourceRows.get(id);
      // A family identifier is a name of the word, not a STEP reading of it.
      const modelled =
        options.policy?.strongIdentifierFamilies && row
          ? occurrences.filter((o) =>
              [...row.primary.map(baseStrong), ...row.alternatives].includes(
                o.strong
              )
            )
          : occurrences;
      let readingUnresolved = true;
      try {
        readingUnresolved =
          makeUnits({ source: modelled }, sourceRows)[0].structure ===
          "variant-conditioned";
        if (
          readingUnresolved &&
          options.policy?.readingInvariantVariants &&
          row &&
          identityInvariantReading(row)
        ) {
          readingUnresolved = false;
          invariantReadings.add(id);
        }
        const attested =
          readingUnresolved && options.policy?.witnessAttestedReadings && row
            ? witnessAttestedReading({
                row,
                occurrences,
                verseOccurrences: input.occurrences,
                annotations: verse.annotations,
                tokens: verse.tokens,
                references: input.references,
                canonicalRefs: input.mapping?.canonicalRefs ?? [verse.ref]
              })
            : undefined;
        if (attested) {
          readingUnresolved = false;
          attestedReadings.set(id, attested);
        }
      } catch (error) {
        issues.push(
          `source-model:${id}:${error instanceof Error ? error.message : String(error)}`
        );
      }
      return {
        unit: {
          id,
          occurrenceIds: occurrences.map((o) => o.occurrenceId),
          strong: [...new Set(occurrences.map((o) => o.strong))],
          readingUnresolved,
          sourceEvidenceSha256: resolutionTextHash(
            JSON.stringify(row ?? occurrences)
          )
        },
        surface: row?.surface ?? occurrences[0].text,
        gloss: row?.gloss ?? occurrences[0].gloss,
        morphology: occurrences[0].morph,
        sourceFile: row?.file ?? "unresolved-source",
        sourceLine: row?.line ?? 0
      };
    }
  );
  if (!units.length) issues.push("no-source-occurrences-for-native-verse");
  if (!verse.tokens.length) issues.push("empty-target-text");
  const knownIds = new Set(units.flatMap((u) => u.unit.occurrenceIds));
  const orphan = verse.annotations.filter(
    (a) => a.originalOccurrenceId && !knownIds.has(a.originalOccurrenceId)
  );
  if (orphan.length) issues.push(`unknown-source-owners:${orphan.length}`);
  const dossier: ResolutionDossier = {
    edition: options.bible,
    ref: verse.ref,
    split: "authoring",
    text: verse.text,
    words: verse.tokens.map((t) => t.text),
    units,
    placements: verse.annotations
      .filter(
        (a) =>
          a.visibility === "reader" &&
          (!a.originalOccurrenceId || knownIds.has(a.originalOccurrenceId))
      )
      .flatMap((a) => {
        const p = canonicalCarrier(a);
        return p ? [p] : [];
      }),
    witnesses: input.references.flatMap((r) => {
      if (!r.verse) return [];
      const tagged = withoutPublisherNotes(r.verse.row.text),
        text = stripTags(tagged);
      return [
        {
          name: r.name,
          family: r.family ?? (r.name === "Sg1910" ? "Sg1910" : "Darby-family"),
          ref: `${r.verse.row.bookId}.${r.verse.row.chapter}.${r.verse.row.verse}`,
          text,
          words: tokenizeText(text)
            .filter((t) => t.kind === "word")
            .map((t) => t.text),
          placements: extractGoldCarrierPlacements(tagged).map((p, i) => ({
            ...p,
            id: `${r.name}:${verse.ref}:${i}`
          }))
        }
      ];
    })
  };
  const result = resolveDossier(dossier, [], {
    applyExactWitness: false,
    applyAssistedReviews: false,
    applyGrammaticalEmpties: true,
    applyWitnessEmpties: options.policy?.witnessEmpties === true,
    targetLanguage: "fr"
  });
  const decisions: CanonicalOccurrenceDecision[] = result.decisions.map((d) => {
    const entry = units.find((u) => u.unit.id === d.sourceUnitId)!;
    const linked = verse.annotations.filter(
      (a) =>
        a.originalOccurrenceId &&
        entry.unit.occurrenceIds.includes(a.originalOccurrenceId)
    );
    const annotationIds = new Set(linked.map((a) => a.id));
    const placementEvidence = linked
      .filter((a) => a.visibility === "reader")
      .map((a) => ({
        annotationId: a.id,
        method: a.source,
        confidence: a.confidence,
        reason: a.reason,
        diagnostics: a.diagnostics
      }));
    let assurance = d.assurance;
    let reasons = d.reasons;
    const attested = attestedReadings.get(d.sourceUnitId);
    if (d.state === "visible" && attested) {
      // The reading stays recorded: the placement rests on the witnesses.
      assurance = "witness-attested-reading";
      reasons = [
        "witness-attested-reading",
        `source-reading:${attested.reading}`,
        `identifier:${attested.identifier}`,
        `witnesses:${attested.witnesses.join("+")}`
      ];
    } else if (d.state === "visible") {
      if (
        linked.some(
          (a) =>
            a.visibility === "reader" &&
            a.source === "semantic-lexicon" &&
            a.diagnostics.some((s) => s.startsWith("lexical-auto-safe"))
        )
      )
        assurance = "validated-deterministic-lexical";
      else if (
        linked.some(
          (a) =>
            a.visibility === "reader" &&
            ["manual-review", "curated-override", "llm-review"].includes(
              a.source
            )
        )
      )
        assurance = "durable-reviewed-placement";
      else if (
        linked.some(
          (a) =>
            a.visibility === "reader" &&
            a.diagnostics.includes("exact") &&
            a.diagnostics.some(
              (s) => s.includes("Sg1910") && s.includes("Darby")
            )
        )
      )
        assurance = "exact-witness-families-and-source";
    }

    const lexicalCandidates = options.lexicalItems
      .filter((item) => annotationIds.has(item.annotationId))
      .flatMap((item) =>
        item.candidates.map((c) => ({
          annotationId: item.annotationId,
          target: c.text,
          startWordIndex: c.startWordIndex ?? c.wordIndex,
          endWordIndex: c.endWordIndex ?? c.wordIndex,
          score: c.score,
          occupied: c.occupied,
          evidence: c.evidence,
          disposition: entry.unit.readingUnresolved
            ? "unresolved-source-reading"
            : c.occupied
              ? "carrier-already-occupied"
              : "not-accepted-by-validated-lexical-policy"
        }))
      );
    let anchor: CanonicalOccurrenceDecision["anchor"];
    let existingEmpty = linked.find(
      (a) =>
        a.placement === "empty" ||
        (a.placement === "duplicate" && a.insertAfterWordIndex !== undefined)
    );
    if (d.state !== "visible") {
      const supported =
        d.grammaticalDecision?.status === "supported"
          ? d.grammaticalDecision
          : undefined;
      const transferred = d.state === "empty" ? d.witnessEmpty : undefined;
      const evidence = d.anchor.interval
        ? d.anchor
        : d.sourceAnchor.interval
          ? d.sourceAnchor
          : d.witnessAnchor?.interval
            ? d.witnessAnchor
            : undefined;
      if (supported)
        anchor = {
          insertAfterWordIndex: supported.anchor!.insertAfterWordIndex,
          method: supported.rule,
          assurance: "editorial-convention",
          absenceEstablished: true,
          reasons: [supported.anchor!.rationale],
          relatedSourceUnits: [supported.grammaticalRelation!.objectUnitId]
        };
      else if (transferred)
        anchor = {
          insertAfterWordIndex: transferred.insertAfterWordIndex,
          method: "witness-empty-context",
          assurance: "witness-context",
          absenceEstablished: true,
          reasons: [...d.reasons],
          relatedSourceUnits: []
        };
      else if (evidence?.interval)
        anchor = {
          insertAfterWordIndex: evidence.interval[0],
          method: evidence.method,
          assurance:
            evidence.status === "supported"
              ? "neighbor-supported"
              : "editorial-convention",
          absenceEstablished: false,
          reasons: [
            ...evidence.reasons,
            "left-boundary-selected-for-deterministic-display-not-proof-of-absence"
          ],
          relatedSourceUnits: evidence.neighbors.flatMap((n) =>
            n.sourceUnitId ? [n.sourceUnitId] : []
          )
        };
      else
        anchor = {
          insertAfterWordIndex: existingEmpty?.insertAfterWordIndex ?? -1,
          method: "existing-fallback",
          assurance: "existing-fallback",
          absenceEstablished: false,
          reasons: [
            "no-compatible-neighbor-boundary; retained-only-as-display-fallback"
          ],
          relatedSourceUnits: []
        };
      if ((supported || transferred) && !existingEmpty) {
        const weak = linked.find(
          (a) =>
            a.source === "original-complete" &&
            a.visibility !== "reader" &&
            (a.placement === "word" || a.placement === "phrase")
        );
        if (weak) {
          weak.lexicalSearchAnchorWordIndex ??=
            weak.insertAfterWordIndex ??
            weak.wordIndex ??
            weak.startWordIndex ??
            -1;
          weak.placement = "empty";
          weak.wordIndex = undefined;
          weak.startWordIndex = undefined;
          weak.endWordIndex = undefined;
          weak.normalizedWord = undefined;
          weak.normalizedPhrase = undefined;
          existingEmpty = weak;
        }
      }
      // An anchor established by the witnesses' context is kept.
      if (
        !transferred &&
        existingEmpty &&
        (existingEmpty.source !== "original-complete" ||
          existingEmpty.visibility === "reader")
      )
        anchor = {
          ...anchor,
          insertAfterWordIndex: existingEmpty.insertAfterWordIndex ?? -1,
          method: "preserved-existing-editorial-anchor",
          assurance: "existing-fallback",
          reasons: [
            "Existing editorial display position retained.",
            existingEmpty.reason
          ]
        };
      // Move only unresolved original-complete empties. Durable reviewed and
      // reader-visible editorial placements are not silently relocated.
      if (
        existingEmpty &&
        existingEmpty.source === "original-complete" &&
        existingEmpty.visibility !== "reader"
      ) {
        existingEmpty.lexicalSearchAnchorWordIndex ??=
          existingEmpty.insertAfterWordIndex ?? -1;
        existingEmpty.insertAfterWordIndex = anchor.insertAfterWordIndex;
        existingEmpty.emptyEvidence = {
          absence: {
            status: supported
              ? "linguistic-rule"
              : transferred
                ? "witness-supported"
                : "unresolved",
            families: d.baseline.emptyWitnessFamilies,
            reason: supported?.absence?.rationale ?? d.reasons.join("; ")
          },
          anchor: {
            status: anchor.assurance,
            method: "occurrence-neighbors",
            insertAfterWordIndex: anchor.insertAfterWordIndex,
            reason: anchor.reasons.join("; ")
          }
        };
      }
    }
    for (const a of linked) {
      a.resolutionUnitId = d.sourceUnitId;
      a.resolutionState = d.state;
      a.resolutionAssurance = assurance;
    }
    return {
      sourceUnitId: d.sourceUnitId,
      occurrenceIds: entry.unit.occurrenceIds,
      strong: entry.unit.strong,
      source: {
        file: entry.sourceFile,
        line: entry.sourceLine,
        surface: entry.surface,
        gloss: entry.gloss,
        morphology: entry.morphology,
        evidenceSha256: entry.unit.sourceEvidenceSha256,
        readingUnresolved: entry.unit.readingUnresolved,
        ...(invariantReadings.has(d.sourceUnitId)
          ? { readingVariant: "identity-invariant" as const }
          : attested
            ? { readingVariant: "witness-attested" as const }
            : {})
      },
      state: d.state,
      assurance,
      targetWordIndices: d.targetWordIndices,
      reasons,
      annotationIds: [...annotationIds],
      placementEvidence,
      anchor,
      grammaticalRelation: d.grammaticalDecision?.grammaticalRelation,
      exploration: {
        status: "completed-locally",
        methods: [
          "source-occurrence-and-reading",
          "existing-reader-carriers",
          "deterministic-lexical-fixed-point",
          "exact-witness-expression-candidate",
          "grammatical-empty-rule",
          "source-and-witness-neighbor-anchors"
        ],
        exactWitnessProposal: d.proposal ?? null,
        lexicalCandidates,
        remainingReason: d.state === "unresolved" ? reasons.join("; ") : null
      }
    };
  });
  assert.equal(
    decisions.flatMap((d) => d.occurrenceIds).length,
    input.occurrences.length,
    "source-accounting-drift"
  );
  const unownedAnnotationIds = verse.annotations
    .filter(
      (a) => !a.originalOccurrenceId || !knownIds.has(a.originalOccurrenceId)
    )
    .map((a) => a.id);
  return {
    policy: CANONICAL_RESOLUTION_POLICY,
    mapping: input.mapping,
    targetTextSha256: resolutionTextHash(verse.text),
    issues,
    unownedAnnotationIds,
    decisions,
    metrics: {
      verses: 1,
      units: decisions.length,
      visible: decisions.filter((d) => d.state === "visible").length,
      empty: decisions.filter((d) => d.state === "empty").length,
      unresolved: decisions.filter((d) => d.state === "unresolved").length,
      policySupportedVerses:
        decisions.length > 0 &&
        !issues.length &&
        decisions.every((d) =>
          [
            "linguistic-rule",
            "witness-empty-transfer",
            "validated-deterministic-lexical",
            "durable-reviewed-placement",
            "exact-witness-families-and-source"
          ].includes(d.assurance)
        )
          ? 1
          : 0,
      grammaticalEmpties: decisions.filter(
        (d) => d.assurance === "linguistic-rule"
      ).length,
      examinedLexicalCandidates: decisions.reduce(
        (n, d) => n + d.exploration.lexicalCandidates.length,
        0
      ),
      fullyAccountedVerses:
        decisions.length > 0 &&
        !issues.length &&
        decisions.every((d) => d.state !== "unresolved")
          ? 1
          : 0,
      sourceIssueVerses: issues.length ? 1 : 0
    }
  };
}

export function aggregateResolutionMetrics(verses: StrongLedgerVerse[]) {
  return aggregateResolutionRecords(
    verses.flatMap((v) =>
      v.resolution ? [{ bookId: v.bookId, metrics: v.resolution.metrics }] : []
    )
  );
}

export function aggregateResolutionRecords(
  records: Iterable<{ bookId: string; metrics: CanonicalResolutionMetrics }>
) {
  const empty = (): CanonicalResolutionMetrics => ({
    verses: 0,
    units: 0,
    visible: 0,
    empty: 0,
    unresolved: 0,
    grammaticalEmpties: 0,
    policySupportedVerses: 0,
    examinedLexicalCandidates: 0,
    fullyAccountedVerses: 0,
    sourceIssueVerses: 0
  });
  const total = empty(),
    books: Record<string, CanonicalResolutionMetrics> = {};
  for (const v of records) {
    const book = (books[v.bookId] ??= empty());
    for (const key of Object.keys(total) as Array<
      keyof CanonicalResolutionMetrics
    >) {
      total[key] += v.metrics[key] ?? 0;
      book[key] += v.metrics[key] ?? 0;
    }
  }
  return { policy: CANONICAL_RESOLUTION_POLICY, ...total, books };
}
