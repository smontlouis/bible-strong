/** Adapter between the measured pure policy and the canonical authoring ledger. */
import assert from "node:assert/strict";
import { canonicalCarrier } from "./strongCanonicalResolution.js";
import {
  CONCORDANCE_FOLLOWUP_POLICY,
  refineConcordanceFollowup
} from "./strongConcordanceFollowup.js";
import type {
  ReconstructionVerse,
  ReconstructionWitness,
  PhraseHeadEvidence
} from "./strongConcordanceRefinement.js";
import type { StrongLedgerVerse } from "./strongLedger.js";
import type { SourceRow } from "./strongSourceUnits.js";
import { extractGoldCarrierPlacements } from "./strongCarriers.js";
import { stripTags, tokenizeText } from "./tokenize.js";
import { withoutPublisherNotes } from "./strongReaderText.js";
import {
  refineConcordanceContext,
  CONCORDANCE_CONTEXT_POLICY,
  type CarrierLexicon
} from "./strongConcordanceContext.js";
import {
  recoverWitnessCarriers,
  WITNESS_RECOVERY_POLICY,
  type RecoveryLexicon,
  type RecoveryChange
} from "./strongWitnessRecovery.js";
import {
  refinePredicateRelations,
  PREDICATE_RELATION_POLICY,
  type PredicateChange
} from "./strongPredicateRelations.js";
import {
  recoverAttestedSurfaceCarriers,
  SURFACE_RECOVERY_POLICY,
  CONSENSUS_SURFACE_RECOVERY,
  type SurfaceRecoveryChange
} from "./strongSurfaceRecovery.js";
import type {
  FrenchInflectionIndex,
  InflectionLexicon,
  WitnessInventory
} from "./strongInflectionEvidence.js";
import {
  alignWitnessClauses,
  CLAUSE_ALIGNMENT_POLICY,
  CONSENSUS_CLAUSE_POLICY,
  type ClauseWitness
} from "./strongClauseAlignment.js";

export const CONCORDANCE_GENERATION_POLICY = "concordance-candidate-v1";
export type ConcordanceDisplay = "expressions" | "heads";
export type ConcordanceTrace = {
  clauses?: {
    policy: typeof CLAUSE_ALIGNMENT_POLICY;
    changes: ReturnType<typeof alignWitnessClauses>["changes"];
    rejected: ReturnType<typeof alignWitnessClauses>["rejected"];
  };
  surface?: {
    policy: typeof SURFACE_RECOVERY_POLICY;
    changes: SurfaceRecoveryChange[];
  };
  predicates?: {
    policy: typeof PREDICATE_RELATION_POLICY;
    changes: PredicateChange[];
  };
  recovery?: {
    policy: typeof WITNESS_RECOVERY_POLICY;
    changes: RecoveryChange[];
  };
  context?: {
    policy: typeof CONCORDANCE_CONTEXT_POLICY;
    changes: ReturnType<typeof refineConcordanceContext>["changes"];
  };
  policy: typeof CONCORDANCE_GENERATION_POLICY;
  refinementPolicy: typeof CONCORDANCE_FOLLOWUP_POLICY;
  display: ConcordanceDisplay;
  changes: ReturnType<typeof refineConcordanceFollowup>["changes"];
  inheritedChanges: ReturnType<
    typeof refineConcordanceFollowup
  >["inheritedChanges"];
  unresolvedCorrespondence?: string[];
};

export function concordanceWitness(
  name: string,
  text: string
): ReconstructionWitness {
  const clean = withoutPublisherNotes(text);
  return {
    name,
    family: name === "Sg1910" ? "Segond-family" : "Darby-family",
    words: tokenizeText(stripTags(clean))
      .filter((t) => t.kind === "word")
      .map((t) => t.text),
    placements: extractGoldCarrierPlacements(clean)
  };
}

export function reconstructionFromLedger(
  verse: StrongLedgerVerse
): ReconstructionVerse {
  assert(verse.resolution, "concordance-requires-resolution");
  return {
    ref: verse.ref,
    text: verse.text,
    words: verse.tokens.map((t) => t.text),
    placements: verse.annotations
      .filter((a) => a.visibility === "reader")
      .flatMap((a) => {
        const carrier = canonicalCarrier(a);
        return carrier
          ? [
              {
                ...carrier,
                confidence: a.confidence,
                source: `${a.source}:${a.diagnostics.join("|")}`
              }
            ]
          : [];
      }),
    units: verse.resolution.decisions,
    issues: verse.resolution.issues,
    unownedAnnotationIds: verse.resolution.unownedAnnotationIds
  };
}

