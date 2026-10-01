import { grammaticalEmptyDecisions } from "./strongGrammaticalEmpty.js";
import assert from "node:assert/strict";
import {
  intersectAnchors,
  resolveOccurrence,
  resolutionSourceHash,
  resolutionTextHash,
  sourceNeighborAnchor,
  witnessNeighborAnchor,
  type ResolutionCarrier,
  type ResolutionUnit,
  type ResolutionWitness
} from "./strongResolution.js";
import { tokenizeText } from "./tokenize.js";

export interface ResolutionDossier {
  edition: string;
  ref: string;
  split: "development" | "reserve" | "authoring";
  text: string;
  words: string[];
  units: Array<{
    unit: ResolutionUnit;
    surface: string;
    gloss: string;
    morphology: string;
    sourceFile: string;
    sourceLine: number;
  }>;
  placements: ResolutionCarrier[];
  witnesses: Array<ResolutionWitness & { words: string[]; text: string }>;
}

export interface ResolutionReview {
  edition: string;
  ref: string;
  sourceUnitId: string;
  sourceUnitSha256: string;
  targetTextSha256: string;
  reviewer: {
    id: string;
    kind: "assistant" | "human";
    exposure: "blind" | "exposed";
  };
  state: "visible" | "empty" | "unresolved";
  relation:
    | "lexical"
    | "grammatical"
    | "idiomatic"
    | "no-explicit-equivalent"
    | "uncertain";
  targetWordIndices: number[];
  /** A contiguous display subset; discontinuous relations stay intact above. */
  carrierWordIndices: number[];
  rationale: string;
  sources: string[];
  anchor?: {
    insertAfterWordIndex: number;
    rationale: string;
    /** Binds the display choice to the original placement context as well as text. */
    contextSha256: string;
  };
}

export const reviewKey = (v: {
  edition: string;
  ref: string;
  sourceUnitId: string;
}) => `${v.edition}:${v.ref}:${v.sourceUnitId}`;
export const dossierKey = (d: ResolutionDossier) => `${d.edition}:${d.ref}`;
export const anchorContextHash = (d: ResolutionDossier) =>
  resolutionTextHash(
    JSON.stringify({
      text: d.text,
      units: d.units.map((u) => u.unit),
      placements: d.placements
    })
  );

export function validateDossier(d: ResolutionDossier) {
  assert(d.edition && d.ref, "missing-dossier-identity");
  assert.deepEqual(
    d.words,
    tokenizeText(d.text)
      .filter((t) => t.kind === "word")
      .map((t) => t.text),
    "target-token-drift"
  );
  // Empty native verses and source-less additions remain representable; they
  // are not vacuously marked as completely resolved.
  assert.equal(
    new Set(d.units.map((u) => u.unit.id)).size,
    d.units.length,
    "duplicate-source-unit"
  );
  const occurrences = d.units.flatMap((u) => u.unit.occurrenceIds);
  assert.equal(
    new Set(occurrences).size,
    occurrences.length,
    "duplicate-source-owner"
  );
  assert.equal(
    new Set(d.placements.map((p) => p.id)).size,
    d.placements.length,
    "duplicate-carrier"
  );
  for (const u of d.units) {
    assert(
      u.unit.occurrenceIds.length &&
        u.unit.strong.length &&
        u.unit.sourceEvidenceSha256,
      "incomplete-source-unit"
    );
  }
  for (const p of d.placements) {
    validateCarrier(p, d.words.length);
    if (p.originalOccurrenceId)
      assert(
        occurrences.includes(p.originalOccurrenceId),
        "unknown-source-owner"
      );
  }
  for (const w of d.witnesses) {
    assert(w.family && w.name && w.name !== d.edition, "invalid-witness");
    assert.deepEqual(
      w.words,
      tokenizeText(w.text)
        .filter((t) => t.kind === "word")
        .map((t) => t.text),
      "witness-token-drift"
    );
    for (const p of w.placements) validateCarrier(p, w.words.length);
  }
}

function validateCarrier(p: ResolutionCarrier, count: number) {
  assert(["word", "phrase", "empty"].includes(p.kind), "invalid-carrier-kind");
  if (p.kind === "empty") {
    assert(
      Number.isInteger(p.insertAfterWordIndex) &&
        p.insertAfterWordIndex! >= -1 &&
        p.insertAfterWordIndex! < count,
      "invalid-empty-anchor"
    );
  } else {
    assert(
      Number.isInteger(p.startWordIndex) &&
        Number.isInteger(p.endWordIndex) &&
        p.startWordIndex! >= 0 &&
        p.endWordIndex! < count &&
        p.startWordIndex! <= p.endWordIndex!,
      "invalid-carrier-span"
    );
  }
}

