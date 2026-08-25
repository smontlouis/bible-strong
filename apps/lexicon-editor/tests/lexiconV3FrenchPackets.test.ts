import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  assertMatchingDatabaseIdentity,
  englishEvidenceRecordDigest,
  normalizeTbeshMeaningHtml,
  runBuildFrenchPackets,
  selectCanonicalEnglish,
  selectTranslatableEnglish,
  type BuildFrenchPacketsOptions,
  type FullDatabaseEntry
} from "../scripts/buildLexiconV3FrenchPackets.js";
import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  englishExactOccurrenceCorpusDigest,
  englishExactOccurrenceGlossDigest,
  type EnglishEvidenceAuditRecord,
  type EnglishEvidenceSourceDigests,
  type EnglishLexiconEntry,
  ENGLISH_EVIDENCE_SCHEMA_VERSION
} from "../src/lexiconV3/evidence.js";
import {
  ENGLISH_EXACT_REPAIR_RULES,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES
} from "../src/lexiconV3/englishExactRepairs.js";
import {
  buildEnglishSemanticGlossSourceLines,
  PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES
} from "../src/lexiconV3/englishSemanticGlossAttestations.js";
import {
  buildFrenchPacket,
  extractFrenchProtectedContent,
  frenchPacketHash,
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  createLexiconV3ReleaseCandidate,
  promoteLexiconV3Release
} from "../src/lexiconV3/release.js";
import { lexiconV3CodeFingerprint } from "../src/lexiconV3/codeFingerprint.js";
import { createLexiconV3Schema } from "../src/lexiconV3/schema.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("builds a fingerprinted repaired French packet with independent concordance families", async () => {
  const fixture = await createFixture();

  const summary = await runBuildFrenchPackets(fixture.options);
  const packet = JSON.parse(
    (await readFile(fixture.options.output, "utf8")).trim()
  ) as LexiconV3FrenchPacket;

  assert.equal(summary.inputRecords, 1);
  assert.equal(summary.outputPackets, 1);
  assert.equal(summary.withLegacy, 1);
  assert.equal(summary.withExistingFrench, 1);
  assert.equal(summary.withResourceFrench, 1);
  assert.equal(summary.sourceDigests.fullDatabase, fixture.databaseDigest);
  assert.equal(summary.sourceDigests.legacyDatabase.length, 64);
  assert.equal(summary.sourceDigests.Sg1910.length, 64);
  assert.equal(summary.outputDigest.length, 64);

  assert.deepEqual(validateFrenchPacket(packet), []);
  assert.equal(packet.entryKey, "greek:G1623");
  assert.equal(packet.english.status, "validated");
  assert.deepEqual(packet.english.sources, ["TFLSJ"]);
  assert.match(packet.english.meaning, /sixth/u);
  assert.doesNotMatch(packet.english.meaning, /outside/u);
  assert.equal(packet.english.contentHash.length, 64);

  assert.match(packet.evidence.legacy?.gloss ?? "", /sixième/u);
  assert.equal(packet.evidence.existingFrench?.trust, "untrusted-candidate");
  assert.equal(packet.evidence.existingFrench?.gloss, "sixième");
  assert.equal(packet.evidence.resourceFrench.length, 1);
  assert.equal(packet.evidence.resourceFrench[0]?.trust, "untrusted-candidate");
  assert.match(packet.evidence.resourceFrench[0]?.meaning ?? "", /sixième/u);
  assert.deepEqual(packet.evidence.concordanceForms, [
    {
      surface: "sixième",
      normalized: "sixieme",
      count: 2,
      strongCount: 1,
      witnessFamilies: ["Darby-family", "Sg1910"],
      sources: ["Darby", "DarbyR", "Sg1910"]
    }
  ]);
  assert.equal(packet.protectedContent.strongCodes.includes("G1623"), false);
  assert.ok(packet.protectedContent.originalTokens.includes("ἕκτος"));

  const report = await readFile(fixture.options.report, "utf8");
  assert.match(report, /Darby and DarbyR are counted as one witness family/u);
  assert.match(report, new RegExp(fixture.databaseDigest, "u"));
});

