import assert from "node:assert/strict";
import test from "node:test";

import {
  HEBREW_ENGLISH_CANDIDATE_SCHEMA,
  type HebrewEnglishCandidate,
  type HebrewEnglishSourceAttestation
} from "../src/lexiconV3/hebrewEnglish.js";
import { HEBREW_GLOSS_RESIDUAL_AUDIT } from "../src/lexiconV3/hebrewGlossResidualAudit.js";
import { HEBREW_MEANING_RESIDUAL_AUDIT } from "../src/lexiconV3/hebrewMeaningResidualAudit.js";
import {
  DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS,
  HEBREW_CANONICAL_REVIEWED_CORPUS_DIGEST,
  HEBREW_GLOSS_ARBITRATION_KEYS,
  HEBREW_GLOSS_RESIDUAL_CANONICAL_DIGEST,
  HEBREW_GLOSS_RESIDUAL_HISTORICAL_DIGEST,
  HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST,
  proveHebrewCanonicalGloss,
  proveHebrewCanonicalMeaning,
  type ProveHebrewCanonicalGlossInput,
  type ProveHebrewCanonicalMeaningInput
} from "../src/lexiconV3/hebrewCanonicalPolicy.js";
import { parseTbeshMeaning } from "../src/lexiconV3/tbeshMeaning.js";
import type { StepDirectAuditIdentityInput } from "../src/lexiconV3/stepDirectProof.js";

test("seals the reviewed gloss partitions without duplicates", () => {
  assert.equal(DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS.length, 132);
  assert.equal(new Set(DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS).size, 132);
  assert.equal(HEBREW_GLOSS_ARBITRATION_KEYS.length, 43);
  assert.equal(new Set(HEBREW_GLOSS_ARBITRATION_KEYS).size, 43);
  assert.equal(
    DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS.filter((key) =>
      new Set<string>(HEBREW_GLOSS_ARBITRATION_KEYS).has(key)
    ).length,
    0
  );
});

test("seals all 65 residual gloss decisions and both registry digests", () => {
  assert.equal(HEBREW_GLOSS_RESIDUAL_AUDIT.records.length, 65);
  assert.equal(
    new Set(HEBREW_GLOSS_RESIDUAL_AUDIT.records.map((record) => record.key))
      .size,
    65
  );
  assert.deepEqual(HEBREW_GLOSS_RESIDUAL_AUDIT.classificationCounts, {
    keep_step: 31,
    replace_source_value: 30,
    editorial_reconstruction: 4
  });
  assert.equal(
    HEBREW_GLOSS_RESIDUAL_HISTORICAL_DIGEST,
    HEBREW_GLOSS_RESIDUAL_AUDIT.registryDigest
  );
  assert.equal(
    HEBREW_GLOSS_RESIDUAL_CANONICAL_DIGEST,
    "49013208d2e47fe86a7d86ccfd233158d2a7609da206f94995103288302ec58d"
  );
});

test("publishes the counter-audited H1524B correction only with exact sealed evidence", () => {
  const record = residualGlossRecord("H1524B");
  const candidate = residualCandidate(record);
  const input = {
    ...glossInput(candidate, {
      primary: record.key,
      stepId: record.identity.stepEntryId
    }),
    exactOccurrenceCount: record.occurrenceProof.count,
    exactOccurrenceCorpusDigest: record.occurrenceProof.occurrenceCorpusDigest
  };
  const proof = proveHebrewCanonicalGloss(input);

  assert.equal(proof.proven, true);
  assert.equal(proof.publicationApproved, true);
  assert.equal(proof.action, "residual_replace_source_value");
  assert.equal(proof.value, "age");
  assert.equal(proof.source.family, "Lexicon-V3-Hebrew-Adjudication");
  assert.equal(proof.reviewLedger?.finalAction, "replace_source_value");

  const drifted = proveHebrewCanonicalGloss({
    ...input,
    exactOccurrenceCorpusDigest: "0".repeat(64)
  });
  assert.equal(drifted.proven, false);
  assert.equal(drifted.publicationApproved, false);
  assert.equal(drifted.facts.residualOccurrenceCorpusExact, false);
});

