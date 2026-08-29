import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  assessCanonicalHebrewMeaning,
  assertFrozenCoreEnglishReleaseContinuity,
  buildLexiconV3Authoring,
  validateEnglishAuditFieldRepairs,
  type BuildLexiconV3AuthoringOptions
} from "../scripts/buildLexiconV3Authoring.js";
import {
  assembleFrenchInternalReviewRecords,
  finalizeFrenchInternalArbiterArtifact,
  finalizeFrenchInternalAuditorArtifact,
  finalizeFrenchInternalProposerArtifact,
  FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION,
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  type FrenchInternalAssemblyConfigurationFile
} from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import {
  englishEvidenceRecordDigest,
  selectCanonicalEnglish,
  type FrenchPacketBuildSummary
} from "../scripts/buildLexiconV3FrenchPackets.js";
import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  CURATED_SOURCE_SNAPSHOT_DIGESTS,
  ENGLISH_EVIDENCE_SCHEMA_VERSION,
  englishExactOccurrenceCorpusDigest,
  englishExactOccurrenceGlossDigest,
  type EnglishEvidenceAuditRecord,
  type EnglishEvidenceSourceDigests,
  type EnglishExactOccurrenceEvidence
} from "../src/lexiconV3/evidence.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchLexiconProposal
} from "../src/lexiconV3/frenchValidation.js";
import {
  buildFrenchPacketEnglishReleaseLineage,
  buildFrenchPacket,
  type FrenchPacketEnglishReleaseLineage,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  createLexiconV3ReleaseCandidate,
  planLexiconV3Release,
  promoteLexiconV3Release,
  type LexiconV3ReleaseSummary
} from "../src/lexiconV3/release.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_PROMPT_VERSION,
  finalizeFrenchInternalExecutionReceipt,
  frenchInternalGenerationConfigHash,
  hashFrenchInternalJson,
  type FrenchInternalAuditChecks,
  type FrenchInternalReviewConfiguration
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  buildFrenchHtmlTemplate,
  FRENCH_HTML_RENDERER_VERSION
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import { readLexiconV3AuthoringEnglishSnapshot } from "../src/lexiconV3/authoringEnglish.js";
import {
  PINNED_G20354_PERSEUS_ACCESSED_AT,
  PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
  PINNED_G20354_PERSEUS_ATTRIBUTION,
  PINNED_G20354_PERSEUS_LICENSE_URL,
  PINNED_G20354_PERSEUS_MODIFICATIONS,
  PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
  PINNED_G20354_PERSEUS_PROVENANCE_URL,
  PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
  PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST
} from "../src/lexiconV3/perseusLsjG20354.js";
import {
  buildHebrewEnglishArtifact,
  HEBREW_ENGLISH_SUMMARY_SCHEMA,
  OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST,
  serializeHebrewEnglishCandidates,
  type HebrewEnglishArtifact,
  type HebrewEnglishCandidate,
  writeHebrewEnglishArtifact
} from "../src/lexiconV3/hebrewEnglish.js";
import { buildLexiconEntryKey } from "../src/lexiconV3/identity.js";
import { finalizeFrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";
import {
  lexiconV3ReviewTargetHash,
  LEXICON_V3_REVIEW_DECISION_SCHEMA
} from "../src/lexiconV3/review.js";

test("accepts a gloss field repair only with its complete pinned audit proof", () => {
  const entry = {
    stepEntryId: 10904,
    baseCode: 21370,
    language: "greek" as const,
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
  const sourceDigests: EnglishEvidenceSourceDigests = {
    database: hash("field-repair-database"),
    TBESG: CURATED_SOURCE_SNAPSHOT_DIGESTS.TBESG,
    TBESH: hash("field-repair-tbesh"),
    TFLSJ: CURATED_SOURCE_SNAPSHOT_DIGESTS.TFLSJ,
    TAGNT: { ...CURATED_SOURCE_SNAPSHOT_DIGESTS.TAGNT },
    TAHOT: { fixture: hash("field-repair-tahot") }
  };
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [],
    sourceDigests
  });
  const audit = auditEnglishEvidenceEntry(entry, [], context);
  const fullEntry = {
    id: entry.stepEntryId,
    ...entry,
    language: "greek",
    classicTransliteration: "",
    pronunciation: ""
  };
  assert.equal(validateEnglishAuditFieldRepairs(fullEntry, audit), "wanderer");

  const forged = structuredClone(audit);
  forged.evidence.fieldRepairs[0]!.repairDigest = "0".repeat(64);
  assert.throws(
    () => validateEnglishAuditFieldRepairs(fullEntry, forged),
    /field-repair-proof-invalid/u
  );
  assert.throws(
    () =>
      validateEnglishAuditFieldRepairs(
        { ...fullEntry, meaning: `${fullEntry.meaning} changed` },
        audit
      ),
    /field-repair-proof-invalid/u
  );
});

test("blocks a canonical TBESH meaning when its independent companion reports a source issue", () => {
  const audit = fixtureAuditRecords(hash("fixture-database"))[2]!;
  const candidate = {
    fieldAssessments: {
      meaning: { status: "source_issue", confidence: 0.2 }
    }
  } as unknown as HebrewEnglishCandidate;
  const assessment = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: audit.meaning,
    primaryDStrong: "H0001",
    morph: audit.morph,
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: false,
    baseConfidence: 0.98
  });

  assert.equal(assessment.status, "source_issue");
  assert.ok(
    assessment.issueCodes.includes("hebrew-open-corroboration-source-issue")
  );
});

test("classifies a sectioned proper name without treating the legacy tail as exact dStrong prose", () => {
  const audit = fixtureAuditRecords(hash("fixture-database"))[2]!;
  audit.evidence.brief.citations = {
    references: ["1Kgs.14.1"],
    resolvedReferences: ["1Kgs.14.1"],
    targetHits: ["1Kgs.14.1"],
    otherStrongHits: {}
  };
  const candidate = {
    method: "tipnr-exact-dstrong",
    issues: [],
    mapping: { tipnrEntityIds: [35] },
    fieldAssessments: {
      meaning: { status: "validated", confidence: 0.98 }
    }
  } as unknown as HebrewEnglishCandidate;

  const assessment = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: "The exact son of Jeroboam. § Eight historical homonyms.",
    primaryDStrong: "H0029H",
    morph: "N:N-M-P",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: true,
    baseConfidence: 0.98
  });

  assert.equal(assessment.status, "validated");
  assert.equal(assessment.sectioning.classification, "both");
  assert.equal(assessment.sectioning.stepSpecificScope, "exact_dstrong");
  assert.equal(assessment.sectioning.legacyGeneralScope, "base_strong_context");
  assert.ok(
    assessment.advisoryCodes.includes("tbesh-shared-legacy-general-context")
  );
  assert.equal(
    assessment.issueCodes.includes("tbesh-bundled-scope-review-required"),
    false
  );
});

test("uses an exact TIPNR alias to dismiss only the section-tail gloss false positive", () => {
  const audit = fixtureAuditRecords(hash("fixture-database"))[2]!;
  audit.gloss = "Oholah";
  audit.meaning = "The exact woman. § Aholah = her own tent";
  audit.evidence.sourceAudit.glossSupport = {
    contentTerms: ["oholah"],
    meaningSupportsGloss: false,
    supportingResources: []
  };
  const candidate = {
    method: "tipnr-exact-dstrong",
    issues: [],
    status: "validated",
    mapping: { tipnrEntityIds: [35] },
    fieldAssessments: {
      gloss: {
        status: "validated",
        tier: "auto",
        method: "tipnr-exact-alias",
        confidence: 0.98,
        issueCodes: [],
        evidence: []
      },
      meaning: {
        status: "validated",
        confidence: 0.98
      }
    }
  } as unknown as HebrewEnglishCandidate;

  const assessment = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: audit.meaning,
    primaryDStrong: "H0170",
    morph: "N:N-F-P",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: false,
    baseConfidence: 0.98
  });

  assert.equal(assessment.status, "validated");
  assert.ok(
    assessment.advisoryCodes.includes(
      "tbesh-gloss-supported-by-exact-specific-section"
    )
  );
  assert.ok(!assessment.issueCodes.includes("tbesh-meaning-gloss-mismatch"));
});

test("reconciles a missed citation only through the exact TIPNR and TAHOT scope proof", () => {
  const audit = fixtureAuditRecords(hash("fixture-database"))[2]!;
  audit.meaning = "Exact Abiel at 2Sa.23.31. § General family context.";
  audit.evidence.brief.citations = {
    references: ["2Sam.23.31"],
    resolvedReferences: ["2Sam.23.31"],
    targetHits: [],
    otherStrongHits: { H0045: ["2Sam.23.31"] }
  };
  audit.evidence.exactOccurrence = exactOccurrenceEvidence({
    source: "TAHOT",
    stepStrong: "H0022H",
    references: ["1Chr.11.32"],
    glosses: ["Abiel"]
  });
  const candidate = {
    method: "tipnr-exact-dstrong",
    issues: [],
    mapping: {
      tipnrEntityIds: [15],
      tipnrEntityReferences: ["2Sa.23.31", "1Ch.11.32"]
    },
    fieldAssessments: {
      meaning: { status: "validated", confidence: 0.98 }
    }
  } as unknown as HebrewEnglishCandidate;

  const assessment = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: audit.meaning,
    primaryDStrong: "H0022H",
    morph: "N:N-M-P",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: false,
    baseConfidence: 0.98
  });

  assert.equal(assessment.status, "validated");
  assert.equal(assessment.sectioning.tipnrScopeProof?.proven, true);
  assert.ok(
    assessment.advisoryCodes.includes(
      "tbesh-citations-reconciled-by-tipnr-tahot-scope"
    )
  );
  assert.ok(
    !assessment.issueCodes.includes("tbesh-citations-miss-exact-identity")
  );

  audit.evidence.brief.citations.references = ["Neh.8.7"];
  audit.evidence.brief.citations.resolvedReferences = ["Neh.8.7"];
  const rejected = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: "Exact Abiel at Neh.8.7. § General family context.",
    primaryDStrong: "H0022H",
    morph: "N:N-M-P",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: false,
    baseConfidence: 0.98
  });
  assert.equal(rejected.status, "review_needed");
  assert.ok(
    rejected.issueCodes.includes("tbesh-citations-miss-exact-identity")
  );
});

test("keeps sectioned lexemes and legacy-only shared names in targeted review", () => {
  const audit = fixtureAuditRecords(hash("fixture-database"))[2]!;
  const candidate = {
    method: "tipnr-exact-dstrong",
    issues: [],
    mapping: { tipnrEntityIds: [35] },
    fieldAssessments: {
      meaning: { status: "validated", confidence: 0.98 }
    }
  } as unknown as HebrewEnglishCandidate;

  const lexical = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: "Exact lexical sense. § Historical Strong context.",
    primaryDStrong: "H1121G",
    morph: "H:N-M",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: false,
    baseConfidence: 0.98
  });
  assert.equal(lexical.status, "review_needed");
  assert.ok(
    lexical.issueCodes.includes("tbesh-lexical-sectioned-scope-review-required")
  );

  const legacyOnly = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: "<br /> § Shared historical family context.",
    primaryDStrong: "H0029H",
    morph: "N:N-M-P",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: true,
    baseConfidence: 0.98
  });
  assert.equal(legacyOnly.status, "review_needed");
  assert.ok(
    legacyOnly.issueCodes.includes(
      "tbesh-shared-family-context-without-specific-section"
    )
  );
});

test("treats an empty sectioned meaning as a source issue", () => {
  const audit = fixtureAuditRecords(hash("fixture-database"))[2]!;
  const candidate = {
    method: "tipnr-exact-dstrong",
    issues: [],
    mapping: { tipnrEntityIds: [35] },
    fieldAssessments: {
      meaning: { status: "validated", confidence: 0.98 }
    }
  } as unknown as HebrewEnglishCandidate;
  const assessment = assessCanonicalHebrewMeaning({
    audit,
    candidate,
    selectedStatus: "validated",
    meaningHtml: "<br /> § <br />",
    primaryDStrong: "H0029H",
    morph: "N:N-M-P",
    sharedAcrossSiblingGlosses: false,
    legacyGeneralSharedAcrossSiblings: false,
    baseConfidence: 0.98
  });

  assert.equal(assessment.status, "source_issue");
  assert.ok(assessment.issueCodes.includes("tbesh-empty-sectioned-meaning"));
});