test("replays all sixteen exact morph repairs before matching raw STEP identity", () => {
  const sourceDigests: EnglishEvidenceSourceDigests = {
    database: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
    TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
    TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
    TFLSJ: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TFLSJ,
    TAGNT: {},
    TAHOT: {}
  };
  const morphRules = [...ENGLISH_EXACT_REPAIR_RULES.values()].filter((rule) =>
    rule.changes.some((change) => change.field === "morph")
  );
  assert.equal(morphRules.length, 16);

  const database = new DatabaseSync(
    path.resolve("data/dictionaries/strong_lexicon.full.production.sqlite"),
    { readOnly: true }
  );
  try {
    const statement = database.prepare(`
      SELECT id AS stepEntryId, baseCode, language, eStrong, dStrong, uStrong,
             original, transliteration, morph, gloss, meaning,
             classicTransliteration, pronunciation
      FROM StepEntries
      WHERE dStrong LIKE ?
    `);
    const rawEntries = morphRules.map((rule) => {
      const strong = rule.entryKey.split(":", 2)[1];
      const raw = statement.get(`${strong} %`) as
        | (EnglishLexiconEntry & { gloss: string; meaning: string })
        | undefined;
      assert.ok(raw, rule.entryKey);
      return raw;
    });
    const context = buildEnglishEvidenceContext({
      entries: rawEntries,
      tokens: [],
      sourceDigests,
      semanticGlossSourceLines: buildEnglishSemanticGlossSourceLines({
        TBESG: readFileSync(
          path.resolve("data/external/stepbible/TBESG.txt"),
          "utf8"
        ),
        TFLSJ: readFileSync(
          path.resolve("data/external/stepbible/TFLSJ.txt"),
          "utf8"
        )
      })
    });
    const audited = rawEntries.map((raw) => ({
      raw,
      record: auditEnglishEvidenceEntry(raw, [], context)
    }));

    for (const { raw, record } of audited) {
      const morphRepairs = record.evidence.fieldRepairs.filter(
        (repair) => repair.field === "morph"
      );
      assert.equal(morphRepairs.length, 1, record.key);
      assert.equal(raw.morph, morphRepairs[0]?.sourceValue, record.key);
      assert.equal(record.morph, morphRepairs[0]?.repairedValue, record.key);
      assert.doesNotThrow(
        () => assertMatchingDatabaseIdentity(record, fullDatabaseEntry(raw)),
        record.key
      );
    }

    const g20387 = audited.find(({ record }) => record.key === "greek:G20387");
    assert.ok(g20387);

    const digestTamper = structuredClone(g20387.record);
    digestTamper.evidence.fieldRepairs[0]!.repairDigest = "0".repeat(64);
    assert.throws(
      () =>
        assertMatchingDatabaseIdentity(
          digestTamper,
          fullDatabaseEntry(g20387.raw)
        ),
      /full-database-exact-repair-replay-mismatch/u
    );

    const incompleteRule = structuredClone(g20387.record);
    incompleteRule.evidence.fieldRepairs =
      incompleteRule.evidence.fieldRepairs.filter(
        (repair) => repair.field === "morph"
      );
    assert.throws(
      () =>
        assertMatchingDatabaseIdentity(
          incompleteRule,
          fullDatabaseEntry(g20387.raw)
        ),
      /full-database-exact-repair-replay-mismatch/u
    );

    const valueTamper = structuredClone(g20387.record);
    valueTamper.morph = "G:N";
    assert.throws(
      () =>
        assertMatchingDatabaseIdentity(
          valueTamper,
          fullDatabaseEntry(g20387.raw)
        ),
      /full-database-exact-repair-value-mismatch/u
    );

    assert.throws(
      () =>
        assertMatchingDatabaseIdentity(g20387.record, {
          ...fullDatabaseEntry(g20387.raw),
          morph: "G:N"
        }),
      /full-database-exact-repair-proof-invalid/u
    );

    const sourceTamper = structuredClone(g20387.record);
    sourceTamper.sourceDigests.TBESG = "0".repeat(64);
    assert.throws(
      () =>
        assertMatchingDatabaseIdentity(
          sourceTamper,
          fullDatabaseEntry(g20387.raw)
        ),
      /full-database-exact-repair-proof-invalid/u
    );
  } finally {
    database.close();
  }
});

test("protects every visible Bible reference, original form, Strong code, number, and relevant siglum", () => {
  const protectedContent = extractFrenchProtectedContent({
    gloss: "G0123; value 12,000 (LXX)",
    meaning:
      "λόγος (Heb. דָּבָר): Matt.23:26-28, 7:11; 1 Cor 14.5; Tob.3:3. In NT and BDB, ratio 1/2.",
    meaningHtml:
      "<b>λόγος</b> (Heb. דָּבָר): Matt.23:26-28, 7:11; 1 Cor 14.5; Tob.3:3. In NT and BDB, ratio 1/2."
  });

  assert.deepEqual(protectedContent.strongCodes, ["G0123"]);
  assert.deepEqual(protectedContent.references, [
    "1Cor.14.5",
    "Matt.23.26",
    "Matt.7.11",
    "Tob.3.3"
  ]);
  assert.deepEqual(protectedContent.referenceLiterals, [
    "1 Cor 14.5",
    "7:11",
    "Matt.23:26-28",
    "Tob.3:3"
  ]);
  assert.deepEqual(protectedContent.originalTokens, ["λόγος", "דָּבָר"]);
  assert.deepEqual(protectedContent.numericLiterals, ["1/2", "12,000"]);
  assert.deepEqual(protectedContent.sigla, ["BDB", "LXX", "NT"]);
});

