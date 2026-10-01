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
  parseSourceRow,
  makeUnits,
  type SourceRow
} from "./strongSourceUnits.js";
import { extractGoldCarrierPlacements } from "./strongCarriers.js";
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
import type { SourceReadingAssessment } from "./strongSourceReading.js";

export const CANONICAL_RESOLUTION_POLICY = "autonomous-fr-occurrences-v2";
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
    readingAssessment?: SourceReadingAssessment;
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
      "editorial-convention" | "neighbor-supported" | "existing-fallback";
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
}): CanonicalVerseResolution {
  const { verse, input, sourceRows } = options;
  const issues = [...input.issues];
  if (input.mapping?.reason?.includes("fallback-after-ambiguous"))
    issues.push("native-coordinate-used-after-ambiguous-text-alignment");
  const groups = new Map<string, OriginalStrongOccurrence[]>();
  const readingAssessments = new Map<string, SourceReadingAssessment>();
  for (const o of input.occurrences) {
    const id = o.sourceIdentity ?? `unresolved:${o.occurrenceId}`;
    const values = groups.get(id) ?? [];
    values.push(o);
    groups.set(id, values);
  }
  const units: ResolutionDossier["units"] = [...groups].map(
    ([id, occurrences]) => {
      const row = sourceRows.get(id);
      let readingUnresolved = true;
      try {
        const model = makeUnits({ source: occurrences }, sourceRows)[0];
        readingUnresolved = model.structure === "variant-conditioned";
        if (model.readingAssessment)
          readingAssessments.set(id, model.readingAssessment);
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
    if (d.state === "visible") {
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
      if (supported && !existingEmpty) {
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
      if (
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
            status: supported ? "linguistic-rule" : "unresolved",
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
        readingAssessment: readingAssessments.get(d.sourceUnitId)
      },
      state: d.state,
      assurance,
      targetWordIndices: d.targetWordIndices,
      reasons: d.reasons,
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
        remainingReason: d.state === "unresolved" ? d.reasons.join("; ") : null
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
