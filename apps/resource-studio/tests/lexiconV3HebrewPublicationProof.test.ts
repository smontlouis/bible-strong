import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import type { HebrewEnglishCandidate } from "../src/lexiconV3/hebrewEnglish.js";
import {
  proveHebrewEnglishGlossCandidate,
  proveHebrewEnglishPublicationCandidate,
  proveStepTechnicalMarker,
  type HebrewEnglishPublicationProofInput
} from "../src/lexiconV3/hebrewPublicationProof.js";

test("proves an exact TIPNR notice through one entity and a TAHOT/EntityRefs overlap", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({
        method: "tipnr-exact-dstrong",
        dStrong: "H0022H = a Part of",
        tipnrEntityIds: [15],
        tipnrEntityReferences: ["2Sa.23.31", "1Ch.11.32"]
      }),
      primaryDStrong: "H22H",
      tahotOccurrences: [
        { dStrong: "H0022H", count: 2, references: ["1Chr.11.32"] }
      ]
    })
  );

  assert.equal(proof.proven, true);
  assert.deepEqual(proof.issueCodes, []);
  assert.equal(proof.normalizedPrimaryDStrong, "H0022H");
  assert.equal(proof.facts.tipnrEntityId, 15);
  assert.equal(proof.facts.exactOccurrenceCount, 2);
  assert.equal(proof.facts.exactOccurrenceIntersectsTipnr, true);
  assert.deepEqual(proof.references.exactTahotOccurrences, ["1Chr.11.32"]);
});

test("proves an exact OpenScriptures lexical candidate with one lexical index", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({
        method: "open-scriptures-lexical-exact",
        dStrong: "H0003 =",
        lexicalIndexIds: ["aab"]
      }),
      primaryDStrong: "H3",
      tahotOccurrences: []
    })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.facts.lexicalIndexId, "aab");
  assert.equal(proof.facts.exactOccurrenceCount, 0);
  assert.equal(proof.facts.exactSourceIdentity, true);
});

test("proves an augmented candidate only when the augmented identity and index agree", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({
        method: "open-scriptures-augmented-exact",
        dStrong: "H0122A =",
        eStrong: "H0122a",
        augmentedStrong: "H122a",
        augmentedLexicalIndexId: "afc",
        lexicalIndexIds: ["afc"]
      }),
      primaryDStrong: "H122A",
      tahotOccurrences: [{ dStrong: "H0122A", references: [] }]
    })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.facts.augmentedStrong, "H122a");
  assert.equal(proof.facts.augmentedStrongExact, true);
});

test("fails closed for empty HTML and non-validated candidate state", () => {
  const invalid = candidate({
    meaningHtml: "<p>&nbsp;</p>",
    status: "review_needed",
    meaningStatus: "review_needed"
  });
  const proof = proveHebrewEnglishPublicationCandidate(
    input({ candidate: invalid })
  );

  assert.equal(proof.proven, false);
  assert.ok(proof.issueCodes.includes("hebrew-publication-meaning-empty"));
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-meaning-not-validated")
  );
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-candidate-not-validated")
  );
});

test("keeps normalized STEP suffix case significant", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({ dStrong: "H2148v =" }),
      primaryDStrong: "H2148V",
      tahotOccurrences: [{ dStrong: "H2148V", references: ["Zech.1.1"] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-primary-dstrong-mismatch")
  );
  assert.equal(proof.normalizedCandidateDStrong, "H2148v");
});

test("rejects ambiguous TIPNR identity, malformed EntityRefs, and no overlap", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({
        tipnrEntityIds: [15, 16],
        tipnrEntityReferences: ["not-a-ref", "2Sa.23.31"]
      }),
      tahotOccurrences: [{ dStrong: "H0022H", references: ["1Chr.11.32"] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-tipnr-entity-ambiguous")
  );
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-tipnr-reference-invalid")
  );
  assert.ok(
    proof.issueCodes.includes(
      "hebrew-publication-tipnr-occurrence-outside-entity"
    )
  );
});

test("rejects a missing or invalid exact TAHOT occurrence", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      tahotOccurrences: [
        { dStrong: "H0022h", count: 0, references: ["1Chr.11.32"] },
        { dStrong: "invalid", references: [] }
      ]
    })
  );

  assert.equal(proof.proven, false);
  assert.ok(
    proof.issueCodes.includes(
      "hebrew-publication-exact-occurrence-dstrong-invalid"
    )
  );
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-exact-occurrence-missing")
  );
});

