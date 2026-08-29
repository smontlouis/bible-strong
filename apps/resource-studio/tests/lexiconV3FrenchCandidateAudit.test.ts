import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  assertFrenchCandidateAuditRecords,
  buildFrenchCandidateAuditRecord,
  type FrenchCandidateEntityRecord
} from "../src/lexiconV3/frenchCandidateAudit.js";
import {
  buildFrenchPacket,
  frenchPacketHash,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  canonicalFrenchReuseJson,
  FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
  FRENCH_REUSE_POLICY_VERSION,
  FRENCH_REUSE_RECORD_SCHEMA_VERSION,
  renderFrenchReuseRecords,
  type FrenchReuseManifestSummary,
  type FrenchReuseRecord
} from "../src/lexiconV3/frenchReuseManifest.js";
import {
  contentHash,
  FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION
} from "../src/lexiconV3/frenchEditorialPolicy.js";
import { HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST } from "../src/lexiconV3/hebrewIdentityCorrections.js";
import { stripLexiconHtml } from "../src/lexiconV3/frenchValidation.js";
import {
  parseFrenchCandidateAuditArgs,
  type AuditLexiconV3FrenchCandidatesOptions,
  runAuditLexiconV3FrenchCandidates
} from "../scripts/auditLexiconV3FrenchCandidates.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

const CREATED_AT = "2026-07-13T12:00:00.000Z";
const RELEASE_KEY = "lexicon-v3-en-test.1";
const RELEASE_SNAPSHOT = "c".repeat(64);
const AUTHORING_DIGEST = "a".repeat(64);
const HISTORICAL_DIGEST = "b".repeat(64);

type FixtureOptions = Required<
  Pick<
    AuditLexiconV3FrenchCandidatesOptions,
    | "packets"
    | "packetSummary"
    | "reuseRecords"
    | "reuseSummary"
    | "entityRegistry"
    | "entitySummary"
    | "recordsOutput"
    | "summaryOutput"
    | "reportOutput"
    | "expectedEntries"
  >
>;

test("keeps a green proper-name gloss narrowly scoped and never promotes meaning", () => {
  const packet = buildPacket();
  const reuse = buildReuseRecord(packet);
  const entity = buildEntityRecord();
  const record = buildFrenchCandidateAuditRecord({ packet, reuse, entity });

  assert.equal(record.status, "green");
  assert.equal(record.fieldStatus.gloss, "green");
  assert.equal(record.fieldStatus.pair, "green");
  assert.deepEqual(record.autoPromotableFields, ["gloss"]);
  assert.equal(record.disposition, "canonical-name-gloss-only");
  assert.equal(
    record.html.rendererVersion,
    "lexicon-v3-french-html-renderer@3"
  );
  assert.equal(record.html.skeletonExact, true);
  assert.equal(record.html.plainHtmlExact, true);
  assert.deepEqual(record.protectedContent.strongCodes.missing, []);
  assert.deepEqual(record.protectedContent.references.missing, []);
  assert.deepEqual(record.protectedContent.originalTokens.missing, []);
  assert.ok(
    record.reasons.some(
      (reason) => reason.code === "canonical-proper-name-attested"
    )
  );
});

test("rejects an incoherent historical meaning/plain HTML pair but preserves field evidence", () => {
  const packet = replaceCandidate(buildPacket(), {
    meaning: "Une biographie moderne sans rapport avec la notice HTML."
  });
  const reuse = buildReuseRecord(packet);
  const record = buildFrenchCandidateAuditRecord({
    packet,
    reuse,
    entity: buildEntityRecord()
  });

  assert.equal(record.status, "red");
  assert.equal(record.fieldStatus.pair, "red");
  assert.equal(record.fieldStatus.gloss, "green");
  assert.equal(record.disposition, "canonical-name-gloss-only");
  assert.ok(
    record.reasons.some(
      (reason) => reason.code === "meaning-text-html-divergence"
    )
  );
});

