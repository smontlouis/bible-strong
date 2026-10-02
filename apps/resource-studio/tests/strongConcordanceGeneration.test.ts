import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConcordanceGeneration,
  reconstructionFromLedger
} from "../src/strongConcordanceGeneration.js";
import type {
  StrongLedgerVerse,
  StrongLedgerAnnotation
} from "../src/strongLedger.js";
import { renderStrongTaggedText } from "../src/strongLedger.js";
import type { CanonicalOccurrenceDecision } from "../src/strongCanonicalResolution.js";
import { tokenizeText, stripTags } from "../src/tokenize.js";

function unit(
  id: string,
  state: CanonicalOccurrenceDecision["state"]
): CanonicalOccurrenceDecision {
  return {
    sourceUnitId: id,
    occurrenceIds: [id + ":0"],
    strong: ["G1063"],
    source: {
      surface: "γάρ",
      gloss: "for",
      morphology: "CONJ",
      evidenceSha256: "test",
      readingUnresolved: false
    },
    state,
    assurance: "existing-reader-carrier",
    targetWordIndices: state === "visible" ? [0, 1] : [],
    reasons: ["fixture"],
    annotationIds: [],
    placementEvidence: [],
    exploration: {
      status: "completed-locally",
      methods: [],
      exactWitnessProposal: null,
      lexicalCandidates: [],
      remainingReason: state === "unresolved" ? "unknown relation" : null
    }
  };
}
function annotation(id: string): StrongLedgerAnnotation {
  return {
    id,
    originalOccurrenceId: id + ":0",
    strong: "G1063",
    visibility: "reader",
    placement: "phrase",
    startWordIndex: 0,
    endWordIndex: 1,
    source: "phrase-transfer",
    confidence: 0.9,
    reason: "fixture",
    diagnostics: ["learned-phrase"]
  };
}
function fixture(): StrongLedgerVerse {
  const text = "en effet.\n";
  return {
    ref: "Rom.1.1",
    bookId: "Rom",
    chapter: 1,
    verse: 1,
    text,
    tokens: [
      { wordIndex: 0, text: "en", normalized: "en" },
      { wordIndex: 1, text: "effet", normalized: "effet" }
    ],
    annotations: [annotation("u")],
    views: { readerHtml: "", advancedHtml: "", debugHtml: "" },
    inventories: {
      references: { Sg1910: [], Darby: [], DarbyR: [] },
      original: ["G1063"],
      reader: ["G1063"],
      advanced: []
    },
    metrics: {} as StrongLedgerVerse["metrics"],
    resolution: {
      policy: "autonomous-fr-occurrences-v2",
      targetTextSha256: "test",
      issues: [],
      unownedAnnotationIds: [],
      decisions: [unit("u", "visible")],
      metrics: {
        verses: 1,
        units: 1,
        visible: 1,
        empty: 0,
        unresolved: 0,
        grammaticalEmpties: 0,
        policySupportedVerses: 0,
        examinedLexicalCandidates: 0,
        fullyAccountedVerses: 1,
        sourceIssueVerses: 0
      }
    }
  };
}
function apply(verse: StrongLedgerVerse, display: "heads" | "expressions") {
  applyConcordanceGeneration({
    verse,
    display,
    sourceRows: new Map(),
    displayEvidence: [],
    witnesses: [
      {
        name: "Darby",
        family: "Darby-family",
        words: ["en", "effet"],
        placements: [
          { strong: "G1063", kind: "word", startWordIndex: 1, endWordIndex: 1 }
        ]
      }
    ]
  });
}
test("exports the selected display boundary while preserving the complete translation relation", () => {
  for (const display of ["heads", "expressions"] as const) {
    const v = fixture();
    v.resolution!.decisions[0].exploration.remainingReason =
      "earlier unsuccessful exploration";
    apply(v, display);
    assert.equal(v.resolution!.decisions[0].exploration.remainingReason, null);
    assert.equal(
      v.annotations[0].placement,
      display === "heads" ? "word" : "phrase"
    );
    assert.deepEqual(v.resolution!.decisions[0].targetWordIndices, [0, 1]);
    if (display === "heads") {
      assert.equal(v.annotations[0].wordIndex, 1);
      assert.equal(v.annotations[0].startWordIndex, undefined);
    }
    const html = renderStrongTaggedText(
      tokenizeText(v.text),
      v.annotations,
      "reader"
    );
    assert.equal(stripTags(html), v.text);
    assert.equal(v.resolution!.concordance!.display, display);
    assert.equal(reconstructionFromLedger(v).placements.length, 1);
  }
});
test("unresolved carriers and unowned annotations cannot escape through the reader export", () => {
  const v = fixture();
  v.resolution!.decisions[0] = unit("u", "unresolved");
  v.annotations.push({
    ...annotation("unowned"),
    originalOccurrenceId: undefined
  });
  apply(v, "expressions");
  assert.equal(reconstructionFromLedger(v).placements.length, 0);
  assert(v.annotations.every((a) => a.visibility === "pending"));
  assert.equal(
    renderStrongTaggedText(tokenizeText(v.text), v.annotations, "reader"),
    v.text
  );
  assert.equal(v.resolution!.metrics.unresolved, 1);
});
test("ambiguous versification quarantines a plausible placement instead of inventing an absence", () => {
  for (const issue of [
    "native-coordinate-used-after-ambiguous-text-alignment",
    "unresolved-exact-text-witness-correspondence"
  ]) {
    const v = fixture();
    v.resolution!.issues.push(issue);
    apply(v, "expressions");
    assert.equal(reconstructionFromLedger(v).placements.length, 0);
    assert.equal(v.resolution!.decisions[0].state, "unresolved");
    assert.equal(v.resolution!.decisions[0].anchor, undefined);
    assert.equal(v.resolution!.metrics.fullyAccountedVerses, 0);
  }
});
test("an established empty gets its distinct anchor; an unsuccessful search does not", () => {
  const v = fixture();
  const empty = unit("u", "empty");
  empty.assurance = "linguistic-rule";
  empty.anchor = {
    insertAfterWordIndex: 0,
    method: "source-object",
    assurance: "editorial-convention",
    absenceEstablished: true,
    reasons: ["source order"],
    relatedSourceUnits: []
  };
  v.resolution!.decisions = [empty, unit("pending", "unresolved")];
  v.annotations[0].visibility = "advanced";
  v.annotations.push({
    ...annotation("pending"),
    placement: "empty",
    insertAfterWordIndex: 1,
    startWordIndex: undefined,
    endWordIndex: undefined
  });
  apply(v, "expressions");
  const placements = reconstructionFromLedger(v).placements;
  assert.equal(placements.length, 1);
  assert.equal(placements[0].kind, "empty");
  assert.equal(placements[0].insertAfterWordIndex, 0);
  const projected = v.annotations.find((a) => a.id === placements[0].id)!;
  assert.equal(projected.emptyEvidence!.absence.status, "linguistic-rule");
  assert.equal(projected.emptyEvidence!.anchor.insertAfterWordIndex, 0);
  assert.equal(projected.startWordIndex, undefined);
  assert.equal(v.resolution!.metrics.unresolved, 1);
});