test("does not mistake classical citations or translatable uppercase labels for Bible references and sigla", () => {
  const protectedContent = extractFrenchProtectedContent({
    gloss: "LORD; PERSON",
    meaning:
      "Comicus 2.12; Judaeus 1.195; Laertius 3.107 (AS). BC and A.D. are chronology markers. JESUS is a PERSON.",
    meaningHtml: ""
  });

  assert.deepEqual(protectedContent.references, []);
  assert.deepEqual(protectedContent.referenceLiterals, []);
  assert.deepEqual(protectedContent.numericLiterals, [
    "1.195",
    "2.12",
    "3.107"
  ]);
  assert.deepEqual(protectedContent.sigla, ["AS"]);
});

test("resolves STEP Roman-numeral books, implicit citation continuations, ibid verses, and chapter-only citations", () => {
  const protectedContent = extractFrenchProtectedContent({
    gloss: "",
    meaning:
      "II Tim 4:8, 10; Act.13:27 17:23; Mat.5:43; ib. 44; Da TH 6:14; 4Mac.5.",
    meaningHtml: ""
  });

  assert.deepEqual(protectedContent.references, [
    "2Tim.4.10",
    "2Tim.4.8",
    "Acts.13.27",
    "Acts.17.23",
    "Dan.6.14",
    "Matt.5.43",
    "Matt.5.44"
  ]);
  assert.deepEqual(protectedContent.referenceLiterals, [
    "10",
    "17:23",
    "4Mac.5",
    "Act.13:27",
    "Da TH 6:14",
    "II Tim 4:8",
    "Mat.5:43",
    "ib. 44"
  ]);
  assert.deepEqual(protectedContent.numericLiterals, []);
  assert.deepEqual(protectedContent.originalTokens, []);
  assert.deepEqual(protectedContent.sigla, []);
});

test("keeps complete verse continuations before compact STEP aliases without stealing numbered books", () => {
  const protectedContent = extractFrenchProtectedContent({
    gloss: "",
    meaning:
      "Luk.2:11, 26 Jhn.1:41; Mat.2:4; Mrk.8:29; Act.2:36 4:26, 1Co.14:5.",
    meaningHtml: ""
  });

  assert.deepEqual(protectedContent.references, [
    "1Cor.14.5",
    "Acts.2.36",
    "Acts.4.26",
    "John.1.41",
    "Luke.2.11",
    "Luke.2.26",
    "Mark.8.29",
    "Matt.2.4"
  ]);
  assert.deepEqual(protectedContent.referenceLiterals, [
    "1Co.14:5",
    "26",
    "4:26",
    "Act.2:36",
    "Jhn.1:41",
    "Luk.2:11",
    "Mat.2:4",
    "Mrk.8:29"
  ]);
  assert.equal(protectedContent.references.includes("Luke.2.2"), false);
  assert.equal(protectedContent.references.includes("Acts.2.1"), false);
});

test("recomputes protected content and rejects a rehashed under-protected packet", () => {
  const packet = buildFrenchPacket({
    entryKey: "greek:G0001",
    englishRelease: frenchPacketFixtureEnglishRelease({
      entryKey: "greek:G0001",
      gloss: "alpha",
      meaning: "ἄλφα in Rev.1:8 (LXX), numeric value 1.",
      meaningHtml: "<b>ἄλφα</b> in Rev.1:8 (LXX), numeric value 1."
    }),
    identity: {
      stepEntryId: 1,
      language: "greek",
      eStrong: "G0001",
      dStrong: "G0001 =",
      uStrong: "G0001",
      original: "ἄλφα",
      transliteration: "alpha",
      morph: "G:N"
    },
    english: {
      contentHash: "a".repeat(64),
      status: "validated",
      gloss: "alpha",
      meaning: "ἄλφα in Rev.1:8 (LXX), numeric value 1.",
      meaningHtml: "<b>ἄλφα</b> in Rev.1:8 (LXX), numeric value 1.",
      sources: ["TBESG"],
      issues: []
    },
    evidence: {
      occurrenceGlosses: [],
      concordanceForms: [],
      legacy: null,
      existingFrench: null,
      resourceFrench: []
    },
    // A caller cannot suppress mechanically visible content with this input.
    protectedContent: {
      strongCodes: [],
      references: [],
      originalTokens: []
    }
  });
  assert.deepEqual(validateFrenchPacket(packet), []);
  assert.deepEqual(packet.protectedContent.references, ["Rev.1.8"]);
  assert.deepEqual(packet.protectedContent.numericLiterals, ["1"]);

  const tampered = structuredClone(packet);
  tampered.protectedContent.references = [];
  const {
    packetHash: _packetHash,
    createdAt: _createdAt,
    ...content
  } = tampered;
  void _packetHash;
  void _createdAt;
  tampered.packetHash = frenchPacketHash(content);
  assert.ok(
    validateFrenchPacket(tampered).includes("protected-content-mismatch")
  );
});