test("does not report the French word excepté as residual English", () => {
  const frenchMeaningHtml =
    "<b>Ἀαρών</b> signifie <strong>G0002</strong>; Gen.1:1, tout autre cas étant excepté.";
  const packet = buildPacket({ frenchMeaningHtml });
  const record = buildFrenchCandidateAuditRecord({
    packet,
    reuse: buildReuseRecord(packet),
    entity: buildEntityRecord()
  });

  assert.deepEqual(record.language.englishResidues, []);
  assert.equal(
    record.reasons.some((reason) => reason.code === "residual-english"),
    false
  );

  const englishPacket = buildPacket({
    frenchMeaningHtml:
      "<b>Ἀαρών</b> signifie <strong>G0002</strong>; Gen.1:1, except."
  });
  const englishRecord = buildFrenchCandidateAuditRecord({
    packet: englishPacket,
    reuse: buildReuseRecord(englishPacket),
    entity: buildEntityRecord()
  });
  assert.deepEqual(englishRecord.language.englishResidues, ["except"]);
});

test("preserves compact STEP reference aliases and continuations in candidate audit", () => {
  const citations =
    "Luk.2:11, 26 Jhn.1:41; Mat.2:4; Mrk.8:29; 1Co.14:5; Act.2:36 4:26";
  const packet = buildPacket({
    englishMeaningHtml: `<b>Ἀαρών</b> means <strong>G0002</strong>; ${citations}.`,
    frenchMeaningHtml: `<b>Ἀαρών</b> signifie <strong>G0002</strong>; ${citations}.`
  });
  const record = buildFrenchCandidateAuditRecord({
    packet,
    reuse: buildReuseRecord(packet),
    entity: buildEntityRecord()
  });

  assert.deepEqual(record.protectedContent.references.missing, []);
  assert.equal(
    record.reasons.some(
      (reason) => reason.code === "protected-bible-reference-missing"
    ),
    false
  );
});

test("accepts only the local legacy-to-span normalization on the French HTML skeleton", () => {
  const englishMeaningHtml =
    "<re><Level2><b>Ἀαρών</b></Level2> means <date>Gen.1:1</date>; <author><strong>G0002</strong></author>.</re>";
  const frenchMeaningHtml =
    "<span><span><b>Ἀαρών</b></span> signifie <span>Gen.1:1</span>; <span><strong>G0002</strong></span>.</span>";
  const packet = buildPacket({ englishMeaningHtml, frenchMeaningHtml });
  const record = buildFrenchCandidateAuditRecord({
    packet,
    reuse: buildReuseRecord(packet),
    entity: buildEntityRecord()
  });

  assert.equal(record.html.skeletonExact, true);
  assert.equal(record.html.candidateParseError, null);
  assert.equal(
    record.reasons.some((reason) =>
      ["candidate-html-unparseable", "html-source-skeleton-mismatch"].includes(
        reason.code
      )
    ),
    false
  );

  const unsafePacket = buildPacket({
    englishMeaningHtml,
    frenchMeaningHtml: frenchMeaningHtml
      .replace("<span>", "<re>")
      .replace("</span>", "</re>")
  });
  const unsafeRecord = buildFrenchCandidateAuditRecord({
    packet: unsafePacket,
    reuse: buildReuseRecord(unsafePacket),
    entity: buildEntityRecord()
  });
  assert.equal(unsafeRecord.status, "red");
  assert.match(
    unsafeRecord.html.candidateParseError ?? "",
    /unsafe-rendered-html-tag:re/u
  );
});