test("builds an atomic English-only authoring database without inventing French", async (t) => {
  const fixture = await createFixture(t);

  const summary = await buildLexiconV3Authoring(fixture.options);
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => db.close());

  assert.equal(
    summary.schema.ok,
    true,
    JSON.stringify(summary.schema, null, 2)
  );
  assert.equal(summary.counts.entries, fixture.records.length);
  assert.equal(summary.counts.entryIds, fixture.records.length);
  assert.equal(summary.counts.frenchFields, 0);
  assert.ok(summary.counts.englishCandidateFields > 0);
  assert.ok(summary.counts.englishBlockedSourceFields > 0);
  assert.equal(summary.counts.frenchCandidateFields, 0);
  assert.equal(summary.counts.frenchBlockedSourceFields, 0);
  assert.equal(summary.counts.carriers, 0);
  assert.equal(summary.counts.carrierEvidence, 0);
  assert.equal(summary.digests.database, fixture.databaseDigest);
  assert.equal(summary.digests.sourceFingerprint.length, 64);
  assert.equal(summary.digests.codeFingerprint.length, 64);

  const repaired = db
    .prepare(
      `SELECT valueText, valueHtml, state
       FROM LexiconFieldVersions
       WHERE entryKey = 'greek:G1623' AND locale = 'en' AND field = 'meaning'`
    )
    .get() as { valueText: string; valueHtml: string; state: string };
  assert.match(repaired.valueText, /sixth/u);
  assert.doesNotMatch(repaired.valueText, /outside/u);
  assert.match(repaired.valueHtml, /ἕκτος/u);
  assert.equal(repaired.state, "candidate");

  const tbesh = db
    .prepare(
      `SELECT sourceKey, rightsStatus, allowDisplay, allowTranslation
       FROM LexiconSources
       WHERE sourceKey LIKE 'step-tbesh-%'
       ORDER BY sourceKey`
    )
    .all() as Array<{
    sourceKey: string;
    rightsStatus: string;
    allowDisplay: number;
    allowTranslation: number;
  }>;
  assert.deepEqual(
    tbesh.map((row) => ({ ...row })),
    [
      {
        sourceKey: "step-tbesh-gloss",
        rightsStatus: "cleared",
        allowDisplay: 1,
        allowTranslation: 1
      },
      {
        sourceKey: "step-tbesh-meaning",
        rightsStatus: "cleared",
        allowDisplay: 1,
        allowTranslation: 1
      }
    ]
  );
  const stepAuditRights = db
    .prepare(
      `SELECT sourceKey, rightsStatus, allowDisplay, allowTranslation,
              json_extract(metadataJson, '$.rightsBasis') AS rightsBasis
       FROM LexiconSources
       WHERE sourceKey IN (
         'step-tagnt', 'step-tahot', 'artifact-english-audit'
       )
       ORDER BY sourceKey`
    )
    .all() as Array<{
    sourceKey: string;
    rightsStatus: string;
    allowDisplay: number;
    allowTranslation: number;
    rightsBasis: string;
  }>;
  assert.equal(stepAuditRights.length, 3);
  for (const source of stepAuditRights) {
    assert.equal(source.rightsStatus, "cleared", source.sourceKey);
    assert.equal(source.allowDisplay, 1, source.sourceKey);
    assert.equal(source.allowTranslation, 1, source.sourceKey);
    assert.match(source.rightsBasis, /permission|rights-cleared/iu);
  }
  const g20354RightsSource = db
    .prepare(
      `SELECT sourceKey, name, witnessFamily, sha256, license, rightsStatus,
              allowDisplay, allowTranslation,
              json_extract(metadataJson, '$.provider') AS provider,
              json_extract(metadataJson, '$.artifactDigest') AS artifactDigest,
              json_extract(metadataJson, '$.artifactFileDigest') AS artifactFileDigest,
              json_extract(metadataJson, '$.payloadDigest') AS payloadDigest,
              json_extract(metadataJson, '$.sourceFileDigest') AS sourceFileDigest,
              json_extract(metadataJson, '$.sourceFragmentDigest') AS sourceFragmentDigest,
              json_extract(metadataJson, '$.licenseUrl') AS licenseUrl,
              json_extract(metadataJson, '$.attribution') AS attribution,
              json_extract(metadataJson, '$.provenanceUrl') AS provenanceUrl,
              json_extract(metadataJson, '$.accessedAt') AS accessedAt,
              json_extract(metadataJson, '$.modifications') AS modifications
       FROM LexiconSources
       WHERE sourceKey = 'perseus-lsj-g20354'`
    )
    .get() as Record<string, string | number>;
  assert.deepEqual(
    { ...g20354RightsSource },
    {
      sourceKey: "perseus-lsj-g20354",
      name: "Perseus LSJ entry n35193 (G20354)",
      witnessFamily: "Perseus-LSJ",
      sha256: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
      license: "CC-BY-SA-4.0",
      rightsStatus: "cleared",
      allowDisplay: 1,
      allowTranslation: 1,
      provider: "Perseus Digital Library",
      artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
      artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
      payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
      sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
      sourceFragmentDigest: PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
      licenseUrl: PINNED_G20354_PERSEUS_LICENSE_URL,
      attribution: PINNED_G20354_PERSEUS_ATTRIBUTION,
      provenanceUrl: PINNED_G20354_PERSEUS_PROVENANCE_URL,
      accessedAt: PINNED_G20354_PERSEUS_ACCESSED_AT,
      modifications: PINNED_G20354_PERSEUS_MODIFICATIONS
    }
  );

  const hebrewFields = db
    .prepare(
      `SELECT field, state
       FROM LexiconFieldVersions
       WHERE entryKey = 'hebrew:H0001' AND locale = 'en'
       ORDER BY field`
    )
    .all();
  assert.deepEqual(
    hebrewFields.map((row) => ({ ...row })),
    [
      { field: "gloss", state: "blocked_source_issue" },
      { field: "meaning", state: "candidate" }
    ]
  );
  const rawAndCanonicalMeaning = db
    .prepare(
      `SELECT assertion.valueText AS sourceText,
              assertion.valueHtml AS sourceHtml,
              field.valueText AS canonicalText,
              field.valueHtml AS canonicalHtml
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey = 'hebrew:H0001' AND field.locale = 'en'
         AND field.field = 'meaning' AND evidence.stance = 'supports'
         AND source.sourceKey = 'step-tbesh-meaning'`
    )
    .get() as {
    sourceText: string;
    sourceHtml: string;
    canonicalText: string;
    canonicalHtml: string;
  };
  assert.equal(
    rawAndCanonicalMeaning.sourceHtml,
    "<b>אָב</b>, father (past<->future).<br /> § shared tail."
  );
  assert.equal(
    rawAndCanonicalMeaning.sourceText,
    "אָב , father (past<->future). § shared tail."
  );
  assert.equal(
    rawAndCanonicalMeaning.canonicalHtml,
    "<b>אָב</b>, father (past&lt;-&gt;future).<br /> § shared tail."
  );
  assert.equal(
    rawAndCanonicalMeaning.canonicalText,
    "אָב , father (past<->future). § shared tail."
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconIssues issue
       JOIN LexiconFieldVersions field ON field.id = issue.fieldVersionId
       WHERE issue.code = 'hebrew-tbesh-meaning-review-needed'
         AND json_extract(issue.detailsJson, '$.assessment.issueCodes') LIKE '%tbesh-lexical-sectioned-scope-review-required%'
         AND field.entryKey = 'hebrew:H0001'`
    ),
    1
  );
  assert.equal(
    count(
      db,
      "SELECT count(*) AS count FROM LexiconIssues WHERE code = 'hebrew-open-gloss-source-issue'"
    ),
    3
  );
  assert.equal(
    count(
      db,
      "SELECT count(*) AS count FROM LexiconIssues WHERE code = 'hebrew-tbesh-meaning-review-needed'"
    ),
    3
  );
  assert.equal(
    count(
      db,
      "SELECT count(*) AS count FROM LexiconIssues WHERE code = 'missing-original' AND severity = 'blocker'"
    ),
    1
  );
  const suffixKeys = db
    .prepare(
      `SELECT entryKey FROM LexiconEntries
       WHERE entryKey IN ('hebrew:H2148V', 'hebrew:H2148v')
       ORDER BY entryKey COLLATE BINARY`
    )
    .all() as Array<{ entryKey: string }>;
  assert.deepEqual(
    suffixKeys.map((row) => row.entryKey),
    ["hebrew:H2148V", "hebrew:H2148v"]
  );

  assert.equal(
    count(
      db,
      "SELECT count(*) AS count FROM LexiconSources WHERE sourceKey = 'artifact-french-review'"
    ),
    0
  );
  const manifestRow = db
    .prepare("SELECT value FROM LexiconV3Meta WHERE key = 'buildManifest'")
    .get() as { value: string };
  const manifest = JSON.parse(manifestRow.value) as {
    expectedEntryCount: number;
    digests: { database: string };
  };
  assert.equal(manifest.expectedEntryCount, fixture.records.length);
  assert.equal(manifest.digests.database, fixture.databaseDigest);

  const writtenSummary = JSON.parse(
    await readFile(fixture.options.summaryJson, "utf8")
  ) as typeof summary;
  assert.deepEqual(writtenSummary.counts, summary.counts);
  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) => name.includes(".tmp-")),
    []
  );
});

test("stores a curated Greek repair as auto-validated with informational audit findings", async (t) => {
  const fixture = await createFixture(t);
  const records = fixture.records.map((record) => {
    if (record.key !== "greek:G1623") return record;
    const updated: EnglishEvidenceAuditRecord = {
      ...record,
      decision: {
        ...record.decision,
        reasonCodes: [
          ...record.decision.reasonCodes,
          "curated-auto-validated-tflsj-repair"
        ]
      }
    };
    updated.recordDigest = englishEvidenceRecordDigest(updated);
    return updated;
  });
  await writeFile(
    fixture.options.englishAudit,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );

  await buildLexiconV3Authoring(fixture.options);
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => db.close());

  const fields = db
    .prepare(
      `SELECT field, state FROM LexiconFieldVersions
       WHERE entryKey = 'greek:G1623' AND locale = 'en'
       ORDER BY field`
    )
    .all() as Array<{ field: string; state: string }>;
  assert.deepEqual(
    fields.map((row) => ({ ...row })),
    [
      { field: "gloss", state: "auto_validated" },
      { field: "meaning", state: "auto_validated" }
    ]
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconIssues
       WHERE entryKey = 'greek:G1623'
         AND status = 'open'
         AND severity IN ('warning', 'blocker')`
    ),
    0
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconIssues
       WHERE entryKey = 'greek:G1623'
         AND code = 'english-audit-meaning-headword-mismatch'
         AND severity = 'info'`
    ),
    1
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence
         ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey = 'greek:G1623'
         AND field.locale = 'en'
         AND field.field = 'meaning'
         AND evidence.stance = 'supports'
         AND assertion.field = 'meaning'
         AND assertion.locale = 'en'
         AND source.sourceKey = 'step-tflsj'
         AND source.rightsStatus = 'cleared'
         AND source.allowDisplay = 1
         AND source.allowTranslation = 1`
    ),
    1
  );
});

