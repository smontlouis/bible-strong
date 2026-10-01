import assert from "node:assert/strict";
import test from "node:test";
import {
  anchorContextHash,
  proposeExactWitnessCarriers,
  resolveDossier,
  validateReview,
  type ResolutionDossier,
  type ResolutionReview
} from "../src/strongResolutionWorkflow.js";
import {
  resolutionSourceHash,
  resolutionTextHash
} from "../src/strongResolution.js";
import { buildResolutionReviewHtml } from "../scripts/strong-resolution-workflow/viewer.js";

function dossier(): ResolutionDossier {
  return {
    edition: "target",
    ref: "Gen.1.1",
    split: "development",
    text: "Le roi dit oui",
    words: ["Le", "roi", "dit", "oui"],
    units: ["H0001", "H0002", "H0003"].map((strong, i) => ({
      unit: {
        id: `u${i}`,
        occurrenceIds: [`o${i}`],
        strong: [strong],
        readingUnresolved: false,
        sourceEvidenceSha256: resolutionTextHash(strong)
      },
      surface: strong,
      gloss: "gloss",
      morphology: "noun",
      sourceFile: "source.txt",
      sourceLine: i + 1
    })),
    placements: [
      {
        id: "p0",
        originalOccurrenceId: "o0",
        strong: "H0001",
        kind: "word",
        startWordIndex: 1,
        endWordIndex: 1
      },
      {
        id: "empty",
        originalOccurrenceId: "o1",
        strong: "H0002",
        kind: "empty",
        insertAfterWordIndex: 1
      },
      {
        id: "p2",
        originalOccurrenceId: "o2",
        strong: "H0003",
        kind: "word",
        startWordIndex: 3,
        endWordIndex: 3
      }
    ],
    witnesses: [
      {
        name: "witness",
        family: "one",
        text: "Le roi dit oui",
        words: ["Le", "roi", "dit", "oui"],
        placements: [
          {
            id: "w1",
            strong: "H0001",
            kind: "word",
            startWordIndex: 1,
            endWordIndex: 1
          },
          {
            id: "w2",
            strong: "H0002",
            kind: "word",
            startWordIndex: 2,
            endWordIndex: 2
          },
          {
            id: "w3",
            strong: "H0003",
            kind: "word",
            startWordIndex: 3,
            endWordIndex: 3
          }
        ]
      }
    ]
  };
}
function review(d = dossier()): ResolutionReview {
  return {
    edition: d.edition,
    ref: d.ref,
    sourceUnitId: "u1",
    sourceUnitSha256: resolutionSourceHash(d.units[1].unit),
    targetTextSha256: resolutionTextHash(d.text),
    reviewer: { id: "test-assistant", kind: "assistant", exposure: "exposed" },
    state: "empty",
    relation: "no-explicit-equivalent",
    targetWordIndices: [],
    carrierWordIndices: [],
    rationale:
      "Synthetic absence decision for contract testing, not a real verse judgment.",
    sources: ["fixture"]
  };
}