test("keeps the three material counter-audit changes exact", () => {
  assert.deepEqual(
    ["H1524B", "H2933", "H5289"].map((key) => {
      const record = residualGlossRecord(key);
      return [record.key, record.input.stepGloss, record.decision.value];
    }),
    [
      ["H1524B", "youth", "age"],
      ["H2933", "to defile", "to be considered stupid"],
      ["H5289", "newborn", "young one"]
    ]
  );
});

test("replaces a double-audited STEP gloss with the exact pinned definition", () => {
  const candidate = lexicalCandidate({
    primary: "H0101",
    stepId: 11168,
    stepGloss: "vessel",
    definition: "bowl",
    lexicalIndexId: "aee"
  });
  const proof = proveHebrewCanonicalGloss(
    glossInput(candidate, { primary: "H0101", stepId: 11168 })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.action, "replace_lexical_definition");
  assert.equal(proof.value, "bowl");
  assert.equal(proof.source.recordId, "aee");
  assert.equal(proof.reviewLedger?.pass1, "replace_lexical_definition");
  assert.equal(proof.reviewLedger?.pass2, "replace_lexical_definition");
  assert.match(proof.reviewLedger?.stepValueDigest ?? "", sha256Pattern);
  assert.match(proof.reviewLedger?.sourceValueDigest ?? "", sha256Pattern);
  assert.match(proof.digests.proof, sha256Pattern);
});

test("proves a sub-STEP replacement through its exact AugIndex mapping", () => {
  const candidate = lexicalCandidate({
    primary: "H6154M",
    stepId: 19000,
    stepGloss: "STEP fixture",
    definition: "exact augmented definition",
    lexicalIndexId: "H6154a"
  });
  candidate.method = "open-scriptures-augmented-exact";
  candidate.mapping.classicalStrong = "H6154";
  candidate.mapping.augmentedStrong = "H6154a";
  candidate.mapping.augmentedLexicalIndexId = "H6154a";
  candidate.mapping.sourceIdentity.classicalLexical = null;
  candidate.mapping.sourceIdentity.augmentedLexical = {
    augmentedStrong: "H6154a",
    lexicalIndexId: "H6154a",
    mappingUnique: true,
    originalFormExact: true,
    partOfSpeechExact: true
  };
  const proof = proveHebrewCanonicalGloss(
    glossInput(candidate, { primary: "H6154M", stepId: 19000 })
  );

  assert.equal(proof.proven, true);
  assert.equal(proof.publicationApproved, true);
  assert.equal(proof.action, "replace_lexical_definition");
  assert.equal(proof.source.recordId, "H6154a");
  assert.equal(proof.value, "exact augmented definition");
});

test("fails a reviewed definition replacement closed on source or corpus drift", () => {
  const candidate = lexicalCandidate({
    primary: "H0101",
    stepId: 11168,
    stepGloss: "vessel",
    definition: "bowl",
    lexicalIndexId: "aee"
  });
  candidate.mapping.sourceIdentity.classicalLexical!.originalFormExact = false;
  const wrongOriginal = proveHebrewCanonicalGloss(
    glossInput(candidate, { primary: "H0101", stepId: 11168 })
  );
  assert.equal(wrongOriginal.proven, false);
  assert.equal(wrongOriginal.facts.exactLexicalIdentity, false);

  const wrongCorpus = proveHebrewCanonicalGloss({
    ...glossInput(
      lexicalCandidate({
        primary: "H0101",
        stepId: 11168,
        stepGloss: "vessel",
        definition: "bowl",
        lexicalIndexId: "aee"
      }),
      { primary: "H0101", stepId: 11168 }
    ),
    candidateCorpusDigest: "0".repeat(64)
  });
  assert.equal(wrongCorpus.proven, false);
  assert.equal(wrongCorpus.facts.reviewedCandidateCorpusExact, false);
});