test("builds atomic, hashed audit artifacts from packet, reuse and entity attestations", async () => {
  const fixture = createFixture();
  try {
    const result = await runAuditLexiconV3FrenchCandidates({
      ...fixture.options,
      generatedAt: CREATED_AT,
      enforceHistoricalEn1Baseline: false
    });
    assert.equal(result.summary.counts.records, 1);
    assert.deepEqual(result.summary.counts.status, {
      green: 1,
      yellow: 0,
      red: 0
    });
    assert.equal(result.summary.counts.canonicalNameGlossGreen, 1);
    assert.equal(result.summary.counts.sealedIdentityCorrections, 0);
    assert.equal(
      sha256(readFileSync(fixture.options.recordsOutput, "utf8")),
      result.summary.artifacts.records.sha256
    );
    assert.equal(
      sha256(readFileSync(fixture.options.reportOutput, "utf8")),
      result.summary.artifacts.report.sha256
    );
    assert.match(result.report, /aucun meaning historique n'est auto-publié/u);
    const writtenSummary = JSON.parse(
      readFileSync(fixture.options.summaryOutput, "utf8")
    ) as typeof result.summary;
    assert.equal(writtenSummary.summaryDigest, result.summary.summaryDigest);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("fails closed when a packet is rehashed after French candidate tampering", async () => {
  const fixture = createFixture();
  try {
    const tampered = replaceCandidate(fixture.packet, {
      meaning: "contenu falsifié"
    });
    writeJsonl(fixture.options.packets, [tampered]);
    rewritePacketSummaryDigest(
      fixture.options.packetSummary,
      fixture.options.packets
    );
    await assert.rejects(
      runAuditLexiconV3FrenchCandidates({
        ...fixture.options,
        enforceHistoricalEn1Baseline: false
      }),
      /french-candidate-reuse-hash-mismatch/u
    );
    assert.equal(readFileIfExists(fixture.options.recordsOutput), null);
    assert.equal(readFileIfExists(fixture.options.summaryOutput), null);
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("fails closed on reuse-record and output-record tampering", async () => {
  const fixture = createFixture();
  try {
    const tamperedReuse = structuredClone(fixture.reuse);
    tamperedReuse.priorFrench.glossHash = "f".repeat(64);
    writeFileSync(
      fixture.options.reuseRecords,
      renderFrenchReuseRecords([tamperedReuse]),
      "utf8"
    );
    await assert.rejects(
      runAuditLexiconV3FrenchCandidates({
        ...fixture.options,
        enforceHistoricalEn1Baseline: false
      }),
      /french-reuse-record-digest-invalid/u
    );

    const record = buildFrenchCandidateAuditRecord({
      packet: fixture.packet,
      reuse: fixture.reuse,
      entity: fixture.entity
    });
    const tamperedRecord = structuredClone(record);
    tamperedRecord.status = "red";
    assert.throws(
      () => assertFrenchCandidateAuditRecords([tamperedRecord], 1),
      /french-candidate-audit-record-hash/u
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("the deterministic audit implementation contains no network transport", () => {
  const source = [
    readFileSync(resolve("src/lexiconV3/frenchCandidateAudit.ts"), "utf8"),
    readFileSync(resolve("scripts/auditLexiconV3FrenchCandidates.ts"), "utf8")
  ].join("\n");
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\/|AI_GATEWAY/iu);
});

test("rejects unknown candidate-audit CLI options", () => {
  assert.throws(
    () => parseFrenchCandidateAuditArgs(["--release", "invented"]),
    /french-candidate-unknown-option:release/u
  );
});

function buildPacket(
  options: {
    englishMeaningHtml?: string;
    frenchMeaningHtml?: string;
  } = {}
): LexiconV3FrenchPacket {
  const englishMeaningHtml =
    options.englishMeaningHtml ??
    "<b>Ἀαρών</b> means <strong>G0002</strong>; Gen.1:1.";
  const frenchMeaningHtml =
    options.frenchMeaningHtml ??
    "<b>Ἀαρών</b> signifie <strong>G0002</strong>; Gen.1:1.";
  return buildFrenchPacket(
    {
      entryKey: "greek:G0002",
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: "greek:G0002",
        gloss: "Aaron",
        meaning: stripLexiconHtml(englishMeaningHtml),
        meaningHtml: englishMeaningHtml,
        releaseKey: RELEASE_KEY,
        releaseSnapshotFingerprint: RELEASE_SNAPSHOT
      }),
      identity: {
        stepEntryId: 3,
        language: "greek",
        eStrong: "G0002",
        dStrong: "G0002 =",
        uStrong: "H0175",
        original: "Ἀαρών",
        transliteration: "Aarōn",
        morph: "N:N-M-P"
      },
      english: {
        contentHash: sha256(
          JSON.stringify({ gloss: "Aaron", meaningHtml: englishMeaningHtml })
        ),
        status: "validated",
        gloss: "Aaron",
        meaning: stripLexiconHtml(englishMeaningHtml),
        meaningHtml: englishMeaningHtml,
        sources: ["fixture-source"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [],
        legacy: null,
        existingFrench: {
          gloss: "Aaron",
          meaning: stripLexiconHtml(frenchMeaningHtml),
          meaningHtml: frenchMeaningHtml,
          source: "fixture:LexiconTranslations:fr",
          sourceHash: "d".repeat(64),
          trust: "untrusted-candidate"
        },
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: ["G0002"],
        references: ["Gen.1.1"],
        originalTokens: ["Ἀαρών"]
      }
    },
    CREATED_AT
  );
}

function replaceCandidate(
  packet: LexiconV3FrenchPacket,
  patch: Partial<
    NonNullable<LexiconV3FrenchPacket["evidence"]["existingFrench"]>
  >
): LexiconV3FrenchPacket {
  const cloned = structuredClone(packet);
  cloned.evidence.existingFrench = {
    ...cloned.evidence.existingFrench!,
    ...patch
  };
  const { packetHash: _packetHash, createdAt: _createdAt, ...content } = cloned;
  void _packetHash;
  void _createdAt;
  cloned.packetHash = frenchPacketHash(content);
  return cloned;
}

function buildReuseRecord(packet: LexiconV3FrenchPacket): FrenchReuseRecord {
  const candidate = packet.evidence.existingFrench!;
  const identity = {
    language: packet.identity.language,
    eStrong: packet.identity.eStrong,
    primaryDStrong: "G0002",
    dStrong: packet.identity.dStrong,
    uStrong: packet.identity.uStrong,
    original: packet.identity.original,
    transliteration: packet.identity.transliteration,
    morph: packet.identity.morph
  };
  const content: Omit<FrenchReuseRecord, "recordDigest"> = {
    schemaVersion: FRENCH_REUSE_RECORD_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    identity,
    identityHash: sha256(canonicalFrenchReuseJson(identity)),
    parents: {
      gloss: {
        releaseKey: RELEASE_KEY,
        releaseSnapshotFingerprint: RELEASE_SNAPSHOT,
        ...packet.englishRelease.parents.gloss
      },
      meaning: {
        releaseKey: RELEASE_KEY,
        releaseSnapshotFingerprint: RELEASE_SNAPSHOT,
        ...packet.englishRelease.parents.meaning
      }
    },
    priorEnglish: {
      glossHash: sha256(packet.english.gloss),
      meaningHtmlHash: sha256(packet.english.meaningHtml)
    },
    priorFrench: {
      glossHash: sha256(candidate.gloss),
      meaningTextHash: sha256(candidate.meaning),
      meaningHtmlHash: sha256(candidate.meaningHtml),
      specificTextHash: null,
      specificHtmlHash: null,
      specificVisibleTextHtmlMatch: null
    },
    meaningCohort: "unchanged",
    cohortProof: {
      kind: "byte_identity",
      currentHtmlDigest: sha256(packet.english.meaningHtml),
      previousHtmlDigest: sha256(packet.english.meaningHtml)
    },
    publicationAction: null,
    glossReviewSeed: false,
    meaningReviewSeed: false,
    glossRiskFlags: [],
    highRiskFlags: []
  };
  return {
    ...content,
    recordDigest: sha256(canonicalFrenchReuseJson(content))
  };
}

function buildEntityRecord(): FrenchCandidateEntityRecord {
  const content = {
    schemaVersion: FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
    entryKey: "greek:G0002",
    stepEntryId: 3,
    status: "green" as const,
    canonicalFr: "Aaron"
  };
  return { ...content, contentHash: contentHash(content) };
}

function createFixture(): {
  directory: string;
  packet: LexiconV3FrenchPacket;
  reuse: FrenchReuseRecord;
  entity: FrenchCandidateEntityRecord;
  options: FixtureOptions;
} {
  const directory = mkdtempSync(
    join(tmpdir(), "lexicon-v3-fr-candidate-audit-")
  );
  const options = {
    packets: join(directory, "packets.jsonl"),
    packetSummary: join(directory, "packets.summary.json"),
    reuseRecords: join(directory, "reuse.records.jsonl"),
    reuseSummary: join(directory, "reuse.summary.json"),
    entityRegistry: join(directory, "entity.jsonl"),
    entitySummary: join(directory, "entity.summary.json"),
    recordsOutput: join(directory, "out", "records.jsonl"),
    summaryOutput: join(directory, "out", "summary.json"),
    reportOutput: join(directory, "report.md"),
    expectedEntries: 1
  };
  const packet = buildPacket();
  const reuse = buildReuseRecord(packet);
  const entity = buildEntityRecord();
  writeJsonl(options.packets, [packet]);
  writeJsonl(options.entityRegistry, [entity]);
  const reuseText = renderFrenchReuseRecords([reuse]);
  writeFileSync(options.reuseRecords, reuseText, "utf8");

  writeJson(options.packetSummary, {
    schemaVersion: "lexicon-v3-french-packet-build@3",
    outputPackets: 1,
    withExistingFrench: 1,
    englishStatusCounts: {
      validated: 1,
      human_validated: 0,
      review_needed: 0,
      source_issue: 0
    },
    sourcePaths: { output: resolve(options.packets) },
    sourceDigests: {
      fullDatabase: HISTORICAL_DIGEST,
      englishAuthoring: AUTHORING_DIGEST
    },
    englishAuthoring: { digest: AUTHORING_DIGEST },
    englishRelease: {
      releaseKey: RELEASE_KEY,
      snapshotFingerprint: RELEASE_SNAPSHOT
    },
    outputDigest: sha256(readFileSync(options.packets, "utf8"))
  });
  writeJson(
    options.reuseSummary,
    buildReuseSummary(options.reuseRecords, reuse, reuseText)
  );
  writeJson(options.entitySummary, {
    schemaVersion: FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
    releaseKey: RELEASE_KEY,
    counts: {
      entityRegistry: 1,
      entityStatus: { green: 1, yellow: 0, red: 0 }
    },
    artifacts: {
      entityRegistry: {
        path: resolve(options.entityRegistry),
        sha256: sha256(readFileSync(options.entityRegistry, "utf8")),
        bytes: Buffer.byteLength(readFileSync(options.entityRegistry, "utf8")),
        records: 1
      }
    }
  });
  return { directory, packet, reuse, entity, options };
}

function buildReuseSummary(
  recordsPath: string,
  record: FrenchReuseRecord,
  recordsText: string
): FrenchReuseManifestSummary {
  const counts: FrenchReuseManifestSummary["counts"] = {
    entries: 1,
    englishFields: 2,
    meaningCohorts: { unchanged: 1, step_specific_only: 0, other_changed: 0 },
    glossReviewSeed: 0,
    meaningReviewSeed: 0,
    highRiskEntries: 0,
    stepSpecificFrenchPrefixDivergence: 0,
    stepSpecificFrenchTextUnavailable: 0,
    residualMeaningCohorts: {
      unchanged: 0,
      step_specific_only: 0,
      other_changed: 0
    },
    otherChangedSelections: {},
    glossRiskFlags: {},
    highRiskFlags: {}
  };
  const withoutDigest: Omit<FrenchReuseManifestSummary, "manifestDigest"> = {
    schemaVersion: FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
    policyVersion: FRENCH_REUSE_POLICY_VERSION,
    generatedAt: CREATED_AT,
    sourcePaths: {
      authoring: "/fixture/authoring.sqlite",
      legacyFull: "/fixture/legacy.sqlite",
      records: resolve(recordsPath)
    },
    sourceDigests: {
      authoring: AUTHORING_DIGEST,
      legacyFull: HISTORICAL_DIGEST
    },
    englishRelease: {
      releaseKey: RELEASE_KEY,
      releaseId: 1,
      state: "promoted",
      snapshotFingerprint: RELEASE_SNAPSHOT,
      sourceFingerprint: "3".repeat(64),
      sourceLogicalFingerprint: "4".repeat(64),
      codeFingerprint: "5".repeat(64),
      policyVersion: "fixture-policy@1"
    },
    counts,
    registryDigests: {
      hebrewGlossResidual: "6".repeat(64),
      hebrewMeaningResidual: "7".repeat(64),
      hebrewIdentityCorrections: HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
    },
    recordsLogicalDigest: sha256(
      canonicalFrenchReuseJson([
        { entryKey: record.entryKey, recordDigest: record.recordDigest }
      ])
    ),
    recordsOutputDigest: sha256(recordsText)
  };
  const projection = {
    schemaVersion: withoutDigest.schemaVersion,
    policyVersion: withoutDigest.policyVersion,
    sourceDigests: withoutDigest.sourceDigests,
    englishRelease: withoutDigest.englishRelease,
    counts: withoutDigest.counts,
    registryDigests: withoutDigest.registryDigests,
    recordsLogicalDigest: withoutDigest.recordsLogicalDigest,
    recordsOutputDigest: withoutDigest.recordsOutputDigest
  };
  return {
    ...withoutDigest,
    manifestDigest: sha256(canonicalFrenchReuseJson(projection))
  };
}

function rewritePacketSummaryDigest(
  summaryPath: string,
  packetsPath: string
): void {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as {
    outputDigest: string;
  };
  summary.outputDigest = sha256(readFileSync(packetsPath, "utf8"));
  writeJson(summaryPath, summary);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(path: string, values: readonly unknown[]): void {
  writeFileSync(
    path,
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8"
  );
}

function readFileIfExists(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