export function validateReview(d: ResolutionDossier, r: ResolutionReview) {
  const unit = d.units.find((u) => u.unit.id === r.sourceUnitId)?.unit;
  assert(unit, "unknown-reviewed-unit");
  assert(
    r.edition === d.edition &&
      r.ref === d.ref &&
      r.targetTextSha256 === resolutionTextHash(d.text) &&
      r.sourceUnitSha256 === resolutionSourceHash(unit),
    "stale-or-misbound-review"
  );
  assert(
    r.reviewer?.id?.trim() &&
      ["human", "assistant"].includes(r.reviewer.kind) &&
      ["blind", "exposed"].includes(r.reviewer.exposure),
    "invalid-reviewer"
  );
  assert(
    ["visible", "empty", "unresolved"].includes(r.state),
    "invalid-review-state"
  );
  assert(
    [
      "lexical",
      "grammatical",
      "idiomatic",
      "no-explicit-equivalent",
      "uncertain"
    ].includes(r.relation),
    "invalid-relation"
  );
  assert(
    r.rationale?.trim() &&
      Array.isArray(r.sources) &&
      r.sources.length &&
      r.sources.every((s) => typeof s === "string" && s.trim()),
    "missing-review-evidence"
  );
  for (const indices of [r.targetWordIndices, r.carrierWordIndices]) {
    assert(Array.isArray(indices), "missing-token-list");
    assert(
      indices.every(
        (i, n) =>
          Number.isInteger(i) &&
          i >= 0 &&
          i < d.words.length &&
          (n === 0 || i > indices[n - 1])
      ),
      "invalid-reviewed-tokens"
    );
  }
  assert(
    (r.state === "visible") === r.targetWordIndices.length > 0,
    "relation-state-mismatch"
  );
  assert(
    r.carrierWordIndices.every(
      (i, n) =>
        r.targetWordIndices.includes(i) &&
        (n === 0 || i === r.carrierWordIndices[n - 1] + 1)
    ),
    "invalid-display-subset"
  );
  assert(
    r.state === "visible" || r.carrierWordIndices.length === 0,
    "nonvisible-carrier"
  );
  assert(
    (r.state === "empty") === (r.relation === "no-explicit-equivalent"),
    "absence-relation-mismatch"
  );
  assert(
    (r.state === "unresolved") === (r.relation === "uncertain"),
    "uncertain-relation-mismatch"
  );
  assert(
    r.state === "unresolved" || !unit.readingUnresolved,
    "unresolved-source-reading"
  );
  if (r.anchor) {
    assert(r.state === "empty", "anchor-requires-empty-review");
    assert(
      r.anchor.rationale?.trim() &&
        r.anchor.contextSha256 === anchorContextHash(d),
      "stale-or-unjustified-anchor"
    );
    assert(
      Number.isInteger(r.anchor.insertAfterWordIndex) &&
        r.anchor.insertAfterWordIndex >= -1 &&
        r.anchor.insertAfterWordIndex < d.words.length,
      "invalid-reviewed-anchor"
    );
  }
}

export interface ExactWitnessProposal {
  sourceUnitId: string;
  startWordIndex: number;
  endWordIndex: number;
  witnesses: string[];
  families: string[];
  reason: string;
}

// Deliberately preserve accents, elisions and negation: normalizeWord removes
// some of these distinctions and is too permissive for exact transfer.
const exactToken = (s: string) =>
  s.normalize("NFC").toLocaleLowerCase("fr-FR").replace(/’/gu, "'");
const owns = (u: ResolutionUnit, p: ResolutionCarrier) =>
  Boolean(
    p.originalOccurrenceId && u.occurrenceIds.includes(p.originalOccurrenceId)
  );