test("requires the sealed residual record before publishing a former arbitration case", () => {
  const candidate = lexicalCandidate({
    primary: "H0924",
    stepId: 12000,
    stepGloss: "challenged",
    definition: "other",
    lexicalIndexId: "fixture"
  });
  const proof = proveHebrewCanonicalGloss(
    glossInput(candidate, { primary: "H0924", stepId: 12000 })
  );
  assert.equal(proof.action, "residual_replace_source_value");
  assert.equal(proof.proven, false);
  assert.equal(proof.publicationApproved, false);
});

test("seals the exhaustive 208-meaning adjudication and its five content classes", () => {
  assert.equal(HEBREW_MEANING_RESIDUAL_AUDIT.records.length, 208);
  assert.equal(
    new Set(HEBREW_MEANING_RESIDUAL_AUDIT.records.map((record) => record.key))
      .size,
    208
  );
  assert.deepEqual(HEBREW_MEANING_RESIDUAL_AUDIT.classificationCounts, {
    keep_raw: 132,
    publish_step_specific: 18,
    publish_legacy_general: 1,
    replace_exact_companion: 14,
    editorial_reconstruction: 43
  });
  assert.equal(
    HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST,
    "f088e435398d2ee86b55d7a4fe65b5047596470125b6bfeebcec81fadd956c75"
  );
  assert.equal(
    HEBREW_MEANING_RESIDUAL_AUDIT.registryDigest,
    HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST
  );
});

test("publishes every residual meaning class only through its exact sealed record", () => {
  const fixtures = [
    ["H0010", "a perishing", "publish_raw", "tbesh_raw"],
    [
      "H0041J",
      'A man living at the time of United Monarchy, only mentioned at 1Ki.4.11; <br /> father of: Ben-abinadab (H1125)<br />§ Abinadab = "my father is noble" or "my father is willing"<br />1) a man of Gibeah who sheltered the ark<br />2) second son of Jesse, David\'s older brother<br />3) a son of Saul, slain with him by the Philistines',
      "publish_step_specific",
      "tbesh_step_specific"
    ],
    [
      "H3066G",
      'A man of the tribe of Judah living at the time of the Patriarchs, first mentioned at Gen.29.35; <br /> son of: Israel (H3478) and Leah (H3812); <br /> brother of: Reuben (H7205), Simeon (H8095), Levi (H3878), Issachar (H3485), Zebulun (H2074) and Dinah (H1783); <br /> half-brother of: Dan (H1835H), Naphtali (H5321), Gad (H1410), Asher (H0836), Joseph (H3130) and Benjamin (H1144); married to Bath-shua (H1323I) and Tamar (H8559); <br /> father of: Er (H6147), Onan (H0209), Shelah (H7956), Perez (H6557) and Zerah (H2226I)<br />Another spelling of <i>ye.hu.dah</i> (יְהוּדָה "Judah" H3063)<br /> § in the Jewish language, in Hebrew',
      "publish_legacy_general",
      "tbesh_legacy_general"
    ],
    [
      "H0726",
      'Someone from Aram, an Aramite, Syrian (Kethib), Edomite<br />Group of <i>e.dom</i> (אֱדוֹם "Edom" H0123)',
      "publish_exact_companion",
      "hebrew_english_exact_companion"
    ],
    [
      "H0025",
      'Abi Gibon = "father of Gibeon"<br /> site of great Bamah, location of the tabernacle of the Lord in the high place',
      "publish_editorial_reconstruction",
      "lexicon_v3_hebrew_adjudication"
    ]
  ] as const;

  for (const [key, rawHtml, disposition, source] of fixtures) {
    const proof = proveHebrewCanonicalMeaning(
      residualMeaningInput(key, rawHtml)
    );
    assert.equal(proof.proven, true, key);
    assert.equal(
      proof.disposition,
      disposition,
      `${key}:${JSON.stringify(
        Object.entries(proof.facts).filter(([, value]) => !value)
      )}`
    );
    assert.equal(proof.basis, "sealed_residual_adjudication", key);
    assert.equal(proof.selection?.source, source, key);
    assert.equal(proof.facts.residualSelectedContentExact, true, key);
  }
});

test("fails a residual meaning closed on any input drift", () => {
  const input = residualMeaningInput("H0025", "changed raw");
  const proof = proveHebrewCanonicalMeaning(input);
  assert.equal(proof.proven, true);
  assert.equal(proof.disposition, "block_publication");
  assert.equal(proof.basis, "fail_closed");
  assert.equal(proof.selection, null);
  assert.equal(proof.facts.residualRawHtmlExact, false);
});