test("imports reviewed French fields with exact English parents and explicit carrier evidence", async (t) => {
  const fixture = await createFixture(t);
  const reviewed = fixture.records.find(
    (record) => record.key === "greek:G7770"
  );
  assert.ok(reviewed);
  const review = makeFrenchReview(reviewed, packetFor(fixture, reviewed.key));
  const frenchReview = path.join(fixture.directory, "french-review.jsonl");
  await writeFile(frenchReview, `${JSON.stringify(review)}\n`, "utf8");

  const summary = await buildLexiconV3Authoring({
    ...fixture.options,
    frenchReview
  });
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => db.close());

  assert.equal(summary.counts.frenchFields, 2);
  assert.equal(summary.counts.carriers, 1);
  assert.equal(summary.counts.carrierEvidence, 2);
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconFieldVersions fr
       JOIN LexiconFieldVersions en ON en.id = fr.derivedFromVersionId
       WHERE fr.entryKey = 'greek:G7770'
         AND fr.locale = 'fr'
         AND en.locale = 'en'
         AND fr.field = en.field`
    ),
    2
  );
  const french = db
    .prepare(
      `SELECT field, valueText, state
       FROM LexiconFieldVersions
       WHERE entryKey = 'greek:G7770' AND locale = 'fr'
       ORDER BY field`
    )
    .all();
  assert.deepEqual(
    french.map((row) => ({ ...row })),
    [
      { field: "gloss", valueText: "sixième", state: "auto_validated" },
      {
        field: "meaning",
        valueText: "ἕκτος, η, ον : le nombre ordinal sixième.",
        state: "auto_validated"
      }
    ]
  );
  const carrier = db
    .prepare(
      `SELECT strong, stepStrong, surface, normalized, state, policy
       FROM LexiconCarrierTerms`
    )
    .get();
  assert.deepEqual(
    { ...carrier },
    {
      strong: "G7770",
      stepStrong: "G7770",
      surface: "sixième",
      normalized: "sixieme",
      state: "auto_validated",
      policy: "auto_safe"
    }
  );
  assert.deepEqual(
    (
      db
        .prepare(
          "SELECT witnessFamily FROM LexiconCarrierEvidence ORDER BY witnessFamily"
        )
        .all() as Array<{ witnessFamily: string }>
    ).map((row) => row.witnessFamily),
    ["Darby-family", "Sg1910"]
  );
});

test("accepts a frozen English parent after code-only drift when the rebuilt core snapshot is exact", async (t) => {
  const fixture = await createFixture(t);
  const staleCodeFingerprint = "0".repeat(64);
  const packetSummary = JSON.parse(
    await readFile(fixture.options.frenchPacketSummary!, "utf8")
  ) as FrenchPacketBuildSummary;
  packetSummary.englishRelease.codeFingerprint = staleCodeFingerprint;
  const historical = new DatabaseSync(fixture.reviewedAuthoring, {
    readOnly: true
  });
  const plan = planLexiconV3Release(historical, { profile: "core-en" });
  historical.close();

  assert.doesNotThrow(() =>
    assertFrozenCoreEnglishReleaseContinuity({
      plan,
      summary: packetSummary
    })
  );
});

test("rejects a frozen English parent when the rebuilt core snapshot drifts", async (t) => {
  const fixture = await createFixture(t);
  const database = new DatabaseSync(fixture.reviewedAuthoring, {
    readOnly: true
  });
  const plan = planLexiconV3Release(database, { profile: "core-en" });
  database.close();
  const packetSummary = JSON.parse(
    await readFile(fixture.options.frenchPacketSummary!, "utf8")
  ) as FrenchPacketBuildSummary;
  packetSummary.englishRelease.snapshotFingerprint = "0".repeat(64);

  assert.throws(
    () =>
      assertFrozenCoreEnglishReleaseContinuity({
        plan,
        summary: packetSummary
      }),
    /french-packet-release-authoring-mismatch:snapshot/u
  );
});

test("imports an auto-validated @4 internal review with execution receipts", async (t) => {
  const fixture = await createFixture(t);
  const reviewed = fixture.records.find(
    (record) => record.key === "greek:G7770"
  );
  assert.ok(reviewed);
  const packet = packetFor(fixture, reviewed.key);
  const review = makeFrenchInternalReview(packet);
  assert.equal(review.status, "auto_validated");
  const frenchReview = path.join(
    fixture.directory,
    "french-internal-review.jsonl"
  );
  await writeFile(frenchReview, `${JSON.stringify(review)}\n`, "utf8");

  const summary = await buildLexiconV3Authoring({
    ...fixture.options,
    frenchReview,
    testOnlySkipFrenchEntityArtifactReplay: true
  });
  assert.equal(summary.counts.frenchFields, 2);
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => db.close());
  const rows = db
    .prepare(
      `SELECT field.generator, evidence.witnessFamily, evidence.detailsJson
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence
         ON evidence.fieldVersionId = field.id
       WHERE field.entryKey = 'greek:G7770'
         AND field.locale = 'fr'
         AND field.state = 'auto_validated'
       ORDER BY field.field`
    )
    .all() as Array<{
    generator: string;
    witnessFamily: string;
    detailsJson: string;
  }>;
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.generator, "lexicon-v3-french-internal-review-policy@1");
    assert.equal(row.witnessFamily, "lexicon-v3-french-internal-review");
    const details = JSON.parse(row.detailsJson) as {
      reviewSchemaVersion: string;
      reviewMode: string;
      agentProofHashes: Record<string, string>;
      executionReceiptHashes: Record<string, string>;
      executionAttestationHash: string;
      executionReceiptsDigest: string;
      siblingConsistencyProofHash: string;
    };
    assert.equal(details.reviewSchemaVersion, "lexicon-v3-french-review@4");
    assert.equal(details.reviewMode, "internal_agents");
    assert.deepEqual(Object.keys(details.agentProofHashes).sort(), [
      "arbiter",
      "auditor",
      "proposerA",
      "proposerB"
    ]);
    assert.ok(
      Object.values(details.agentProofHashes).every((hashValue) =>
        /^[a-f0-9]{64}$/u.test(hashValue)
      )
    );
    assert.deepEqual(Object.keys(details.executionReceiptHashes).sort(), [
      "arbiter",
      "auditor",
      "proposerA",
      "proposerB"
    ]);
    for (const hashValue of [
      ...Object.values(details.executionReceiptHashes),
      details.executionAttestationHash,
      details.executionReceiptsDigest,
      details.siblingConsistencyProofHash
    ]) {
      assert.match(hashValue, /^[a-f0-9]{64}$/u);
    }
  }
});

test("fails closed when an @4 review has no physical entity-first configuration", async (t) => {
  const fixture = await createFixture(t);
  const packet = packetFor(fixture, "greek:G7770");
  const review = makeFrenchInternalReview(packet);
  const frenchReview = path.join(
    fixture.directory,
    "french-internal-review-missing-entity-config.jsonl"
  );
  const missingConfiguration = path.join(
    fixture.directory,
    "missing-french-internal-configuration.json"
  );
  await writeFile(frenchReview, `${JSON.stringify(review)}\n`, "utf8");

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      frenchReview,
      frenchConfiguration: missingConfiguration
    }),
    /missing-required-authoring-input:.*missing-french-internal-configuration\.json/u
  );
});

test("rejects a custom-only @4 review without a remediation closure", async (t) => {
  const fixture = await createFixture(t);
  const packet = packetFor(fixture, "greek:G7770");
  const review = makeFrenchInternalReview(
    packet,
    "/fr-internal/custom/remediation-r001"
  );
  const frenchReview = path.join(
    fixture.directory,
    "french-custom-only-review.jsonl"
  );
  await writeFile(frenchReview, `${JSON.stringify(review)}\n`, "utf8");

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      frenchReview,
      testOnlySkipFrenchEntityArtifactReplay: true
    }),
    /french-publication-execution-cohort-drift:final/u
  );
});

test("imports only rights-cleared Hebrew meanings and preserves sub-STEP identity", async (t) => {
  const fixture = await createFixture(t);
  const sourceDb = new DatabaseSync(fixture.options.database);
  sourceDb.exec("BEGIN");
  sourceDb
    .prepare("UPDATE StepEntries SET meaning = ? WHERE id = ?")
    .run("<br /> § shared historical family context.", 21481);
  sourceDb
    .prepare("UPDATE StepEntries SET meaning = ? WHERE id = ?")
    .run("Unrelated unsectioned raw notice.", 12000);
  sourceDb.exec("COMMIT");
  sourceDb.close();
  const updatedDatabaseDigest = await fileHash(fixture.options.database);
  const updatedRecords = fixtureAuditRecords(updatedDatabaseDigest);
  const upperAudit = updatedRecords.find(
    (record) => record.key === "hebrew:H2148V"
  )!;
  upperAudit.meaning = "<br /> § shared historical family context.";
  upperAudit.evidence.exactOccurrence = exactOccurrenceEvidence({
    source: "TAHOT",
    stepStrong: "H2148V",
    references: ["Zech.1.1"],
    glosses: ["male V"]
  });
  upperAudit.recordDigest = englishEvidenceRecordDigest(upperAudit);
  const exactStrongAudit = updatedRecords.find(
    (record) => record.key === "hebrew:H0001"
  )!;
  exactStrongAudit.meaning = "Unrelated unsectioned raw notice.";
  exactStrongAudit.evidence.exactOccurrence = exactOccurrenceEvidence({
    source: "TAHOT",
    stepStrong: "H0001",
    references: ["Gen.1.1", "Gen.1.2", "Gen.1.3", "Gen.1.4", "Gen.1.5"],
    glosses: ["a father", "father", "father/ his", "like/ a father", "ancestor"]
  });
  exactStrongAudit.evidence.sourceAudit.glossSupport = {
    contentTerms: ["father"],
    meaningSupportsGloss: false,
    supportingResources: []
  };
  exactStrongAudit.recordDigest = englishEvidenceRecordDigest(exactStrongAudit);
  await writeFile(
    fixture.options.englishAudit,
    `${updatedRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
  const entities = path.join(fixture.directory, "entities.sqlite");
  const entityDb = new DatabaseSync(entities);
  entityDb.exec(`
    CREATE TABLE Entities (
      id INTEGER PRIMARY KEY,
      displayName TEXT NOT NULL,
      brief TEXT NOT NULL,
      shortDescription TEXT NOT NULL
    );
    CREATE TABLE EntityNames (
      entityId INTEGER NOT NULL,
      dStrong TEXT NOT NULL,
      displayName TEXT NOT NULL
    );
    CREATE TABLE EntityRefs (
      entityId INTEGER NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      suffix TEXT NOT NULL,
      refText TEXT NOT NULL
    );
    CREATE TABLE EntityMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO EntityMeta VALUES
      ('sourceDigests',
       '{"TIPNR.txt":"${"1".repeat(64)}","tipnr-json/people.json":"${"2".repeat(64)}","tipnr-json/places.json":"${"3".repeat(64)}"}');
    INSERT INTO Entities VALUES
      (1, 'male V', 'Upper-case identity',
       'The upper-case sub-STEP identity in the fixture.'),
      (2, 'male v', 'Lower-case identity',
       'The lower-case sub-STEP identity in the fixture.');
    INSERT INTO EntityNames VALUES
      (1, 'H2148V', 'male V'),
      (2, 'H2148v', 'male v');
    INSERT INTO EntityRefs VALUES
      (1, 'Zech', 1, 1, '', 'Zech.1.1');
  `);
  entityDb.close();
  const hebrewStrong = path.join(fixture.directory, "HebrewStrong.xml");
  await writeFile(
    hebrewStrong,
    `<?xml version="1.0"?><lexicon><entry id="H1"><w pos="n-m" xml:lang="heb">אָב</w><source>a primitive word;</source><meaning>a <def>father</def></meaning><usage>father, chief.</usage></entry></lexicon>`,
    "utf8"
  );
  const artifact = buildHebrewEnglishArtifact({
    lexiconDbPath: fixture.options.database,
    entitiesDbPath: entities,
    hebrewStrongPath: hebrewStrong,
    openScripturesRevision: OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.revision,
    verifyPinnedSources: false
  });
  Object.assign(
    artifact.summary.sourceDigests,
    OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.sourceDigests
  );
  const exactStrongCandidate = artifact.records.find(
    (record) => record.entryKey === "hebrew:H0001"
  );
  assert.ok(exactStrongCandidate);
  assert.ok(exactStrongCandidate.fieldAssessments.gloss.evidence[0]);
  exactStrongCandidate.fieldAssessments.gloss.evidence[0]!.matchedText =
    "ancestor";
  reattestHebrewEnglishArtifact(artifact);
  assert.deepEqual(artifact.summary.coverage, {
    total: 3,
    validated: 3,
    reviewNeeded: 0,
    sourceIssue: 0,
    properNames: 2,
    lexemes: 1,
    methods: {
      "tipnr-exact-dstrong": 2,
      "open-scriptures-augmented-exact": 0,
      "open-scriptures-lexical-exact": 0,
      "hebrew-strong-exact": 1,
      "hebrew-strong-substep-anchor": 0,
      "hebrew-strong-proper-name-fallback": 0,
      "missing-open-source": 0
    },
    fields: {
      gloss: {
        validated: 2,
        reviewNeeded: 1,
        sourceIssue: 0,
        tiers: {
          auto: 2,
          candidate_high: 1,
          review: 0,
          source_issue: 0
        }
      },
      meaning: {
        validated: 3,
        reviewNeeded: 0,
        sourceIssue: 0,
        tiers: {
          auto: 3,
          candidate_high: 0,
          review: 0,
          source_issue: 0
        }
      }
    }
  });
  const hebrewEnglish = path.join(fixture.directory, "hebrew-english.jsonl");
  const hebrewEnglishSummary = path.join(
    fixture.directory,
    "hebrew-english.summary.json"
  );
  writeHebrewEnglishArtifact(artifact, hebrewEnglish, hebrewEnglishSummary);

  await buildLexiconV3Authoring({
    ...fixture.options,
    entitiesDatabase: entities,
    hebrewEnglish,
    hebrewEnglishSummary,
    testOnlySkipHebrewSourceRebuild: true
  });
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => db.close());
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconFieldVersions
       WHERE locale = 'en' AND field = 'meaning'
         AND entryKey LIKE 'hebrew:%' AND state = 'auto_validated'`
    ),
    2
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconFieldVersions
       WHERE locale = 'en' AND field = 'meaning'
         AND entryKey IN ('hebrew:H2148V', 'hebrew:H2148v')
         AND state = 'candidate'`
    ),
    1
  );
  const unsectionedFallback = db
    .prepare(
      `SELECT field.valueText, source.sourceKey, evidence.stance,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.action') AS action
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey = 'hebrew:H0001' AND field.field = 'meaning'
         AND evidence.stance = 'supports'`
    )
    .get() as {
    valueText: string;
    sourceKey: string;
    stance: string;
    action: string;
  };
  assert.equal(unsectionedFallback.sourceKey, "artifact-hebrew-open-english");
  assert.equal(unsectionedFallback.stance, "supports");
  assert.equal(unsectionedFallback.action, "exact_companion");
  assert.match(unsectionedFallback.valueText, /father/iu);
  assert.doesNotMatch(unsectionedFallback.valueText, /Unrelated unsectioned/u);
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconFieldVersions
       WHERE locale = 'en' AND field = 'gloss'
         AND entryKey LIKE 'hebrew:%' AND state = 'auto_validated'`
    ),
    3
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconFieldVersions
       WHERE locale = 'en' AND field = 'gloss'
         AND entryKey = 'hebrew:H0001' AND state = 'auto_validated'`
    ),
    1
  );
  const glossValidationEvidence = db
    .prepare(
      `SELECT evidence.evidenceKind, evidence.stance, source.sourceKey
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey = 'hebrew:H2148V' AND field.locale = 'en'
         AND field.field = 'gloss'
         AND source.sourceKey = 'artifact-hebrew-open-english'`
    )
    .get() as {
    evidenceKind: string;
    stance: string;
    sourceKey: string;
  };
  assert.deepEqual(
    { ...glossValidationEvidence },
    {
      evidenceKind: "validator",
      stance: "context",
      sourceKey: "artifact-hebrew-open-english"
    }
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconIssues issue
       JOIN LexiconFieldVersions field ON field.id = issue.fieldVersionId
       WHERE issue.code = 'hebrew-open-gloss-review-needed'
         AND issue.severity = 'warning'
         AND field.entryKey = 'hebrew:H0001' AND field.field = 'gloss'`
    ),
    0
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconIssues issue
       JOIN LexiconFieldVersions field ON field.id = issue.fieldVersionId
       WHERE issue.code = 'hebrew-open-gloss-review-resolved-by-tahot'
         AND issue.severity = 'info'
         AND field.entryKey = 'hebrew:H0001' AND field.field = 'gloss'`
    ),
    1
  );
  const tahotGlossEvidence = db
    .prepare(
      `SELECT field.state, field.confidence, field.generator,
              evidence.evidenceKind, evidence.stance, evidence.witnessFamily,
              source.sourceKey,
              json_extract(evidence.detailsJson, '$.proof.proven') AS proven,
              json_extract(evidence.detailsJson,
                '$.proof.facts.minimumTokenSupportRatio') AS threshold
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey = 'hebrew:H0001' AND field.field = 'gloss'
         AND evidence.witnessFamily = 'STEP-TAHOT-exact-dstrong-gloss'`
    )
    .get();
  assert.deepEqual(
    { ...tahotGlossEvidence },
    {
      state: "auto_validated",
      confidence: 0.9,
      generator: "tahot-exact-occurrence-gloss-proof@1",
      evidenceKind: "cross_source",
      stance: "supports",
      witnessFamily: "STEP-TAHOT-exact-dstrong-gloss",
      sourceKey: "step-tahot",
      proven: 1,
      threshold: 0.8
    }
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconIssues
       WHERE code LIKE 'tbesh-meaning-%rights%' AND status = 'open'`
    ),
    0
  );
  const suffixes = db
    .prepare(
      `SELECT entryKey, valueText FROM LexiconFieldVersions
       WHERE entryKey IN ('hebrew:H2148V', 'hebrew:H2148v')
         AND locale = 'en' AND field = 'meaning'
       ORDER BY entryKey COLLATE BINARY`
    )
    .all() as Array<{ entryKey: string; valueText: string }>;
  assert.deepEqual(
    suffixes.map((row) => row.entryKey),
    ["hebrew:H2148V", "hebrew:H2148v"]
  );
  assert.match(suffixes[0]!.valueText, /upper-case sub-STEP identity/u);
  assert.doesNotMatch(suffixes[0]!.valueText, /Lower-case STEP notice/u);
  assert.match(suffixes[1]!.valueText, /Lower-case STEP notice for male v/u);
  assert.doesNotMatch(suffixes[1]!.valueText, /Upper-case STEP notice/u);
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconIssues issue
       JOIN LexiconFieldVersions field ON field.id = issue.fieldVersionId
       WHERE issue.code = 'hebrew-tbesh-meaning-review-needed'
         AND json_extract(issue.detailsJson, '$.assessment.issueCodes') LIKE '%tbesh-suffixed-scope-unproven%'
         AND field.entryKey IN ('hebrew:H2148V', 'hebrew:H2148v')`
    ),
    1
  );
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count FROM LexiconIssues
       WHERE code = 'hebrew-tbesh-exact-companion-conservative'
         AND entryKey = 'hebrew:H2148V' AND severity = 'info'`
    ),
    1
  );
  const publicationEvidence = db
    .prepare(
      `SELECT source.sourceKey, evidence.evidenceKind, evidence.stance,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.action') AS action
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey = 'hebrew:H2148V' AND field.field = 'meaning'
         AND evidence.stance = 'supports'`
    )
    .get();
  assert.deepEqual(
    { ...publicationEvidence },
    {
      sourceKey: "artifact-hebrew-open-english",
      evidenceKind: "cross_source",
      stance: "supports",
      action: "exact_companion"
    }
  );
  const companionMeanings = db
    .prepare(
      `SELECT assertion.entryKey, assertion.valueText
       FROM LexiconSourceAssertions assertion
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE source.sourceKey = 'artifact-hebrew-open-english'
         AND assertion.field = 'meaning'
         AND assertion.entryKey IN ('hebrew:H2148V', 'hebrew:H2148v')
       ORDER BY assertion.entryKey COLLATE BINARY`
    )
    .all() as Array<{ entryKey: string; valueText: string }>;
  assert.deepEqual(
    companionMeanings.map((row) => row.entryKey),
    ["hebrew:H2148V", "hebrew:H2148v"]
  );
  assert.match(companionMeanings[0]!.valueText, /upper-case sub-STEP/u);
  assert.match(companionMeanings[1]!.valueText, /lower-case sub-STEP/u);
  assert.equal(
    count(
      db,
      `SELECT count(*) AS count
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       JOIN LexiconSourceAssertions assertion ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE field.entryKey LIKE 'hebrew:%' AND field.field = 'meaning'
         AND evidence.stance = 'supports'
         AND (source.rightsStatus <> 'cleared' OR source.allowTranslation <> 1)`
    ),
    0
  );
});

test("refuses a self-consistent Hebrew artifact built from unpinned sources", async (t) => {
  const fixture = await createFixture(t);
  const entities = path.join(fixture.directory, "unpinned-entities.sqlite");
  const entityDb = new DatabaseSync(entities);
  entityDb.exec(`
    CREATE TABLE Entities (
      id INTEGER PRIMARY KEY,
      displayName TEXT NOT NULL,
      brief TEXT NOT NULL,
      shortDescription TEXT NOT NULL
    );
    CREATE TABLE EntityNames (
      entityId INTEGER NOT NULL,
      dStrong TEXT NOT NULL,
      displayName TEXT NOT NULL
    );
    CREATE TABLE EntityRefs (
      entityId INTEGER NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      suffix TEXT NOT NULL,
      refText TEXT NOT NULL
    );
    CREATE TABLE EntityMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO EntityMeta VALUES
      ('sourceDigests',
       '{"TIPNR.txt":"${"1".repeat(64)}","tipnr-json/people.json":"${"2".repeat(64)}","tipnr-json/places.json":"${"3".repeat(64)}"}');
  `);
  entityDb.close();
  const hebrewStrong = path.join(
    fixture.directory,
    "unpinned-HebrewStrong.xml"
  );
  await writeFile(
    hebrewStrong,
    `<?xml version="1.0"?><lexicon><entry id="H1"><source>a primitive word;</source><meaning>a <def>father</def></meaning><usage>father.</usage></entry></lexicon>`,
    "utf8"
  );
  const artifact = buildHebrewEnglishArtifact({
    lexiconDbPath: fixture.options.database,
    entitiesDbPath: entities,
    hebrewStrongPath: hebrewStrong,
    openScripturesRevision: "unverified-local-input",
    verifyPinnedSources: false
  });
  const hebrewEnglish = path.join(
    fixture.directory,
    "unpinned-hebrew-english.jsonl"
  );
  const hebrewEnglishSummary = path.join(
    fixture.directory,
    "unpinned-hebrew-english.summary.json"
  );
  writeHebrewEnglishArtifact(artifact, hebrewEnglish, hebrewEnglishSummary);

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      entitiesDatabase: entities,
      hebrewEnglish,
      hebrewEnglishSummary,
      testOnlySkipHebrewSourceRebuild: true
    }),
    /hebrew-english-unpinned-revision/u
  );

  artifact.summary.openScripturesRevision =
    OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.revision;
  writeHebrewEnglishArtifact(artifact, hebrewEnglish, hebrewEnglishSummary);
  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      entitiesDatabase: entities,
      hebrewEnglish,
      hebrewEnglishSummary,
      testOnlySkipHebrewSourceRebuild: true
    }),
    /hebrew-english-unpinned-source-digest:lexiconAllowedColumns/u
  );

  const unpinnedHebrewStrong = artifact.summary.sourceDigests.hebrewStrong;
  Object.assign(
    artifact.summary.sourceDigests,
    OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.sourceDigests,
    { hebrewStrong: unpinnedHebrewStrong }
  );
  writeHebrewEnglishArtifact(artifact, hebrewEnglish, hebrewEnglishSummary);
  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      entitiesDatabase: entities,
      hebrewEnglish,
      hebrewEnglishSummary,
      testOnlySkipHebrewSourceRebuild: true
    }),
    /hebrew-english-unpinned-source-digest:hebrewStrong/u
  );
});

test("rebuilds French from an editorial English replacement and links the exact new parent", async (t) => {
  const fixture = await createFixture(t);
  const reviewed = fixture.records.find(
    (record) => record.key === "greek:G7770"
  );
  assert.ok(reviewed);
  const draft = new DatabaseSync(fixture.reviewedAuthoring, {
    readOnly: true
  });
  const englishField = draft
    .prepare(
      `SELECT fv.id, fv.entryKey, fv.locale, fv.field, fv.valueText,
              fv.valueHtml, NULL AS parentContentHash
       FROM LexiconFieldVersions fv
       WHERE fv.entryKey = 'greek:G7770' AND fv.locale = 'en'
         AND fv.field = 'meaning' AND fv.state <> 'superseded'`
    )
    .get() as unknown as ReviewTargetRow;
  draft.close();
  const decisionsPath = path.join(
    fixture.directory,
    "english-replacement-decisions.jsonl"
  );
  await writeFile(
    decisionsPath,
    `${JSON.stringify({
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: englishField.entryKey,
      locale: "en",
      field: "meaning",
      fieldVersionId: englishField.id,
      expectedContentHash: reviewTargetHash(englishField),
      verdict: "replace",
      reviewer: "lexicographe-fixture",
      reason: "Définition anglaise éditoriale relue.",
      replacement: {
        valueText: "ἕκτος, η, ον: the ordinal number sixth.",
        valueHtml: "<p><b>ἕκτος</b>, η, ον: the ordinal number sixth.</p>",
        confidence: 0.99,
        evidenceMode: "editorial_replacement",
        sourceNote: "Rédaction indépendante contrôlée dans la fixture."
      },
      decidedAt: "2026-07-12T12:30:00.000Z"
    })}\n`,
    "utf8"
  );
  const revisedEnglish = path.join(
    fixture.directory,
    "reviewed-english-replacement.sqlite"
  );
  await buildLexiconV3Authoring({
    ...fixture.options,
    reviewDecisions: decisionsPath,
    output: revisedEnglish,
    summaryJson: path.join(
      fixture.directory,
      "reviewed-english-replacement.summary.json"
    )
  });
  await rewriteFrenchPacketsForAuthoring(fixture, revisedEnglish);
  const packet = packetFor(fixture, reviewed.key);
  assert.equal(packet.english.status, "human_validated");
  assert.match(packet.english.meaning, /ordinal number sixth/u);
  const frenchReview = path.join(
    fixture.directory,
    "french-after-english-replacement.jsonl"
  );
  await writeFile(
    frenchReview,
    `${JSON.stringify(makeFrenchReview(reviewed, packet))}\n`,
    "utf8"
  );

  await buildLexiconV3Authoring({
    ...fixture.options,
    frenchReview,
    reviewDecisions: decisionsPath
  });
  const final = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => final.close());
  const linkage = final
    .prepare(
      `SELECT fr.derivedFromVersionId AS parentId, en.id AS englishId,
              en.valueText AS englishText, en.state AS englishState
       FROM LexiconFieldVersions fr
       JOIN LexiconFieldVersions en ON en.id = fr.derivedFromVersionId
       WHERE fr.entryKey = 'greek:G7770' AND fr.locale = 'fr'
         AND fr.field = 'meaning' AND fr.state <> 'superseded'`
    )
    .get() as {
    parentId: number;
    englishId: number;
    englishText: string;
    englishState: string;
  };
  assert.equal(linkage.parentId, linkage.englishId);
  assert.equal(linkage.englishState, "human_validated");
  assert.match(linkage.englishText, /ordinal number sixth/u);
  assert.equal(
    count(
      final,
      `SELECT count(*) AS count
       FROM LexiconFieldVersions fr
       JOIN LexiconFieldVersions en ON en.id = fr.derivedFromVersionId
       WHERE fr.locale = 'fr' AND fr.state IN ('auto_validated', 'human_validated')
         AND en.state = 'superseded'`
    ),
    0
  );
});

test("refuses a durable creation when the canonical STEP Hebrew meaning exists", async (t) => {
  const fixture = await createFixture(t);
  const decisionsPath = path.join(
    fixture.directory,
    "english-creation-decisions.jsonl"
  );
  await writeFile(
    decisionsPath,
    `${JSON.stringify({
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: "hebrew:H0001",
      locale: "en",
      field: "meaning",
      expectedContentHash: hash("0"),
      verdict: "create",
      reviewer: "lexicographe-fixture",
      reason: "Notice anglaise originale ajoutée après revue éditoriale.",
      replacement: {
        valueText: "A male parent; also used for an ancestor.",
        valueHtml: "<p>A male parent; also used for an ancestor.</p>",
        confidence: 1,
        evidenceMode: "editorial_replacement",
        sourceNote: "Rédaction originale contrôlée dans la fixture."
      },
      resolveIssueCodes: [
        "missing-english-meaning",
        "hebrew-tbesh-meaning-review-needed"
      ],
      decidedAt: "2026-07-12T12:30:00.000Z"
    })}\n`,
    "utf8"
  );

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      reviewDecisions: decisionsPath
    }),
    /stale-review-decision:hebrew:H0001:en:meaning/u
  );
});

test("replays durable human decisions after rebuilding authoring", async (t) => {
  const fixture = await createFixture(t);
  const reviewed = fixture.records.find(
    (record) => record.key === "greek:G7770"
  );
  assert.ok(reviewed);
  const review = makeFrenchReview(
    reviewed,
    packetFor(fixture, reviewed.key)
  ) as Record<string, unknown>;
  review.status = "review_needed";
  review.artifactHash = reviewArtifactHash(review);
  const frenchReview = path.join(fixture.directory, "french-review.jsonl");
  await writeFile(frenchReview, `${JSON.stringify(review)}\n`, "utf8");

  await buildLexiconV3Authoring({ ...fixture.options, frenchReview });
  const first = new DatabaseSync(fixture.options.output, { readOnly: true });
  const fields = first
    .prepare(
      `SELECT fv.id, fv.entryKey, fv.locale, fv.field, fv.valueText,
              fv.valueHtml, parent.contentHash AS parentContentHash
       FROM LexiconFieldVersions fv
       LEFT JOIN LexiconFieldVersions parent ON parent.id = fv.derivedFromVersionId
       WHERE fv.entryKey = 'greek:G7770' AND fv.locale = 'fr'
       ORDER BY fv.field`
    )
    .all() as unknown as ReviewTargetRow[];
  first.close();
  const decisions = fields.map((field) => ({
    schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
    entryKey: field.entryKey,
    locale: field.locale,
    field: field.field,
    fieldVersionId: field.id,
    expectedContentHash: reviewTargetHash(field),
    verdict: "accept" as const,
    reviewer: "lexicographe-fixture",
    reason: "Contenu relu contre les sources du paquet.",
    decidedAt: "2026-07-12T13:00:00.000Z"
  }));
  const reviewDecisions = path.join(
    fixture.directory,
    "review-decisions.jsonl"
  );
  await writeFile(
    reviewDecisions,
    `${decisions.map((decision) => JSON.stringify(decision)).join("\n")}\n`,
    "utf8"
  );

  const summary = await buildLexiconV3Authoring({
    ...fixture.options,
    frenchReview,
    reviewDecisions
  });
  const rebuilt = new DatabaseSync(fixture.options.output, { readOnly: true });
  t.after(() => rebuilt.close());
  assert.equal(
    count(
      rebuilt,
      `SELECT count(*) AS count FROM LexiconFieldVersions
       WHERE entryKey = 'greek:G7770' AND locale = 'fr'
         AND state = 'human_validated'`
    ),
    2
  );
  assert.equal(
    count(
      rebuilt,
      `SELECT count(*) AS count FROM LexiconFieldReviews
       WHERE reviewerType = 'human' AND reviewer = 'lexicographe-fixture'`
    ),
    2
  );
  assert.equal(summary.inputs.reviewDecisions, reviewDecisions);
});

test("rejects contradictory durable decisions for the same field", async (t) => {
  const fixture = await createFixture(t);
  const reviewed = fixture.records.find(
    (record) => record.key === "greek:G7770"
  );
  assert.ok(reviewed);
  const review = makeFrenchReview(
    reviewed,
    packetFor(fixture, reviewed.key)
  ) as Record<string, unknown>;
  review.status = "review_needed";
  review.artifactHash = reviewArtifactHash(review);
  const frenchReview = path.join(fixture.directory, "review-candidate.jsonl");
  await writeFile(frenchReview, `${JSON.stringify(review)}\n`, "utf8");
  await buildLexiconV3Authoring({ ...fixture.options, frenchReview });
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  const field = db
    .prepare(
      `SELECT fv.id, fv.entryKey, fv.locale, fv.field, fv.valueText,
              fv.valueHtml, parent.contentHash AS parentContentHash
       FROM LexiconFieldVersions fv
       LEFT JOIN LexiconFieldVersions parent ON parent.id = fv.derivedFromVersionId
       WHERE fv.entryKey = 'greek:G7770' AND fv.locale = 'fr' AND fv.field = 'gloss'`
    )
    .get() as unknown as ReviewTargetRow;
  db.close();
  const base = {
    schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
    entryKey: field.entryKey,
    locale: field.locale,
    field: field.field,
    fieldVersionId: field.id,
    expectedContentHash: reviewTargetHash(field),
    reviewer: "lexicographe-fixture",
    reason: "Décision contradictoire de fixture.",
    decidedAt: "2026-07-12T13:00:00.000Z"
  };
  const decisionsPath = path.join(
    fixture.directory,
    "contradictory-decisions.jsonl"
  );
  await writeFile(
    decisionsPath,
    `${JSON.stringify({ ...base, verdict: "accept" })}\n${JSON.stringify({
      ...base,
      verdict: "reject"
    })}\n`,
    "utf8"
  );

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      frenchReview,
      reviewDecisions: decisionsPath
    }),
    /duplicate-review-decision/u
  );
});

test("rejects forged human model status and unsafe reviewed HTML", async (t) => {
  const fixture = await createFixture(t);
  const reviewed = fixture.records.find(
    (record) => record.key === "greek:G7770"
  );
  assert.ok(reviewed);
  const forged = makeFrenchReview(
    reviewed,
    packetFor(fixture, reviewed.key)
  ) as Record<string, unknown>;
  forged.status = "human_validated";
  forged.artifactHash = reviewArtifactHash(forged);
  const forgedPath = path.join(fixture.directory, "forged-review.jsonl");
  await writeFile(forgedPath, `${JSON.stringify(forged)}\n`, "utf8");
  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      frenchReview: forgedPath
    }),
    /model-artifact-cannot-be-human-validated/u
  );

  const forgedCarrier = makeFrenchReview(
    reviewed,
    packetFor(fixture, reviewed.key)
  ) as Record<string, unknown>;
  forgedCarrier.carrierTerms = [
    {
      surface: "mot-falsifié",
      normalized: "mot falsifie",
      state: "human_validated",
      policy: "auto_safe",
      confidence: 1,
      witnessFamilies: ["Fake-A", "Fake-B"],
      sources: ["Fake-A", "Fake-B"],
      reason: "forged"
    }
  ];
  forgedCarrier.artifactHash = reviewArtifactHash(forgedCarrier);
  const forgedCarrierPath = path.join(
    fixture.directory,
    "forged-carrier-review.jsonl"
  );
  await writeFile(
    forgedCarrierPath,
    `${JSON.stringify(forgedCarrier)}\n`,
    "utf8"
  );
  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      frenchReview: forgedCarrierPath
    }),
    /french-review-carrier-mismatch/u
  );

  const review = makeFrenchReview(
    reviewed,
    packetFor(fixture, reviewed.key)
  ) as Record<string, unknown>;
  review.status = "review_needed";
  review.artifactHash = reviewArtifactHash(review);
  const reviewPath = path.join(fixture.directory, "candidate-review.jsonl");
  await writeFile(reviewPath, `${JSON.stringify(review)}\n`, "utf8");
  await buildLexiconV3Authoring({
    ...fixture.options,
    frenchReview: reviewPath
  });
  const db = new DatabaseSync(fixture.options.output, { readOnly: true });
  const meaning = db
    .prepare(
      `SELECT fv.id, fv.entryKey, fv.locale, fv.field, fv.valueText,
              fv.valueHtml, parent.contentHash AS parentContentHash
       FROM LexiconFieldVersions fv
       LEFT JOIN LexiconFieldVersions parent ON parent.id = fv.derivedFromVersionId
       WHERE fv.entryKey = 'greek:G7770' AND fv.locale = 'fr' AND fv.field = 'meaning'`
    )
    .get() as unknown as ReviewTargetRow;
  db.close();
  const unsafeDecisions = path.join(
    fixture.directory,
    "unsafe-decisions.jsonl"
  );
  await writeFile(
    unsafeDecisions,
    `${JSON.stringify({
      schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
      entryKey: meaning.entryKey,
      locale: meaning.locale,
      field: meaning.field,
      fieldVersionId: meaning.id,
      expectedContentHash: reviewTargetHash(meaning),
      verdict: "replace",
      reviewer: "lexicographe-fixture",
      reason: "Fixture hostile.",
      replacement: {
        valueText: "dangereux",
        valueHtml: "<script>alert(1)</script>",
        confidence: 1,
        evidenceMode: "inherit"
      },
      decidedAt: "2026-07-12T13:00:00.000Z"
    })}\n`,
    "utf8"
  );
  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      frenchReview: reviewPath,
      reviewDecisions: unsafeDecisions
    }),
    /invalid-reviewed-html/u
  );
});

test("keeps an existing authoring output untouched when source validation fails", async (t) => {
  const fixture = await createFixture(t);
  await writeFile(fixture.options.output, "sentinel", "utf8");
  const stale = fixture.records.map((record, index) => {
    if (index !== 0) return record;
    const changed: EnglishEvidenceAuditRecord = {
      ...record,
      sourceDigests: { ...record.sourceDigests, database: "0".repeat(64) }
    };
    changed.recordDigest = englishEvidenceRecordDigest(changed);
    return changed;
  });
  await writeFile(
    fixture.options.englishAudit,
    `${stale.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );

  await assert.rejects(
    buildLexiconV3Authoring(fixture.options),
    /english-audit-database-digest-mismatch/u
  );
  assert.equal(await readFile(fixture.options.output, "utf8"), "sentinel");
  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) => name.includes(".tmp-")),
    []
  );
});