test("requires rights-attested authoring before translating raw TBESH meaning", async () => {
  const fixture = await createFixture();
  const hebrew: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    key: "hebrew:H0001",
    language: "hebrew",
    eStrong: "H0001",
    dStrong: "H0001 =",
    uStrong: "H0001",
    original: "אָב",
    gloss: "father",
    meaning: "<b>אָב</b>, father.",
    decision: {
      status: "accepted",
      canonicalSource: "TBESH",
      quarantinedSources: [],
      reasonCodes: [],
      extendedSource: null
    }
  };
  const english = selectTranslatableEnglish(hebrew);
  assert.equal(english.status, "source_issue");
  assert.ok(
    english.issues.includes(
      "authoring-rights-attestation-required:TBESH-meaning"
    )
  );
  assert.equal(english.sources[0], "TBESH");
  assert.equal(english.meaning, "");
  assert.equal(english.meaningHtml, "");
});

test("escapes the H9001 bidirectional marker without losing its visible text", async () => {
  assert.equal(
    normalizeTbeshMeaningHtml("future<->past"),
    "future&lt;-&gt;past"
  );
  const fixture = await createFixture();
  const hebrew: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    key: "hebrew:H9001",
    language: "hebrew",
    eStrong: "H9001",
    dStrong: "H9001 =",
    uStrong: "H9001",
    original: "ו",
    gloss: "&",
    meaning:
      "Verbal vav: joined to verb with no intervening prefix (usually conversive) (future<->past)",
    decision: {
      status: "accepted",
      canonicalSource: "TBESH",
      quarantinedSources: [],
      reasonCodes: ["brief-source-accepted"],
      extendedSource: null
    }
  };
  const english = selectCanonicalEnglish(hebrew);
  assert.match(english.meaning, /future<->past/u);
  assert.match(english.meaningHtml, /future&lt;-&gt;past/u);
});

test("keeps quarantined English content visible but blocks it as source_issue", async () => {
  const fixture = await createFixture();
  const quarantined: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    decision: {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: ["TBESG"],
      reasonCodes: ["confirmed-brief-source-conflict", "no-safe-repair-source"]
    }
  };
  quarantined.recordDigest = englishEvidenceRecordDigest(quarantined);

  const english = selectCanonicalEnglish(quarantined);

  assert.equal(english.status, "source_issue");
  assert.deepEqual(english.sources, ["TBESG"]);
  assert.match(english.meaning, /outside/u);
  assert.ok(english.issues.includes("quarantined-source:TBESG"));
});

test("keeps missing quarantined English content blank instead of inventing it", async () => {
  const fixture = await createFixture();
  const quarantined: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    gloss: "",
    decision: {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: ["TBESG"],
      reasonCodes: ["missing-required-source-field:gloss"]
    }
  };
  quarantined.recordDigest = englishEvidenceRecordDigest(quarantined);

  const english = selectCanonicalEnglish(quarantined);
  const packet = buildFrenchPacket({
    entryKey: quarantined.key,
    englishRelease: frenchPacketFixtureEnglishRelease({
      entryKey: quarantined.key,
      gloss: english.gloss,
      meaning: english.meaning,
      meaningHtml: english.meaningHtml
    }),
    identity: {
      stepEntryId: quarantined.stepEntryId,
      language: quarantined.language,
      eStrong: quarantined.eStrong,
      dStrong: quarantined.dStrong,
      uStrong: quarantined.uStrong,
      original: quarantined.original,
      transliteration: quarantined.transliteration,
      morph: quarantined.morph
    },
    english,
    evidence: {
      occurrenceGlosses: [],
      concordanceForms: [],
      legacy: null,
      existingFrench: null,
      resourceFrench: []
    },
    protectedContent: {
      strongCodes: [],
      references: [],
      originalTokens: []
    }
  });

  assert.equal(packet.english.status, "source_issue");
  assert.equal(packet.english.gloss, "");
  assert.deepEqual(validateFrenchPacket(packet), []);
});

