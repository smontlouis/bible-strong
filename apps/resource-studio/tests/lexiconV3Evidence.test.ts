import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildFrenchOccurrenceGlossEvidence,
  selectCanonicalEnglish
} from "../scripts/buildLexiconV3FrenchPackets.js";

import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  digestEnglishGreekReconstructionCatalog,
  CONFIRMED_BRIEF_SOURCE_CONFLICTS,
  CONFIRMED_TFLSJ_SOURCE_CONFLICTS,
  CURATED_AUTO_BRIEF_RETENTIONS,
  CURATED_AUTO_SOURCE_VARIANTS,
  CURATED_AUTO_TFLSJ_BUNDLE_REPAIRS,
  CURATED_AUTO_TFLSJ_REPAIRS,
  CURATED_AUTO_TFLSJ_SUPPLEMENTAL_QUARANTINES,
  CURATED_BUNDLED_NOTICE_ENTRIES,
  CURATED_GREEK_ENGLISH_REPAIR_RULES,
  CURATED_GREEK_REQUIRED_REVIEW_ENTRIES,
  CURATED_ISOLATED_SOURCE_ISSUES,
  CURATED_SOURCE_SNAPSHOT_DIGESTS,
  CURATED_SOURCE_VARIANT_ENTRIES,
  ENGLISH_EVIDENCE_SCHEMA_VERSION,
  extractSourceReferences,
  isCuratedAutoValidatedEnglishEvidence,
  normalizeLexiconHeadword,
  PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_DIGEST,
  summarizeEnglishEvidenceAudit,
  validateEnglishAlternateStrongAliasEvidence,
  validateEnglishExactOccurrenceEvidence,
  validateEnglishGreekReconstructionEvidence,
  verifyEnglishGreekReconstructionCatalog,
  type EnglishEvidenceAuditRecord,
  type EnglishEvidenceSourceDigests,
  type EnglishGreekReconstructionCatalog,
  type EnglishLexiconEntry,
  type EnglishLexiconResource
} from "../src/lexiconV3/evidence.js";
import {
  GREEK_RECONSTRUCTION_SOURCE_DIGESTS,
  PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST
} from "../src/lexiconV3/greekReconstruction.js";
import {
  readStepOriginalTokens,
  type StepOriginalToken
} from "../src/stepOriginals.js";

const DIGESTS: EnglishEvidenceSourceDigests = {
  database: "db-digest",
  TBESG: CURATED_SOURCE_SNAPSHOT_DIGESTS.TBESG,
  TBESH: "tbesh-digest",
  TFLSJ: CURATED_SOURCE_SNAPSHOT_DIGESTS.TFLSJ,
  TAGNT: { ...CURATED_SOURCE_SNAPSHOT_DIGESTS.TAGNT },
  TAHOT: { "TAHOT fixture.txt": "tahot-digest" }
};

const GREEK_RECONSTRUCTION_CATALOG = JSON.parse(
  readFileSync(
    new URL(
      "../src/lexiconV3/sources/greek-reconstruction-witness-catalog.json",
      import.meta.url
    ),
    "utf8"
  )
) as EnglishGreekReconstructionCatalog;

const GREEK_RECONSTRUCTION_DIGESTS: EnglishEvidenceSourceDigests = {
  ...DIGESTS,
  database: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.stepDatabase,
  TBESH: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tbesh,
  greekReconstruction: {
    witnessCatalog: GREEK_RECONSTRUCTION_CATALOG.catalogDigest,
    witnessCatalogFile: "a".repeat(64),
    tipnrPeople: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tipnrPeople,
    legacyDatabase: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.legacyDatabase,
    perseusArtifact: PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST,
    perseusArtifactFile: "b".repeat(64),
    perseusSourceFile: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.perseusLsj,
    g20464AdjudicationArtifact:
      PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST,
    g20464AdjudicationArtifactFile:
      PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST,
    g20464AdjudicationPayload:
      PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST,
    kaikkiFrench: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.kaikkiFrench
  }
};

const BRIEF_CONFLICT_FIXTURES = [
  {
    target: "G0062",
    targetOriginal: "ἀγράμματος",
    owner: "G0063",
    ownerOriginal: "ἀγραυλέω"
  },
  {
    target: "G1623",
    targetOriginal: "ἕκτος",
    owner: "G1622",
    ownerOriginal: "ἐκτός"
  },
  {
    target: "G1633",
    targetOriginal: "ἐκχωρέω",
    owner: "G1632",
    ownerOriginal: "ἐκχύννω"
  },
  {
    target: "G2600",
    targetOriginal: "κατάβασις",
    owner: "G6046",
    ownerOriginal: "καταβαρύνω"
  },
  {
    target: "G3426",
    targetOriginal: "μόδιος",
    owner: "G3428",
    ownerOriginal: "μοιχαλίς"
  },
  {
    target: "G4776",
    targetOriginal: "συγκαθίζω",
    owner: "G8731",
    ownerOriginal: "περικαθίζω"
  },
  {
    target: "G4821",
    targetOriginal: "συμβασιλεύω",
    owner: "G4823",
    ownerOriginal: "συμβουλεύω"
  },
  {
    target: "G4844",
    targetOriginal: "συμπίνω",
    owner: "G4849",
    ownerOriginal: "συμπόσιον"
  }
] as const;

const TFLSJ_CONFLICT_FIXTURES = [
  {
    target: "G1561",
    targetOriginal: "ἐκδοχή",
    owner: "G1391",
    ownerOriginal: "δόξα"
  },
  {
    target: "G3327",
    targetOriginal: "μεταβαίνω",
    owner: "G3328",
    ownerOriginal: "μεταβάλλω"
  },
  {
    target: "G4895",
    targetOriginal: "σύνειμι",
    owner: "G4896",
    ownerOriginal: "σύνειμι"
  },
  {
    target: "G4896",
    targetOriginal: "σύνειμι",
    owner: "G4895",
    ownerOriginal: "σύνειμι"
  }
] as const;

test("preserves Greek breathing while ignoring ordinary accents", () => {
  assert.notEqual(
    normalizeLexiconHeadword("ἕκτος", "greek"),
    normalizeLexiconHeadword("ἐκτός", "greek")
  );
  assert.equal(
    normalizeLexiconHeadword("πού", "greek"),
    normalizeLexiconHeadword("που", "greek")
  );
});

test("normalizes brief and TFLSJ scripture references to OSIS keys", () => {
  assert.deepEqual(
    extractSourceReferences(
      "<b>ἐκτός</b> Mat.23:26; 1Co.14:5; Neh.11.4; Mat.23:26",
      "TBESG"
    ),
    ["Matt.23.26", "1Cor.14.5", "Neh.11.4"]
  );
  assert.deepEqual(
    extractSourceReferences(
      "[NT (NT.Matt.23.26, NT.1Cor.14.5, NT.Matt.23.26)]",
      "TFLSJ"
    ),
    ["Matt.23.26", "1Cor.14.5"]
  );
});

test("preserves the rights-cleared TBESH meaning in the evidence artifact", () => {
  const entry: EnglishLexiconEntry = {
    stepEntryId: 1,
    baseCode: 1,
    language: "hebrew",
    eStrong: "H0001",
    dStrong: "H0001 =",
    uStrong: "H0001",
    original: "אָב",
    transliteration: "av",
    morph: "H:N-M",
    gloss: "father",
    meaning: "<b>אָב</b>, father."
  };
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [],
    sourceDigests: DIGESTS
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);
  assert.equal(record.meaning, "<b>אָב</b>, father.");
  assert.equal(
    record.evidence.brief.issues.some((issue) => issue.includes("redacted")),
    false
  );
  assert.ok(JSON.stringify(record).includes("<b>אָב</b>, father."));
});

test("pins exact TAHOT occurrence glosses, locators, and corpus digest in schema v9", () => {
  const entry: EnglishLexiconEntry = {
    stepEntryId: 2,
    baseCode: 1,
    language: "hebrew",
    eStrong: "H0001",
    dStrong: "H0001G =",
    uStrong: "H0001G",
    original: "אָב",
    transliteration: "av",
    morph: "H:N-M",
    gloss: "father",
    meaning: "<b>אָב</b>, father."
  };
  const token: StepOriginalToken = {
    ...makeToken("Gen.1.1", "H0001G"),
    source: "TAHOT",
    tokenIndex: 3,
    gloss: "[was] a father"
  };
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [token],
    sourceDigests: DIGESTS
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.schemaVersion, ENGLISH_EVIDENCE_SCHEMA_VERSION);
  assert.equal(record.evidence.exactOccurrence.count, 1);
  assert.equal(record.evidence.exactOccurrence.occurrences.length, 1);
  assert.deepEqual(record.evidence.exactOccurrence.occurrences[0], {
    dStrong: "H0001G",
    gloss: "[was] a father",
    locator: "TAHOT:Gen.1.1#03",
    digest: record.evidence.exactOccurrence.occurrences[0]!.digest
  });
  assert.match(
    record.evidence.exactOccurrence.occurrences[0]!.digest,
    /^[a-f0-9]{64}$/u
  );
  assert.match(
    record.evidence.exactOccurrence.occurrenceCorpusDigest,
    /^[a-f0-9]{64}$/u
  );
  assert.deepEqual(validateEnglishExactOccurrenceEvidence(record), []);

  const forged = structuredClone(record);
  forged.evidence.exactOccurrence.occurrences[0]!.gloss = "ancestor";
  assert.deepEqual(validateEnglishExactOccurrenceEvidence(forged), [
    "english-exact-occurrence-gloss-digest-mismatch"
  ]);
});