test("rejects a symlink preemption of the private staging database without touching inputs or the old pair", async (t) => {
  const fixture = await createFixture(t);
  const oldOutput = Buffer.from("old-authoring-database");
  const oldSummary = Buffer.from("old-authoring-summary");
  await Promise.all([
    writeFile(fixture.options.output, oldOutput),
    writeFile(fixture.options.summaryJson, oldSummary)
  ]);
  const protectedInputs = [
    fixture.options.database,
    fixture.options.entitiesDatabase,
    fixture.options.englishAudit
  ];
  const protectedBytes = await Promise.all(
    protectedInputs.map((file) => readFile(file))
  );

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      testOnlyHooks: {
        beforeStagingDatabaseOpen: ({ stagingDatabase }) => {
          symlinkSync(fixture.options.database, stagingDatabase);
        }
      }
    }),
    /authoring-staging-path-not-empty:staging-database-before-open/u
  );

  assert.deepEqual(await readFile(fixture.options.output), oldOutput);
  assert.deepEqual(await readFile(fixture.options.summaryJson), oldSummary);
  for (const [index, file] of protectedInputs.entries()) {
    assert.deepEqual(await readFile(file), protectedBytes[index]);
  }
  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) =>
      name.includes(".transaction")
    ),
    []
  );
});

