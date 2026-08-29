import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeExactDStrong,
  normalizeStepOrOsisVerseReference,
  proveStrictTbeshTipnrScope,
  type TbeshTipnrScopeProofInput
} from "../src/lexiconV3/tbeshScopeProof.js";

test("normalizes STEP and OSIS references at verse scope", () => {
  assert.equal(normalizeStepOrOsisVerseReference("1Ki.14.31"), "1Kgs.14.31");
  assert.equal(normalizeStepOrOsisVerseReference("1Kgs.14:31"), "1Kgs.14.31");
  assert.equal(normalizeStepOrOsisVerseReference("Ezk.11.1b"), "Ezek.11.1");
  assert.equal(normalizeStepOrOsisVerseReference("Sng.6.12"), "Song.6.12");
  assert.equal(
    normalizeStepOrOsisVerseReference({
      book: "2Sa",
      chapter: 23,
      verse: 31,
      suffix: "a"
    }),
    "2Sam.23.31"
  );
  assert.equal(normalizeStepOrOsisVerseReference("Unknown.1.1"), null);
  assert.equal(normalizeStepOrOsisVerseReference("Gen.0.1"), null);
});

test("normalizes dStrong padding without destroying suffix case", () => {
  assert.equal(normalizeExactDStrong("H22H"), "H0022H");
  assert.equal(normalizeExactDStrong("h2148v"), "H2148v");
  assert.equal(normalizeExactDStrong("H2148V"), "H2148V");
  assert.equal(normalizeExactDStrong("H12A_b"), "H0012A_b");
  assert.equal(normalizeExactDStrong("H0000"), null);
});

test("proves H0022H when citation and exact occurrence are different refs of one entity", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H0022H",
      tipnrEntityIds: [15, 15],
      tipnrEntityReferences: ["2Sa.23.31", "1Ch.11.32"],
      stepSpecificCitations: ["2Sam.23.31"],
      tahotOccurrences: [{ dStrong: "H22H", references: ["1Chr.11.32"] }]
    })
  );

  assert.equal(proof.proven, true);
  assert.deepEqual(proof.issueCodes, []);
  assert.equal(proof.tipnrEntityId, 15);
  assert.deepEqual(proof.facts, {
    exactTipnrIdentity: true,
    allSpecificCitationsBelongToEntity: true,
    exactOccurrenceCount: 1,
    exactOccurrenceIntersectsEntity: true
  });
});

test("proves H0029I while keeping shared family context out of the API", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H0029I",
      tipnrEntityIds: [33],
      tipnrEntityReferences: ["1Ki.14.31", "2Ch.13.1"],
      stepSpecificCitations: ["1Kgs.14.31"],
      tahotOccurrences: [{ dStrong: "H0029I", references: ["2Chr.13.1"] }]
    })
  );

  assert.equal(proof.proven, true);
  assert.deepEqual(proof.references.stepSpecificCitations, ["1Kgs.14.31"]);
  assert.equal(
    "legacyGeneralReferences" in proof.references,
    false,
    "family-tail references must not be admissible proof inputs"
  );
});

test("allows a section without citations when H1141R is tied to its entity by TAHOT", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H1141R",
      tipnrEntityIds: [492],
      tipnrEntityReferences: [
        { book: "Ezk", chapter: 11, verse: 1 },
        { book: "Ezk", chapter: 11, verse: 13 }
      ],
      stepSpecificCitations: [],
      tahotOccurrences: [
        {
          dStrong: "H1141R",
          count: 2,
          references: ["Ezek.11.1", "Ezek.11.13"]
        }
      ]
    })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.facts.allSpecificCitationsBelongToEntity, true);
  assert.equal(proof.facts.exactOccurrenceCount, 2);
});

test("accepts a valid exact TAHOT overlap alongside a Psalm superscription ref", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H0288G",
      tipnrEntityIds: [147],
      tipnrEntityReferences: ["1Sa.14.3", "1Sa.21.2", "Psa.52.1"],
      stepSpecificCitations: ["1Sam.14.3"],
      tahotOccurrences: [
        {
          dStrong: "H0288G",
          references: ["Ps.52.0", "1Sam.21.2"]
        }
      ]
    })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.facts.exactOccurrenceIntersectsEntity, true);
});