test("exact rescue uses unique unoccupied text and preserves baseline on default abstention", () => {
  const d = dossier(),
    before = structuredClone(d);
  assert.equal(proposeExactWitnessCarriers(d).length, 1);
  assert.deepEqual(resolveDossier(d).placements, d.placements);
  const result = resolveDossier(d, [], {
    applyExactWitness: true,
    applyAssistedReviews: false
  });
  assert.equal(result.decisions[1].assurance, "exact-witness-transfer");
  assert.equal(result.placements.length, 3);
  assert.equal(
    result.placements.find((p) => p.originalOccurrenceId === "o1")
      ?.startWordIndex,
    2
  );
  assert.deepEqual(d, before);
  assert.deepEqual(
    result,
    resolveDossier(d, [], {
      applyExactWitness: true,
      applyAssistedReviews: false
    })
  );
});
test("exact rescue rejects elision differences, repetition, occupied spans and conflicting witnesses", () => {
  const d = dossier();
  d.witnesses[0].words[2] = "d’it";
  assert.equal(proposeExactWitnessCarriers(d).length, 0);
  const repeat = dossier();
  repeat.words[0] = "dit";
  assert.equal(proposeExactWitnessCarriers(repeat).length, 0);
  const occupied = dossier();
  occupied.placements[0].endWordIndex = 2;
  assert.equal(proposeExactWitnessCarriers(occupied).length, 0);
  const conflict = dossier();
  const sister = structuredClone(conflict.witnesses[0]);
  sister.name = "sister";
  sister.placements[1] = {
    id: "we",
    strong: "H0002",
    kind: "empty",
    insertAfterWordIndex: 1
  };
  conflict.witnesses.push(sister);
  assert.equal(proposeExactWitnessCarriers(conflict).length, 0);
});
test("Darby-like sister votes count as one family", () => {
  const d = dossier();
  d.witnesses.push({ ...structuredClone(d.witnesses[0]), name: "sister" });
  assert.deepEqual(proposeExactWitnessCarriers(d)[0].families, ["one"]);
});
test("source aliases and repeated source identities do not receive guessed rescues", () => {
  const d = dossier();
  d.units[1].unit.strong.push("H0004");
  assert.equal(proposeExactWitnessCarriers(d).length, 0);
  const repeated = dossier();
  repeated.units[2].unit.strong = ["H0002"];
  assert.equal(proposeExactWitnessCarriers(repeated).length, 0);
});
test("assistant review requires explicit application and never becomes human certainty", () => {
  const d = dossier(),
    r = review(d);
  assert.equal(resolveDossier(d, [r]).decisions[1].state, "unresolved");
  const result = resolveDossier(d, [r], {
    applyAssistedReviews: true,
    applyExactWitness: false
  });
  assert.equal(result.decisions[1].state, "empty");
  assert.equal(result.decisions[1].assurance, "assistant-reviewed");
  assert.equal(result.summary.fullyHumanReviewed, false);
  assert.equal(result.summary.displayComplete, false);
  assert(!result.placements.some((p) => p.originalOccurrenceId === "o1"));
});
test("absence and explicit anchor are independent and stale anchors are rejected", () => {
  const d = dossier(),
    r = review(d);
  r.anchor = {
    insertAfterWordIndex: 1,
    rationale: "After the existing neighbor in this synthetic fixture.",
    contextSha256: anchorContextHash(d)
  };
  const out = resolveDossier(d, [r], {
    applyAssistedReviews: true,
    applyExactWitness: false
  });
  assert.equal(
    out.placements.find((p) => p.originalOccurrenceId === "o1")
      ?.insertAfterWordIndex,
    1
  );
  const changed = structuredClone(d);
  changed.placements[0].endWordIndex = 2;
  assert.throws(
    () => validateReview(changed, r),
    /stale-or-unjustified-anchor/
  );
  assert.equal(out.summary.displayComplete, true);
});
test("review refuses stale text, changed source, another edition, duplicate decisions and unresolved reading", () => {
  const d = dossier(),
    r = review(d);
  for (const bad of [
    { ...r, targetTextSha256: "wrong" },
    { ...r, sourceUnitSha256: "wrong" },
    { ...r, edition: "other" }
  ])
    assert.throws(() => validateReview(d, bad), /misbound/);
  assert.throws(() => resolveDossier(d, [r, r]), /conflicting-review/);
  d.units[1].unit.readingUnresolved = true;
  r.sourceUnitSha256 = resolutionSourceHash(d.units[1].unit);
  assert.throws(() => validateReview(d, r), /unresolved-source-reading/);
});
test("discontinuous relation survives while display stays a separately selected contiguous subset", () => {
  const d = dossier(),
    r = review(d);
  r.state = "visible";
  r.relation = "idiomatic";
  r.targetWordIndices = [0, 2];
  r.carrierWordIndices = [2];
  const out = resolveDossier(d, [r], {
    applyAssistedReviews: true,
    applyExactWitness: false
  });
  assert.deepEqual(out.decisions[1].targetWordIndices, [0, 2]);
  assert.equal(out.decisions[1].display?.startWordIndex, 2);
  assert.equal(out.decisions[1].display?.endWordIndex, 2);
  assert.throws(
    () => validateReview(d, { ...r, carrierWordIndices: [0, 2] }),
    /invalid-display-subset/
  );
  assert.throws(
    () => validateReview(d, { ...r, carrierWordIndices: [1] }),
    /invalid-display-subset/
  );
});
test("an explicit unresolved review removes obsolete visible assertions", () => {
  const d = dossier(),
    r = review(d);
  r.sourceUnitId = "u0";
  r.sourceUnitSha256 = resolutionSourceHash(d.units[0].unit);
  r.state = "unresolved";
  r.relation = "uncertain";
  const out = resolveDossier(d, [r], {
    applyAssistedReviews: true,
    applyExactWitness: false
  });
  assert.equal(out.decisions[0].state, "unresolved");
  assert(!out.placements.some((p) => p.originalOccurrenceId === "o0"));
});
test("invalid evidence, relation or out-of-bounds tokens fail closed", () => {
  const d = dossier(),
    r = review(d);
  assert.throws(
    () => validateReview(d, { ...r, sources: [] }),
    /missing-review-evidence/
  );
  assert.throws(
    () => validateReview(d, { ...r, state: "visible" }),
    /relation-state-mismatch/
  );
  assert.throws(
    () => validateReview(d, { ...r, relation: "grammatical" }),
    /absence-relation-mismatch/
  );
  assert.throws(
    () => validateReview(d, { ...r, targetWordIndices: [99] }),
    /invalid-reviewed-tokens/
  );
});
test("dossier token drift, duplicate source owners and corrupt baseline boundaries are rejected", () => {
  const d = dossier();
  d.words[0] = "drift";
  assert.throws(() => resolveDossier(d), /token-drift/);
  const duplicate = dossier();
  duplicate.units[0].unit.occurrenceIds = ["o1"];
  assert.throws(() => resolveDossier(duplicate), /duplicate-source-owner/);
  const bounds = dossier();
  bounds.placements[0].endWordIndex = 99;
  assert.throws(() => resolveDossier(bounds), /invalid-carrier-span/);
});
test("offline dossier escapes embedded script delimiters and disables network requests", () => {
  const d = dossier();
  d.units[0].gloss = "</script><script>alert('injection')</script>";
  const html = buildResolutionReviewHtml([d], [resolveDossier(d)]);
  assert(!html.includes(d.units[0].gloss));
  assert(html.includes("connect-src 'none'"));
  assert(html.includes("\\u003c/script>"));
});