test("rolls back both old artifacts when installation fails between database and summary", async (t) => {
  const fixture = await createFixture(t);
  const oldOutput = Buffer.from("old-authoring-database-before-pair-install");
  const oldSummary = Buffer.from("old-authoring-summary-before-pair-install");
  await Promise.all([
    writeFile(fixture.options.output, oldOutput),
    writeFile(fixture.options.summaryJson, oldSummary)
  ]);
  const protectedInputs = [
    fixture.options.database,
    fixture.options.entitiesDatabase,
    fixture.options.englishAudit
  ];
  const protectedBytes = await Promise.all(
    protectedInputs.map((file) => readFile(file))
  );

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      testOnlyHooks: {
        afterFirstPairInstall: () => {
          throw new Error("injected-authoring-pair-install-failure");
        }
      }
    }),
    /injected-authoring-pair-install-failure/u
  );

  assert.deepEqual(await readFile(fixture.options.output), oldOutput);
  assert.deepEqual(await readFile(fixture.options.summaryJson), oldSummary);
  for (const [index, file] of protectedInputs.entries()) {
    assert.deepEqual(await readFile(file), protectedBytes[index]);
  }
  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) =>
      name.includes(".transaction")
    ),
    []
  );
});

test("refuses output equal to the source database without changing its bytes", async (t) => {
  const fixture = await createFixture(t);
  const before = await readFile(fixture.options.database);
  const summaryJson = path.join(
    fixture.directory,
    "database-collision.summary.json"
  );

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      output: fixture.options.database,
      summaryJson
    }),
    /authoring-write-input-path-collision:output:database/u
  );

  assert.deepEqual(await readFile(fixture.options.database), before);
  assert.equal(existsSync(summaryJson), false);
  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) => name.includes(".tmp-")),
    []
  );
});

test("refuses one path for output and summary without changing existing bytes", async (t) => {
  const fixture = await createFixture(t);
  const collision = path.join(fixture.directory, "shared-authoring-output");
  await writeFile(collision, "existing-shared-output", "utf8");
  const before = await readFile(collision);

  await assert.rejects(
    buildLexiconV3Authoring({
      ...fixture.options,
      output: collision,
      summaryJson: collision
    }),
    /authoring-write-path-collision:output:summaryJson/u
  );

  assert.deepEqual(await readFile(collision), before);
  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) => name.includes(".tmp-")),
    []
  );
});

test("refuses output and summary collisions with every authoring input provenance", async (t) => {
  const fixture = await createFixture(t);
  const hebrewSourcesDirectory = path.join(
    fixture.directory,
    "hebrew-source-provenance"
  );
  await mkdir(hebrewSourcesDirectory);
  const hebrewSource = path.join(hebrewSourcesDirectory, "HebrewStrong.xml");
  const optionalPaths = {
    frenchReview: path.join(fixture.directory, "french-review.jsonl"),
    frenchRemediationSummary: path.join(
      fixture.directory,
      "french-remediation.summary.json"
    ),
    hebrewEnglish: path.join(fixture.directory, "hebrew-english.jsonl"),
    hebrewEnglishSummary: path.join(
      fixture.directory,
      "hebrew-english.summary.json"
    ),
    reviewDecisions: path.join(fixture.directory, "review-decisions.json")
  };
  await Promise.all([
    writeFile(hebrewSource, "hebrew-source-sentinel", "utf8"),
    ...Object.entries(optionalPaths).map(([label, file]) =>
      writeFile(file, `${label}-sentinel`, "utf8")
    )
  ]);
  const options: BuildLexiconV3AuthoringOptions = {
    ...fixture.options,
    ...optionalPaths,
    hebrewSourcesDirectory,
    testOnlySkipHebrewSourceRebuild: true
  };
  const collisions = [
    { label: "database", path: options.database },
    { label: "entitiesDatabase", path: options.entitiesDatabase },
    {
      label: "hebrewSourcesDirectory",
      path: hebrewSource
    },
    { label: "englishAudit", path: options.englishAudit },
    { label: "frenchReview", path: options.frenchReview! },
    { label: "frenchPackets", path: options.frenchPackets! },
    { label: "frenchPacketSummary", path: options.frenchPacketSummary! },
    {
      label: "frenchRemediationSummary",
      path: options.frenchRemediationSummary!
    },
    { label: "hebrewEnglish", path: options.hebrewEnglish! },
    { label: "hebrewEnglishSummary", path: options.hebrewEnglishSummary! },
    { label: "reviewDecisions", path: options.reviewDecisions! }
  ];
  const protectedFiles = [...new Set(collisions.map((value) => value.path))];
  const originalDigests = new Map(
    await Promise.all(
      protectedFiles.map(async (file) => [file, await fileHash(file)] as const)
    )
  );

  for (const destination of ["output", "summaryJson"] as const) {
    for (const [index, collision] of collisions.entries()) {
      const safeOutput = path.join(
        fixture.directory,
        `safe-${destination}-${index}.sqlite`
      );
      const safeSummary = path.join(
        fixture.directory,
        `safe-${destination}-${index}.summary.json`
      );
      await assert.rejects(
        buildLexiconV3Authoring({
          ...options,
          output: destination === "output" ? collision.path : safeOutput,
          summaryJson:
            destination === "summaryJson" ? collision.path : safeSummary
        }),
        new RegExp(
          `authoring-write-input-path-collision:${destination}:${collision.label}`,
          "u"
        )
      );
      assert.equal(existsSync(safeOutput), false);
      assert.equal(existsSync(safeSummary), false);
      for (const file of protectedFiles) {
        assert.equal(await fileHash(file), originalDigests.get(file));
      }
    }
  }

  assert.deepEqual(
    (await readdir(fixture.directory)).filter((name) => name.includes(".tmp-")),
    []
  );
});