test("binds residual meanings to semantic facts rather than unrelated audit-envelope metadata", () => {
  const record = HEBREW_MEANING_RESIDUAL_AUDIT.records.find(
    (candidate) => candidate.key === "H0011"
  );
  assert.ok(record);
  const exact = residualMeaningInput(
    "H0011",
    "Abaddon, a place of destruction, destruction, ruin<br />"
  );
  const envelopeMigrated = proveHebrewCanonicalMeaning({
    ...exact,
    auditRecordDigest: "f".repeat(64)
  });
  assert.equal(envelopeMigrated.proven, true);
  assert.equal(envelopeMigrated.disposition, "publish_raw");
  assert.equal(envelopeMigrated.facts.residualAuditRecordsWellFormed, true);

  const semanticDrift = proveHebrewCanonicalMeaning({
    ...exact,
    rawHtml: `${exact.rawHtml} changed`
  });
  assert.equal(semanticDrift.disposition, "block_publication");
  assert.equal(semanticDrift.facts.residualRawHtmlExact, false);
});

test("publishes supported unsectioned lexeme raw but not a proper legacy notice", () => {
  const lexeme = proveHebrewCanonicalMeaning(
    meaningInput({ rawHtml: "to bind or join", meaningSupportsGloss: true })
  );
  assert.equal(lexeme.proven, true);
  assert.equal(lexeme.disposition, "publish_raw");
  assert.equal(lexeme.basis, "direct_semantic_support");

  const properRaw = "§ Mizpah, a named place";
  const proper = proveHebrewCanonicalMeaning(
    meaningInput({
      rawHtml: properRaw,
      meaningSupportsGloss: true,
      properName: true,
      entityScopeProven: true,
      companionProven: true,
      fallbackPublicationAction: "exact_companion"
    })
  );
  assert.equal(proper.proven, true);
  assert.equal(proper.disposition, "publish_exact_companion");
  assert.equal(proper.basis, "conservative_exact_companion");
});

test("preserves a re-sealed safe section and its section sign", () => {
  const rawHtml = "specific sense § base Strong context";
  const proof = proveHebrewCanonicalMeaning(
    meaningInput({
      rawHtml,
      meaningSupportsGloss: true,
      ledgerCategory: "verified_context"
    })
  );
  assert.equal(proof.proven, true);
  assert.equal(proof.disposition, "publish_raw");
  assert.equal(proof.structure.rawPreserved, true);
  assert.equal(proof.structure.hasSectionSeparator, true);
  assert.equal(proof.structure.sectionSeparatorCount, 1);
  assert.match(proof.structure.stepSpecificDigest ?? "", sha256Pattern);
  assert.match(proof.structure.baseStrongContextDigest ?? "", sha256Pattern);
});

test("contrasts the sealed H1958 raw with positive conflicts", () => {
  const h1958Raw = "lamentation, wailing";
  const h1958 = proveHebrewCanonicalMeaning(
    meaningInput({
      primary: "H1958",
      stepId: 13635,
      rawHtml: h1958Raw,
      auditRecordDigest:
        "86117aba48a3f8cea3f938b2e91ef85058871efc95cda0f83a3bdf1114214d1d",
      meaningSupportsGloss: false
    })
  );
  assert.equal(h1958.proven, true);
  assert.equal(h1958.disposition, "publish_raw");
  assert.equal(h1958.basis, "sealed_semantic_adjudication");

  for (const fixture of [
    {
      primary: "H0099",
      stepId: 11166,
      rawHtml: "stagnant pond",
      auditRecordDigest:
        "7278545fb82d9862262a87cab52b17ce45c4a6a9d8d48319fe9d278ce4627f21"
    },
    {
      primary: "H2337",
      stepId: 14158,
      rawHtml:
        'rock, crevice (a hiding place)<br />Another spelling of <i>cho.ach</i> (חוֹחַ "thistle" H2336)',
      auditRecordDigest:
        "b60810da26d47eb9b57bda2afd4cddd7124a51048937cf4a624f7048cbfd2fb1"
    },
    {
      primary: "H4709G",
      stepId: 17376,
      rawHtml:
        '<br /> § Mizpah = "watchtower"<br />a place in Gilead south of Jabbok',
      auditRecordDigest:
        "2ecb6caef911cb7502f4fa89c556568ab89b0a2013dace36544a98733b0662e9",
      properName: true
    }
  ]) {
    const proof = proveHebrewCanonicalMeaning(
      meaningInput({
        ...fixture,
        meaningSupportsGloss: true,
        companionProven: true,
        fallbackPublicationAction: "exact_companion"
      })
    );
    assert.equal(proof.proven, true, fixture.primary);
    assert.equal(proof.disposition, "publish_exact_companion");
    assert.equal(proof.basis, "positive_conflict_ledger");
  }
});