test("rejects H3063M when specific citations do not belong to the exact entity", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H3063M",
      tipnrEntityIds: [1201],
      tipnrEntityReferences: ["Neh.12.8"],
      stepSpecificCitations: ["Neh.8.7", "Ezr.3.9"],
      tahotOccurrences: [{ dStrong: "H3063M", references: ["Neh.12.8"] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.ok(
    proof.issueCodes.includes("tbesh-scope-specific-citation-outside-tipnr")
  );
  assert.equal(proof.facts.exactOccurrenceIntersectsEntity, true);
});

test("rejects H5371H when exact TAHOT occurrences miss the entity refs", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H5371H",
      tipnrEntityIds: [2170],
      tipnrEntityReferences: [
        { book: "Jer", chapter: 39, verse: 3, suffix: "a" }
      ],
      stepSpecificCitations: ["Jer.39.3b"],
      tahotOccurrences: [{ dStrong: "H5371H", references: ["Jer.39.13"] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.ok(
    proof.issueCodes.includes("tbesh-scope-exact-occurrence-outside-tipnr")
  );
  assert.equal(proof.facts.allSpecificCitationsBelongToEntity, true);
});

test("keeps lowercase and uppercase STEP suffix identities distinct", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      primaryDStrong: "H2148v",
      tipnrEntityIds: [2982],
      tipnrEntityReferences: ["Zec.1.1"],
      stepSpecificCitations: ["Zech.1.1"],
      tahotOccurrences: [{ dStrong: "H2148V", references: ["Zech.1.1"] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.equal(proof.facts.exactOccurrenceCount, 0);
  assert.ok(proof.issueCodes.includes("tbesh-scope-exact-occurrence-missing"));
});

test("fails closed for ambiguous TIPNR identity and lexical H5081G", () => {
  const ambiguous = proveStrictTbeshTipnrScope(
    input({
      tipnrEntityIds: [10, 11]
    })
  );
  assert.equal(ambiguous.proven, false);
  assert.ok(
    ambiguous.issueCodes.includes("tbesh-scope-tipnr-identity-not-exact")
  );

  const lexical = proveStrictTbeshTipnrScope(
    input({
      properName: false,
      primaryDStrong: "H5081G",
      tipnrEntityIds: [500],
      tipnrEntityReferences: ["Sng.6.12"],
      stepSpecificCitations: [],
      tahotOccurrences: [{ dStrong: "H5081G", references: ["Song.6.12"] }]
    })
  );
  assert.equal(lexical.proven, false);
  assert.ok(lexical.issueCodes.includes("tbesh-scope-not-proper-name"));
});

test("fails closed for legacy-only sections and malformed evidence refs", () => {
  const proof = proveStrictTbeshTipnrScope(
    input({
      sectionClassification: "legacy_only",
      tipnrEntityReferences: ["not-a-reference"],
      stepSpecificCitations: ["still-not-a-reference"],
      tahotOccurrences: [{ dStrong: "H0022H", references: ["also-invalid"] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.deepEqual(proof.issueCodes, [
    "tbesh-scope-exact-occurrence-outside-tipnr",
    "tbesh-scope-exact-occurrence-reference-invalid",
    "tbesh-scope-section-not-both",
    "tbesh-scope-specific-citation-invalid",
    "tbesh-scope-specific-citation-outside-tipnr",
    "tbesh-scope-tipnr-reference-invalid",
    "tbesh-scope-tipnr-references-missing"
  ]);
});

function input(
  overrides: Partial<TbeshTipnrScopeProofInput>
): TbeshTipnrScopeProofInput {
  return {
    sectionClassification: "both",
    properName: true,
    primaryDStrong: "H0022H",
    tipnrEntityIds: [15],
    tipnrEntityReferences: ["2Sa.23.31", "1Ch.11.32"],
    stepSpecificCitations: ["2Sa.23.31"],
    tahotOccurrences: [{ dStrong: "H0022H", references: ["1Ch.11.32"] }],
    ...overrides
  };
}