test("rejects ambiguous lexical mappings and mismatched augmented mappings", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({
        method: "open-scriptures-augmented-exact",
        dStrong: "H0122A =",
        eStrong: "H0122a",
        augmentedStrong: "H122b",
        augmentedLexicalIndexId: "wrong",
        lexicalIndexIds: ["afc", "aez"]
      }),
      primaryDStrong: "H0122A",
      tahotOccurrences: [{ dStrong: "H0122A", references: [] }]
    })
  );

  assert.equal(proof.proven, false);
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-lexical-index-id-ambiguous")
  );
  assert.ok(
    proof.issueCodes.includes("hebrew-publication-augmented-strong-mismatch")
  );
  assert.ok(
    proof.issueCodes.includes(
      "hebrew-publication-augmented-lexical-index-id-mismatch"
    )
  );
});

test("proves an exact HebrewStrong record through identity, form, and POS facts", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({
        method: "hebrew-strong-exact",
        dStrong: "H0042 ="
      }),
      primaryDStrong: "H42",
      tahotOccurrences: []
    })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.facts.sourceRecordId, "H42");
  assert.equal(proof.facts.exactOccurrenceCount, 0);
});

test("rejects every candidate method outside the exact publication allowlist", () => {
  const proof = proveHebrewEnglishPublicationCandidate(
    input({
      candidate: candidate({ method: "hebrew-strong-substep-anchor" }),
      tahotOccurrences: []
    })
  );

  assert.equal(proof.proven, false);
  assert.deepEqual(proof.issueCodes, ["hebrew-publication-method-unsupported"]);
});

test("proves only an exact Strong meaning gloss with complete token coverage", () => {
  const value = candidate({
    method: "open-scriptures-lexical-exact",
    dStrong: "H0046 =",
    lexicalIndexIds: ["abv"]
  });
  value.english.gloss = "mighty";
  value.mapping.sourceIdentity.hebrewStrong = {
    strongId: "H46",
    recordUnique: true,
    primaryDStrongExact: true,
    originalFormExact: true,
    partOfSpeechExact: true
  };
  value.fieldAssessments.gloss = {
    status: "review_needed",
    tier: "candidate_high",
    method: "hebrew-strong-meaning",
    confidence: 0.88,
    issueCodes: ["hebrew-strong-meaning-only-gloss-candidate"],
    evidence: [
      {
        source: "OpenScriptures-HebrewStrong",
        recordId: "H46",
        contentDigest: "a".repeat(64),
        matchKind: "exact-strong-meaning",
        matchedText: "mighty"
      }
    ]
  };

  const proof = proveHebrewEnglishGlossCandidate({
    candidate: value,
    primaryDStrong: "H46",
    tahotOccurrences: []
  });
  assert.equal(proof.proven, true);

  value.fieldAssessments.gloss.evidence[0]!.matchedText = "weak";
  assert.equal(
    proveHebrewEnglishGlossCandidate({
      candidate: value,
      primaryDStrong: "H46",
      tahotOccurrences: []
    }).proven,
    false
  );
});

test("keeps exact TIPNR gloss aliases behind the EntityRefs/TAHOT gate", () => {
  const value = candidate();
  value.english.gloss = "Abiel";
  value.fieldAssessments.gloss = {
    status: "review_needed",
    tier: "review",
    method: "tipnr-exact-alias",
    confidence: 0.88,
    issueCodes: ["tipnr-gloss-non-proper-link-not-lexical-definition"],
    evidence: [
      {
        source: "STEPBible-TIPNR",
        recordId: "H0022H:entity:15",
        contentDigest: "b".repeat(64),
        matchKind: "exact-alias",
        matchedText: "Abiel"
      }
    ]
  };
  const proven = proveHebrewEnglishGlossCandidate({
    candidate: value,
    primaryDStrong: "H22H",
    tahotOccurrences: [{ dStrong: "H0022H", references: ["1Chr.11.32"] }]
  });
  assert.equal(proven.proven, true);

  const rejected = proveHebrewEnglishGlossCandidate({
    candidate: value,
    primaryDStrong: "H22H",
    tahotOccurrences: [{ dStrong: "H0022H", references: ["2Sam.23.30"] }]
  });
  assert.equal(rejected.proven, false);
  assert.ok(
    rejected.issueCodes.includes(
      "hebrew-gloss-publication-tipnr-tahot-intersection-missing"
    )
  );
});

test("attests only exact self-anchored STEP technical markers", () => {
  const exact = proveStepTechnicalMarker({
    baseCode: 9003,
    eStrong: "H9003",
    dStrong: "H9003 =",
    uStrong: "H9003",
    original: "/ב",
    morph: "Prefix",
    gloss: "in/on/with",
    meaningHtml: "Prefix beth: in, among, with"
  });
  assert.equal(exact.proven, true);

  const wrong = proveStepTechnicalMarker({
    baseCode: 9003,
    eStrong: "H9003",
    dStrong: "H9003 = a Meaning of",
    uStrong: "H9004",
    original: "/ב",
    morph: "Prefix",
    gloss: "in/on/with",
    meaningHtml: "Prefix beth"
  });
  assert.equal(wrong.proven, false);
  assert.ok(
    wrong.issueCodes.includes("step-technical-marker-dstrong-mismatch")
  );
  assert.ok(
    wrong.issueCodes.includes("step-technical-marker-ustrong-mismatch")
  );
});