test("rejects a re-digested schema-v9 audit with forged TAHOT occurrence evidence", async (t) => {
  const fixture = await createFixture(t);
  const records = structuredClone(fixture.records);
  const target = records.find((record) => record.key === "hebrew:H0001");
  assert.ok(target);
  target.evidence.exactOccurrence = exactOccurrenceEvidence({
    source: "TAHOT",
    stepStrong: "H0001",
    references: ["Gen.1.1"],
    glosses: ["father"]
  });
  target.evidence.exactOccurrence.occurrences[0]!.gloss = "forged";
  target.recordDigest = englishEvidenceRecordDigest(target);
  await writeFile(
    fixture.options.englishAudit,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );

  await assert.rejects(
    buildLexiconV3Authoring(fixture.options),
    /invalid-english-audit-exact-occurrences:hebrew:H0001:english-exact-occurrence-gloss-digest-mismatch/u
  );
});

test(
  "keeps all production STEP entry keys unique, including case-sensitive suffixes",
  {
    skip: !existsSync("data/dictionaries/strong_lexicon.full.production.sqlite")
  },
  () => {
    const db = new DatabaseSync(
      "data/dictionaries/strong_lexicon.full.production.sqlite",
      { readOnly: true }
    );
    try {
      const rows = db
        .prepare("SELECT language, dStrong FROM StepEntries")
        .all() as Array<{ language: string; dStrong: string }>;
      const keys = rows.map((row) =>
        buildLexiconEntryKey(row.language, row.dStrong)
      );
      assert.equal(rows.length, 22_717);
      assert.equal(new Set(keys).size, 22_717);
      assert.ok(keys.includes("hebrew:H2148V"));
      assert.ok(keys.includes("hebrew:H2148v"));
    } finally {
      db.close();
    }
  }
);

interface Fixture {
  directory: string;
  options: BuildLexiconV3AuthoringOptions;
  records: EnglishEvidenceAuditRecord[];
  packets: LexiconV3FrenchPacket[];
  databaseDigest: string;
  reviewedAuthoring: string;
}

async function createFixture(t: test.TestContext): Promise<Fixture> {
  const directory = await mkdtemp(path.join(tmpdir(), "lexicon-v3-authoring-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const database = path.join(directory, "full.sqlite");
  const entitiesDatabase = path.join(directory, "authoring-entities.sqlite");
  const englishAudit = path.join(directory, "english-audit.jsonl");
  const frenchPackets = path.join(directory, "french-packets.jsonl");
  const frenchPacketSummary = path.join(
    directory,
    "french-packets.summary.json"
  );
  const legacyDatabase = path.join(directory, "legacy.sqlite");
  const sg1910 = path.join(directory, "Sg1910.csv");
  const darby = path.join(directory, "Darby.csv");
  const darbyR = path.join(directory, "DarbyR.csv");
  const output = path.join(directory, "authoring.sqlite");
  const summaryJson = path.join(directory, "authoring.summary.json");
  createFullDatabase(database);
  const entitiesDb = new DatabaseSync(entitiesDatabase);
  entitiesDb.exec(
    "CREATE TABLE EntityMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  );
  entitiesDb.close();
  const databaseDigest = await fileHash(database);
  const records = fixtureAuditRecords(databaseDigest);
  await writeFile(
    englishAudit,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
  const reviewedAuthoring = path.join(directory, "reviewed-english.sqlite");
  await buildLexiconV3Authoring({
    database,
    entitiesDatabase,
    englishAudit,
    output: reviewedAuthoring,
    summaryJson: path.join(directory, "reviewed-english.summary.json"),
    generatedAt: "2026-07-12T09:00:00.000Z"
  });
  const releaseFixture = promoteFixtureCoreEnglishRelease(
    reviewedAuthoring,
    "lexicon-v3-en-authoring-fixture.1"
  );
  const reviewedDb = new DatabaseSync(reviewedAuthoring, { readOnly: true });
  const englishSnapshot = readLexiconV3AuthoringEnglishSnapshot(reviewedDb);
  reviewedDb.close();
  const packets = records.map((record) =>
    makeFrenchPacket(
      record,
      englishSnapshot.records.get(record.key),
      releaseFixture.lineages.get(record.key)
    )
  );
  await writeFile(
    frenchPackets,
    `${packets.map((packet) => JSON.stringify(packet)).join("\n")}\n`,
    "utf8"
  );
  await Promise.all([
    writeFile(legacyDatabase, "legacy-fixture", "utf8"),
    writeFile(sg1910, "sg1910-fixture", "utf8"),
    writeFile(darby, "darby-fixture", "utf8"),
    writeFile(darbyR, "darby-r-fixture", "utf8")
  ]);
  const statusCounts = Object.fromEntries(
    ["validated", "human_validated", "review_needed", "source_issue"].map(
      (status) => [
        status,
        packets.filter((packet) => packet.english.status === status).length
      ]
    )
  );
  await writeFile(
    frenchPacketSummary,
    `${JSON.stringify({
      schemaVersion: "lexicon-v3-french-packet-build@3",
      generatedAt: "2026-07-12T10:00:00.000Z",
      inputRecords: records.length,
      outputPackets: packets.length,
      englishStatusCounts: statusCounts,
      withLegacy: 0,
      withExistingFrench: 0,
      withResourceFrench: 0,
      concordanceForms: packets.length,
      sourcePaths: {
        input: englishAudit,
        database,
        legacyDatabase,
        sg1910,
        darby,
        darbyR,
        authoring: reviewedAuthoring,
        output: frenchPackets,
        summaryJson: frenchPacketSummary,
        report: path.join(directory, "french-packets.md")
      },
      sourceDigests: {
        englishEvidence: await fileHash(englishAudit),
        fullDatabase: databaseDigest,
        legacyDatabase: await fileHash(legacyDatabase),
        Sg1910: await fileHash(sg1910),
        Darby: await fileHash(darby),
        DarbyR: await fileHash(darbyR),
        englishAuthoring: await fileHash(reviewedAuthoring)
      },
      englishAuthoring: {
        path: reviewedAuthoring,
        digest: await fileHash(reviewedAuthoring)
      },
      englishRelease: releaseFixture.attestation,
      outputDigest: await fileHash(frenchPackets)
    })}\n`,
    "utf8"
  );
  return {
    directory,
    databaseDigest,
    records,
    packets,
    reviewedAuthoring,
    options: {
      database,
      entitiesDatabase,
      englishAudit,
      frenchPackets,
      frenchPacketSummary,
      output,
      summaryJson,
      generatedAt: "2026-07-12T12:00:00.000Z",
      testOnlySkipFrozenCoreEnglishReleaseContinuity: true
    }
  };
}

function createFullDatabase(path: string): void {
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      CREATE TABLE StepEntries (
        id INTEGER PRIMARY KEY,
        language TEXT NOT NULL,
        baseCode INTEGER NOT NULL,
        eStrong TEXT NOT NULL,
        dStrong TEXT NOT NULL,
        uStrong TEXT NOT NULL,
        original TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        morph TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        classicTransliteration TEXT NOT NULL DEFAULT '',
        pronunciation TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE LexiconResources (
        id INTEGER PRIMARY KEY,
        stepEntryId INTEGER NOT NULL,
        source TEXT NOT NULL,
        kind TEXT NOT NULL,
        contentHtml TEXT NOT NULL
      );
      CREATE TABLE DictionaryMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

      INSERT INTO StepEntries VALUES
        (1673, 'greek', 1623, 'G1623', 'G1623 =', 'G1623', 'ἕκτος',
         'hektos', 'G:A', 'sixth', '<b>ἐκτός</b>, outside, beyond or except.', '', ''),
        (7770, 'greek', 7770, 'G7770', 'G7770 =', 'G7770', 'ἕκτος',
         'hektos-fixture', 'G:A', 'sixth', '<b>ἕκτος</b>, sixth.', '', ''),
        (12000, 'hebrew', 1, 'H0001', 'H0001 =', 'H0001', 'אָב',
         'ab', 'H:N', 'father', '<b>אָב</b>, father (past<->future).<br /> § shared tail.', '', ''),
        (2, 'greek', 2, 'G0002', 'G0002 =', 'G0002', '',
         'missing', 'G:N', 'second', '<b>δεύτερος</b>, second.', '', ''),
        (21481, 'hebrew', 2148, 'H2148a', 'H2148V =', 'H2148V', 'זָכָר',
         'zakar-v', 'N:N-M-P', 'male V',
         'Upper-case STEP notice for male V.<br /> § shared tail.', '', ''),
        (21482, 'hebrew', 2148, 'H2148a', 'H2148v =', 'H2148v', 'זָכָר',
         'zakar-v-lower', 'N:N-M-P', 'male v',
         'Lower-case STEP notice for male v.<br /> § shared tail.', '', '');

      INSERT INTO LexiconResources VALUES
        (1673, 1673, 'TFLSJ', 'classical_full',
         '<b>ἕκτος</b>, η, ον, <b>sixth</b>.');

      INSERT INTO DictionaryMeta VALUES (
        'sourceDigests',
        '${JSON.stringify({
          "TBESG.txt": hash("a"),
          "TBESH.txt": hash("b"),
          "TFLSJ.txt": hash("c")
        }).replaceAll("'", "''")}'
      );
    `);
  } finally {
    db.close();
  }
}

function fixtureAuditRecords(
  databaseDigest: string
): EnglishEvidenceAuditRecord[] {
  const sourceDigests: EnglishEvidenceSourceDigests = {
    database: databaseDigest,
    TBESG: hash("a"),
    TBESH: hash("b"),
    TFLSJ: hash("c"),
    TAGNT: { "TAGNT fixture": hash("d") },
    TAHOT: { "TAHOT fixture": hash("e") }
  };
  const records: EnglishEvidenceAuditRecord[] = [
    makeAuditRecord({
      sourceDigests,
      key: "greek:G1623",
      stepEntryId: 1673,
      language: "greek",
      eStrong: "G1623",
      dStrong: "G1623 =",
      uStrong: "G1623",
      original: "ἕκτος",
      transliteration: "hektos",
      morph: "G:A",
      gloss: "sixth",
      meaning: "<b>ἐκτός</b>, outside, beyond or except.",
      resources: [
        {
          resourceId: 1673,
          stepEntryId: 1673,
          source: "TFLSJ",
          kind: "classical_full",
          contentHtml: "<b>ἕκτος</b>, η, ον, <b>sixth</b>."
        }
      ],
      decision: {
        status: "repaired",
        canonicalSource: "TFLSJ",
        extendedSource: null,
        quarantinedSources: ["TBESG"],
        reasonCodes: [
          "confirmed-brief-source-conflict",
          "coherent-tflsj-repair"
        ]
      },
      briefHeadword: "ἐκτός",
      sourceAuditFindings: [
        {
          code: "meaning-headword-mismatch",
          severity: "error",
          message: "Wrong brief headword."
        }
      ]
    }),
    makeAuditRecord({
      sourceDigests,
      key: "greek:G7770",
      stepEntryId: 7770,
      language: "greek",
      eStrong: "G7770",
      dStrong: "G7770 =",
      uStrong: "G7770",
      original: "ἕκτος",
      transliteration: "hektos-fixture",
      morph: "G:A",
      gloss: "sixth",
      meaning: "<b>ἕκτος</b>, sixth."
    }),
    makeAuditRecord({
      sourceDigests,
      key: "hebrew:H0001",
      stepEntryId: 12000,
      language: "hebrew",
      eStrong: "H0001",
      dStrong: "H0001 =",
      uStrong: "H0001",
      original: "אָב",
      transliteration: "ab",
      morph: "H:N",
      gloss: "father",
      meaning: "<b>אָב</b>, father (past<->future).<br /> § shared tail."
    }),
    makeAuditRecord({
      sourceDigests,
      key: "greek:G0002",
      stepEntryId: 2,
      language: "greek",
      eStrong: "G0002",
      dStrong: "G0002 =",
      uStrong: "G0002",
      original: "",
      transliteration: "missing",
      morph: "G:N",
      gloss: "second",
      meaning: "<b>δεύτερος</b>, second."
    }),
    makeAuditRecord({
      sourceDigests,
      key: "hebrew:H2148V",
      stepEntryId: 21481,
      language: "hebrew",
      eStrong: "H2148a",
      dStrong: "H2148V =",
      uStrong: "H2148V",
      original: "זָכָר",
      transliteration: "zakar-v",
      morph: "N:N-M-P",
      gloss: "male V",
      meaning: "Upper-case STEP notice for male V.<br /> § shared tail."
    }),
    makeAuditRecord({
      sourceDigests,
      key: "hebrew:H2148v",
      stepEntryId: 21482,
      language: "hebrew",
      eStrong: "H2148a",
      dStrong: "H2148v =",
      uStrong: "H2148v",
      original: "זָכָר",
      transliteration: "zakar-v-lower",
      morph: "N:N-M-P",
      gloss: "male v",
      meaning: "Lower-case STEP notice for male v.<br /> § shared tail."
    })
  ];
  return records;
}

function makeAuditRecord(input: {
  sourceDigests: EnglishEvidenceSourceDigests;
  key: string;
  stepEntryId: number;
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
  resources?: EnglishEvidenceAuditRecord["resources"];
  decision?: EnglishEvidenceAuditRecord["decision"];
  briefHeadword?: string;
  sourceAuditFindings?: Array<Record<string, unknown>>;
}): EnglishEvidenceAuditRecord {
  const briefSource = input.language === "greek" ? "TBESG" : "TBESH";
  const record: EnglishEvidenceAuditRecord = {
    schemaVersion: ENGLISH_EVIDENCE_SCHEMA_VERSION,
    key: input.key,
    stepEntryId: input.stepEntryId,
    language: input.language,
    eStrong: input.eStrong,
    dStrong: input.dStrong,
    uStrong: input.uStrong,
    original: input.original,
    transliteration: input.transliteration,
    morph: input.morph,
    gloss: input.gloss,
    meaning: input.meaning,
    reconstruction: null,
    resources: input.resources ?? [],
    evidence: {
      brief: {
        source: briefSource,
        digest:
          input.language === "greek"
            ? input.sourceDigests.TBESG
            : input.sourceDigests.TBESH,
        headword: (input.briefHeadword ?? input.original) || null,
        headwordMatchesEntry: input.original ? true : null,
        headwordOwnerKeys: [],
        declaredRelatedStrongCodes: [],
        headwordMatchesDeclaredRelation: false,
        contentMentionsEntryOriginal: false,
        conflictOwner: null,
        citations: emptyCitations(),
        issues: [],
        quarantined:
          input.decision?.quarantinedSources.includes(briefSource) ?? false
      },
      TFLSJ: input.resources?.length
        ? {
            source: "TFLSJ",
            digest: input.sourceDigests.TFLSJ,
            headword: input.original || null,
            headwordMatchesEntry: input.original ? true : null,
            headwordOwnerKeys: [],
            declaredRelatedStrongCodes: [],
            headwordMatchesDeclaredRelation: false,
            contentMentionsEntryOriginal: false,
            conflictOwner: null,
            citations: emptyCitations(),
            issues: [],
            quarantined: false
          }
        : null,
      exactOccurrence: exactOccurrenceEvidence({
        source: input.language === "greek" ? "TAGNT" : "TAHOT",
        stepStrong: input.dStrong.split(/\s+/u)[0] ?? input.eStrong,
        references: [],
        glosses: []
      }),
      alternateStrongAlias: null,
      semanticGlossAttestation: null,
      sourceAudit: {
        identity: {
          entryKey: input.key,
          language: input.language,
          primaryDStrong: input.dStrong.split(/\s+/u)[0] ?? input.eStrong,
          eStrong: input.eStrong,
          dStrong: input.dStrong,
          uStrong: input.uStrong
        },
        status: "source_ok",
        requiresReview: false,
        meaningHeadword: {
          candidate: input.original || null,
          originals: input.original ? [input.original] : [],
          match: input.original ? "exact" : "unavailable",
          matches: input.original ? true : null,
          matchedOriginal: input.original || null,
          reason: "Fixture source audit."
        },
        glossSupport: {
          contentTerms: input.gloss ? [input.gloss] : [],
          meaningSupportsGloss: true,
          supportingResources: []
        },
        resources: [],
        findings: input.sourceAuditFindings ?? [],
        selection: {
          strategy: "step_primary",
          source: "STEP",
          kind: "brief",
          automatic: true,
          reason: "Fixture source audit accepted the canonical STEP brief."
        }
      } as unknown as EnglishEvidenceAuditRecord["evidence"]["sourceAudit"],
      fieldRepairs: []
    },
    decision:
      input.decision ??
      ({
        status: "accepted",
        canonicalSource: briefSource,
        extendedSource: input.resources?.length ? "TFLSJ" : null,
        quarantinedSources: [],
        reasonCodes: ["brief-source-accepted"]
      } as EnglishEvidenceAuditRecord["decision"]),
    sourceDigests: input.sourceDigests,
    recordDigest: ""
  };
  record.recordDigest = englishEvidenceRecordDigest(record);
  return record;
}

function emptyCitations(): {
  references: string[];
  resolvedReferences: string[];
  targetHits: string[];
  otherStrongHits: Record<string, string[]>;
} {
  return {
    references: [],
    resolvedReferences: [],
    targetHits: [],
    otherStrongHits: {}
  };
}

function exactOccurrenceEvidence(input: {
  source: "TAGNT" | "TAHOT";
  stepStrong: string;
  references: string[];
  glosses: string[];
}): EnglishExactOccurrenceEvidence {
  const occurrences = input.glosses.map((gloss, index) => {
    const locator = `${input.source}:Gen.1.${index + 1}#01`;
    return {
      dStrong: input.stepStrong,
      gloss,
      locator,
      digest: englishExactOccurrenceGlossDigest({
        source: input.source,
        dStrong: input.stepStrong,
        gloss,
        locator
      })
    };
  });
  return {
    source: input.source,
    stepStrong: input.stepStrong,
    count: occurrences.length,
    references: [...input.references].sort(),
    occurrences,
    occurrenceCorpusDigest: englishExactOccurrenceCorpusDigest({
      source: input.source,
      stepStrong: input.stepStrong,
      occurrences
    })
  };
}

