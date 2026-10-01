import assert from "node:assert/strict";
import test from "node:test";
import { scoreConjoinIdentity } from "../scripts/strong-concordance-followup/identity.js";
import type {
  Prediction,
  GoldVerse
} from "../scripts/strong-concordance-night/contract.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";

function fixture() {
  const codes = ["G3588", "G0018", "G0846"];
  const source = codes.map((code, i) =>
    parseSourceRow(
      `Rom.1.1#${i + 1}=NKO\ts${i}\tg${i}\t${code}=N-NSM\tlemma\tNA28+TR\t\t\t\t\t${i === 0 ? "#01»02:G0018" : `#${i + 1}`}\t${code}\t`,
      "TAGNT fixture.txt",
      i + 1
    )!
  );
  const raw: Prediction = {
    ref: "Rom.1.1",
    text: "le bien puis le reste",
    words: ["le", "bien", "puis", "le", "reste"],
    issues: [],
    unownedAnnotationIds: [],
    units: source.map((r, i) => ({
      sourceUnitId: r.id,
      occurrenceIds: [`${r.id}.main:0`],
      strong: i === 2 ? ["G0846", "G3778"] : [codes[i]],
      source: {
        file: r.file,
        line: r.line,
        surface: r.surface,
        gloss: r.gloss,
        morphology: i === 0 ? "T-ASN" : "A-ASN",
        evidenceSha256: "fixture",
        readingUnresolved: i === 2
      },
      state: "visible",
      assurance: "fixture",
      targetWordIndices: [],
      reasons: [],
      annotationIds: [],
      placementEvidence: [],
      exploration: {
        status: "completed-locally",
        methods: [],
        exactWitnessProposal: null,
        lexicalCandidates: [],
        remainingReason: null
      }
    })),
    placements: [
      {
        id: "p",
        strong: "G3588",
        originalOccurrenceId: `${source[0].id}.main:0`,
        kind: "word",
        startWordIndex: 3,
        endWordIndex: 3
      }
    ]
  };
  const gold: GoldVerse = {
    ref: raw.ref,
    text: raw.text,
    diagnostics: [],
    placements: [
      {
        id: "1/G3588",
        strong: "G3588",
        kind: "word",
        startWordIndex: 0,
        endWordIndex: 0
      },
      {
        id: "2/G0018",
        strong: "G0018",
        kind: "word",
        startWordIndex: 1,
        endWordIndex: 1
      }
    ]
  };
  return { raw, gold, rows: new Map(source.map((r) => [r.id, r])) };
}
test("an explicit article/head ordinal pair can be scored despite unrelated source ambiguity", () => {
  const { raw, gold, rows } = fixture();
  assert.equal(scoreConjoinIdentity(raw, raw, gold, rows).metric.expected, 1);
  assert.equal(scoreConjoinIdentity(raw, raw, gold, rows).metric.tp, 0);
  const corrected = structuredClone(raw);
  corrected.placements[0].startWordIndex =
    corrected.placements[0].endWordIndex = 0;
  assert.equal(scoreConjoinIdentity(raw, corrected, gold, rows).metric.tp, 1);
});
test("identity eligibility is fixed independently of candidate reading flags", () => {
  const { raw, gold, rows } = fixture();
  const changed = structuredClone(raw);
  changed.units.forEach((u) => {
    u.source.readingUnresolved = !u.source.readingUnresolved;
  });
  assert.deepEqual(
    scoreConjoinIdentity(raw, raw, gold, rows),
    scoreConjoinIdentity(raw, changed, gold, rows)
  );
});
test("an ordinal shift or missing head label cannot certify an article identity", () => {
  const { raw, gold, rows } = fixture();
  gold.placements[1].id = "3/G0018";
  assert.equal(scoreConjoinIdentity(raw, raw, gold, rows).metric.expected, 0);
  gold.placements.pop();
  assert.equal(scoreConjoinIdentity(raw, raw, gold, rows).metric.expected, 0);
});
test("repeated lexical heads and ambiguous source ordinals are excluded", () => {
  const { raw, gold, rows } = fixture();
  raw.units[2].strong = ["G0018"];
  assert.equal(scoreConjoinIdentity(raw, raw, gold, rows).metric.expected, 0);
});