export function applyConcordanceGeneration(options: {
  verse: StrongLedgerVerse;
  sourceRows: ReadonlyMap<string, SourceRow>;
  witnesses: ReconstructionWitness[];
  displayEvidence: PhraseHeadEvidence[];
  display: ConcordanceDisplay;
  contextLexicon?: CarrierLexicon;
  recoveryLexicon?: RecoveryLexicon;
  surfaceInflections?: {
    index: FrenchInflectionIndex;
    lexicon: InflectionLexicon;
  };
  surfaceWitnessInventory?: WitnessInventory;
  clauses?: {
    witnesses: ClauseWitness[];
    lexicalProof: Parameters<typeof alignWitnessClauses>[0]["lexicalProof"];
  };
  predicates?: boolean;
}): void {
  const { verse, display } = options;
  const initial = reconstructionFromLedger(verse);
  const result = refineConcordanceFollowup({
    ...options,
    initial,
    policy: {
      minorReadings: true,
      functionExpressions: display === "expressions",
      articleLinks: true,
      minimumHeadFamilies: 1
    }
  });
  const context = options.contextLexicon
    ? refineConcordanceContext({
        initial: result.prediction,
        witnesses: options.witnesses,
        lexicon: options.contextLexicon,
        display
      })
    : undefined;
  const recovery = options.recoveryLexicon
    ? recoverWitnessCarriers({
        initial: context?.prediction ?? result.prediction,
        lexicon: options.recoveryLexicon
      })
    : undefined;
  const predicates = options.predicates
    ? refinePredicateRelations({
        initial:
          recovery?.prediction ?? context?.prediction ?? result.prediction,
        display
      })
    : undefined;
  const surface =
    options.surfaceInflections && options.recoveryLexicon
      ? recoverAttestedSurfaceCarriers({
          initial:
            predicates?.prediction ??
            recovery?.prediction ??
            context?.prediction ??
            result.prediction,
          lexicon: options.recoveryLexicon,
          inflections: options.surfaceInflections,
          witnessInventory: options.surfaceWitnessInventory,
          display: "heads",
          policy: CONSENSUS_SURFACE_RECOVERY
        })
      : undefined;
  const beforeClauses =
    surface?.prediction ??
    predicates?.prediction ??
    recovery?.prediction ??
    context?.prediction ??
    result.prediction;
  const clauses = options.clauses
    ? alignWitnessClauses({
        initial: beforeClauses,
        ...options.clauses,
        policy: CONSENSUS_CLAUSE_POLICY
      })
    : undefined;
  const prediction = clauses?.prediction ?? beforeClauses;
  // A coordinate fallback or a split with no aligned witness text does not
  // establish which native verse owns the proposed translation relation.
  const mappingIssues = prediction.issues.filter(
    (i) =>
      i === "native-coordinate-used-after-ambiguous-text-alignment" ||
      i === "witness-text-spans-multiple-native-verses" ||
      i === "unresolved-exact-text-witness-correspondence" ||
      i.startsWith("source-model:")
  );
  if (mappingIssues.length) {
    for (const u of prediction.units) {
      u.state = "unresolved";
      u.assurance = "unresolved-verse-correspondence";
      u.targetWordIndices = [];
      delete u.anchor;
      delete u.grammaticalRelation;
      u.reasons = [...u.reasons, ...mappingIssues];
      u.exploration.remainingReason = mappingIssues.join("; ");
    }
    prediction.placements = [];
  }
  assert.equal(prediction.text, verse.text);
  assert.deepEqual(
    prediction.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong]),
    initial.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong]),
    "concordance-source-inventory-drift"
  );
  const byOccurrence = new Map(
    prediction.units.flatMap((u) =>
      u.occurrenceIds.map((id) => [id, u] as const)
    )
  );
  const byId = new Map(verse.annotations.map((a) => [a.id, a]));
  const retained = new Set(prediction.placements.map((p) => p.id));
  assert.equal(
    retained.size,
    prediction.placements.length,
    "duplicate-concordance-placement"
  );
  for (const a of verse.annotations) {
    if (a.visibility === "reader" && !retained.has(a.id))
      a.visibility = "pending";
  }
  for (const p of prediction.placements) {
    const unit = byOccurrence.get(p.originalOccurrenceId ?? "");
    assert(
      unit && unit.state !== "unresolved" && !unit.source.readingUnresolved,
      "unjustified-reader-carrier"
    );
    assert(unit.strong.includes(p.strong), "concordance-identity-drift");
    let annotation = byId.get(p.id);
    if (!annotation) {
      const evidence = verse.annotations.find(
        (a) => a.originalOccurrenceId === p.originalOccurrenceId
      );
      assert(evidence, "concordance-missing-source-annotation");
      annotation = {
        ...evidence,
        id: p.id,
        source: "reference-backed-original",
        confidence: p.confidence ?? 0,
        reason: p.source ?? CONCORDANCE_GENERATION_POLICY,
        diagnostics: [
          ...evidence.diagnostics,
          p.source ?? CONCORDANCE_GENERATION_POLICY
        ]
      };
      verse.annotations.push(annotation);
      byId.set(p.id, annotation);
    }
    // All location fields must agree: renderer and SQLite exporters use different ones.
    for (const key of [
      "wordIndex",
      "startWordIndex",
      "endWordIndex",
      "insertAfterWordIndex",
      "normalizedWord",
      "normalizedPhrase",
      "emptyEvidence"
    ] as const)
      delete annotation[key];
    annotation.visibility = "reader";
    const predicateChange = predicates?.changes.find((change) =>
      change.after.some((after) => after.id === p.id)
    );
    if (predicateChange) {
      annotation.reason = predicateChange.rule;
      annotation.diagnostics = [
        ...annotation.diagnostics,
        ...predicateChange.evidence
      ];
    }
    const contextChange = context?.changes.find((change) =>
      change.after.some((after) => after.id === p.id)
    );
    if (
      contextChange &&
      contextChange.before.some(
        (before) =>
          before.startWordIndex !== p.startWordIndex ||
          before.endWordIndex !== p.endWordIndex
      )
    ) {
      annotation.source = "reference-backed-original";
      annotation.confidence = 0; // No calibrated probability is assigned to a new rule.
      annotation.reason = contextChange.rule;
      annotation.diagnostics = [
        ...annotation.diagnostics,
        ...contextChange.evidence
      ];
    }
    annotation.placement = p.kind;
    if (p.kind === "empty") {
      assert(
        unit.state === "empty" && unit.anchor?.absenceEstablished,
        "unestablished-empty"
      );
      assert.equal(
        p.insertAfterWordIndex,
        unit.anchor.insertAfterWordIndex,
        "empty-anchor-drift"
      );
      annotation.insertAfterWordIndex = p.insertAfterWordIndex;
      annotation.emptyEvidence = {
        absence: {
          status: "linguistic-rule",
          families: [],
          reason: unit.reasons.join("; ")
        },
        anchor: {
          status: unit.anchor.assurance,
          method: "occurrence-neighbors",
          insertAfterWordIndex: p.insertAfterWordIndex!,
          reason: unit.anchor.reasons.join("; ")
        }
      };
    } else {
      assert(unit.state === "visible");
      assert(
        Number.isInteger(p.startWordIndex) &&
          Number.isInteger(p.endWordIndex) &&
          p.startWordIndex! >= 0 &&
          p.endWordIndex! < verse.tokens.length &&
          p.endWordIndex! >= p.startWordIndex!
      );
      if (p.kind === "word") {
        annotation.wordIndex = p.startWordIndex;
        annotation.normalizedWord = verse.tokens[p.startWordIndex!].normalized;
      } else {
        annotation.startWordIndex = p.startWordIndex;
        annotation.endWordIndex = p.endWordIndex;
        annotation.normalizedPhrase = verse.tokens
          .slice(p.startWordIndex!, p.endWordIndex! + 1)
          .map((t) => t.normalized)
          .join(" ");
      }
    }
  }
  for (const a of verse.annotations) {
    const u = byOccurrence.get(a.originalOccurrenceId ?? "");
    if (u)
      Object.assign(a, {
        resolutionUnitId: u.sourceUnitId,
        resolutionState: u.state,
        resolutionAssurance: u.assurance
      });
  }
  const resolution = verse.resolution!;
  resolution.decisions = prediction.units;
  resolution.unownedAnnotationIds = prediction.unownedAnnotationIds;
  resolution.concordance = {
    clauses: clauses
      ? {
          policy: CLAUSE_ALIGNMENT_POLICY,
          changes: clauses.changes,
          rejected: clauses.rejected
        }
      : undefined,
    surface: surface
      ? { policy: SURFACE_RECOVERY_POLICY, changes: surface.changes }
      : undefined,
    predicates: predicates
      ? { policy: PREDICATE_RELATION_POLICY, changes: predicates.changes }
      : undefined,
    recovery: recovery
      ? { policy: WITNESS_RECOVERY_POLICY, changes: recovery.changes }
      : undefined,
    context: context
      ? { policy: CONCORDANCE_CONTEXT_POLICY, changes: context.changes }
      : undefined,
    policy: CONCORDANCE_GENERATION_POLICY,
    refinementPolicy: CONCORDANCE_FOLLOWUP_POLICY,
    display,
    unresolvedCorrespondence: mappingIssues.length ? mappingIssues : undefined,
    changes: result.changes,
    inheritedChanges: result.inheritedChanges
  };
  const count = (state: string) =>
    prediction.units.filter((u) => u.state === state).length;
  resolution.metrics = {
    ...resolution.metrics,
    visible: count("visible"),
    empty: count("empty"),
    unresolved: count("unresolved"),
    policySupportedVerses:
      mappingIssues.length ||
      context?.changes.length ||
      recovery?.changes.length ||
      predicates?.changes.length ||
      clauses?.changes.length ||
      surface?.changes.length
        ? 0
        : resolution.metrics.policySupportedVerses,
    grammaticalEmpties: prediction.units.filter(
      (u) => u.state === "empty" && u.assurance === "linguistic-rule"
    ).length,
    fullyAccountedVerses:
      prediction.units.length &&
      !resolution.issues.length &&
      !count("unresolved")
        ? 1
        : 0
  };
  for (const u of prediction.units) {
    if (u.state !== "unresolved") u.exploration.remainingReason = null;
    u.annotationIds = verse.annotations
      .filter(
        (a) =>
          a.originalOccurrenceId &&
          u.occurrenceIds.includes(a.originalOccurrenceId)
      )
      .map((a) => a.id);
  }
}