test("retains the brief source but requires review when only TFLSJ conflicts", async () => {
  const fixture = await createFixture();
  const sourceConflict: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    decision: {
      status: "source-conflict",
      canonicalSource: "TBESG",
      extendedSource: null,
      quarantinedSources: ["TFLSJ"],
      reasonCodes: ["confirmed-tflsj-source-conflict", "brief-source-retained"]
    }
  };
  sourceConflict.recordDigest = englishEvidenceRecordDigest(sourceConflict);

  const english = selectCanonicalEnglish(sourceConflict);

  assert.equal(english.status, "review_needed");
  assert.deepEqual(english.sources, ["TBESG"]);
  assert.match(english.meaning, /outside/u);
  assert.ok(english.issues.includes("quarantined-source:TFLSJ"));
});

test("publishes a snapshot-pinned reviewed repair without reopening English review", async () => {
  const fixture = await createFixture();
  const autoValidated: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    decision: {
      ...fixture.record.decision,
      reasonCodes: [
        ...fixture.record.decision.reasonCodes,
        "curated-auto-validated-tflsj-repair"
      ]
    }
  };
  autoValidated.recordDigest = englishEvidenceRecordDigest(autoValidated);

  const english = selectCanonicalEnglish(autoValidated);
  assert.equal(english.status, "validated");
  assert.deepEqual(english.sources, ["TFLSJ"]);
  assert.match(english.meaning, /sixth/u);
  assert.doesNotMatch(english.meaning, /outside/u);
});

test("removes a quarantined TFLSJ translation from the French packet", async () => {
  const fixture = await createFixture();
  const acceptedBrief: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    decision: {
      status: "accepted",
      canonicalSource: "TBESG",
      extendedSource: null,
      quarantinedSources: ["TFLSJ"],
      reasonCodes: [
        "brief-source-accepted",
        "tflsj-supplemental-quarantined-headword-mismatch"
      ]
    }
  };
  acceptedBrief.recordDigest = englishEvidenceRecordDigest(acceptedBrief);
  await writeFile(fixture.options.input, `${JSON.stringify(acceptedBrief)}\n`);
  const authoring = path.join(fixture.directory, "authoring-brief.sqlite");
  await createPromotedCoreEnglishFixture({
    path: authoring,
    record: acceptedBrief,
    databaseDigest: fixture.databaseDigest,
    englishAuditDigest: await fileHash(fixture.options.input)
  });

  const summary = await runBuildFrenchPackets({
    ...fixture.options,
    authoring
  });
  const packet = JSON.parse(
    (await readFile(fixture.options.output, "utf8")).trim()
  ) as LexiconV3FrenchPacket;

  assert.equal(packet.english.status, "validated");
  assert.equal(summary.withResourceFrench, 0);
  assert.deepEqual(packet.evidence.resourceFrench, []);
  assert.doesNotMatch(
    JSON.stringify(packet.evidence),
    /ἕκτος, η, ον, sixième/u
  );
});

test("does not leak TFLSJ:fr after quarantining an uncorroborated morphological supplement", async () => {
  const fixture = await createFixture();
  const acceptedBrief: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    decision: {
      status: "accepted",
      canonicalSource: "TBESG",
      extendedSource: null,
      quarantinedSources: ["TFLSJ"],
      reasonCodes: [
        "brief-source-accepted",
        "tflsj-supplemental-quarantined-uncorroborated-morphological-variant"
      ]
    }
  };
  acceptedBrief.recordDigest = englishEvidenceRecordDigest(acceptedBrief);
  await writeFile(fixture.options.input, `${JSON.stringify(acceptedBrief)}\n`);
  const authoring = path.join(
    fixture.directory,
    "authoring-morphological-brief.sqlite"
  );
  await createPromotedCoreEnglishFixture({
    path: authoring,
    record: acceptedBrief,
    databaseDigest: fixture.databaseDigest,
    englishAuditDigest: await fileHash(fixture.options.input)
  });

  const summary = await runBuildFrenchPackets({
    ...fixture.options,
    authoring
  });
  const packet = JSON.parse(
    (await readFile(fixture.options.output, "utf8")).trim()
  ) as LexiconV3FrenchPacket;

  assert.equal(packet.english.status, "validated");
  assert.equal(summary.withResourceFrench, 0);
  assert.deepEqual(packet.evidence.resourceFrench, []);
  assert.doesNotMatch(JSON.stringify(packet), /TFLSJ:classical_full:fr/u);
  assert.doesNotMatch(
    JSON.stringify(packet.evidence),
    /ἕκτος, η, ον, sixième/u
  );
});