test("keeps G0567 exact dStrong empty while proving and publishing its six form aliases", async () => {
  const entry: EnglishLexiconEntry = {
    stepEntryId: 585,
    baseCode: 567,
    language: "greek",
    eStrong: "G0567",
    dStrong: "G0567 = a Form of",
    uStrong: "G0568",
    original: "ἀπέχομαι",
    transliteration: "apechomai",
    morph: "G:V",
    gloss: "to refrain/",
    meaning: "refrain, receive/be far, keep away from",
    classicTransliteration: "",
    pronunciation: "ap-ekh'-om-ahee"
  };
  const allTokens = await readStepOriginalTokens(
    fileURLToPath(
      new URL(
        "../data/external/stepbible/amalgamated/TAGNT Act-Rev.txt",
        import.meta.url
      )
    )
  );
  const tokens = allTokens.filter((token) => token.strongByBase.has("G0567"));
  assert.equal(tokens.length, 6);

  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens,
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.evidence.exactOccurrence.stepStrong, "G0567");
  assert.equal(record.evidence.exactOccurrence.count, 0);
  assert.deepEqual(record.evidence.exactOccurrence.references, []);
  assert.deepEqual(record.evidence.exactOccurrence.occurrences, []);
  assert.equal(record.evidence.alternateStrongAlias?.aliasStrong, "G0567");
  assert.equal(record.evidence.alternateStrongAlias?.primaryDStrong, "G0568");
  assert.equal(record.evidence.alternateStrongAlias?.count, 6);
  assert.deepEqual(record.evidence.alternateStrongAlias?.references, [
    "1Pet.2.11",
    "1Thess.4.3",
    "1Thess.5.22",
    "1Tim.4.3",
    "Acts.15.20",
    "Acts.15.29"
  ]);
  assert.deepEqual(
    Object.fromEntries(
      [
        ...record.evidence.alternateStrongAlias!.occurrences.reduce(
          (counts, occurrence) =>
            counts.set(
              occurrence.morph,
              (counts.get(occurrence.morph) ?? 0) + 1
            ),
          new Map<string, number>()
        )
      ].sort(([left], [right]) => left.localeCompare(right))
    ),
    { "V-PMM-2P": 1, "V-PMN": 5 }
  );
  assert.equal(record.reconstruction?.applied, true);
  assert.equal(record.gloss, "to abstain");
  assert.match(record.meaning, /middle-voice form/u);
  assert.doesNotMatch(
    record.meaning,
    /have in full|receive|be distant|enough/iu
  );
  assert.deepEqual(validateEnglishExactOccurrenceEvidence(record), []);
  assert.deepEqual(validateEnglishAlternateStrongAliasEvidence(record), []);
  assert.deepEqual(validateEnglishGreekReconstructionEvidence(record), []);

  const frenchOccurrenceGlosses = buildFrenchOccurrenceGlossEvidence(record);
  assert.equal(
    frenchOccurrenceGlosses.reduce((total, item) => total + item.count, 0),
    6
  );
  assert.ok(
    frenchOccurrenceGlosses.every(
      (item) => item.source === "TAGNT:alternateStrongAlias:G0567->G0568"
    )
  );

  const forgedVoice = structuredClone(record);
  forgedVoice.evidence.alternateStrongAlias!.occurrences[0]!.morph = "V-PAI-3S";
  const tamperIssues = validateEnglishAlternateStrongAliasEvidence(forgedVoice);
  assert.ok(
    tamperIssues.includes("english-g0567-alternate-strong-alias-voice-mismatch")
  );
  assert.ok(
    validateEnglishGreekReconstructionEvidence(forgedVoice).some((issue) =>
      issue.startsWith("english-greek-reconstruction-alias-invalid:")
    )
  );

  const forgedCount = structuredClone(record);
  forgedCount.evidence.alternateStrongAlias!.count = 5;
  assert.ok(
    validateEnglishAlternateStrongAliasEvidence(forgedCount).includes(
      "english-g0567-alternate-strong-alias-count-mismatch"
    )
  );

  const forgedRelation = structuredClone(record);
  (
    forgedRelation.evidence.alternateStrongAlias as unknown as {
      relationKind: string;
    }
  ).relationKind = "variant_of";
  assert.ok(
    validateEnglishAlternateStrongAliasEvidence(forgedRelation).includes(
      "english-alternate-strong-alias-relation-kind-mismatch"
    )
  );

  const forgedTarget = structuredClone(record);
  forgedTarget.evidence.alternateStrongAlias!.primaryDStrong = "G0569";
  assert.ok(
    validateEnglishAlternateStrongAliasEvidence(forgedTarget).includes(
      "english-g0567-alternate-strong-alias-target-mismatch"
    )
  );

  const forgedReferences = structuredClone(record);
  forgedReferences.evidence.alternateStrongAlias!.references.pop();
  assert.ok(
    validateEnglishAlternateStrongAliasEvidence(forgedReferences).includes(
      "english-g0567-alternate-strong-alias-references-mismatch"
    )
  );

  const forgedExactChannel = structuredClone(record);
  forgedExactChannel.evidence.exactOccurrence.count = 1;
  assert.ok(
    validateEnglishAlternateStrongAliasEvidence(forgedExactChannel).includes(
      "english-g0567-exact-occurrence-channel-not-empty"
    )
  );

  const missingChannel = structuredClone(record);
  delete (
    missingChannel.evidence as Partial<EnglishEvidenceAuditRecord["evidence"]>
  ).alternateStrongAlias;
  assert.deepEqual(
    validateEnglishAlternateStrongAliasEvidence(missingChannel),
    ["english-alternate-strong-alias-evidence-missing"]
  );
});

test("verifies the independent Greek witness catalog against pinned global sources", () => {
  const verification = verifyEnglishGreekReconstructionCatalog(
    GREEK_RECONSTRUCTION_CATALOG,
    GREEK_RECONSTRUCTION_DIGESTS
  );
  assert.equal(verification.valid, true);
  assert.deepEqual(verification.issues, []);
  assert.equal(
    verification.computedDigest,
    PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_DIGEST
  );
  assert.equal(
    digestEnglishGreekReconstructionCatalog(GREEK_RECONSTRUCTION_CATALOG),
    PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_DIGEST
  );
});

test("requires the real G20464 adjudication artifact file and its verified payload at runtime", () => {
  const changedFileDigests = structuredClone(GREEK_RECONSTRUCTION_DIGESTS);
  changedFileDigests.greekReconstruction!.g20464AdjudicationArtifactFile =
    "0".repeat(64);
  const changedFileVerification = verifyEnglishGreekReconstructionCatalog(
    GREEK_RECONSTRUCTION_CATALOG,
    changedFileDigests
  );
  assert.equal(changedFileVerification.valid, false);
  assert.ok(
    changedFileVerification.issues.includes(
      "greek-reconstruction-global-source-mismatch:internal-adjudication.G20464.artifact-file"
    )
  );

  const target = makeG20464ReconstructionEntry();
  const validContext = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [],
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const validRecord = auditEnglishEvidenceEntry(target, [], validContext);
  assert.equal(validRecord.reconstruction?.applied, true);
  assert.equal(validRecord.decision.status, "repaired");
  assert.equal(validRecord.morph, "G:N-M");
  assert.equal(validRecord.gloss, "king bee; priest of Artemis at Ephesus");
  assert.deepEqual(validateEnglishGreekReconstructionEvidence(validRecord), []);

  const missingPayloadDigests = structuredClone(GREEK_RECONSTRUCTION_DIGESTS);
  missingPayloadDigests.greekReconstruction!.g20464AdjudicationPayload = "";
  const missingPayloadContext = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [],
    sourceDigests: missingPayloadDigests,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const missingPayloadRecord = auditEnglishEvidenceEntry(
    target,
    [],
    missingPayloadContext
  );
  assert.equal(missingPayloadRecord.reconstruction?.applied, false);
  assert.equal(missingPayloadRecord.decision.status, "quarantined");
  assert.ok(
    missingPayloadRecord.reconstruction?.blockers.includes(
      "greek:G20464:internal-adjudication-payload-missing"
    )
  );
  assert.ok(
    missingPayloadRecord.reconstruction?.proof.reasonCodes.includes(
      "greek-reconstruction-witness-digest-set-mismatch"
    )
  );

  const changedPayloadDigests = structuredClone(GREEK_RECONSTRUCTION_DIGESTS);
  changedPayloadDigests.greekReconstruction!.g20464AdjudicationPayload =
    "1".repeat(64);
  const changedPayloadContext = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [],
    sourceDigests: changedPayloadDigests,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const changedPayloadRecord = auditEnglishEvidenceEntry(
    target,
    [],
    changedPayloadContext
  );
  assert.equal(changedPayloadRecord.reconstruction?.applied, false);
  assert.ok(
    changedPayloadRecord.reconstruction?.blockers.includes(
      "greek:G20464:internal-adjudication-payload-digest-mismatch"
    )
  );
  assert.ok(
    changedPayloadRecord.reconstruction?.proof.reasonCodes.includes(
      "greek-reconstruction-witness-digest-mismatch"
    )
  );
});