/** Candidate generation only. Failure or an empty witness never implies absence. */
export function proposeExactWitnessCarriers(
  d: ResolutionDossier
): ExactWitnessProposal[] {
  const proposals: ExactWitnessProposal[] = [];
  const target = d.words.map(exactToken);
  for (const { unit } of d.units) {
    if (
      unit.readingUnresolved ||
      unit.strong.length !== 1 ||
      unit.occurrenceIds.length !== 1 ||
      d.units.filter((u) => u.unit.strong.includes(unit.strong[0])).length !==
        1 ||
      d.placements.some((p) => owns(unit, p) && p.kind !== "empty")
    )
      continue;
    const votes: Array<{
      name: string;
      family: string;
      start: number;
      end: number;
    }> = [];
    let contradiction = false;
    for (const w of d.witnesses) {
      const same = w.placements.filter((p) => p.strong === unit.strong[0]);
      if (!same.length) continue;
      if (same.length !== 1 || same[0].kind === "empty") {
        contradiction = true;
        continue;
      }
      const p = same[0];
      const phrase = w.words
        .slice(p.startWordIndex!, p.endWordIndex! + 1)
        .map(exactToken);
      const hits = target.flatMap((_, start) =>
        phrase.length && phrase.every((t, j) => t === target[start + j])
          ? [start]
          : []
      );
      if (hits.length !== 1) {
        contradiction = true;
        continue;
      }
      votes.push({
        name: w.name,
        family: w.family,
        start: hits[0],
        end: hits[0] + phrase.length - 1
      });
    }
    if (
      contradiction ||
      !votes.length ||
      new Set(votes.map((v) => `${v.start}:${v.end}`)).size !== 1
    )
      continue;
    const { start, end } = votes[0];
    if (
      d.placements.some(
        (p) =>
          p.kind !== "empty" &&
          p.startWordIndex! <= end &&
          p.endWordIndex! >= start
      )
    )
      continue;
    proposals.push({
      sourceUnitId: unit.id,
      startWordIndex: start,
      endWordIndex: end,
      witnesses: votes.map((v) => v.name),
      families: [...new Set(votes.map((v) => v.family))].sort(),
      reason: "unique-exact-witness-expression-unoccupied-target"
    });
  }
  // Competing proposals are rejected together, never resolved by iteration order.
  return proposals.filter(
    (p) =>
      !proposals.some(
        (q) =>
          p !== q &&
          p.startWordIndex <= q.endWordIndex &&
          p.endWordIndex >= q.startWordIndex
      )
  );
}

export interface ResolutionOptions {
  applyExactWitness: boolean;
  applyAssistedReviews: boolean;
  applyGrammaticalEmpties?: boolean;
  targetLanguage?: string;
}