test("fails before building when the mandatory legacy database is absent", async () => {
  const fixture = await createFixture();
  const missingLegacy = path.join(fixture.directory, "missing-legacy.sqlite");

  await assert.rejects(
    runBuildFrenchPackets({
      ...fixture.options,
      legacyDatabase: missingLegacy
    }),
    /missing-required-sources/u
  );
});

test("rejects an English audit produced from a different full database digest", async () => {
  const fixture = await createFixture();
  const stale: EnglishEvidenceAuditRecord = {
    ...fixture.record,
    sourceDigests: {
      ...fixture.record.sourceDigests,
      database: "0".repeat(64)
    }
  };
  stale.recordDigest = englishEvidenceRecordDigest(stale);
  await writeFile(fixture.options.input, `${JSON.stringify(stale)}\n`);
  const authoring = path.join(fixture.directory, "authoring-stale.sqlite");
  await createPromotedCoreEnglishFixture({
    path: authoring,
    record: stale,
    databaseDigest: fixture.databaseDigest,
    englishAuditDigest: await fileHash(fixture.options.input)
  });

  await assert.rejects(
    runBuildFrenchPackets({ ...fixture.options, authoring }),
    /english-evidence-database-digest-mismatch/u
  );
});

interface Fixture {
  directory: string;
  options: BuildFrenchPacketsOptions;
  record: EnglishEvidenceAuditRecord;
  databaseDigest: string;
}

async function createFixture(): Promise<Fixture> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "lexicon-v3-fr-packets-")
  );
  const database = path.join(directory, "full.sqlite");
  const legacyDatabase = path.join(directory, "legacy.sqlite");
  const input = path.join(directory, "english-audit.jsonl");
  const sg1910 = path.join(directory, "Sg1910.csv");
  const darby = path.join(directory, "Darby.csv");
  const darbyR = path.join(directory, "DarbyR.csv");
  const output = path.join(directory, "french-packets.jsonl");
  const summaryJson = path.join(directory, "french-packets.summary.json");
  const report = path.join(directory, "french-packets.md");
  const authoring = path.join(directory, "reviewed-english.sqlite");

  execFileSync("sqlite3", [
    database,
    `
      create table StepEntries (
        id integer primary key,
        language text not null,
        eStrong text not null,
        dStrong text not null,
        uStrong text not null,
        original text not null,
        transliteration text not null,
        morph text not null,
        gloss text not null,
        meaning text not null
      );
      create table LexiconTranslations (
        stepEntryId integer not null,
        language text not null,
        gloss text not null,
        meaning text not null,
        meaningHtml text not null
      );
      create table LexiconResources (
        id integer primary key,
        stepEntryId integer not null,
        source text not null,
        kind text not null,
        contentHtml text not null
      );
      create table LexiconResourceTranslations (
        resourceId integer not null,
        language text not null,
        contentHtml text not null,
        contentText text not null
      );
      insert into StepEntries values
        (1673, 'greek', 'G1623', 'G1623 =', 'G1623', 'ἕκτος', 'hektos',
         'G:A', 'sixth', '<b>ἐκτός</b>, outside, beyond or except.');
      insert into LexiconTranslations values
        (1673, 'fr', 'sixième', 'au-dehors, excepté', '<b>ἐκτός</b>, au-dehors, excepté.');
      insert into LexiconResources values
        (1673, 1673, 'TFLSJ', 'classical_full', '<b>ἕκτος</b>, η, ον, <b>sixth</b>.');
      insert into LexiconResourceTranslations values
        (1673, 'fr', '<b>ἕκτος</b>, η, ον, <b>sixième</b>.', 'ἕκτος, η, ον, sixième.');
    `
  ]);
  execFileSync("sqlite3", [
    legacyDatabase,
    `
      create table Grec (
        Code integer primary key,
        LSG text not null,
        Definition text not null
      );
      create table Hebreu (
        Code integer primary key,
        LSG text not null,
        Definition text not null
      );
      insert into Grec values
        (1623, 'sixième 14; 14', '<ol><li>le ou la sixième.</li></ol>');
    `
  ]);

  const csvHeader = "book_id\tnum_chapter\tnum_verse\ttext\n";
  await writeFile(
    sg1910,
    `${csvHeader}Heb\t10\t7\t<w strong="G1623">sixième</w>\n`
  );
  await writeFile(
    darby,
    `${csvHeader}Heb\t10\t7\t<w strong="G1623">sixième</w>\n`
  );
  await writeFile(
    darbyR,
    `${csvHeader}Heb\t10\t7\t<w strong="G1623">sixième</w>\n`
  );

  const databaseDigest = await fileHash(database);
  const record = makeEnglishEvidenceRecord(databaseDigest);
  await writeFile(input, `${JSON.stringify(record)}\n`);
  await createPromotedCoreEnglishFixture({
    path: authoring,
    record,
    databaseDigest,
    englishAuditDigest: await fileHash(input)
  });
  return {
    directory,
    databaseDigest,
    record,
    options: {
      input,
      database,
      legacyDatabase,
      sg1910,
      darby,
      darbyR,
      authoring,
      releaseKey: "lexicon-v3-en-fixture.1",
      output,
      summaryJson,
      report,
      only: new Set(),
      offset: 0,
      limit: null,
      createdAt: "2026-07-12T00:00:00.000Z"
    }
  };
}