test("binds G8216 and G20765 reconstructions to distinct empty exact-dStrong corpora", () => {
  const entries = [
    makeG8216ReconstructionEntry(),
    makeG20765ReconstructionEntry()
  ];
  const context = buildEnglishEvidenceContext({
    entries,
    tokens: [],
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const records = entries.map((entry) =>
    auditEnglishEvidenceEntry(entry, [], context)
  );

  assert.deepEqual(
    records.map((record) => ({
      key: record.key,
      gloss: record.gloss,
      count: record.evidence.exactOccurrence.count,
      corpusDigest: record.evidence.exactOccurrence.occurrenceCorpusDigest,
      applied: record.reconstruction?.applied,
      status: record.decision.status
    })),
    [
      {
        key: "greek:G8216",
        gloss: "mother!",
        count: 0,
        corpusDigest:
          "06889d7c68de7bed23dab02a4a38171656defa45bbba45f8702135d449936f85",
        applied: true,
        status: "repaired"
      },
      {
        key: "greek:G20765",
        gloss: "a plant cutting",
        count: 0,
        corpusDigest:
          "7e5d2c34968773c22ecb99091729410f9c74bc5352ed1866a492da7230d7b083",
        applied: true,
        status: "repaired"
      }
    ]
  );
  for (const record of records) {
    assert.deepEqual(record.evidence.exactOccurrence.references, []);
    assert.deepEqual(record.evidence.exactOccurrence.occurrences, []);
    assert.deepEqual(validateEnglishExactOccurrenceEvidence(record), []);
    assert.deepEqual(validateEnglishGreekReconstructionEvidence(record), []);
    const selected = selectCanonicalEnglish(record);
    assert.equal(selected.status, "validated");
    assert.deepEqual(selected.sources, ["GREEK_RECONSTRUCTION"]);
    assert.deepEqual(buildFrenchOccurrenceGlossEvidence(record), []);
  }
  assert.notEqual(
    records[0]!.evidence.exactOccurrence.occurrenceCorpusDigest,
    records[1]!.evidence.exactOccurrence.occurrenceCorpusDigest
  );

  const forgedCorpus = structuredClone(records[0]!);
  forgedCorpus.evidence.exactOccurrence.occurrenceCorpusDigest = "0".repeat(64);
  assert.ok(
    validateEnglishGreekReconstructionEvidence(forgedCorpus).includes(
      "english-greek-reconstruction-exact-absence-corpus-mismatch"
    )
  );

  const forgedOccurrence = structuredClone(records[1]!);
  forgedOccurrence.evidence.exactOccurrence.count = 1;
  assert.ok(
    validateEnglishGreekReconstructionEvidence(forgedOccurrence).includes(
      "english-greek-reconstruction-exact-absence-corpus-mismatch"
    )
  );
});

test("replays the new exact TAGNT corpus and TBESH-bound editorial reconstructions fail-closed", () => {
  const g1503 = makeG1503ReconstructionEntry();
  const g20654 = makeG20654ReconstructionEntry();
  const exactTokens = [
    {
      ...makeToken("Jas.1.6", "G1503"),
      tokenIndex: 10,
      surface: "ἔοικεν (eoiken)",
      transliteration: "eoiken",
      gloss: "he has been likened",
      morphology: "V-RAI-3S"
    },
    {
      ...makeToken("Jas.1.23", "G1503"),
      tokenIndex: 11,
      surface: "ἔοικεν (eoiken)",
      transliteration: "eoiken",
      gloss: "has been likened",
      morphology: "V-RAI-3S"
    }
  ];
  const context = buildEnglishEvidenceContext({
    entries: [g1503, g20654],
    tokens: exactTokens,
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const exact = auditEnglishEvidenceEntry(g1503, [], context);
  const editorial = auditEnglishEvidenceEntry(g20654, [], context);

  assert.equal(exact.reconstruction?.applied, true);
  assert.equal(exact.evidence.exactOccurrence.count, 2);
  assert.equal(
    exact.evidence.exactOccurrence.occurrenceCorpusDigest,
    "aa4c140f4a6ce2ee2e62555ad7ab7a7b8fbbf176f02168145672502fd2d105e6"
  );
  assert.deepEqual(exact.evidence.exactOccurrence.references, [
    "Jas.1.23",
    "Jas.1.6"
  ]);
  assert.equal(exact.gloss, "to resemble");
  assert.deepEqual(validateEnglishGreekReconstructionEvidence(exact), []);

  assert.equal(editorial.reconstruction?.applied, true);
  assert.equal(editorial.gloss, "a man of strife");
  assert.equal(editorial.eStrong, g20654.eStrong);
  assert.equal(editorial.dStrong, g20654.dStrong);
  assert.equal(editorial.uStrong, g20654.uStrong);
  assert.deepEqual(validateEnglishGreekReconstructionEvidence(editorial), []);

  const changedGlossContext = buildEnglishEvidenceContext({
    entries: [g1503],
    tokens: [{ ...exactTokens[0]!, gloss: "changed" }, exactTokens[1]!],
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const changedGloss = auditEnglishEvidenceEntry(
    g1503,
    [],
    changedGlossContext
  );
  assert.equal(changedGloss.reconstruction?.applied, false);
  assert.ok(
    changedGloss.reconstruction?.blockers.includes(
      "greek:G1503:exact-occurrence-corpus-digest-mismatch"
    )
  );
  assert.equal(changedGloss.decision.status, "quarantined");

  const changedTbeshContext = buildEnglishEvidenceContext({
    entries: [g20654],
    tokens: [],
    sourceDigests: {
      ...GREEK_RECONSTRUCTION_DIGESTS,
      TBESH: "0".repeat(64)
    },
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const changedTbesh = auditEnglishEvidenceEntry(
    g20654,
    [],
    changedTbeshContext
  );
  assert.equal(changedTbesh.reconstruction?.applied, false);
  assert.ok(
    changedTbesh.reconstruction?.blockers.includes(
      "greek-reconstruction-global-source-mismatch:TBESH"
    )
  );
  assert.equal(changedTbesh.decision.status, "quarantined");
  assert.equal(changedTbesh.gloss, g20654.gloss);
});

test("applies a proved Greek reconstruction while preserving the exact raw STEP row", () => {
  const entry = makeG5441ReconstructionEntry();
  const tokens = [
    makeToken("Acts.5.23", "G5441"),
    makeToken("Acts.12.6", "G5441"),
    makeToken("Acts.12.19", "G5441")
  ];
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens,
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.reconstruction?.applied, true);
  assert.equal(record.reconstruction?.proof.approved, true);
  assert.deepEqual(record.reconstruction?.blockers, []);
  assert.equal(record.reconstruction?.input.occurrenceCount, 3);
  assert.equal(
    record.reconstruction?.input.witnessDigests["TBESG.G5441.full"],
    GREEK_RECONSTRUCTION_CATALOG.entries["greek:G5441"]?.witnessDigests[
      "TBESG.G5441.full"
    ]
  );
  assert.equal(record.original, "φύλαξ");
  assert.equal(record.transliteration, "phulax");
  assert.equal(record.gloss, "guard; keeper");
  assert.equal(
    record.meaning,
    "φύλαξ, -ακος, ὁ, a guard or keeper (Acts 5:23; 12:6, 19)."
  );
  assert.equal(record.reconstruction?.rawEntry.original, "φυλακτήριος");
  assert.equal(record.reconstruction?.rawEntry.gloss, "guard");
  assert.equal(record.reconstruction?.rawEntry.meaning, entry.meaning);
  assert.equal(record.decision.status, "repaired");
  assert.ok(
    record.decision.reasonCodes.includes(
      "curated-auto-validated-greek-reconstruction"
    )
  );
  assert.equal(isCuratedAutoValidatedEnglishEvidence(record.decision), true);
  assert.deepEqual(validateEnglishGreekReconstructionEvidence(record), []);
  const selected = selectCanonicalEnglish(record);
  assert.equal(selected.status, "validated");
  assert.deepEqual(selected.sources, ["GREEK_RECONSTRUCTION"]);
  assert.equal(selected.gloss, "guard; keeper");
  assert.equal(selected.meaningHtml, record.meaning);
  assert.match(
    record.reconstruction?.reconstructionDigest ?? "",
    /^[a-f0-9]{64}$/u
  );

  const forgedOutput = structuredClone(record);
  forgedOutput.meaning = "forged reconstructed meaning";
  assert.ok(
    validateEnglishGreekReconstructionEvidence(forgedOutput).includes(
      "english-greek-reconstruction-published-output-mismatch"
    )
  );
  const forgedProof = structuredClone(record);
  forgedProof.reconstruction!.proof.proofDigest = "0".repeat(64);
  assert.ok(
    validateEnglishGreekReconstructionEvidence(forgedProof).includes(
      "english-greek-reconstruction-proof-replay-mismatch"
    )
  );
});

test("fails closed without copying witnesses from a tampered Greek catalog", () => {
  const entry = makeG5441ReconstructionEntry();
  const catalog = structuredClone(GREEK_RECONSTRUCTION_CATALOG);
  catalog.entries["greek:G5441"]!.witnessDigests["TBESG.G5441.full"] =
    "0".repeat(64);
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [
      makeToken("Acts.5.23", "G5441"),
      makeToken("Acts.12.6", "G5441"),
      makeToken("Acts.12.19", "G5441")
    ],
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: catalog
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.reconstruction?.applied, false);
  assert.equal(record.reconstruction?.proof.approved, false);
  assert.deepEqual(record.reconstruction?.input.witnessDigests, {});
  assert.ok(
    record.reconstruction?.blockers.includes(
      "greek-reconstruction-witness-catalog-digest-mismatch"
    )
  );
  assert.ok(
    record.reconstruction?.blockers.includes(
      "greek-reconstruction-witness-digest-set-mismatch"
    )
  );
  assert.equal(record.original, entry.original);
  assert.equal(record.gloss, entry.gloss);
  assert.equal(record.meaning, entry.meaning);
  assert.equal(record.decision.status, "quarantined");
  assert.deepEqual(validateEnglishGreekReconstructionEvidence(record), []);
});

test("recalculates Greek composition counts and rejects a stale catalog count", () => {
  const entry = makeG5441ReconstructionEntry();
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [makeToken("Acts.5.23", "G5441"), makeToken("Acts.12.6", "G5441")],
    sourceDigests: GREEK_RECONSTRUCTION_DIGESTS,
    greekReconstructionCatalog: GREEK_RECONSTRUCTION_CATALOG
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.reconstruction?.input.occurrenceCount, 2);
  assert.equal(record.reconstruction?.applied, false);
  assert.ok(
    record.reconstruction?.blockers.includes(
      "greek:G5441:witness-catalog-occurrence-count-current-mismatch"
    )
  );
  assert.ok(
    record.reconstruction?.blockers.includes(
      "greek-reconstruction-occurrence-count-mismatch"
    )
  );
  assert.equal(record.gloss, entry.gloss);
});

test("assigns deterministic variant ordinals to duplicate native TAHOT positions", () => {
  const entry: EnglishLexiconEntry = {
    stepEntryId: 559,
    baseCode: 559,
    language: "hebrew",
    eStrong: "H0559",
    dStrong: "H0559 =",
    uStrong: "H0559",
    original: "אָמַר",
    transliteration: "amar",
    morph: "H:V",
    gloss: "say",
    meaning: "say"
  };
  const token = {
    ...makeToken("1Kgs.22.22", "H0559"),
    source: "TAHOT" as const,
    tokenIndex: 9,
    gloss: "and/ he said"
  };
  const record = auditEnglishEvidenceEntry(
    entry,
    [],
    buildEnglishEvidenceContext({
      entries: [entry],
      tokens: [token, { ...token, surface: "variant pointing" }],
      sourceDigests: DIGESTS
    })
  );

  assert.deepEqual(
    record.evidence.exactOccurrence.occurrences.map(
      (occurrence) => occurrence.locator
    ),
    ["TAHOT:1Kgs.22.22#09", "TAHOT:1Kgs.22.22#09@2"]
  );
  assert.deepEqual(validateEnglishExactOccurrenceEvidence(record), []);
});

test("generic evidence quarantines all eight confirmed TBESG conflicts and selects coherent TFLSJ", () => {
  assert.equal(CONFIRMED_BRIEF_SOURCE_CONFLICTS.size, 8);
  const entries = BRIEF_CONFLICT_FIXTURES.flatMap((fixture, index) => [
    makeEntry(
      index * 2 + 1,
      fixture.target,
      fixture.targetOriginal,
      `<b>${fixture.ownerOriginal}</b> wrong sense Mat.${index + 1}:1`
    ),
    makeEntry(
      index * 2 + 2,
      fixture.owner,
      fixture.ownerOriginal,
      `<b>${fixture.ownerOriginal}</b> owner sense Mat.${index + 1}:1`
    )
  ]);
  const resources = BRIEF_CONFLICT_FIXTURES.map((fixture, index) =>
    makeResource(
      index * 2 + 1,
      index + 1,
      `<b>${fixture.targetOriginal}</b> repaired sense`
    )
  );
  const tokens = BRIEF_CONFLICT_FIXTURES.flatMap((fixture, index) => [
    makeToken(`Matt.${index + 1}.1`, fixture.owner),
    makeToken(`Matt.${index + 1}.2`, fixture.target)
  ]);
  const context = buildEnglishEvidenceContext({
    entries,
    tokens,
    sourceDigests: DIGESTS
  });

  const records = BRIEF_CONFLICT_FIXTURES.map((fixture, index) =>
    auditEnglishEvidenceEntry(entries[index * 2]!, [resources[index]!], context)
  );

  for (const [index, record] of records.entries()) {
    assert.equal(record.decision.status, "repaired");
    assert.equal(record.decision.canonicalSource, "TFLSJ");
    assert.deepEqual(record.decision.quarantinedSources, ["TBESG"]);
    assert.equal(
      record.evidence.brief.conflictOwner,
      BRIEF_CONFLICT_FIXTURES[index]!.owner
    );
    assert.equal(record.evidence.brief.headwordMatchesEntry, false);
    assert.equal(record.evidence.brief.citations.targetHits.length, 0);
    assert.deepEqual(
      record.evidence.brief.citations.otherStrongHits[
        BRIEF_CONFLICT_FIXTURES[index]!.owner
      ],
      [`Matt.${index + 1}.1`]
    );
    assert.equal(record.evidence.brief.digest, DIGESTS.TBESG);
    assert.equal(record.evidence.exactOccurrence.count, 1);
    assert.equal(isCuratedAutoValidatedEnglishEvidence(record.decision), true);
    assert.match(record.recordDigest, /^[a-f0-9]{64}$/u);
  }
});

test("quarantines the four TFLSJ regression conflicts while retaining coherent TBESG", () => {
  assert.equal(CONFIRMED_TFLSJ_SOURCE_CONFLICTS.size, 4);
  const entries = TFLSJ_CONFLICT_FIXTURES.flatMap((fixture, index) => [
    makeEntry(
      index * 2 + 101,
      fixture.target,
      fixture.targetOriginal,
      `<b>${fixture.targetOriginal}</b> correct sense Mat.${index + 11}:1`
    ),
    makeEntry(
      index * 2 + 102,
      fixture.owner,
      fixture.ownerOriginal,
      `<b>${fixture.ownerOriginal}</b> owner sense Mat.${index + 21}:1`
    )
  ]);
  const resources = TFLSJ_CONFLICT_FIXTURES.map((fixture, index) =>
    makeResource(
      index * 2 + 101,
      index + 101,
      `<b>${fixture.ownerOriginal}</b> wrong resource NT.Matt.${index + 21}.1`
    )
  );
  const tokens = TFLSJ_CONFLICT_FIXTURES.flatMap((fixture, index) => [
    makeToken(`Matt.${index + 11}.1`, fixture.target),
    makeToken(`Matt.${index + 21}.1`, fixture.owner)
  ]);
  const context = buildEnglishEvidenceContext({
    entries,
    tokens,
    sourceDigests: DIGESTS
  });

  const records = TFLSJ_CONFLICT_FIXTURES.map((fixture, index) =>
    auditEnglishEvidenceEntry(entries[index * 2]!, [resources[index]!], context)
  );

  for (const record of records) {
    assert.equal(record.decision.status, "source-conflict");
    assert.equal(record.decision.canonicalSource, "TBESG");
    assert.deepEqual(record.decision.quarantinedSources, ["TFLSJ"]);
    assert.equal(record.evidence.TFLSJ?.quarantined, true);
    assert.equal(record.evidence.brief.quarantined, false);
  }

  const summary = summarizeEnglishEvidenceAudit(
    records,
    entries.length,
    DIGESTS,
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(summary.statusCounts["source-conflict"], 4);
  assert.deepEqual(summary.confirmedTflsjConflicts, [
    "greek:G1561",
    "greek:G3327",
    "greek:G4895",
    "greek:G4896"
  ]);
});

test("auto-validates only the twelve snapshot-pinned exact TFLSJ repairs", () => {
  assert.equal(CURATED_AUTO_TFLSJ_REPAIRS.size, 12);
  const fixtures = [
    ["G0062", "G0062", "ἀγράμματος", "G0063", "ἀγραυλέω"],
    ["G1492G", "G1492", "εἴδω", "G6063", "οἶδα"],
    ["G1623", "G1623", "ἕκτος", "G1622", "ἐκτός"],
    ["G1633", "G1633", "ἐκχωρέω", "G1632", "ἐκχύννω"],
    ["G2046", "G2046", "ἐρῶ", "G3004G", "λέγω"],
    ["G2600", "G2600", "κατάβασις", "G6046", "καταβαρύνω"],
    ["G3426", "G3426", "μόδιος", "G3428", "μοιχαλίς"],
    ["G4483", "G4483", "ἐρέω", "G3004G", "λέγω"],
    ["G4571", "G4571", "σέ", "G0846", "αὐτός"],
    ["G4776", "G4776", "συγκαθίζω", "G8731", "περικαθίζω"],
    ["G4821", "G4821", "συμβασιλεύω", "G4823", "συμβουλεύω"],
    ["G4844", "G4844", "συμπίνω", "G4849", "συμπόσιον"]
  ] as const;

  for (const [index, fixture] of fixtures.entries()) {
    const [stepStrong, eStrong, original, ownerStrong, ownerOriginal] = fixture;
    const ref = `Matt.${60 + index}.1`;
    const briefRef = ref
      .replace(/^Matt\./u, "Mat.")
      .replace(/\.(\d+)$/u, ":$1");
    const target = {
      ...makeEntry(
        700 + index * 3,
        eStrong,
        original,
        `<b>${ownerOriginal}</b> wrong source ${briefRef}`
      ),
      dStrong: stepStrong === "G4571" ? "G4571 = a Form of" : `${stepStrong} =`,
      uStrong: stepStrong === "G4571" ? "G4771" : stepStrong
    };
    const owner = makeEntry(
      701 + index * 3,
      ownerStrong,
      ownerOriginal,
      `<b>${ownerOriginal}</b> owner`
    );
    const declaredLemma = makeEntry(
      702 + index * 3,
      "G4771",
      "σύ",
      "<b>σύ</b> second-person pronoun"
    );
    const resourceHeadword = stepStrong === "G4571" ? "σύ" : original;
    const resource = makeResource(
      target.stepEntryId,
      900 + index,
      `<b>${resourceHeadword}</b> coherent TFLSJ content`
    );
    const tokens = [makeToken(ref, ownerStrong)];
    if (stepStrong !== "G4571") {
      tokens.push(makeToken(`Acts.${60 + index}.2`, stepStrong));
    }
    const context = buildEnglishEvidenceContext({
      entries:
        stepStrong === "G4571"
          ? [target, owner, declaredLemma]
          : [target, owner],
      tokens,
      sourceDigests: DIGESTS
    });
    const record = auditEnglishEvidenceEntry(target, [resource], context);

    assert.equal(record.key, `greek:${stepStrong}`);
    assert.equal(record.decision.status, "repaired", record.key);
    assert.equal(record.decision.canonicalSource, "TFLSJ", record.key);
    assert.equal(
      isCuratedAutoValidatedEnglishEvidence(record.decision),
      true,
      record.key
    );
    assert.equal(
      record.evidence.exactOccurrence.count,
      stepStrong === "G4571" ? 0 : 1,
      record.key
    );
  }
});

test("auto-validates the six exact brief retentions and quarantines their TFLSJ", () => {
  assert.deepEqual(
    [...CURATED_AUTO_BRIEF_RETENTIONS],
    [
      "greek:G1561",
      "greek:G2653",
      "greek:G3327",
      "greek:G4619",
      "greek:G4895",
      "greek:G4896"
    ]
  );
  const fixtures = [
    ["G1561", "ἐκδοχή", "G1391", "δόξα"],
    ["G2653", "καταναθεματίζω", "G2652", "κατανάθεμα"],
    ["G3327", "μεταβαίνω", "G3328", "μεταβάλλω"],
    ["G4619", "σιτιστός", "G4618", "σιτευτός"],
    ["G4895", "σύνειμι", "G4896", "σύνειμι"],
    ["G4896", "σύνειμι", "G4895", "σύνειμι"]
  ] as const;

  for (const [
    index,
    [targetStrong, original, ownerStrong, ownerOriginal]
  ] of fixtures.entries()) {
    const targetRef = `Matt.${80 + index}.1`;
    const ownerRef = `Matt.${80 + index}.2`;
    const briefTargetRef = targetRef
      .replace(/^Matt\./u, "Mat.")
      .replace(/\.(\d+)$/u, ":$1");
    const target = makeEntry(
      800 + index * 2,
      targetStrong,
      original,
      `<b>${original}</b> correct source ${briefTargetRef}`
    );
    const owner = makeEntry(
      801 + index * 2,
      ownerStrong,
      ownerOriginal,
      `<b>${ownerOriginal}</b> owner`
    );
    const resource = makeResource(
      target.stepEntryId,
      950 + index,
      `<b>${ownerOriginal}</b> wrong resource NT.${ownerRef}`
    );
    const context = buildEnglishEvidenceContext({
      entries: [target, owner],
      tokens: [
        makeToken(targetRef, targetStrong),
        makeToken(ownerRef, ownerStrong)
      ],
      sourceDigests: DIGESTS
    });
    const record = auditEnglishEvidenceEntry(target, [resource], context);

    assert.equal(record.decision.status, "source-conflict", record.key);
    assert.equal(record.decision.canonicalSource, "TBESG", record.key);
    assert.deepEqual(record.decision.quarantinedSources, ["TFLSJ"]);
    assert.equal(
      isCuratedAutoValidatedEnglishEvidence(record.decision),
      true,
      record.key
    );
  }
});

test("keeps G4245H publishable while quarantining its distinct G4244 TFLSJ", () => {
  assert.deepEqual(
    [...CURATED_AUTO_TFLSJ_SUPPLEMENTAL_QUARANTINES],
    ["greek:G4245H"]
  );
  const target = {
    ...makeEntry(
      4245,
      "G4245H",
      "πρεσβύτερος",
      "<b>πρέσβυς</b> comparative πρεσβύτερος Mat.44:1"
    ),
    eStrong: "G4245",
    dStrong: "G4245H = a Meaning of",
    uStrong: "G4245G"
  };
  const owner = makeEntry(
    4244,
    "G4244",
    "πρεσβυτέριον",
    "<b>πρεσβυτέριον</b> presbytery Mat.44:2"
  );
  const resource = makeResource(
    target.stepEntryId,
    4245,
    "Related to: <b>πρεσβυτέριον</b> presbytery NT.Matt.44.2"
  );
  const tokens = [
    makeToken("Matt.44.1", "G4245H"),
    makeToken("Matt.44.2", "G4244")
  ];
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens,
    sourceDigests: DIGESTS
  });
  const record = auditEnglishEvidenceEntry(target, [resource], context);

  assert.equal(record.evidence.exactOccurrence.stepStrong, "G4245H");
  assert.equal(record.evidence.exactOccurrence.count, 1);
  assert.equal(record.evidence.TFLSJ?.conflictOwner, "G4244");
  assert.equal(record.decision.status, "accepted");
  assert.equal(record.decision.canonicalSource, "TBESG");
  assert.equal(record.decision.extendedSource, null);
  assert.deepEqual(record.decision.quarantinedSources, ["TFLSJ"]);
  assert.equal(isCuratedAutoValidatedEnglishEvidence(record.decision), true);

  const changedContext = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens,
    sourceDigests: { ...DIGESTS, TFLSJ: "changed-tflsj-digest" }
  });
  const changedRecord = auditEnglishEvidenceEntry(
    target,
    [resource],
    changedContext
  );
  assert.equal(changedRecord.decision.status, "quarantined");
  assert.deepEqual(changedRecord.decision.reasonCodes, [
    "curated-greek-source-snapshot-changed"
  ]);
});

test("repairs only the three exact single-headword bundles with direct TAGNT evidence", () => {
  assert.deepEqual(
    [...CURATED_AUTO_TFLSJ_BUNDLE_REPAIRS],
    ["greek:G2624", "greek:G3022", "greek:G4955"]
  );
  const fixtures = [
    ["G2624", "κατακληροδοτέω", "κατακληρονομέω"],
    ["G3022", "λευκός", "λευκοβύσσινος"],
    ["G4955", "συστασιαστής", "στασιαστής"]
  ] as const;

  for (const [
    index,
    [strong, original, bundledHeadword]
  ] of fixtures.entries()) {
    const target = makeEntry(
      900 + index,
      strong,
      original,
      `<b>${bundledHeadword}</b> bundled source Matt.${100 + index}:1`
    );
    const resource = makeResource(
      target.stepEntryId,
      980 + index,
      `<b>${original}</b> exact TFLSJ repair`
    );
    const context = buildEnglishEvidenceContext({
      entries: [target],
      tokens: [makeToken(`Matt.${100 + index}.1`, strong)],
      sourceDigests: DIGESTS
    });
    const record = auditEnglishEvidenceEntry(target, [resource], context);

    assert.equal(record.decision.status, "repaired", record.key);
    assert.equal(record.decision.canonicalSource, "TFLSJ", record.key);
    assert.equal(
      isCuratedAutoValidatedEnglishEvidence(record.decision),
      true,
      record.key
    );
  }
});

test("auto-validates the six pinned brief variants only with exact TFLSJ and TAGNT", () => {
  assert.deepEqual(
    [...CURATED_AUTO_SOURCE_VARIANTS],
    [
      "greek:G1714",
      "greek:G1740",
      "greek:G1757",
      "greek:G4803",
      "greek:G4852",
      "greek:G5282"
    ]
  );
  const fixtures = [
    ["G1714", "ἐμπρήθω", "ἐμπίπρημι"],
    ["G1740", "ἐνδοξάζομαι", "ἐνδοξάζω"],
    ["G1757", "ἐνευλογέομαι", "ἐνευλογέω"],
    ["G4803", "συζήτησις", "συνζήτηαις"],
    ["G4852", "σύμφημι", "σύν"],
    ["G5282", "ὑπονοέω", "ὑπο"]
  ] as const;

  for (const [index, [strong, original, briefHeadword]] of fixtures.entries()) {
    const ref = `Matt.${110 + index}.1`;
    const briefRef = ref
      .replace(/^Matt\./u, "Mat.")
      .replace(/\.(\d+)$/u, ":$1");
    const target = makeEntry(
      1000 + index,
      strong,
      original,
      `<b>${briefHeadword}</b> valid variant ${briefRef}`
    );
    const resource = makeResource(
      target.stepEntryId,
      1000 + index,
      `<b>${original}</b> exact TFLSJ witness`
    );
    const context = buildEnglishEvidenceContext({
      entries: [target],
      tokens: [makeToken(ref, strong)],
      sourceDigests: DIGESTS
    });
    const record = auditEnglishEvidenceEntry(target, [resource], context);

    assert.equal(record.decision.status, "accepted", record.key);
    assert.equal(
      isCuratedAutoValidatedEnglishEvidence(record.decision),
      true,
      record.key
    );
  }
});

test("quarantines a mismatched TFLSJ supplement without blocking coherent TBESG", () => {
  const target = makeEntry(
    1100,
    "G7770",
    "ἀπερισπάστως",
    "<b>ἀπερισπάστως</b> undistracted Matt.120:1"
  );
  const resource = makeResource(
    1100,
    1100,
    "<b>ἀπερίσσευτος</b> unrelated secondary resource"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [makeToken("Matt.120.1", "G7770")],
    sourceDigests: DIGESTS
  });
  const record = auditEnglishEvidenceEntry(target, [resource], context);

  assert.equal(record.decision.status, "accepted");
  assert.equal(record.decision.canonicalSource, "TBESG");
  assert.equal(record.decision.extendedSource, null);
  assert.deepEqual(record.decision.quarantinedSources, ["TFLSJ"]);
  assert.ok(
    record.decision.reasonCodes.includes(
      "tflsj-supplemental-quarantined-headword-mismatch"
    )
  );
});

test("does not infer a conflict when cited occurrences still hit the target", () => {
  const target = makeEntry(
    301,
    "G3755",
    "ὅτου",
    "<b>ὅστις</b> an inflected relative form Heb.2:6"
  );
  const owner = makeEntry(
    302,
    "G3748",
    "ὅστις",
    "<b>ὅστις</b> relative pronoun"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens: [makeToken("Heb.2.6", "G3755")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.equal(record.evidence.brief.quarantined, false);
  assert.equal(record.decision.status, "accepted");
  assert.deepEqual(record.evidence.brief.citations.targetHits, ["Heb.2.6"]);
});

test("keeps exhaustively reviewed source variants publishable with an explicit annotation", () => {
  assert.equal(CURATED_SOURCE_VARIANT_ENTRIES.size, 88);
  const target = makeEntry(
    501,
    "G0170",
    "ἀκαίρως",
    "<b>ἄκαιρος</b> legitimate adverbial form Matt.40:1"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [makeToken("Matt.40.1", "G0170")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.equal(record.decision.status, "accepted");
  assert.deepEqual(record.decision.reasonCodes, [
    "brief-source-accepted",
    "curated-source-variant"
  ]);
});

test("quarantines bundled notices and isolated identity or relation cases before translation", () => {
  assert.equal(CURATED_BUNDLED_NOTICE_ENTRIES.size, 6);
  assert.deepEqual(
    [...CURATED_BUNDLED_NOTICE_ENTRIES],
    [
      "greek:G1489",
      "greek:G1490",
      "greek:G2624",
      "greek:G3022",
      "greek:G4245G",
      "greek:G4955"
    ]
  );
  assert.equal(CURATED_ISOLATED_SOURCE_ISSUES.size, 3);
  const bundled = makeEntry(
    502,
    "G2624",
    "κατακληροδοτέω",
    "<b>κατακληρονομέω</b> bundled source Matt.41:1"
  );
  const isolated = makeEntry(
    503,
    "G5441",
    "φυλακτήριος",
    "<b>φύλαξ</b> identity conflict Matt.42:1"
  );
  const context = buildEnglishEvidenceContext({
    entries: [bundled, isolated],
    tokens: [makeToken("Matt.41.1", "G2624"), makeToken("Matt.42.1", "G5441")],
    sourceDigests: DIGESTS
  });

  const bundledRecord = auditEnglishEvidenceEntry(bundled, [], context);
  const isolatedRecord = auditEnglishEvidenceEntry(isolated, [], context);
  assert.equal(bundledRecord.decision.status, "quarantined");
  assert.deepEqual(bundledRecord.decision.reasonCodes, [
    "source-bundle-trim-required",
    "curated-auto-repair-evidence-missing"
  ]);
  assert.equal(isolatedRecord.decision.status, "quarantined");
  assert.deepEqual(isolatedRecord.decision.reasonCodes, [
    "identity-repair-required"
  ]);
});

test("keeps every raw notice superseded by a Greek reconstruction explicitly fail-closed", () => {
  assert.deepEqual(
    [...CURATED_GREEK_REQUIRED_REVIEW_ENTRIES.keys()],
    [
      "greek:G0001H",
      "greek:G0567",
      "greek:G1489",
      "greek:G1490",
      "greek:G1503",
      "greek:G1507",
      "greek:G1970",
      "greek:G2199H",
      "greek:G2424K",
      "greek:G4245G",
      "greek:G5441",
      "greek:G6087",
      "greek:G6243",
      "greek:G8216",
      "greek:G20014",
      "greek:G20128",
      "greek:G20209",
      "greek:G20278",
      "greek:G20394",
      "greek:G20464",
      "greek:G20467",
      "greek:G20490",
      "greek:G20583",
      "greek:G20654",
      "greek:G20665",
      "greek:G20765",
      "greek:G20937",
      "greek:G21057",
      "greek:G21118",
      "greek:G21241",
      "greek:G21273"
    ]
  );
});

test("repairs G21370 gloss only from its exact pinned TBESG definition", () => {
  const target = makeG21370Entry();
  const context = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);

  assert.equal(record.gloss, "wanderer");
  assert.equal(record.evidence.sourceAudit.status, "source_ok");
  assert.equal(record.decision.status, "accepted");
  assert.equal(record.decision.canonicalSource, "TBESG");
  assert.deepEqual(record.decision.reasonCodes, [
    "brief-source-accepted",
    "exact-brief-definition-gloss-repair",
    "curated-auto-validated-exact-brief-gloss-repair"
  ]);
  assert.equal(isCuratedAutoValidatedEnglishEvidence(record.decision), true);
  assert.deepEqual(
    record.evidence.fieldRepairs.map((repair) => repair.field),
    ["gloss"]
  );
  assert.equal(record.evidence.fieldRepairs[0]?.sourceValue, "");
  assert.equal(record.evidence.fieldRepairs[0]?.repairedValue, "wanderer");
  assert.match(
    record.evidence.fieldRepairs[0]?.ruleDigest ?? "",
    /^[a-f0-9]{64}$/u
  );
  assert.match(
    record.evidence.fieldRepairs[0]?.repairDigest ?? "",
    /^[a-f0-9]{64}$/u
  );
  assert.match(
    record.decision.curatedRuleProof?.proofDigest ?? "",
    /^[a-f0-9]{64}$/u
  );
});

test("fails the G21370 gloss repair closed after any source-row or snapshot change", () => {
  const exact = makeG21370Entry();
  const changedInputs = [
    {
      entry: {
        ...exact,
        meaning: exact.meaning.replace("a wanderer", "a roamer")
      },
      sourceDigests: DIGESTS,
      expectedReason: "curated-greek-repair-evidence-missing"
    },
    {
      entry: exact,
      sourceDigests: { ...DIGESTS, TBESG: "changed-tbesg-digest" },
      expectedReason: "curated-greek-source-snapshot-changed"
    }
  ];

  for (const input of changedInputs) {
    const context = buildEnglishEvidenceContext({
      entries: [input.entry],
      tokens: [],
      sourceDigests: input.sourceDigests
    });
    const record = auditEnglishEvidenceEntry(input.entry, [], context);
    assert.equal(record.gloss, "");
    assert.deepEqual(record.evidence.fieldRepairs, []);
    assert.equal(record.decision.status, "quarantined");
    assert.deepEqual(record.decision.reasonCodes, [input.expectedReason]);
  }
});

test("retains exact G4191 and G5024 briefs while quarantining cross-entry TFLSJ", () => {
  assert.equal(CURATED_GREEK_ENGLISH_REPAIR_RULES.size, 3);
  const fixtures = [
    {
      target: makeG4191Entry(),
      owner: makeEntry(611, "G4190", "πονηρός", "<b>πονηρός</b>, evil."),
      resource: "<b>πονηρός</b>, more evil [NT (NT.Matt.13.19)]",
      ref: "Matt.13.19",
      ownerStrong: "G4190"
    },
    {
      target: makeG5024Entry(),
      owner: makeEntry(612, "G3778", "οὗτος", "<b>οὗτος</b>, this."),
      resource: "<b>οὗτος</b>, thus [NT (NT.Luke.2.2)]",
      ref: "Luke.2.2",
      ownerStrong: "G3778"
    }
  ];

  for (const fixture of fixtures) {
    const context = buildEnglishEvidenceContext({
      entries: [fixture.target, fixture.owner],
      tokens: [makeToken(fixture.ref, fixture.ownerStrong)],
      sourceDigests: DIGESTS
    });
    const record = auditEnglishEvidenceEntry(
      fixture.target,
      [makeResource(fixture.target.stepEntryId, 700, fixture.resource)],
      context
    );
    assert.equal(record.decision.status, "accepted", record.key);
    assert.equal(record.decision.canonicalSource, "TBESG", record.key);
    assert.equal(record.decision.extendedSource, null, record.key);
    assert.deepEqual(record.decision.quarantinedSources, ["TFLSJ"]);
    assert.deepEqual(record.decision.reasonCodes, [
      "brief-source-accepted",
      "tflsj-supplemental-quarantined-headword-mismatch",
      "curated-auto-validated-exact-brief-retention"
    ]);
    assert.equal(record.evidence.TFLSJ?.conflictOwner, fixture.ownerStrong);
    assert.equal(isCuratedAutoValidatedEnglishEvidence(record.decision), true);
    assert.match(
      record.decision.curatedRuleProof?.ruleDigest ?? "",
      /^[a-f0-9]{64}$/u
    );
    assert.match(
      record.decision.curatedRuleProof?.proofDigest ?? "",
      /^[a-f0-9]{64}$/u
    );
  }
});

test("does not retain a curated brief when its exact row or TFLSJ conflict proof is missing", () => {
  const exact = makeG4191Entry();
  const changed = { ...exact, meaning: `${exact.meaning}.` };
  for (const target of [exact, changed]) {
    const context = buildEnglishEvidenceContext({
      entries: [target],
      tokens: [],
      sourceDigests: DIGESTS
    });
    const record = auditEnglishEvidenceEntry(target, [], context);
    assert.equal(record.decision.status, "quarantined");
    assert.equal(record.decision.canonicalSource, null);
    assert.deepEqual(record.decision.reasonCodes, [
      "curated-greek-repair-evidence-missing"
    ]);
  }
});

test("quarantines every curated bundled notice even when its citation hits the target", () => {
  const entries = [...CURATED_BUNDLED_NOTICE_ENTRIES].map((key, index) =>
    makeEntry(
      520 + index,
      key.split(":")[1]!,
      `λῆμμα${String.fromCodePoint(0x3b1 + index)}`,
      `<b>ἕτερος</b> bundled notice Mat.${50 + index}:1`
    )
  );
  const context = buildEnglishEvidenceContext({
    entries,
    tokens: entries.map((entry, index) =>
      makeToken(`Matt.${50 + index}.1`, entry.eStrong)
    ),
    sourceDigests: DIGESTS
  });

  for (const entry of entries) {
    const record = auditEnglishEvidenceEntry(entry, [], context);
    assert.equal(record.decision.status, "quarantined", record.key);
    assert.equal(record.decision.canonicalSource, null, record.key);
    assert.deepEqual(
      record.decision.reasonCodes,
      CURATED_AUTO_TFLSJ_BUNDLE_REPAIRS.has(record.key)
        ? [
            "source-bundle-trim-required",
            "curated-auto-repair-evidence-missing"
          ]
        : ["source-bundle-trim-required"],
      record.key
    );
  }
});

test("fails curated exceptions closed when the audited STEP snapshot changes", () => {
  const target = makeEntry(
    504,
    "G0170",
    "ἀκαίρως",
    "<b>ἄκαιρος</b> changed source Matt.43:1"
  );
  const changedSnapshots: EnglishEvidenceSourceDigests[] = [
    { ...DIGESTS, TBESG: "changed-tbesg-digest" },
    { ...DIGESTS, TFLSJ: "changed-tflsj-digest" },
    {
      ...DIGESTS,
      TAGNT: {
        ...DIGESTS.TAGNT,
        "TAGNT Act-Rev.txt": "changed-tagnt-digest"
      }
    },
    {
      ...DIGESTS,
      TAGNT: { ...DIGESTS.TAGNT, "unexpected-extra.txt": "extra" }
    }
  ];

  for (const sourceDigests of changedSnapshots) {
    const context = buildEnglishEvidenceContext({
      entries: [target],
      tokens: [makeToken("Matt.43.1", "G0170")],
      sourceDigests
    });
    const record = auditEnglishEvidenceEntry(target, [], context);
    assert.equal(record.decision.status, "quarantined");
    assert.deepEqual(record.decision.reasonCodes, [
      "curated-greek-source-snapshot-changed"
    ]);
  }
});

test("quarantines entries with missing required source fields", () => {
  const target = {
    ...makeEntry(303, "G7776", "", "<b>λέξις</b> source content"),
    gloss: ""
  };
  const context = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);

  assert.equal(record.decision.status, "quarantined");
  assert.equal(record.decision.canonicalSource, null);
  assert.deepEqual(record.decision.reasonCodes, [
    "missing-required-source-field:original",
    "missing-required-source-field:gloss"
  ]);
});

test("accepts a declared STEP form whose notice is intentionally filed under its lemma", () => {
  const target = {
    ...makeEntry(351, "G1488", "εἶ", "<b>εἰμί</b> second-person form Matt.1:1"),
    dStrong: "G1488 = a Form of",
    uStrong: "G1510"
  };
  const lemma = makeEntry(352, "G1510", "εἰμί", "<b>εἰμί</b> to be Matt.1:1");
  const context = buildEnglishEvidenceContext({
    entries: [target, lemma],
    tokens: [makeToken("Matt.1.1", "G1510")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.equal(record.evidence.brief.headwordMatchesEntry, false);
  assert.deepEqual(record.evidence.brief.declaredRelatedStrongCodes, ["G1510"]);
  assert.equal(record.evidence.brief.headwordMatchesDeclaredRelation, true);
  assert.equal(record.evidence.brief.quarantined, false);
  assert.equal(record.decision.status, "accepted");
});

test("uses the declared STEP parent to distinguish a real wrong notice from a valid lemma notice", () => {
  const target = {
    ...makeEntry(
      361,
      "G4571",
      "σέ",
      "<b>αὐτός</b> wrong pronoun notice Mat.2:1"
    ),
    dStrong: "G4571 = a Form of",
    uStrong: "G4771"
  };
  const wrongOwner = makeEntry(
    362,
    "G0846",
    "αὐτός",
    "<b>αὐτός</b> third-person pronoun Mat.2:1"
  );
  const declaredLemma = makeEntry(
    363,
    "G4771",
    "σύ",
    "<b>σύ</b> second-person pronoun"
  );
  const resource = makeResource(361, 361, "<b>σύ</b> second-person pronoun");
  const context = buildEnglishEvidenceContext({
    entries: [target, wrongOwner, declaredLemma],
    tokens: [makeToken("Matt.2.1", "G0846")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [resource], context);
  assert.equal(record.evidence.brief.conflictOwner, "G0846");
  assert.equal(record.evidence.brief.quarantined, true);
  assert.equal(record.evidence.TFLSJ?.headwordMatchesDeclaredRelation, true);
  assert.equal(record.evidence.TFLSJ?.quarantined, false);
  assert.equal(record.decision.status, "repaired");
  assert.equal(record.decision.canonicalSource, "TFLSJ");
});

test("accepts an included inflected form when the notice explicitly contains it", () => {
  const target = makeEntry(
    371,
    "G3755",
    "ὅτου",
    "<b>ὅστις</b> includes the genitive ὅτου Matt.3:1"
  );
  const lemma = makeEntry(
    372,
    "G3748",
    "ὅστις",
    "<b>ὅστις</b> relative pronoun Matt.3:1"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target, lemma],
    tokens: [makeToken("Matt.3.1", "G3748")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.equal(record.evidence.brief.contentMentionsEntryOriginal, true);
  assert.equal(record.evidence.brief.quarantined, false);
  assert.equal(record.decision.status, "accepted");
});

test("repairs an unlisted conflict from headword and occurrence evidence", () => {
  const target = makeEntry(
    401,
    "G7777",
    "ἀλήθεια",
    "<b>ψεῦδος</b> wrong source meaning Mat.30:1"
  );
  const owner = makeEntry(
    402,
    "G7778",
    "ψεῦδος",
    "<b>ψεῦδος</b> owner meaning Mat.30:1"
  );
  const resource = makeResource(
    401,
    401,
    "<b>ἀλήθεια</b> coherent alternative"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens: [makeToken("Matt.30.1", "G7778")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [resource], context);
  assert.equal(CONFIRMED_BRIEF_SOURCE_CONFLICTS.has(record.key), false);
  assert.equal(record.evidence.brief.quarantined, true);
  assert.equal(record.evidence.brief.conflictOwner, "G7778");
  assert.equal(record.decision.status, "repaired");
  assert.deepEqual(record.decision.reasonCodes, [
    "inferred-brief-source-conflict",
    "coherent-tflsj-repair"
  ]);
});

test("confirmed G1633 and G4776 collisions override a shared target citation", () => {
  const fixtures = [
    {
      target: makeEntry(
        620,
        "G1633",
        "ἐκχωρέω",
        "<b>ἐκχύννω</b> wrong block Luk.21:21; <b>ἐκχωρέω</b> target block"
      ),
      owner: makeEntry(621, "G1632", "ἐκχύννω", "<b>ἐκχύννω</b> pour out"),
      resource: makeResource(620, 620, "<b>ἐκχωρέω</b> depart, withdraw"),
      ref: "Luke.21.21"
    },
    {
      target: makeEntry(
        622,
        "G4776",
        "συγκαθίζω",
        "<b>περικαθίζω</b> sit around Luk.22:55"
      ),
      owner: makeEntry(623, "G8731", "περικαθίζω", "<b>περικαθίζω</b> besiege"),
      resource: makeResource(622, 622, "<b>συγκαθίζω</b> sit together"),
      ref: "Luke.22.55"
    }
  ];
  const context = buildEnglishEvidenceContext({
    entries: fixtures.flatMap((fixture) => [fixture.target, fixture.owner]),
    tokens: fixtures.flatMap((fixture) => [
      makeToken(fixture.ref, fixture.target.eStrong),
      makeToken(fixture.ref, fixture.owner.eStrong)
    ]),
    sourceDigests: DIGESTS
  });

  for (const fixture of fixtures) {
    const record = auditEnglishEvidenceEntry(
      fixture.target,
      [fixture.resource],
      context
    );
    assert.deepEqual(record.evidence.brief.citations.targetHits, [fixture.ref]);
    assert.equal(record.evidence.brief.quarantined, true);
    assert.equal(record.decision.status, "repaired");
    assert.equal(record.decision.canonicalSource, "TFLSJ");
  }
});

test("fails an unknown source-audit mismatch closed even when citations hit", () => {
  const target = makeEntry(
    624,
    "G7780",
    "ἀλήθεια",
    "<b>ψεῦδος</b> unresolved wrong headword Mat.32:1"
  );
  const owner = makeEntry(625, "G7781", "ψεῦδος", "<b>ψεῦδος</b> falsehood");
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens: [makeToken("Matt.32.1", "G7780")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.equal(record.evidence.brief.quarantined, false);
  assert.equal(record.evidence.sourceAudit.status, "source_issue");
  assert.equal(record.decision.status, "quarantined");
  assert.deepEqual(record.decision.reasonCodes, [
    "unresolved-source-audit:source_issue"
  ]);
});

test("does not let a classical Strong citation validate the wrong STEP sub-entry", () => {
  const target = {
    ...makeEntry(
      601,
      "G1492",
      "εἴδω",
      "<b>οἶδα</b> sibling sub-entry notice Act.1:1"
    ),
    dStrong: "G1492G ="
  };
  const sibling = {
    ...makeEntry(602, "G1492", "οἶδα", "<b>οἶδα</b> to know Act.1:1"),
    dStrong: "G1492H ="
  };
  const token = {
    ...makeToken("Acts.1.1", "G1492"),
    strongByBase: new Map([["G1492", new Set(["G1492H"])]]),
    ref: "Acts.1.1"
  };
  const context = buildEnglishEvidenceContext({
    entries: [target, sibling],
    tokens: [token],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.deepEqual(record.evidence.brief.citations.targetHits, []);
  assert.deepEqual(record.evidence.brief.citations.otherStrongHits.G1492H, [
    "Acts.1.1"
  ]);
  assert.equal(record.evidence.brief.conflictOwner, "G1492H");
  assert.equal(record.decision.status, "quarantined");
});

test("does not treat an incidental original-language mention as a structured relation", () => {
  const target = makeEntry(
    603,
    "G7777",
    "ἀλήθεια",
    "<b>ψεῦδος</b> falsehood, contrasted with ἀλήθεια Mat.31:1"
  );
  const owner = makeEntry(
    604,
    "G7778",
    "ψεῦδος",
    "<b>ψεῦδος</b> falsehood Mat.31:1"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens: [makeToken("Matt.31.1", "G7778")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);
  assert.equal(record.evidence.brief.contentMentionsEntryOriginal, false);
  assert.equal(record.evidence.brief.conflictOwner, "G7778");
  assert.equal(record.decision.status, "quarantined");
});

test("fails a prefix-close canonical notice closed when its citations belong to another headword owner", () => {
  const target = {
    ...makeEntry(701, "G2501", "Ἰωσήφ", "<b>Ἰωσῆς</b>, Joses Mat.13:55"),
    dStrong: "G2501O = a Name of",
    uStrong: "G0921G",
    gloss: "Joseph"
  };
  const owner = {
    ...makeEntry(702, "G2500", "Ἰωσῆς", "<b>Ἰωσῆς</b>, Joses"),
    dStrong: "G2500G ="
  };
  const ownerCitation = {
    ...makeToken("Matt.13.55", "G2500"),
    strongByBase: new Map([["G2500", new Set(["G2500G"])]]),
    ref: "Matt.13.55"
  };
  const exactTargetOccurrence = {
    ...makeToken("Acts.4.36", "G2501"),
    strongByBase: new Map([["G2501", new Set(["G2501O"])]]),
    ref: "Acts.4.36"
  };
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens: [ownerCitation, exactTargetOccurrence],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);

  assert.equal(
    record.evidence.sourceAudit.meaningHeadword.match,
    "morphological_variant"
  );
  assert.equal(
    record.evidence.sourceAudit.glossSupport.meaningSupportsGloss,
    false
  );
  assert.deepEqual(record.evidence.brief.citations.targetHits, []);
  assert.deepEqual(record.evidence.brief.headwordOwnerKeys, ["greek:G2500G"]);
  assert.deepEqual(record.evidence.brief.citations.otherStrongHits.G2500G, [
    "Matt.13.55"
  ]);
  assert.equal(record.evidence.brief.headwordMatchesDeclaredRelation, false);
  assert.equal(record.evidence.brief.contentMentionsEntryOriginal, false);
  assert.equal(record.evidence.exactOccurrence.count, 1);
  assert.equal(record.decision.status, "quarantined");
  assert.equal(record.decision.canonicalSource, null);
  assert.deepEqual(record.decision.quarantinedSources, ["TBESG"]);
  assert.deepEqual(record.decision.reasonCodes, [
    "canonical-source-uncorroborated-morphological-variant"
  ]);
});

test("quarantines an uncorroborated TFLSJ morphological supplement even when its gloss overlaps", () => {
  const target = {
    ...makeEntry(711, "G7777", "ἐνδύνω", "<b>ἐνδύνω</b>, sneak Mat.1:1"),
    gloss: "sneak"
  };
  const owner = makeEntry(
    712,
    "G7778",
    "ἐνδύω",
    "<b>ἐνδύω</b>, put on Eph.4:24"
  );
  const resource = makeResource(
    711,
    711,
    "<b>ἐνδύω</b>, put on or sneak NT.Eph.4.24"
  );
  const context = buildEnglishEvidenceContext({
    entries: [target, owner],
    tokens: [makeToken("Matt.1.1", "G7777"), makeToken("Eph.4.24", "G7778")],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [resource], context);
  const tflsjAudit = record.evidence.sourceAudit.resources.find(
    (candidate) => candidate.resource.source === "TFLSJ"
  );

  assert.equal(tflsjAudit?.headword.match, "morphological_variant");
  assert.equal(tflsjAudit?.supportsGloss, true);
  assert.deepEqual(record.evidence.TFLSJ?.citations.resolvedReferences, [
    "Eph.4.24"
  ]);
  assert.deepEqual(record.evidence.TFLSJ?.citations.targetHits, []);
  assert.equal(record.evidence.TFLSJ?.headwordMatchesDeclaredRelation, false);
  assert.equal(record.evidence.TFLSJ?.contentMentionsEntryOriginal, false);
  assert.equal(record.decision.status, "accepted");
  assert.equal(record.decision.canonicalSource, "TBESG");
  assert.equal(record.decision.extendedSource, null);
  assert.deepEqual(record.decision.quarantinedSources, ["TFLSJ"]);
  assert.deepEqual(record.decision.reasonCodes, [
    "brief-source-accepted",
    "tflsj-supplemental-quarantined-uncorroborated-morphological-variant"
  ]);
});

test("fails an unattested zero-occurrence supplemental semantic gloss closed", () => {
  const target = {
    ...makeEntry(721, "G29999", "δοκιμή", "<b>δοκιμή</b>: a trial."),
    gloss: "royal crown"
  };
  const context = buildEnglishEvidenceContext({
    entries: [target],
    tokens: [],
    sourceDigests: DIGESTS
  });

  const record = auditEnglishEvidenceEntry(target, [], context);

  assert.equal(
    record.evidence.sourceAudit.glossSupport.meaningSupportsGloss,
    false
  );
  assert.equal(record.evidence.exactOccurrence.count, 0);
  assert.equal(record.decision.status, "quarantined");
  assert.deepEqual(record.decision.reasonCodes, [
    "supplemental-semantic-gloss-unattested"
  ]);
});

function makeEntry(
  stepEntryId: number,
  strong: string,
  original: string,
  meaning: string
): EnglishLexiconEntry {
  return {
    stepEntryId,
    baseCode: Number.parseInt(strong.slice(1), 10),
    language: "greek",
    eStrong: strong,
    dStrong: `${strong} =`,
    uStrong: strong,
    original,
    transliteration: original,
    morph: "G:N",
    gloss: "fixture gloss",
    meaning
  };
}

function makeG21370Entry(): EnglishLexiconEntry {
  return {
    stepEntryId: 10904,
    baseCode: 21370,
    language: "greek",
    eStrong: "G21370",
    dStrong: "G21370 =",
    uStrong: "G21370",
    original: "πλάνης",
    transliteration: "planēs",
    morph: "G:N-F",
    gloss: "",
    meaning:
      "<b>πλάνης</b>, -ητος, ό, see: πλανήτης <br /> <b>πλανήτης</b>, -ου, ὁ<br /> (πλανάω), [in LXX: Hos.9:17 (נָדַד) *;] <br /><b>= πλάνης, a wanderer</b>: ἀστέρες π. (cl. planets), wandering stars, Ju 13 (WH, mg., -τες).†<br /> (AS)"
  };
}

function makeG4191Entry(): EnglishLexiconEntry {
  return {
    stepEntryId: 4230,
    baseCode: 4191,
    language: "greek",
    eStrong: "G4191",
    dStrong: "G4191 =",
    uStrong: "G4191",
    original: "πονηρότερος",
    transliteration: "ponēroteros",
    morph: "G:A",
    gloss: "more evil",
    meaning: "- more evil evil, wicked, painful, harmful"
  };
}

function makeG5024Entry(): EnglishLexiconEntry {
  return {
    stepEntryId: 5086,
    baseCode: 5024,
    language: "greek",
    eStrong: "G5024",
    dStrong: "G5024 = a Combination of",
    uStrong: "G0846 (G3588+G0846)",
    original: "ταὐτά",
    transliteration: "tauta",
    morph: "G:ADV",
    gloss: "thus",
    meaning: "thus, in the same way"
  };
}

function makeG5441ReconstructionEntry(): EnglishLexiconEntry {
  return {
    stepEntryId: 5514,
    baseCode: 5441,
    language: "greek",
    eStrong: "G5441",
    dStrong: "G5441 =",
    uStrong: "G5441",
    original: "φυλακτήριος",
    transliteration: "phulaktērios",
    morph: "G:N-M",
    gloss: "guard",
    meaning:
      "<b>φύλαξ</b>, -ακος, ὁ<br /> (φυλάσσω), [in LXX for שָׁמַר, צוּר;] <br /><b>a guard, keeper</b>: Act.5:23 12:6, 19.†<br /> (AS)",
    classicTransliteration: "phulax",
    pronunciation: "foo'-lax"
  };
}

function makeG1503ReconstructionEntry(): EnglishLexiconEntry {
  return {
    stepEntryId: 1553,
    baseCode: 1503,
    language: "greek",
    eStrong: "G1503",
    dStrong: "G1503 =",
    uStrong: "G1503",
    original: "εἴκω",
    transliteration: "eikō",
    morph: "G:V",
    gloss: "to resemble",
    meaning:
      "<b>εἴκω</b> (obsolete pres.), see: ἔοικα <note>Transcriber note: This form does not occur in Abbott-Smith. It should be on p. 158.</note>.<br /> (AS)",
    classicTransliteration: "",
    pronunciation: "i'-ko"
  };
}

function makeG20654ReconstructionEntry(): EnglishLexiconEntry {
  return {
    stepEntryId: 10193,
    baseCode: 20654,
    language: "greek",
    eStrong: "G20654",
    dStrong: "G20654 =",
    uStrong: "G20654",
    original: "μαδών",
    transliteration: "madōn",
    morph: "",
    gloss: "íš mādhón",
    meaning: "íš mādhón",
    classicTransliteration: "",
    pronunciation: ""
  };
}

function makeG20464ReconstructionEntry(): EnglishLexiconEntry {
  return {
    stepEntryId: 10008,
    baseCode: 20464,
    language: "greek",
    eStrong: "G20464",
    dStrong: "G20464 =",
    uStrong: "G20464",
    original: "ἐσσήν",
    transliteration: "essēn",
    morph: "",
    gloss: "[hudot ]ōšen",
    meaning: "[hudot ]ōšen",
    classicTransliteration: "",
    pronunciation: ""
  };
}

function makeG8216ReconstructionEntry(): EnglishLexiconEntry {
  return {
    stepEntryId: 7906,
    baseCode: 8216,
    language: "greek",
    eStrong: "G8216",
    dStrong: "G8216 =",
    uStrong: "G8216",
    original: "μᾶ",
    transliteration: "ma",
    morph: "",
    gloss: "by!",
    meaning:
      "shortened doric form for μάτηρ, μᾶ γᾶ for μῆτερ γῆ, (Aeschulus Tragicus); μᾶ, πόθεν ἅνθρωπος; (Theocritus Poeta Bucolicus) (ML)",
    classicTransliteration: "",
    pronunciation: ""
  };
}

function makeG20765ReconstructionEntry(): EnglishLexiconEntry {
  return {
    stepEntryId: 10304,
    baseCode: 20765,
    language: "greek",
    eStrong: "G20765",
    dStrong: "G20765 =",
    uStrong: "G20765",
    original: "μόσχευμα",
    transliteration: "moscheuma",
    morph: "",
    gloss: "PLond.ined.",
    meaning: "PLond.ined.",
    classicTransliteration: "",
    pronunciation: ""
  };
}

function makeResource(
  stepEntryId: number,
  resourceId: number,
  contentHtml: string
): EnglishLexiconResource {
  return {
    stepEntryId,
    resourceId,
    source: "TFLSJ",
    kind: "classical_full",
    contentHtml
  };
}

function makeToken(ref: string, strong: string): StepOriginalToken {
  return {
    ref,
    alternateRefs: [],
    source: "TAGNT",
    tokenIndex: 1,
    type: "NKO",
    surface: strong,
    transliteration: strong,
    gloss: strong,
    morphology: "N-NSM",
    editions: "NA28",
    strongByBase: new Map([[strong, new Set([strong])]])
  };
}