test("attests the complete production H9001-H9049 technical marker corpus", () => {
  const db = new DatabaseSync(
    "data/dictionaries/strong_lexicon.full.production.sqlite",
    { readOnly: true }
  );
  try {
    const rows = db
      .prepare(
        `SELECT baseCode, eStrong, dStrong, uStrong, original, morph, gloss,
                meaning AS meaningHtml
         FROM StepEntries
         WHERE language = 'hebrew' AND baseCode BETWEEN 9001 AND 9049
         ORDER BY baseCode`
      )
      .all() as unknown as Array<
      Parameters<typeof proveStepTechnicalMarker>[0]
    >;
    assert.equal(rows.length, 49);
    assert.deepEqual(
      rows
        .map((row) => ({ row, proof: proveStepTechnicalMarker(row) }))
        .filter(({ proof }) => !proof.proven)
        .map(({ row, proof }) => ({
          baseCode: row.baseCode,
          issueCodes: proof.issueCodes
        })),
      []
    );
  } finally {
    db.close();
  }
});

interface CandidateOverrides {
  method?: HebrewEnglishCandidate["method"];
  dStrong?: string;
  eStrong?: string;
  meaningHtml?: string;
  status?: HebrewEnglishCandidate["status"];
  meaningStatus?: HebrewEnglishCandidate["status"];
  tipnrEntityIds?: number[];
  tipnrEntityReferences?: string[];
  lexicalIndexIds?: string[];
  augmentedStrong?: string | null;
  augmentedLexicalIndexId?: string | null;
}

function candidate(overrides: CandidateOverrides = {}): HebrewEnglishCandidate {
  const method = overrides.method ?? "tipnr-exact-dstrong";
  const status = overrides.status ?? "validated";
  const dStrong = overrides.dStrong ?? "H0022H =";
  const primaryDStrong =
    /^H\d+(?:[A-Za-z]|_[A-Za-z])?/u.exec(dStrong)?.[0] ?? "";
  const entityIds = overrides.tipnrEntityIds ?? [15];
  const lexicalIndexIds = overrides.lexicalIndexIds ?? [];
  const augmentedStrong = overrides.augmentedStrong ?? null;
  const augmentedLexicalIndexId = overrides.augmentedLexicalIndexId ?? null;
  const classicalStrong = /^H0*(\d+)/u.exec(primaryDStrong)?.[1]
    ? `H${Number.parseInt(/^H0*(\d+)/u.exec(primaryDStrong)![1]!, 10)}`
    : null;
  return {
    english: {
      meaningHtml: overrides.meaningHtml ?? "<p>Exact English notice.</p>"
    },
    identity: {
      dStrong,
      eStrong: overrides.eStrong ?? "H0022"
    },
    fieldAssessments: {
      meaning: { status: overrides.meaningStatus ?? status }
    },
    status,
    method,
    mapping: {
      classicalStrong,
      tipnrEntityIds: entityIds,
      tipnrEntityReferences: overrides.tipnrEntityReferences ?? ["1Ch.11.32"],
      lexicalIndexIds,
      augmentedStrong,
      augmentedLexicalIndexId,
      sourceIdentity: {
        primaryDStrong,
        tipnr:
          method === "tipnr-exact-dstrong"
            ? {
                entityId: entityIds.length === 1 ? entityIds[0]! : null,
                entityUnique: entityIds.length === 1
              }
            : null,
        augmentedLexical:
          method === "open-scriptures-augmented-exact" &&
          augmentedStrong &&
          augmentedLexicalIndexId
            ? {
                augmentedStrong,
                lexicalIndexId: augmentedLexicalIndexId,
                mappingUnique: true,
                originalFormExact: true,
                partOfSpeechExact: true
              }
            : null,
        classicalLexical:
          method === "open-scriptures-lexical-exact" &&
          lexicalIndexIds.length === 1
            ? {
                lexicalIndexId: lexicalIndexIds[0]!,
                matchCount: 1,
                originalFormExact: true,
                partOfSpeechExact: true
              }
            : null,
        hebrewStrong:
          method === "hebrew-strong-exact" && classicalStrong
            ? {
                strongId: classicalStrong,
                recordUnique: true,
                primaryDStrongExact: true,
                originalFormExact: true,
                partOfSpeechExact: true
              }
            : null
      }
    }
  } as unknown as HebrewEnglishCandidate;
}

function input(
  overrides: Partial<HebrewEnglishPublicationProofInput>
): HebrewEnglishPublicationProofInput {
  return {
    candidate: candidate(),
    primaryDStrong: "H0022H",
    tahotOccurrences: [{ dStrong: "H0022H", references: ["1Chr.11.32"] }],
    ...overrides
  };
}