async function createPromotedCoreEnglishFixture(input: {
  path: string;
  record: EnglishEvidenceAuditRecord;
  databaseDigest: string;
  englishAuditDigest: string;
}): Promise<void> {
  const english = selectCanonicalEnglish(input.record);
  const lineage = frenchPacketFixtureEnglishRelease({
    entryKey: input.record.key,
    gloss: english.gloss,
    meaning: english.meaning,
    meaningHtml: english.meaningHtml
  });
  const database = new DatabaseSync(input.path);
  try {
    createLexiconV3Schema(database);
    const setMeta = database.prepare(
      `INSERT OR REPLACE INTO LexiconV3Meta (key, value) VALUES (?, ?)`
    );
    setMeta.run("databaseDigest", input.databaseDigest);
    setMeta.run("englishAuditDigest", input.englishAuditDigest);
    setMeta.run("sourceFingerprint", "1".repeat(64));
    setMeta.run("sourceLogicalFingerprint", "2".repeat(64));
    setMeta.run("codeFingerprint", lexiconV3CodeFingerprint());
    database
      .prepare(
        `INSERT INTO LexiconEntries (
           entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
           uStrong, original, transliteration, morph
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.record.key,
        input.record.language,
        1623,
        input.record.eStrong,
        "G1623",
        input.record.dStrong,
        input.record.uStrong,
        input.record.original,
        input.record.transliteration,
        input.record.morph
      );
    database
      .prepare(
        `INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)`
      )
      .run(input.record.key, input.record.stepEntryId);
    const sourceId = Number(
      database
        .prepare(
          `INSERT INTO LexiconSources (
             sourceKey, name, version, witnessFamily, locale, sha256,
             license, rightsStatus, allowDisplay, allowTranslation,
             allowCarrier
           ) VALUES ('TFLSJ', 'TFLSJ fixture', '1', 'TFLSJ', 'en', ?,
                     'fixture', 'cleared', 1, 1, 0)`
        )
        .run("4".repeat(64)).lastInsertRowid
    );
    for (const field of ["gloss", "meaning"] as const) {
      const valueText = field === "gloss" ? english.gloss : english.meaning;
      const valueHtml = field === "gloss" ? null : english.meaningHtml;
      const parent = lineage.parents[field];
      const assertionId = Number(
        database
          .prepare(
            `INSERT INTO LexiconSourceAssertions (
               sourceId, entryKey, scope, field, locale, valueText,
               valueHtml, locator, sha256
             ) VALUES (?, ?, 'entry', ?, 'en', ?, ?, ?, ?)`
          )
          .run(
            sourceId,
            input.record.key,
            field,
            valueText,
            valueHtml,
            `fixture:${field}`,
            field === "gloss" ? "5".repeat(64) : "6".repeat(64)
          ).lastInsertRowid
      );
      database
        .prepare(
          `INSERT INTO LexiconFieldVersions (
             id, entryKey, locale, field, valueText, valueHtml, state,
             confidence, method, generator, contentHash
           ) VALUES (?, ?, 'en', ?, ?, ?, 'auto_validated', 0.99,
                     'source', 'test-fixture', ?)`
        )
        .run(
          parent.fieldVersionId,
          input.record.key,
          field,
          valueText,
          valueHtml,
          parent.contentHash
        );
      database
        .prepare(
          `INSERT INTO LexiconFieldEvidence (
             fieldVersionId, sourceAssertionId, evidenceKind, stance,
             witnessFamily, weight
           ) VALUES (?, ?, 'direct_source', 'supports', 'TFLSJ', 1)`
        )
        .run(parent.fieldVersionId, assertionId);
    }
    createLexiconV3ReleaseCandidate(database, {
      releaseKey: "lexicon-v3-en-fixture.1",
      profile: "core-en"
    });
    promoteLexiconV3Release(
      database,
      "lexicon-v3-en-fixture.1",
      "2026-07-12T00:00:00.000Z"
    );
  } finally {
    database.close();
  }
}

function makeEnglishEvidenceRecord(
  databaseDigest: string
): EnglishEvidenceAuditRecord {
  const record: EnglishEvidenceAuditRecord = {
    schemaVersion: ENGLISH_EVIDENCE_SCHEMA_VERSION,
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
    reconstruction: null,
    resources: [
      {
        resourceId: 1673,
        stepEntryId: 1673,
        source: "TFLSJ",
        kind: "classical_full",
        contentHtml: "<b>ἕκτος</b>, η, ον, <b>sixth</b>."
      }
    ],
    evidence: {
      brief: {
        source: "TBESG",
        digest: "a".repeat(64),
        headword: "ἐκτός",
        headwordMatchesEntry: false,
        headwordOwnerKeys: ["greek:G1622"],
        declaredRelatedStrongCodes: [],
        headwordMatchesDeclaredRelation: false,
        contentMentionsEntryOriginal: false,
        conflictOwner: "G1622",
        citations: {
          references: ["Matt.23.26"],
          resolvedReferences: ["Matt.23.26"],
          targetHits: [],
          otherStrongHits: { G1622: ["Matt.23.26"] }
        },
        issues: ["confirmed-cross-entry-source-content"],
        quarantined: true
      },
      TFLSJ: {
        source: "TFLSJ",
        digest: "b".repeat(64),
        headword: "ἕκτος",
        headwordMatchesEntry: true,
        headwordOwnerKeys: [],
        declaredRelatedStrongCodes: [],
        headwordMatchesDeclaredRelation: false,
        contentMentionsEntryOriginal: false,
        conflictOwner: null,
        citations: {
          references: [],
          resolvedReferences: [],
          targetHits: [],
          otherStrongHits: {}
        },
        issues: [],
        quarantined: false
      },
      exactOccurrence: {
        source: "TAGNT",
        stepStrong: "G1623",
        count: 1,
        references: [],
        occurrences: [
          {
            dStrong: "G1623",
            gloss: "sixth",
            locator: "TAGNT:Matt.1.1#01",
            digest: englishExactOccurrenceGlossDigest({
              source: "TAGNT",
              dStrong: "G1623",
              gloss: "sixth",
              locator: "TAGNT:Matt.1.1#01"
            })
          }
        ],
        occurrenceCorpusDigest: englishExactOccurrenceCorpusDigest({
          source: "TAGNT",
          stepStrong: "G1623",
          occurrences: [
            {
              dStrong: "G1623",
              gloss: "sixth",
              locator: "TAGNT:Matt.1.1#01",
              digest: englishExactOccurrenceGlossDigest({
                source: "TAGNT",
                dStrong: "G1623",
                gloss: "sixth",
                locator: "TAGNT:Matt.1.1#01"
              })
            }
          ]
        })
      },
      alternateStrongAlias: null,
      semanticGlossAttestation: null,
      sourceAudit: {} as EnglishEvidenceAuditRecord["evidence"]["sourceAudit"],
      fieldRepairs: []
    },
    decision: {
      status: "repaired",
      canonicalSource: "TFLSJ",
      extendedSource: null,
      quarantinedSources: ["TBESG"],
      reasonCodes: ["confirmed-brief-source-conflict", "coherent-tflsj-repair"]
    },
    sourceDigests: {
      database: databaseDigest,
      TBESG: "a".repeat(64),
      TBESH: "c".repeat(64),
      TFLSJ: "b".repeat(64),
      TAGNT: { "TAGNT fixture": "d".repeat(64) },
      TAHOT: { "TAHOT fixture": "e".repeat(64) }
    },
    recordDigest: ""
  };
  record.recordDigest = englishEvidenceRecordDigest(record);
  return record;
}

function fullDatabaseEntry(
  entry: EnglishLexiconEntry & { gloss: string; meaning: string }
): FullDatabaseEntry {
  return {
    stepEntryId: entry.stepEntryId,
    language: entry.language,
    eStrong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong,
    original: entry.original,
    transliteration: entry.transliteration,
    morph: entry.morph,
    gloss: entry.gloss,
    meaning: entry.meaning
  };
}

async function fileHash(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}