test("fails a drifted adjudication closed before considering token support", () => {
  const proof = proveHebrewCanonicalMeaning(
    meaningInput({
      primary: "H4709G",
      stepId: 17376,
      rawHtml: "changed raw",
      auditRecordDigest:
        "2ecb6caef911cb7502f4fa89c556568ab89b0a2013dace36544a98733b0662e9",
      properName: true,
      meaningSupportsGloss: true,
      companionProven: true,
      fallbackPublicationAction: "exact_companion"
    })
  );
  assert.equal(proof.proven, true);
  assert.equal(proof.disposition, "block_publication");
  assert.equal(proof.basis, "fail_closed");
  assert.equal(proof.facts.adjudicationDriftDetected, true);
});

function glossInput(
  candidate: HebrewEnglishCandidate,
  identity: { primary: string; stepId: number }
): ProveHebrewCanonicalGlossInput {
  return {
    ...auditIdentity(identity.primary, identity.stepId),
    stepGloss: candidate.english.gloss,
    auditGloss: candidate.english.gloss,
    selectedGloss: candidate.english.gloss,
    meaningSupportsGloss: false,
    candidate,
    candidateCorpusDigest: HEBREW_CANONICAL_REVIEWED_CORPUS_DIGEST,
    tbeshSourceDigest: HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.tbesh,
    tahotSourceDigests: HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.tahot,
    exactOccurrenceCount: 0,
    exactOccurrenceCorpusDigest: "e".repeat(64),
    tahotGlossProofProven: false,
    strictGlossProofProven: false,
    technicalMarkerProofProven: false
  };
}

type ResidualGlossRecord = (typeof HEBREW_GLOSS_RESIDUAL_AUDIT.records)[number];

function residualGlossRecord(key: string): ResidualGlossRecord {
  const record = HEBREW_GLOSS_RESIDUAL_AUDIT.records.find(
    (candidate) => candidate.key === key
  );
  assert.ok(record, key);
  return record;
}

function residualCandidate(
  record: ResidualGlossRecord
): HebrewEnglishCandidate {
  const candidate = lexicalCandidate({
    primary: record.key,
    stepId: record.identity.stepEntryId,
    stepGloss: record.input.stepGloss,
    definition: record.decision.value,
    lexicalIndexId: "fixture"
  });
  candidate.identity.eStrong = record.identity.eStrong;
  candidate.identity.dStrong = record.identity.dStrong;
  candidate.identity.uStrong = record.identity.uStrong;
  candidate.mapping.sourceIdentity.primaryDStrong = record.key;
  candidate.provenance = Object.entries(
    record.exactSourceAttestations as Readonly<Record<string, string>>
  ).map(([locator, contentDigest]) => {
    const separator = locator.indexOf(":");
    return {
      source: locator.slice(
        0,
        separator
      ) as HebrewEnglishSourceAttestation["source"],
      recordId: locator.slice(separator + 1),
      license: "sealed-fixture",
      revision: "sealed-fixture",
      contentDigest
    };
  });
  candidate.recordDigest = record.input.candidateRecordDigest;
  return candidate;
}

type ResidualMeaningRecord =
  (typeof HEBREW_MEANING_RESIDUAL_AUDIT.records)[number];

