import assert from "node:assert/strict";
import test from "node:test";
import { resolveCanonicalVerse } from "../src/strongCanonicalResolution.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import type { StrongLedgerAnnotation } from "../src/strongLedger.js";

function fixture() {
  const codes = ["H7200", "H0853", "H1004"];
  const morphs = ["HVqp3ms", "HTo", "HTd/Ncmsa"];
  const rows = codes.map((code, i) =>
    parseSourceRow(
      `Gen.1.1#0${i + 1}=L\tsurface${i}\ttranslit\tgloss\t{${code}}\t${morphs[i]}\t\t\t${code}\t\t\t`,
      "TAHOT fixture.txt",
      i + 1
    )!
  );
  const occurrences: OriginalStrongOccurrence[] = rows.map((r, i) => ({
    occurrenceId: `${r.id}.main:0`,
    tokenId: `${r.id}.main`,
    tokenIndex: i + 1,
    sourceIdentity: r.id,
    strong: codes[i],
    sourceStrong: codes[i],
    text: r.surface,
    gloss: r.gloss,
    lemma: r.surface,
    morph: morphs[i],
    pos: ""
  }));
  const annotations: StrongLedgerAnnotation[] = codes.map((strong, i) => ({
    id: `a${i}`,
    strong,
    visibility: i === 1 ? "advanced" : "reader",
    placement: i === 1 ? "empty" : "word",
    source: i === 1 ? "original-complete" : "reference-transfer",
    confidence: i === 1 ? 0.35 : 0.99,
    reason: "fixture",
    diagnostics: [],
    originalOccurrenceId: occurrences[i].occurrenceId,
    ...(i === 1 ? { insertAfterWordIndex: 0 } : { wordIndex: i === 0 ? 1 : 3 })
  }));
  const verse = {
    ref: "Gen.1.1",
    text: "Il voit la maison",
    tokens: ["Il", "voit", "la", "maison"].map((text, wordIndex) => ({
      wordIndex,
      text,
      normalized: text.toLowerCase()
    })),
    annotations
  };
  return {
    bible: "nbs",
    verse,
    input: { occurrences, references: [], issues: [] },
    sourceRows: new Map(rows.map((r) => [r.id, r])),
    lexicalItems: []
  };
}
test("canonical grammatical absence reuses the source occurrence and preserves lexical scoring position", () => {
  const f = fixture();
  const result = resolveCanonicalVerse(f);
  assert.equal(result.decisions.length, 3);
  assert.equal(result.decisions[1].state, "empty");
  assert.equal(result.decisions[1].assurance, "linguistic-rule");
  assert.equal(result.decisions[1].anchor?.absenceEstablished, true);
  assert.equal(f.verse.annotations.length, 3);
  assert.equal(f.verse.annotations[1].insertAfterWordIndex, 1);
  assert.equal(f.verse.annotations[1].lexicalSearchAnchorWordIndex, 0);
  assert.equal(f.verse.annotations[1].visibility, "advanced");
  assert.equal(
    f.verse.annotations[1].emptyEvidence?.absence.status,
    "linguistic-rule"
  );
  assert.equal(result.metrics.fullyAccountedVerses, 1);
  assert.equal(f.verse.text, "Il voit la maison");
});
test("a supported anchor cannot certify a missing lexical counterpart", () => {
  const f = fixture();
  f.input.occurrences[1].strong = "H0001";
  f.input.occurrences[1].sourceStrong = "H0001";
  f.verse.annotations[1].strong = "H0001";
  const row = f.sourceRows.get(f.input.occurrences[1].sourceIdentity!)!;
  row.primary = ["H0001"];
  const result = resolveCanonicalVerse(f);
  assert.equal(result.decisions[1].state, "unresolved");
  assert.equal(result.decisions[1].anchor?.absenceEstablished, false);
  assert.equal(result.decisions[1].exploration.status, "completed-locally");
  assert(result.decisions[1].exploration.remainingReason);
});
test("missing STEP provenance is accounted for explicitly and never drops the occurrence", () => {
  const f = fixture();
  f.sourceRows.delete(f.input.occurrences[1].sourceIdentity!);
  const r = resolveCanonicalVerse(f);
  assert.equal(r.decisions.length, 3);
  assert(r.issues.some((s) => s.startsWith("source-model:")));
  assert.equal(r.decisions[1].state, "unresolved");
  assert.equal(r.metrics.fullyAccountedVerses, 0);
});
test("source-less target verses and empty native verses are retained, not vacuously certified", () => {
  const f = fixture();
  f.input.occurrences = [];
  f.verse.annotations = [];
  const r = resolveCanonicalVerse(f);
  assert.equal(r.metrics.units, 0);
  assert.equal(r.metrics.fullyAccountedVerses, 0);
  assert(r.issues.includes("no-source-occurrences-for-native-verse"));
  const empty = fixture();
  empty.verse.text = "";
  empty.verse.tokens = [];
  empty.verse.annotations = [];
  const e = resolveCanonicalVerse(empty);
  assert.equal(e.decisions.length, 3);
  assert.equal(e.metrics.unresolved, 3);
  assert(e.issues.includes("empty-target-text"));
});
test("canonical references spanning native verses do not become invented empty witness votes", () => {
  const f = fixture();
  f.input.issues.push("witness-text-spans-multiple-native-verses");
  const r = resolveCanonicalVerse(f);
  assert.equal(r.metrics.sourceIssueVerses, 1);
  assert.equal(r.metrics.fullyAccountedVerses, 0);
  assert.equal(r.decisions[1].assurance, "linguistic-rule");
});
test("reader-visible and durable empty anchors remain untouched by automatic anchoring", () => {
  for (const visibility of ["reader", "advanced"] as const) {
    const f = fixture();
    f.verse.annotations[1].visibility = visibility;
    f.verse.annotations[1].source = "manual-review";
    resolveCanonicalVerse(f);
    assert.equal(f.verse.annotations[1].insertAfterWordIndex, 0);
    assert.equal(
      f.verse.annotations[1].lexicalSearchAnchorWordIndex,
      undefined
    );
  }
});