function makeFrenchPacket(
  audit: EnglishEvidenceAuditRecord,
  english = selectCanonicalEnglish(audit),
  englishRelease?: FrenchPacketEnglishReleaseLineage
): LexiconV3FrenchPacket {
  if (!englishRelease) {
    throw new Error(`missing-fixture-english-release:${audit.key}`);
  }
  return buildFrenchPacket(
    {
      entryKey: audit.key,
      englishRelease,
      identity: {
        stepEntryId: audit.stepEntryId,
        language: audit.language,
        eStrong: audit.eStrong,
        dStrong: audit.dStrong,
        uStrong: audit.uStrong,
        original: audit.original,
        transliteration: audit.transliteration,
        morph: audit.morph
      },
      english,
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [
          {
            surface: "sixième",
            normalized: "sixieme",
            count: 2,
            strongCount: 1,
            witnessFamilies: ["Darby-family", "Sg1910"],
            sources: ["Darby", "DarbyR", "Sg1910"]
          }
        ],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: [],
        references: [],
        originalTokens: audit.original ? [audit.original] : []
      }
    },
    "2026-07-12T10:00:00.000Z"
  );
}

function promoteFixtureCoreEnglishRelease(
  authoringPath: string,
  releaseKey: string
): {
  summary: LexiconV3ReleaseSummary;
  attestation: {
    releaseKey: string;
    releaseId: number;
    state: "promoted";
    snapshotFingerprint: string;
    codeFingerprint: string;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    policyVersion: string;
    expectedEntryCount: number;
    fieldCount: number;
  };
  lineages: Map<string, FrenchPacketEnglishReleaseLineage>;
} {
  const database = new DatabaseSync(authoringPath);
  try {
    database.exec(
      `UPDATE LexiconFieldVersions
       SET state = CASE
             WHEN state = 'human_validated' THEN state
             ELSE 'auto_validated'
           END,
           confidence = 0.99
       WHERE locale = 'en' AND field IN ('gloss', 'meaning')
         AND state NOT IN ('rejected', 'superseded');
       DELETE FROM LexiconIssues;
       UPDATE LexiconSources
       SET rightsStatus = 'cleared', allowDisplay = 1, allowTranslation = 1;`
    );
    const fixtureHebrewDigest = "f".repeat(64);
    database
      .prepare(
        `INSERT OR IGNORE INTO LexiconSources (
           sourceKey, name, version, witnessFamily, locale, sha256,
           license, rightsStatus, allowDisplay, allowTranslation,
           allowCarrier, metadataJson
         ) VALUES (
           'artifact-hebrew-open-english', 'Pinned Hebrew English fixture',
           'fixture', 'OpenScriptures', 'en', ?, 'CC-BY-4.0', 'cleared',
           1, 1, 0, ?
         )`
      )
      .run(
        fixtureHebrewDigest,
        JSON.stringify({
          summary: {
            schema: HEBREW_ENGLISH_SUMMARY_SCHEMA,
            openScripturesRevision:
              OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.revision,
            sourceDigests:
              OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.sourceDigests,
            coverage: {
              total: 0,
              validated: 0,
              reviewNeeded: 0,
              sourceIssue: 0,
              properNames: 0,
              lexemes: 0,
              methods: {},
              fields: {
                gloss: {
                  validated: 0,
                  reviewNeeded: 0,
                  sourceIssue: 0,
                  tiers: {}
                },
                meaning: {
                  validated: 0,
                  reviewNeeded: 0,
                  sourceIssue: 0,
                  tiers: {}
                }
              }
            },
            recordsDigest: fixtureHebrewDigest,
            outputDigest: fixtureHebrewDigest
          }
        })
      );
    createLexiconV3ReleaseCandidate(database, {
      releaseKey,
      profile: "core-en"
    });
    const summary = promoteLexiconV3Release(
      database,
      releaseKey,
      "2026-07-12T09:30:00.000Z"
    );
    const release = database
      .prepare(
        `SELECT id, manifestJson FROM LexiconReleases WHERE releaseKey = ?`
      )
      .get(releaseKey) as { id: number; manifestJson: string };
    const manifest = JSON.parse(release.manifestJson) as {
      sourceLogicalFingerprint: string;
      fieldCount: number;
    };
    const rows = database
      .prepare(
        `SELECT rf.entryKey, rf.field, rf.fieldVersionId, fv.valueText,
                fv.valueHtml, fv.state, fv.method, fv.generator,
                fv.contentHash
         FROM LexiconReleaseFields rf
         JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
         WHERE rf.releaseId = ? AND rf.locale = 'en'
           AND rf.field IN ('gloss', 'meaning')
         ORDER BY rf.entryKey, rf.field`
      )
      .all(release.id) as Array<{
      entryKey: string;
      field: "gloss" | "meaning";
      fieldVersionId: number;
      valueText: string;
      valueHtml: string | null;
      state: "auto_validated" | "human_validated";
      method: string;
      generator: string;
      contentHash: string;
    }>;
    const byEntry = new Map<string, typeof rows>();
    for (const row of rows) {
      const entryRows = byEntry.get(row.entryKey) ?? [];
      entryRows.push(row);
      byEntry.set(row.entryKey, entryRows);
    }
    const lineages = new Map<string, FrenchPacketEnglishReleaseLineage>();
    for (const [entryKey, entryRows] of byEntry) {
      const gloss = entryRows.find((row) => row.field === "gloss");
      const meaning = entryRows.find((row) => row.field === "meaning");
      if (!gloss || !meaning) {
        throw new Error(`incomplete-fixture-release:${entryKey}`);
      }
      const lineage = buildFrenchPacketEnglishReleaseLineage({
        entryKey,
        releaseKey,
        releaseSnapshotFingerprint: summary.snapshotFingerprint,
        gloss: {
          fieldVersionId: gloss.fieldVersionId,
          state: gloss.state,
          method: gloss.method,
          generator: gloss.generator,
          valueText: gloss.valueText
        },
        meaning: {
          fieldVersionId: meaning.fieldVersionId,
          state: meaning.state,
          method: meaning.method,
          generator: meaning.generator,
          valueText: meaning.valueText,
          valueHtml: meaning.valueHtml
        }
      });
      if (
        lineage.parents.gloss.contentHash !== gloss.contentHash ||
        lineage.parents.meaning.contentHash !== meaning.contentHash
      ) {
        throw new Error(`invalid-fixture-release-content:${entryKey}`);
      }
      lineages.set(entryKey, lineage);
    }
    return {
      summary,
      attestation: {
        releaseKey,
        releaseId: release.id,
        state: "promoted",
        snapshotFingerprint: summary.snapshotFingerprint,
        codeFingerprint: summary.codeFingerprint,
        sourceFingerprint: summary.sourceFingerprint,
        sourceLogicalFingerprint: manifest.sourceLogicalFingerprint,
        policyVersion: summary.policyVersion,
        expectedEntryCount: summary.expectedEntryCount,
        fieldCount: manifest.fieldCount
      },
      lineages
    };
  } finally {
    database.close();
  }
}