function residualMeaningInput(
  key: string,
  rawHtml: string
): ProveHebrewCanonicalMeaningInput {
  const record = HEBREW_MEANING_RESIDUAL_AUDIT.records.find(
    (candidate) => candidate.key === key
  ) as ResidualMeaningRecord | undefined;
  assert.ok(record, key);
  const baseIdentity = auditIdentity(key, record.identity.stepEntryId);
  const exactIdentity: StepDirectAuditIdentityInput = {
    ...baseIdentity,
    dStrong: record.identity.dStrong,
    uStrong: record.identity.uStrong,
    auditDStrong: record.identity.dStrong,
    auditUStrong: record.identity.uStrong,
    sourceAuditDStrong: record.identity.dStrong,
    sourceAuditUStrong: record.identity.uStrong,
    auditRecordDigest: record.input.auditRecordDigest
  };
  const candidate = lexicalCandidate({
    primary: key,
    stepId: record.identity.stepEntryId,
    stepGloss: "sealed fixture",
    definition: "sealed fixture",
    lexicalIndexId: "sealed-fixture"
  });
  candidate.identity.eStrong = record.identity.eStrong;
  candidate.identity.dStrong = record.identity.dStrong;
  candidate.identity.uStrong = record.identity.uStrong;
  candidate.english.meaningHtml =
    key === "H0726"
      ? "<p><strong>STEP sense:</strong> Syrian</p><p><strong>Origin:</strong> a clerical error for 130 [H130];</p><p><strong>Meaning:</strong> an Edomite (as in the margin)</p><p><strong>Traditional usage:</strong> Syrian.</p><p><strong>STEP relation:</strong> a group of H0123G</p><p><strong>Open-source relation path:</strong> H726 → H130 → H123G</p>"
      : "<p>Sealed companion fixture</p>";
  candidate.provenance = Object.entries(
    record.exactSourceAttestations as Readonly<Record<string, string>>
  ).map(([locator, contentDigest]) => {
    const separator = locator.indexOf(":");
    return {
      source: locator.slice(
        0,
        separator
      ) as HebrewEnglishSourceAttestation["source"],
      recordId: locator.slice(separator + 1),
      license: "sealed-fixture",
      revision: "sealed-fixture",
      contentDigest
    };
  });
  candidate.recordDigest = record.input.candidateRecordDigest;

  return {
    ...exactIdentity,
    rawHtml,
    tbeshSourceDigest: HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.tbesh,
    auditMeaningHtml: rawHtml,
    selectedMeaningHtml: rawHtml,
    meaningSupportsGloss: false,
    sections: parseTbeshMeaning(rawHtml),
    properName: true,
    entityScopeProven: false,
    ledgerCategory: null,
    companionProven: false,
    rawAssessmentStatus: "review_needed",
    stepSpecificScopeProven: false,
    fallbackPublicationAction: "blocked",
    fallbackPublicationReasonCodes: ["sealed-fixture-counterfactual"],
    candidate,
    candidateCorpusDigest:
      HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.candidateCorpus,
    tahotSourceDigests: HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.tahot,
    exactOccurrenceCount: record.occurrenceProof.count,
    exactOccurrenceCorpusDigest: record.occurrenceProof.occurrenceCorpusDigest
  };
}