export function resolveDossier(
  d: ResolutionDossier,
  reviews: ResolutionReview[] = [],
  options: ResolutionOptions = {
    applyExactWitness: false,
    applyAssistedReviews: false
  }
) {
  validateDossier(d);
  const before = JSON.stringify(d);
  for (const r of reviews) validateReview(d, r);
  assert.equal(
    new Set(reviews.map(reviewKey)).size,
    reviews.length,
    "conflicting-review-records"
  );
  const proposals = proposeExactWitnessCarriers(d);
  const grammar = options.applyGrammaticalEmpties
    ? grammaticalEmptyDecisions(d, options.targetLanguage ?? "")
    : [];
  const units = d.units.map((u) => u.unit);
  const projected = structuredClone(d.placements);
  const decisions = units.map((unit) => {
    const source = sourceNeighborAnchor(
      unit,
      units,
      d.placements,
      d.words.length
    );
    const identifiable =
      unit.strong.length === 1 &&
      units.filter((u) => u.strong.includes(unit.strong[0])).length === 1;
    const witness = identifiable
      ? witnessNeighborAnchor(
          unit.strong[0],
          d.witnesses,
          d.placements,
          d.words.length
        )
      : undefined;
    const anchor = witness ? intersectAnchors([source, witness]) : source;
    const baseline = resolveOccurrence({
      ref: d.ref,
      text: d.text,
      wordCount: d.words.length,
      unit,
      placements: d.placements,
      witnesses: d.witnesses,
      anchor
    });
    const review = reviews.find((r) => r.sourceUnitId === unit.id);
    const proposal = proposals.find((p) => p.sourceUnitId === unit.id);
    const grammaticalDecision = grammar.find((p) => p.sourceUnitId === unit.id);
    const reviewApplied = Boolean(
      review &&
      (review.reviewer.kind === "human" || options.applyAssistedReviews)
    );
    let state = baseline.state;
    let assurance: string = baseline.assurance;
    let targetWordIndices = baseline.targetWordIndices;
    let display: ResolutionCarrier | undefined;
    const reasons = [...baseline.reasons];
    const projectableIdentity =
      !unit.readingUnresolved &&
      unit.strong.length === 1 &&
      unit.occurrenceIds.length === 1;
    if (review && reviewApplied) {
      state = review.state;
      assurance =
        review.reviewer.kind === "human"
          ? "human-reviewed"
          : "assistant-reviewed";
      targetWordIndices = review.targetWordIndices;
      reasons.splice(0, reasons.length, review.rationale);
      if (
        projectableIdentity &&
        review.state === "visible" &&
        review.carrierWordIndices.length
      ) {
        const indices = review.carrierWordIndices;
        display = {
          id: `review:${unit.id}`,
          strong: unit.strong[0],
          originalOccurrenceId: unit.occurrenceIds[0],
          kind: indices.length === 1 ? "word" : "phrase",
          startWordIndex: indices[0],
          endWordIndex: indices.at(-1)
        };
      } else if (
        projectableIdentity &&
        review.state === "empty" &&
        review.anchor
      ) {
        display = {
          id: `review:${unit.id}`,
          strong: unit.strong[0],
          originalOccurrenceId: unit.occurrenceIds[0],
          kind: "empty",
          insertAfterWordIndex: review.anchor.insertAfterWordIndex
        };
      }
      if (!display && review.state !== "unresolved")
        reasons.push("display-not-resolved-separately");
    } else if (!review && grammaticalDecision?.status === "supported") {
      state = "empty";
      assurance = "linguistic-rule";
      targetWordIndices = [];
      display = {
        id: `grammar:${unit.id}`,
        strong: unit.strong[0],
        originalOccurrenceId: unit.occurrenceIds[0],
        kind: "empty",
        insertAfterWordIndex: grammaticalDecision.anchor!.insertAfterWordIndex
      };
      reasons.splice(0, reasons.length, grammaticalDecision.absence!.rationale);
    } else if (!review && proposal && options.applyExactWitness) {
      state = "visible";
      assurance = "exact-witness-transfer";
      targetWordIndices = Array.from(
        { length: proposal.endWordIndex - proposal.startWordIndex + 1 },
        (_, i) => proposal.startWordIndex + i
      );
      display = {
        id: `exact:${unit.id}`,
        strong: unit.strong[0],
        originalOccurrenceId: unit.occurrenceIds[0],
        kind: targetWordIndices.length === 1 ? "word" : "phrase",
        startWordIndex: proposal.startWordIndex,
        endWordIndex: proposal.endWordIndex
      };
      reasons.splice(0, reasons.length, proposal.reason);
    }
    // An applied review owns the disposition: remove obsolete carriers even if
    // its new display is unresolved. No stale visible word survives an absence.
    if (reviewApplied || display) {
      for (let i = projected.length - 1; i >= 0; i--)
        if (owns(unit, projected[i])) projected.splice(i, 1);
      if (display) projected.push(display);
    }
    return {
      sourceUnitId: unit.id,
      baseline,
      state,
      assurance,
      targetWordIndices,
      reasons,
      anchor,
      sourceAnchor: source,
      witnessAnchor: witness,
      proposal,
      review,
      reviewApplied,
      ...(grammaticalDecision ? { grammaticalDecision } : {}),
      display
    };
  });
  assert.equal(JSON.stringify(d), before, "dossier-mutated");
  return {
    edition: d.edition,
    ref: d.ref,
    split: d.split,
    text: d.text,
    decisions,
    placements: projected,
    summary: {
      units: decisions.length,
      ...(options.applyGrammaticalEmpties
        ? {
            linguisticRule: decisions.filter(
              (r) => r.assurance === "linguistic-rule"
            ).length
          }
        : {}),
      visible: decisions.filter((r) => r.state === "visible").length,
      empty: decisions.filter((r) => r.state === "empty").length,
      unresolved: decisions.filter((r) => r.state === "unresolved").length,
      assisted: decisions.filter((r) => r.assurance === "assistant-reviewed")
        .length,
      humanReviewed: decisions.filter((r) => r.assurance === "human-reviewed")
        .length,
      translationAccountedFor:
        decisions.length > 0 &&
        decisions.every((r) => r.state !== "unresolved"),
      fullyHumanReviewed:
        decisions.length > 0 &&
        decisions.every(
          (r) => r.assurance === "human-reviewed" && r.state !== "unresolved"
        ),
      displayComplete:
        decisions.length > 0 &&
        decisions.every(
          (r) =>
            r.state !== "unresolved" &&
            (r.display || (r.state === "visible" && !r.reviewApplied))
        )
    }
  };
}