function makeFrenchReview(
  audit: EnglishEvidenceAuditRecord,
  packet: LexiconV3FrenchPacket
): Record<string, unknown> {
  const englishHash = packet.english.contentHash;
  const proposal: FrenchLexiconProposal = {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: audit.key,
    derivedFromEnglishHash: englishHash,
    model: "provider-c/arbiter-model",
    glossFr: "sixième",
    meaningSegmentsFr: [],
    entityMentionsFr: [],
    meaningFr: "ἕκτος, η, ον : le nombre ordinal sixième.",
    meaningHtmlFr: "<p><b>ἕκτος</b>, η, ον : le nombre ordinal sixième.</p>",
    notesFr: "",
    carrierTermsFr: ["sixième"],
    confidence: 0.97
  };
  const validation = {
    issues: [],
    canPublishDisplay: true,
    requiresHumanReview: false
  };
  const content = {
    schemaVersion: "lexicon-v3-french-review@2",
    entryKey: audit.key,
    packetHash: packet.packetHash,
    englishHash,
    generationConfigHash: "9".repeat(64),
    status: "auto_validated",
    models: {
      proposerA: "provider-a/model-a",
      proposerB: "provider-b/model-b",
      arbiter: "provider-c/arbiter-model"
    },
    modelProofs: {
      proposerA: {
        requestedModel: "provider-a/model-a",
        actualModel: "model-a",
        provider: "provider-a",
        identity: "provider-a/model-a",
        verified: true
      },
      proposerB: {
        requestedModel: "provider-b/model-b",
        actualModel: "model-b",
        provider: "provider-b",
        identity: "provider-b/model-b",
        verified: true
      },
      arbiter: {
        requestedModel: "provider-c/arbiter-model",
        actualModel: "arbiter-model",
        provider: "provider-c",
        identity: "provider-c/arbiter-model",
        verified: true
      }
    },
    proposalA: { ...proposal, model: "provider-a/model-a" },
    proposalB: { ...proposal, model: "provider-b/model-b" },
    validationA: validation,
    validationB: validation,
    arbiter: {
      verdict: "accept",
      reasons: [],
      proposal,
      validation
    },
    carrierTerms: [
      {
        surface: "sixième",
        normalized: "sixieme",
        state: "auto_validated",
        policy: "auto_safe",
        confidence: 0.92,
        witnessFamilies: ["Darby-family", "Sg1910"],
        sources: ["Darby", "DarbyR", "Sg1910"],
        reason: "three-model-consensus-and-two-witness-families"
      }
    ],
    issues: [],
    usage: {
      proposerA: { inputTokens: 1, outputTokens: 1 },
      proposerB: { inputTokens: 1, outputTokens: 1 },
      arbiter: { inputTokens: 1, outputTokens: 1 }
    },
    generatedAt: "2026-07-12T11:00:00.000Z"
  };
  return {
    ...content,
    artifactHash: createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex")
  };
}

function makeFrenchInternalReview(
  packet: LexiconV3FrenchPacket,
  namespace = "/fr-internal/full"
) {
  const threads = {
    proposerA: "11111111-1111-4111-8111-111111111111",
    proposerB: "22222222-2222-4222-8222-222222222222",
    arbiter: "33333333-3333-4333-8333-333333333333",
    auditor: "44444444-4444-4444-8444-444444444444"
  } as const;
  const configuration: FrenchInternalReviewConfiguration = {
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    proposerAPromptHash: hashFrenchInternalJson("authoring-prompt-a"),
    proposerBPromptHash: hashFrenchInternalJson("authoring-prompt-b"),
    arbiterPromptHash: hashFrenchInternalJson("authoring-prompt-arbiter"),
    auditorPromptHash: hashFrenchInternalJson("authoring-prompt-auditor"),
    styleGuideHash: hashFrenchInternalJson("authoring-style"),
    termbaseHash: hashFrenchInternalJson("authoring-termbase"),
    canonicalNamesHash: hashFrenchInternalJson("authoring-names"),
    canonicalEntitiesHash: hashFrenchInternalJson("canonical-entities"),
    canonicalEntryPoliciesHash: hashFrenchInternalJson("canonical-policies"),
    entityMergeAttestationHash: hashFrenchInternalJson("entity-attestation"),
    entityGateHash: hashFrenchInternalJson("entity-gate"),
    entityMentionsHash: hashFrenchInternalJson("entity-mentions"),
    htmlRendererVersion: FRENCH_HTML_RENDERER_VERSION,
    approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
  };
  const configurationFile: FrenchInternalAssemblyConfigurationFile = {
    schemaVersion: FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
    configuration,
    generationConfigHash: frenchInternalGenerationConfigHash(configuration)
  };
  const common = {
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash: configurationFile.generationConfigHash
  };
  const meaningSegmentsFr = buildFrenchHtmlTemplate(
    packet.english.meaningHtml
  ).tokens.flatMap((token) =>
    token.kind === "text" && token.translatable
      ? [
          {
            id: token.id,
            text: token.sourceText.replace(/\bsixth\b/giu, "sixième")
          }
        ]
      : []
  );
  const proposerA = finalizeFrenchInternalProposerArtifact({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role: "proposerA",
    ...common,
    inputHash: "1".repeat(64),
    agentId: `codex-agent:${threads.proposerA}`,
    taskName: "/fixture/proposer-a",
    completedAt: "2026-07-12T11:00:00.000Z",
    glossFr: "sixième",
    meaningSegmentsFr,
    requiredEntityMentions: [],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: ["sixième"],
    confidence: 0.97
  });
  const proposerB = finalizeFrenchInternalProposerArtifact({
    schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
    role: "proposerB",
    ...common,
    inputHash: "2".repeat(64),
    agentId: `codex-agent:${threads.proposerB}`,
    taskName: "/fixture/proposer-b",
    completedAt: "2026-07-12T11:01:00.000Z",
    glossFr: "sixième",
    meaningSegmentsFr,
    requiredEntityMentions: [],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: ["sixième"],
    confidence: 0.96
  });
  const arbiter = finalizeFrenchInternalArbiterArtifact({
    schemaVersion: FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION,
    role: "arbiter",
    ...common,
    inputHash: "3".repeat(64),
    agentId: `codex-agent:${threads.arbiter}`,
    taskName: "/fixture/arbiter",
    completedAt: "2026-07-12T11:02:00.000Z",
    verdict: "accept",
    selectedProposal: "proposalA",
    reasons: []
  });
  const checks: FrenchInternalAuditChecks = {
    identityExact: "pass",
    semanticCoverage: "pass",
    noSemanticAddition: "pass",
    noSemanticOmission: "pass",
    polarityModalityUncertaintyPreserved: "pass",
    glossMorphologyConform: "pass",
    properNamesAndTermsConform: "pass",
    entityMentionsConform: "pass",
    protectedContentPreserved: "pass",
    htmlStructurePreserved: "pass",
    naturalFrench: "pass",
    siblingStepConsistency: "pass"
  };
  const auditor = finalizeFrenchInternalAuditorArtifact({
    schemaVersion: FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION,
    role: "auditor",
    ...common,
    inputHash: "4".repeat(64),
    agentId: `codex-agent:${threads.auditor}`,
    taskName: "/fixture/auditor",
    completedAt: "2026-07-12T11:03:00.000Z",
    verdict: "safe",
    reasons: [],
    confidence: 0.97,
    checks
  });
  const artifacts = { proposerA, proposerB, arbiter, auditor };
  const proposerManifestHash = "5".repeat(64);
  const arbiterManifestHash = "6".repeat(64);
  const auditorManifestHash = "7".repeat(64);
  const selectionHash = "8".repeat(64);
  const roleOrder = ["proposerA", "proposerB", "arbiter", "auditor"] as const;
  const receipts = Object.fromEntries(
    roleOrder.map((role) => {
      const artifact = artifacts[role];
      const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role];
      return [
        role,
        finalizeFrenchInternalExecutionReceipt({
          schemaVersion: "lexicon-v3-french-codex-execution-receipt@1",
          role,
          entryKey: packet.entryKey,
          batchId: `fixture-${role}`,
          namespace,
          manifestHash:
            role === "proposerA" || role === "proposerB"
              ? proposerManifestHash
              : role === "arbiter"
                ? arbiterManifestHash
                : auditorManifestHash,
          selectionHash,
          inputHash: artifact.inputHash,
          artifactHash: artifact.artifactHash,
          agentId: artifact.agentId,
          taskName: artifact.taskName,
          threadId: threads[role],
          model: profile.model,
          reasoningEffort: profile.reasoningEffort,
          executorPolicyVersion:
            FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion,
          executor: {
            path: "/fixture/codex",
            version: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion,
            sha256: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256
          },
          capabilities: {
            localTools: "disabled",
            networkDataTools: "disabled",
            shell: "disabled",
            eventPolicy: "agent-message-only",
            sealedWorkingDirectory: "/fixture",
            disabledFeaturesHash: "9".repeat(64),
            environmentPolicyHash: "a".repeat(64)
          },
          sourcePaths: {
            input: `/fixture/${role}/input.jsonl`,
            runPointer: `/fixture/${role}/run.json`
          },
          sourceHashes: {
            input: "b".repeat(64),
            runPointer: "d".repeat(64)
          },
          resultPaths: {
            agentEvents: `/fixture/${role}/events.jsonl`,
            structuredResponse: `/fixture/${role}/response.json`
          },
          resultHashes: {
            agentEvents: "c".repeat(64),
            structuredResponse: "e".repeat(64)
          },
          startedAt: "2026-07-12T10:59:00.000Z",
          completedAt: artifact.completedAt,
          runHash: "d".repeat(64)
        })
      ];
    })
  ) as Record<
    (typeof roleOrder)[number],
    ReturnType<typeof finalizeFrenchInternalExecutionReceipt>
  >;
  const executionReceiptsDigest = hashFrenchInternalJson(
    roleOrder.map((role) => ({
      entryKey: packet.entryKey,
      role,
      receiptHash: receipts[role].receiptHash
    }))
  );
  return assembleFrenchInternalReviewRecords({
    packets: [packet],
    proposerA: [proposerA],
    proposerB: [proposerB],
    arbiters: [arbiter],
    auditors: [auditor],
    configuration: configurationFile,
    entityMentions: finalizeFrenchEntityMentionsArtifact({
      inputHashes: {
        stepEntries: "a".repeat(64),
        canonicalEntities: "b".repeat(64),
        canonicalPolicies: "c".repeat(64),
        englishMeanings: "d".repeat(64)
      },
      requiredEntityMentions: []
    }),
    execution: {
      namespace,
      releaseKey: packet.englishRelease.releaseKey,
      releaseSnapshotFingerprint:
        packet.englishRelease.releaseSnapshotFingerprint,
      selectionHash,
      keyOrderHash: "e".repeat(64),
      proposerManifestHash,
      proposerSummaryHash: "f".repeat(64),
      arbiterManifestHash,
      arbiterSummaryHash: "1".repeat(64),
      auditorManifestHash,
      auditorSummaryHash: "2".repeat(64),
      executionReceiptsDigest,
      adjudicationSummaryHash: "3".repeat(64),
      receiptsByEntry: new Map([[packet.entryKey, receipts]])
    },
    generatedAt: "2026-07-12T11:04:00.000Z"
  }).records[0]!;
}

function packetFor(fixture: Fixture, entryKey: string): LexiconV3FrenchPacket {
  const packet = fixture.packets.find((value) => value.entryKey === entryKey);
  assert.ok(packet, `missing packet fixture for ${entryKey}`);
  return packet;
}

async function rewriteFrenchPacketsForAuthoring(
  fixture: Fixture,
  authoring: string
): Promise<void> {
  const releaseFixture = promoteFixtureCoreEnglishRelease(
    authoring,
    "lexicon-v3-en-authoring-fixture.1"
  );
  const database = new DatabaseSync(authoring, { readOnly: true });
  const snapshot = readLexiconV3AuthoringEnglishSnapshot(database);
  database.close();
  const packets = fixture.records.map((record) =>
    makeFrenchPacket(
      record,
      snapshot.records.get(record.key),
      releaseFixture.lineages.get(record.key)
    )
  );
  fixture.packets = packets;
  const packetsPath = fixture.options.frenchPackets!;
  const summaryPath = fixture.options.frenchPacketSummary!;
  await writeFile(
    packetsPath,
    `${packets.map((packet) => JSON.stringify(packet)).join("\n")}\n`,
    "utf8"
  );
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as {
    englishStatusCounts: Record<string, number>;
    sourcePaths: Record<string, string>;
    sourceDigests: Record<string, string>;
    englishAuthoring: unknown;
    englishRelease: unknown;
    outputDigest: string;
  };
  summary.englishStatusCounts = Object.fromEntries(
    ["validated", "human_validated", "review_needed", "source_issue"].map(
      (status) => [
        status,
        packets.filter((packet) => packet.english.status === status).length
      ]
    )
  );
  summary.sourcePaths.authoring = authoring;
  summary.sourceDigests.englishAuthoring = await fileHash(authoring);
  summary.englishAuthoring = {
    path: authoring,
    digest: summary.sourceDigests.englishAuthoring
  };
  summary.englishRelease = releaseFixture.attestation;
  summary.outputDigest = await fileHash(packetsPath);
  await writeFile(summaryPath, `${JSON.stringify(summary)}\n`, "utf8");
}

function reviewArtifactHash(record: Record<string, unknown>): string {
  const { artifactHash: _artifactHash, ...content } = record;
  void _artifactHash;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

interface ReviewTargetRow {
  id: number;
  entryKey: string;
  locale: "en" | "fr";
  field: "gloss" | "meaning" | "notes";
  valueText: string;
  valueHtml: string | null;
  parentContentHash: string | null;
}

function reviewTargetHash(field: ReviewTargetRow): string {
  return lexiconV3ReviewTargetHash({
    entryKey: field.entryKey,
    locale: field.locale,
    field: field.field,
    valueText: field.valueText,
    valueHtml: field.valueHtml,
    derivedFromContentHash: field.parentContentHash
  });
}

function count(db: DatabaseSync, sql: string): number {
  return Number((db.prepare(sql).get() as { count: number }).count);
}

function reattestHebrewEnglishArtifact(artifact: HebrewEnglishArtifact): void {
  for (const record of artifact.records) {
    const payload = Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== "recordDigest")
    );
    record.recordDigest = createHash("sha256")
      .update(canonicalJson(payload))
      .digest("hex");
  }
  artifact.jsonl = serializeHebrewEnglishCandidates(artifact.records);
  artifact.summary.recordsDigest = createHash("sha256")
    .update(
      canonicalJson(artifact.records.map((record) => record.recordDigest))
    )
    .digest("hex");
  artifact.summary.outputDigest = createHash("sha256")
    .update(artifact.jsonl)
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hash(character: string): string {
  return character.repeat(64);
}

async function fileHash(file: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}