function lexicalCandidate(input: {
  primary: string;
  stepId: number;
  stepGloss: string;
  definition: string;
  lexicalIndexId: string;
}): HebrewEnglishCandidate {
  const identity = auditIdentity(input.primary, input.stepId);
  return {
    schema: HEBREW_ENGLISH_CANDIDATE_SCHEMA,
    entryKey: identity.entryKey,
    identity: {
      stepEntryId: input.stepId,
      language: "hebrew",
      baseCode: Number(/\d+/u.exec(input.primary)?.[0] ?? 0),
      eStrong: input.primary,
      dStrong: identity.dStrong,
      uStrong: identity.uStrong,
      original: "א",
      transliteration: "fixture",
      morph: "H:N-M"
    },
    english: {
      gloss: input.stepGloss,
      meaningHtml: `<p><strong>STEP sense:</strong> ${input.stepGloss}</p><p><strong>Exact lexical definition:</strong> ${input.definition}</p>`
    },
    fieldAssessments: {
      gloss: {
        status: "review_needed",
        tier: "review",
        method: "unsupported",
        confidence: 0.72,
        issueCodes: ["step-gloss-open-definition-mismatch"],
        evidence: []
      },
      meaning: {
        status: "validated",
        tier: "auto",
        method: "open-scriptures-lexical-exact",
        confidence: 0.98,
        issueCodes: [],
        evidence: []
      }
    },
    status: "validated",
    method: "open-scriptures-lexical-exact",
    mapping: {
      classicalStrong: input.primary,
      relation: "=",
      relationPath: [],
      relationPaths: [],
      augmentedStrong: null,
      augmentedLexicalIndexId: null,
      tipnrEntityIds: [],
      tipnrEntityReferences: [],
      lexicalIndexIds: [input.lexicalIndexId],
      bdbIds: [],
      unresolvedBdbIds: [],
      sourceIdentity: {
        primaryDStrong: input.primary,
        tipnr: null,
        augmentedLexical: null,
        classicalLexical: {
          lexicalIndexId: input.lexicalIndexId,
          matchCount: 1,
          originalFormExact: true,
          partOfSpeechExact: true
        },
        hebrewStrong: null
      }
    },
    issues: [],
    provenance: [
      {
        source: "OpenScriptures-LexicalIndex",
        recordId: input.lexicalIndexId,
        license: "CC-BY-4.0",
        revision: "21c9add13bc727d3a951361778e97e3ff7afd1ce",
        contentDigest: "b".repeat(64)
      },
      {
        source: "STEP-gloss-anchor",
        recordId: String(input.stepId),
        license: "CC-BY-4.0",
        revision: "local-production-sqlite",
        contentDigest: "c".repeat(64)
      }
    ],
    recordDigest: "d".repeat(64)
  };
}

function meaningInput(
  overrides: Partial<ProveHebrewCanonicalMeaningInput> & {
    primary?: string;
    stepId?: number;
    rawHtml?: string;
  } = {}
): ProveHebrewCanonicalMeaningInput {
  const primary = overrides.primary ?? "H1000";
  const stepId = overrides.stepId ?? 1000;
  const rawHtml = overrides.rawHtml ?? "to bind or join";
  return {
    ...auditIdentity(primary, stepId),
    rawHtml,
    tbeshSourceDigest:
      "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    auditMeaningHtml: rawHtml,
    selectedMeaningHtml: rawHtml,
    meaningSupportsGloss: true,
    sections: parseTbeshMeaning(rawHtml),
    properName: false,
    entityScopeProven: false,
    ledgerCategory: null,
    companionProven: true,
    rawAssessmentStatus: "review_needed",
    stepSpecificScopeProven: false,
    fallbackPublicationAction: "exact_companion",
    fallbackPublicationReasonCodes: [
      "tbesh-replace-unvalidated-unsectioned-with-exact-companion"
    ],
    ...overrides
  };
}

function auditIdentity(
  primary: string,
  stepId: number
): StepDirectAuditIdentityInput {
  const entryKey = `hebrew:${primary}`;
  const dStrong = `${primary} =`;
  return {
    entryKey,
    stepEntryId: stepId,
    primaryDStrong: primary,
    dStrong,
    uStrong: primary,
    auditKey: entryKey,
    auditStepEntryId: stepId,
    auditDStrong: dStrong,
    auditUStrong: primary,
    auditDecisionStatus: "accepted",
    auditCanonicalSource: "TBESH",
    sourceAuditStatus: "source_ok",
    sourceAuditRequiresReview: false,
    sourceAuditEntryKey: entryKey,
    sourceAuditPrimaryDStrong: primary,
    sourceAuditDStrong: dStrong,
    sourceAuditUStrong: primary,
    sourceSelectionStrategy: "step_primary",
    sourceSelectionSource: "STEP",
    sourceSelectionKind: "brief",
    sourceSelectionAutomatic: true,
    auditRecordDigest: "a".repeat(64)
  };
}

const sha256Pattern = /^[a-f0-9]{64}$/u;
