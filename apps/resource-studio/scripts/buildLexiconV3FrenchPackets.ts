import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { once } from "node:events";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";

import { requiredLexiconV3Meta } from "../src/lexiconV3/authoringEnglish.js";
import { applyEnglishExactRepairs } from "../src/lexiconV3/englishExactRepairs.js";
import { applyEnglishCanonicalResourceRepairs } from "../src/lexiconV3/englishCanonicalResourceRepairs.js";
import {
  type EnglishEvidenceAuditRecord,
  ENGLISH_EVIDENCE_SCHEMA_VERSION,
  isCuratedAutoValidatedEnglishEvidence,
  validateEnglishAlternateStrongAliasEvidence,
  validateEnglishExactOccurrenceEvidence,
  validateEnglishGreekReconstructionEvidence,
  validateEnglishSemanticGlossEvidence
} from "../src/lexiconV3/evidence.js";
import {
  buildFrenchPacket,
  buildFrenchPacketEnglishReleaseLineage,
  extractFrenchProtectedContent,
  type FrenchExistingTranslationEvidence,
  type FrenchLegacyEvidence,
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  type FrenchConcordanceForm,
  stripLexiconHtml
} from "../src/lexiconV3/frenchValidation.js";
import {
  buildLexiconEntryKey,
  extractPrimaryDStrong
} from "../src/lexiconV3/identity.js";
import { verifyLexiconV3Schema } from "../src/lexiconV3/schema.js";
import {
  parseStrongTokens,
  readStrongCsv,
  type StrongRow
} from "../src/strongCsv.js";

const DEFAULT_INPUT = "outputs/lexicon-v3/english-audit.jsonl";
const DEFAULT_DB = "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_LEGACY_DB = "data/dictionaries/strong.legacy.sqlite";
const DEFAULT_SG1910 = "data/strongs/Sg1910.csv";
const DEFAULT_DARBY = "data/strongs/Darby.csv";
const DEFAULT_DARBY_R = "data/strongs/DarbyR.csv";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/french-packets.jsonl";
const DEFAULT_SUMMARY = "outputs/lexicon-v3/french-packets.summary.json";
const DEFAULT_REPORT = "reports/lexicon-v3-french-packets.md";

export interface BuildFrenchPacketsOptions {
  input: string;
  database: string;
  legacyDatabase: string;
  sg1910: string;
  darby: string;
  darbyR: string;
  /** Reviewed English-only authoring database. Required for publishable FR. */
  authoring: string;
  /** Exact promoted core-en release; defaults to the latest promoted core-en. */
  releaseKey?: string;
  output: string;
  summaryJson: string;
  report: string;
  only: Set<string>;
  offset: number;
  limit: number | null;
  createdAt?: string;
}

export interface FrenchPacketSourceDigests {
  englishEvidence: string;
  fullDatabase: string;
  legacyDatabase: string;
  Sg1910: string;
  Darby: string;
  DarbyR: string;
  englishAuthoring: string;
}

export interface FrenchPacketEnglishAuthoringAttestation {
  path: string;
  digest: string;
}

export interface FrenchPacketEnglishReleaseAttestation {
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
}

export interface FrenchPacketBuildSummary {
  schemaVersion: "lexicon-v3-french-packet-build@3";
  generatedAt: string;
  inputRecords: number;
  outputPackets: number;
  englishStatusCounts: Record<
    LexiconV3FrenchPacket["english"]["status"],
    number
  >;
  withLegacy: number;
  withExistingFrench: number;
  withResourceFrench: number;
  concordanceForms: number;
  sourcePaths: Omit<
    BuildFrenchPacketsOptions,
    "only" | "offset" | "limit" | "createdAt" | "releaseKey"
  >;
  sourceDigests: FrenchPacketSourceDigests;
  englishAuthoring: FrenchPacketEnglishAuthoringAttestation;
  englishRelease: FrenchPacketEnglishReleaseAttestation;
  outputDigest: string;
}

export interface ConcordanceWitnessInput {
  source: "Sg1910" | "Darby" | "DarbyR";
  family: "Sg1910" | "Darby-family";
  rows: readonly StrongRow[];
}

export interface FullDatabaseEntry {
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
}

interface FullDatabaseEvidence {
  entries: Map<number, FullDatabaseEntry>;
  existingFrench: Map<number, FrenchExistingTranslationEvidence>;
  resourceFrench: Map<number, FrenchExistingTranslationEvidence[]>;
}

export interface FrenchPacketBuildContext {
  databaseDigest: string;
  fullDatabase: FullDatabaseEvidence;
  legacyByStrong: Map<string, FrenchLegacyEvidence>;
  concordanceByStrong: Map<string, FrenchConcordanceForm[]>;
  releasedEnglish: Map<
    string,
    Pick<LexiconV3FrenchPacket, "english" | "englishRelease">
  >;
}

interface CoreEnglishReleaseRow {
  id: number;
  releaseKey: string;
  state: string;
  expectedEntryCount: number;
  sourceFingerprint: string;
  codeFingerprint: string;
  policyVersion: string;
  manifestJson: string;
}

interface CoreEnglishSupportingSourceRow {
  fieldVersionId: number;
  sourceKey: string;
}

interface CoreEnglishReleaseManifest {
  releaseProfile?: string;
  snapshotFingerprint?: string;
  sourceLogicalFingerprint?: string;
  sourceFingerprint?: string;
  codeFingerprint?: string;
  policyVersion?: string;
  fieldCount?: number;
}

interface CoreEnglishReleasedFieldRow {
  entryKey: string;
  field: "gloss" | "meaning";
  fieldVersionId: number;
  valueText: string;
  valueHtml: string | null;
  state: "auto_validated" | "human_validated";
  method: string;
  generator: string;
  contentHash: string;
}

interface SourceFormStats {
  family: ConcordanceWitnessInput["family"];
  count: number;
  surfaces: Map<string, number>;
}

type ConcordanceAccumulator = Map<
  string,
  Map<string, Map<string, SourceFormStats>>
>;

export async function runBuildFrenchPackets(
  options: BuildFrenchPacketsOptions
): Promise<FrenchPacketBuildSummary> {
  const required = [
    options.input,
    options.database,
    options.legacyDatabase,
    options.sg1910,
    options.darby,
    options.darbyR,
    options.authoring
  ];
  assertRequiredFiles(required);

  const generatedAt = options.createdAt ?? new Date().toISOString();
  const sourceDigests = await sourceFileDigests(options);
  const [sg1910Rows, darbyRows, darbyRRows] = await Promise.all([
    readRequiredStrongCsv(options.sg1910, "Sg1910"),
    readRequiredStrongCsv(options.darby, "Darby"),
    readRequiredStrongCsv(options.darbyR, "DarbyR")
  ]);
  const concordanceByStrong = buildFrenchConcordanceIndex([
    { source: "Sg1910", family: "Sg1910", rows: sg1910Rows },
    { source: "Darby", family: "Darby-family", rows: darbyRows },
    { source: "DarbyR", family: "Darby-family", rows: darbyRRows }
  ]);
  const englishAuthoring = readEnglishReleaseAttestation(
    options.authoring,
    sourceDigests.englishAuthoring,
    sourceDigests.englishEvidence,
    sourceDigests.fullDatabase,
    options.releaseKey
  );
  const context: FrenchPacketBuildContext = {
    databaseDigest: sourceDigests.fullDatabase,
    fullDatabase: readFullDatabaseEvidence(
      options.database,
      sourceDigests.fullDatabase
    ),
    legacyByStrong: readLegacyEvidence(
      options.legacyDatabase,
      sourceDigests.legacyDatabase
    ),
    concordanceByStrong,
    releasedEnglish: englishAuthoring.records
  };

  mkdirSync(dirname(resolve(options.output)), { recursive: true });
  const temporaryOutput = `${resolve(options.output)}.tmp-${process.pid}`;
  rmSync(temporaryOutput, { force: true });
  const output = createWriteStream(temporaryOutput, { encoding: "utf8" });
  const seenKeys = new Set<string>();
  const seenIds = new Set<number>();
  const englishStatusCounts: FrenchPacketBuildSummary["englishStatusCounts"] = {
    validated: 0,
    human_validated: 0,
    review_needed: 0,
    source_issue: 0
  };
  let inputRecords = 0;
  let outputPackets = 0;
  let matchedRecords = 0;
  let withLegacy = 0;
  let withExistingFrench = 0;
  let withResourceFrench = 0;
  let concordanceForms = 0;

  try {
    for await (const record of readEnglishEvidenceJsonl(options.input)) {
      inputRecords += 1;
      validateEnglishEvidenceRecord(record, context.databaseDigest);
      if (seenKeys.has(record.key)) {
        throw new Error(`duplicate-english-evidence-key:${record.key}`);
      }
      if (seenIds.has(record.stepEntryId)) {
        throw new Error(
          `duplicate-english-evidence-step-entry:${record.stepEntryId}`
        );
      }
      seenKeys.add(record.key);
      seenIds.add(record.stepEntryId);

      if (!recordMatchesSelection(record, options.only)) continue;
      if (matchedRecords < options.offset) {
        matchedRecords += 1;
        continue;
      }
      matchedRecords += 1;
      if (options.limit !== null && outputPackets >= options.limit) continue;

      const packet = buildFrenchPacketFromEvidence(
        record,
        context,
        generatedAt
      );
      const packetIssues = validateFrenchPacket(packet);
      if (packetIssues.length > 0) {
        throw new Error(
          `invalid-built-french-packet:${record.key}:${packetIssues.join(",")}`
        );
      }
      await writeLine(output, JSON.stringify(packet));
      outputPackets += 1;
      englishStatusCounts[packet.english.status] += 1;
      if (packet.evidence.legacy) withLegacy += 1;
      if (packet.evidence.existingFrench) withExistingFrench += 1;
      if (packet.evidence.resourceFrench.length > 0) withResourceFrench += 1;
      concordanceForms += packet.evidence.concordanceForms.length;
    }

    if (inputRecords === 0) throw new Error("empty-english-evidence-input");
    if (outputPackets === 0) throw new Error("no-french-packets-selected");
    output.end();
    await once(output, "finish");
    renameSync(temporaryOutput, resolve(options.output));
  } catch (error) {
    // A failed build may still have asynchronous filesystem writes in flight.
    // Swallow only the stream's teardown error; the original validation error
    // below remains the failure reported to the caller.
    output.on("error", () => undefined);
    output.destroy();
    rmSync(temporaryOutput, { force: true });
    throw error;
  }

  const outputDigest = await sha256File(options.output);
  const summary: FrenchPacketBuildSummary = {
    schemaVersion: "lexicon-v3-french-packet-build@3",
    generatedAt,
    inputRecords,
    outputPackets,
    englishStatusCounts,
    withLegacy,
    withExistingFrench,
    withResourceFrench,
    concordanceForms,
    sourcePaths: {
      input: resolve(options.input),
      database: resolve(options.database),
      legacyDatabase: resolve(options.legacyDatabase),
      sg1910: resolve(options.sg1910),
      darby: resolve(options.darby),
      darbyR: resolve(options.darbyR),
      authoring: resolve(options.authoring),
      output: resolve(options.output),
      summaryJson: resolve(options.summaryJson),
      report: resolve(options.report)
    },
    sourceDigests,
    englishAuthoring: englishAuthoring.attestation,
    englishRelease: englishAuthoring.release,
    outputDigest
  };
  writeText(options.summaryJson, `${JSON.stringify(summary, null, 2)}\n`);
  writeText(options.report, renderFrenchPacketReport(summary));
  return summary;
}

function readEnglishReleaseAttestation(
  path: string,
  digest: string,
  expectedEnglishAuditDigest: string,
  expectedDatabaseDigest: string,
  requestedReleaseKey?: string
): {
  records: Map<
    string,
    Pick<LexiconV3FrenchPacket, "english" | "englishRelease">
  >;
  attestation: FrenchPacketEnglishAuthoringAttestation;
  release: FrenchPacketEnglishReleaseAttestation;
} {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const verification = verifyLexiconV3Schema(database);
    if (!verification.ok) {
      throw new Error(
        `invalid-reviewed-english-authoring:${JSON.stringify(verification)}`
      );
    }
    if (
      requiredLexiconV3Meta(database, "databaseDigest") !==
      expectedDatabaseDigest
    ) {
      throw new Error("reviewed-authoring-database-digest-mismatch");
    }
    if (
      requiredLexiconV3Meta(database, "englishAuditDigest") !==
      expectedEnglishAuditDigest
    ) {
      throw new Error("reviewed-authoring-english-audit-digest-mismatch");
    }
    const release = readPromotedCoreEnglishRelease(
      database,
      requestedReleaseKey
    );
    const manifest = parseCoreEnglishReleaseManifest(release);
    const released = readCoreEnglishReleaseRecords(database, release, manifest);
    return {
      records: released,
      attestation: {
        path: resolve(path),
        digest
      },
      release: {
        releaseKey: release.releaseKey,
        releaseId: release.id,
        state: "promoted",
        snapshotFingerprint: manifest.snapshotFingerprint!,
        codeFingerprint: release.codeFingerprint,
        sourceFingerprint: release.sourceFingerprint,
        sourceLogicalFingerprint: manifest.sourceLogicalFingerprint!,
        policyVersion: release.policyVersion,
        expectedEntryCount: release.expectedEntryCount,
        fieldCount: manifest.fieldCount!
      }
    };
  } finally {
    database.close();
  }
}

function readPromotedCoreEnglishRelease(
  database: DatabaseSync,
  requestedReleaseKey?: string
): CoreEnglishReleaseRow {
  const releaseKey = requestedReleaseKey?.trim();
  const row = (
    releaseKey
      ? database
          .prepare(
            `SELECT id, releaseKey, state, expectedEntryCount,
                  sourceFingerprint, codeFingerprint, policyVersion,
                  manifestJson
           FROM LexiconReleases
           WHERE releaseKey = ?`
          )
          .get(releaseKey)
      : database
          .prepare(
            `SELECT id, releaseKey, state, expectedEntryCount,
                  sourceFingerprint, codeFingerprint, policyVersion,
                  manifestJson
           FROM LexiconReleases
           WHERE state = 'promoted'
             AND json_extract(manifestJson, '$.releaseProfile') = 'core-en'
           ORDER BY promotedAt DESC, id DESC
           LIMIT 1`
          )
          .get()
  ) as CoreEnglishReleaseRow | undefined;
  if (!row) {
    throw new Error(
      releaseKey
        ? `french-packet-release-missing:${releaseKey}`
        : "french-packet-promoted-core-en-release-missing"
    );
  }
  if (row.state !== "promoted") {
    throw new Error(`french-packet-release-not-promoted:${row.state}`);
  }
  return row;
}

function parseCoreEnglishReleaseManifest(
  release: CoreEnglishReleaseRow
): CoreEnglishReleaseManifest {
  let manifest: CoreEnglishReleaseManifest;
  try {
    manifest = JSON.parse(release.manifestJson) as CoreEnglishReleaseManifest;
  } catch {
    throw new Error("french-packet-release-manifest-json-invalid");
  }
  if (
    manifest.releaseProfile !== "core-en" ||
    !isSha256(manifest.snapshotFingerprint) ||
    !isSha256(manifest.sourceLogicalFingerprint) ||
    manifest.sourceFingerprint !== release.sourceFingerprint ||
    manifest.codeFingerprint !== release.codeFingerprint ||
    manifest.policyVersion !== release.policyVersion ||
    manifest.fieldCount !== release.expectedEntryCount * 2
  ) {
    throw new Error("french-packet-release-manifest-invalid");
  }
  return manifest;
}

function readCoreEnglishReleaseRecords(
  database: DatabaseSync,
  release: CoreEnglishReleaseRow,
  manifest: CoreEnglishReleaseManifest
): Map<string, Pick<LexiconV3FrenchPacket, "english" | "englishRelease">> {
  const fields = database
    .prepare(
      `SELECT rf.entryKey, rf.field, rf.fieldVersionId, fv.valueText,
              fv.valueHtml, fv.state, fv.method, fv.generator, fv.contentHash
       FROM LexiconReleaseFields rf
       JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
       WHERE rf.releaseId = ? AND rf.locale = 'en'
         AND rf.field IN ('gloss', 'meaning')
       ORDER BY rf.entryKey, rf.field`
    )
    .all(release.id) as unknown as CoreEnglishReleasedFieldRow[];
  if (fields.length !== manifest.fieldCount) {
    throw new Error(
      `french-packet-release-field-count:${fields.length}:${String(manifest.fieldCount)}`
    );
  }
  const sources = database
    .prepare(
      `SELECT DISTINCT evidence.fieldVersionId, source.sourceKey
       FROM LexiconReleaseFields rf
       JOIN LexiconFieldEvidence evidence
         ON evidence.fieldVersionId = rf.fieldVersionId
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE rf.releaseId = ? AND rf.locale = 'en'
         AND rf.field IN ('gloss', 'meaning')
         AND evidence.stance = 'supports'
       ORDER BY evidence.fieldVersionId, source.sourceKey`
    )
    .all(release.id) as unknown as CoreEnglishSupportingSourceRow[];
  const sourcesByField = new Map<number, string[]>();
  for (const source of sources) {
    getOrInsert(sourcesByField, source.fieldVersionId, () => []).push(
      source.sourceKey
    );
  }
  const fieldsByEntry = new Map<string, CoreEnglishReleasedFieldRow[]>();
  for (const field of fields) {
    if (!["auto_validated", "human_validated"].includes(field.state)) {
      throw new Error(
        `french-packet-release-parent-state:${field.entryKey}:${field.field}:${field.state}`
      );
    }
    getOrInsert(fieldsByEntry, field.entryKey, () => []).push(field);
  }
  if (fieldsByEntry.size !== release.expectedEntryCount) {
    throw new Error(
      `french-packet-release-entry-count:${fieldsByEntry.size}:${release.expectedEntryCount}`
    );
  }
  const records = new Map<
    string,
    Pick<LexiconV3FrenchPacket, "english" | "englishRelease">
  >();
  for (const [entryKey, entryFields] of fieldsByEntry) {
    const gloss = requiredCoreEnglishReleaseField(
      entryFields,
      "gloss",
      entryKey
    );
    const meaning = requiredCoreEnglishReleaseField(
      entryFields,
      "meaning",
      entryKey
    );
    const englishRelease = buildFrenchPacketEnglishReleaseLineage({
      entryKey,
      releaseKey: release.releaseKey,
      releaseSnapshotFingerprint: manifest.snapshotFingerprint!,
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
      englishRelease.parents.gloss.contentHash !== gloss.contentHash ||
      englishRelease.parents.meaning.contentHash !== meaning.contentHash
    ) {
      throw new Error(`french-packet-release-parent-content-hash:${entryKey}`);
    }
    const sourceKeys = uniqueSorted([
      ...(sourcesByField.get(gloss.fieldVersionId) ?? []),
      ...(sourcesByField.get(meaning.fieldVersionId) ?? [])
    ]);
    if (sourceKeys.length === 0) {
      throw new Error(
        `french-packet-release-parent-sources-missing:${entryKey}`
      );
    }
    records.set(entryKey, {
      englishRelease,
      english: {
        contentHash: "",
        status:
          gloss.state === "human_validated" ||
          meaning.state === "human_validated"
            ? "human_validated"
            : "validated",
        gloss: gloss.valueText,
        meaning: meaning.valueText,
        meaningHtml: meaning.valueHtml ?? meaning.valueText,
        sources: sourceKeys,
        issues: []
      }
    });
  }
  return records;
}

function requiredCoreEnglishReleaseField(
  fields: readonly CoreEnglishReleasedFieldRow[],
  field: "gloss" | "meaning",
  entryKey: string
): CoreEnglishReleasedFieldRow {
  const matches = fields.filter((candidate) => candidate.field === field);
  if (matches.length !== 1) {
    throw new Error(
      `french-packet-release-parent-field-count:${entryKey}:${field}:${matches.length}`
    );
  }
  return matches[0]!;
}

function requiredReleasedEnglish(
  records: Map<
    string,
    Pick<LexiconV3FrenchPacket, "english" | "englishRelease">
  >,
  entryKey: string
): Pick<LexiconV3FrenchPacket, "english" | "englishRelease"> {
  const english = records.get(entryKey);
  if (!english) throw new Error(`missing-released-english:${entryKey}`);
  return english;
}

export function buildFrenchPacketFromEvidence(
  record: EnglishEvidenceAuditRecord,
  context: FrenchPacketBuildContext,
  createdAt = new Date().toISOString()
): LexiconV3FrenchPacket {
  const databaseEntry = context.fullDatabase.entries.get(record.stepEntryId);
  if (!databaseEntry) {
    throw new Error(`missing-full-database-entry:${record.key}`);
  }
  assertMatchingDatabaseIdentity(record, databaseEntry);
  const releasedEnglish = requiredReleasedEnglish(
    context.releasedEnglish,
    record.key
  );
  const english = releasedEnglish.english;
  const classicalStrong = normalizeClassicalStrong(record.eStrong);
  const legacy = classicalStrong
    ? (context.legacyByStrong.get(classicalStrong) ?? null)
    : null;
  const concordanceForms = classicalStrong
    ? (context.concordanceByStrong.get(classicalStrong) ?? [])
    : [];
  const protectedContent = extractFrenchProtectedContent(english);
  const quarantinedResourceSources = new Set(
    record.decision.quarantinedSources.map((source) => source.toUpperCase())
  );
  const resourceFrench = (
    context.fullDatabase.resourceFrench.get(record.stepEntryId) ?? []
  ).filter((resource) => {
    const source = resource.source.split(":", 1)[0]?.toUpperCase() ?? "";
    return !quarantinedResourceSources.has(source);
  });

  return buildFrenchPacket(
    {
      entryKey: record.key,
      identity: {
        stepEntryId: record.stepEntryId,
        language: record.language,
        eStrong: record.eStrong,
        dStrong: record.dStrong,
        uStrong: record.uStrong,
        original: record.original,
        transliteration: record.transliteration,
        morph: record.morph
      },
      englishRelease: releasedEnglish.englishRelease,
      english,
      evidence: {
        occurrenceGlosses: buildFrenchOccurrenceGlossEvidence(record),
        concordanceForms,
        legacy,
        existingFrench:
          context.fullDatabase.existingFrench.get(record.stepEntryId) ?? null,
        resourceFrench
      },
      protectedContent
    },
    createdAt
  );
}

/**
 * Carries contextual source glosses into French work packets. Alternate
 * Strong aliases intentionally replace (rather than supplement) the exact
 * dStrong channel so the same native token can never be counted twice.
 */
export function buildFrenchOccurrenceGlossEvidence(
  record: EnglishEvidenceAuditRecord
): LexiconV3FrenchPacket["evidence"]["occurrenceGlosses"] {
  const alias = record.evidence.alternateStrongAlias;
  const selected = alias
    ? {
        source: `${alias.source}:alternateStrongAlias:${alias.aliasStrong}->${alias.primaryDStrong}`,
        occurrences: alias.occurrences
      }
    : {
        source: `${record.evidence.exactOccurrence.source}:exactDStrong:${record.evidence.exactOccurrence.stepStrong}`,
        occurrences: record.evidence.exactOccurrence.occurrences
      };
  const counts = new Map<string, number>();
  const seenLocators = new Set<string>();
  for (const occurrence of selected.occurrences) {
    if (seenLocators.has(occurrence.locator)) continue;
    seenLocators.add(occurrence.locator);
    const value = occurrence.gloss.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count, source: selected.source }))
    .sort(
      (left, right) =>
        right.count - left.count || left.value.localeCompare(right.value)
    );
}

export function selectCanonicalEnglish(
  record: EnglishEvidenceAuditRecord
): LexiconV3FrenchPacket["english"] {
  const semanticGlossIssues = validateEnglishSemanticGlossEvidence(record);
  if (semanticGlossIssues.length > 0) {
    throw new Error(
      `invalid-semantic-gloss-attestation:${record.key}:${semanticGlossIssues.join(",")}`
    );
  }
  const reconstructionIssues =
    validateEnglishGreekReconstructionEvidence(record);
  if (reconstructionIssues.length > 0) {
    throw new Error(
      `invalid-greek-reconstruction:${record.key}:${reconstructionIssues.join(",")}`
    );
  }
  const briefSource = record.language === "greek" ? "TBESG" : "TBESH";
  const quarantined = record.decision.status === "quarantined";
  const reconstructed = record.reconstruction?.applied === true;
  const exactInPlaceRepair =
    record.decision.status === "repaired" &&
    record.decision.canonicalSource === briefSource &&
    record.decision.reasonCodes.includes(
      "curated-auto-validated-exact-source-field-repair"
    );
  let selectedSource: string;
  let meaningHtml: string;

  if (reconstructed) {
    if (
      record.decision.status !== "repaired" ||
      record.decision.canonicalSource !== null
    ) {
      throw new Error(`invalid-reconstructed-canonical-source:${record.key}`);
    }
    selectedSource = "GREEK_RECONSTRUCTION";
    meaningHtml = record.meaning;
  } else if (exactInPlaceRepair) {
    // Exact field repairs mutate the pinned brief row itself; they do not
    // replace that row with TFLSJ. The audit and authoring boundaries replay
    // every repair against the original source row before reaching here.
    selectedSource = briefSource;
    meaningHtml = record.meaning;
  } else if (record.decision.status === "repaired") {
    if (record.decision.canonicalSource !== "TFLSJ") {
      throw new Error(`invalid-repaired-canonical-source:${record.key}`);
    }
    const resource = record.resources.find(
      (candidate) => candidate.source === "TFLSJ"
    );
    if (!resource?.contentHtml.trim()) {
      throw new Error(`missing-repaired-tflsj-content:${record.key}`);
    }
    selectedSource = "TFLSJ";
    meaningHtml =
      applyEnglishCanonicalResourceRepairs({
        entryKey: record.key,
        databaseDigest: record.sourceDigests.database,
        sourceSnapshotDigest: record.sourceDigests.TFLSJ,
        source: resource.source,
        kind: resource.kind,
        contentHtml: resource.contentHtml
      })?.contentHtml ?? resource.contentHtml;
  } else {
    if (!quarantined && record.decision.canonicalSource !== briefSource) {
      throw new Error(`invalid-brief-canonical-source:${record.key}`);
    }
    if (quarantined && record.decision.canonicalSource !== null) {
      throw new Error(`invalid-quarantined-canonical-source:${record.key}`);
    }
    selectedSource = briefSource;
    meaningHtml =
      record.language === "hebrew"
        ? normalizeTbeshMeaningHtml(record.meaning)
        : record.meaning;
  }

  const status: LexiconV3FrenchPacket["english"]["status"] = quarantined
    ? "source_issue"
    : isCuratedAutoValidatedEnglishEvidence(record.decision)
      ? "validated"
      : record.decision.status === "source-conflict" ||
          record.decision.status === "repaired"
        ? "review_needed"
        : "validated";
  const meaning = stripLexiconHtml(meaningHtml);
  if (status !== "source_issue" && (!record.gloss.trim() || !meaning)) {
    throw new Error(`missing-selected-english-content:${record.key}`);
  }
  const sources = [selectedSource];
  const issues = uniqueSorted([
    ...record.decision.reasonCodes,
    ...record.decision.quarantinedSources.map(
      (source) => `quarantined-source:${source}`
    )
  ]);
  const contentHash = sha256(
    stableJson({
      entryKey: record.key,
      recordDigest: record.recordDigest,
      status,
      gloss: record.gloss,
      meaning,
      meaningHtml,
      sources,
      issues
    })
  );
  return {
    contentHash,
    status,
    gloss: record.gloss.trim(),
    meaning,
    meaningHtml,
    sources,
    issues
  };
}

/**
 * Preserve the TBESH notice while escaping the one source token that looks
 * like an HTML tag (`<->`, used by H9001 for a bidirectional relation).
 * The raw source HTML remains available in its source assertion.
 */
export function normalizeTbeshMeaningHtml(value: string): string {
  return value.replaceAll("<->", "&lt;-&gt;");
}

export function selectTranslatableEnglish(
  record: EnglishEvidenceAuditRecord
): LexiconV3FrenchPacket["english"] {
  if (record.language !== "hebrew") return selectCanonicalEnglish(record);
  const status = "source_issue" as const;
  const issues = uniqueSorted([
    ...record.decision.reasonCodes,
    ...record.decision.quarantinedSources.map(
      (source) => `quarantined-source:${source}`
    ),
    "authoring-rights-attestation-required:TBESH-meaning"
  ]);
  const sources = ["TBESH"];
  return {
    status,
    gloss: record.gloss.trim(),
    meaning: "",
    meaningHtml: "",
    sources,
    issues,
    contentHash: sha256(
      stableJson({
        entryKey: record.key,
        recordDigest: record.recordDigest,
        status,
        gloss: record.gloss.trim(),
        meaning: "",
        meaningHtml: "",
        sources,
        issues
      })
    )
  };
}

export function englishEvidenceRecordDigest(
  record: EnglishEvidenceAuditRecord
): string {
  const content = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "recordDigest")
  );
  return sha256(stableJson(content));
}

export function buildFrenchConcordanceIndex(
  witnesses: readonly ConcordanceWitnessInput[]
): Map<string, FrenchConcordanceForm[]> {
  const accumulator: ConcordanceAccumulator = new Map();
  for (const witness of witnesses) {
    for (const row of witness.rows) {
      for (const token of parseStrongTokens(row.text)) {
        if (!token.normalized || !token.text.trim()) continue;
        for (const strong of new Set(token.strong)) {
          const normalizedStrong = normalizeClassicalStrong(strong);
          if (!normalizedStrong) continue;
          const forms = getOrInsert(
            accumulator,
            normalizedStrong,
            () => new Map()
          );
          const sources = getOrInsert(forms, token.normalized, () => new Map());
          const stats = getOrInsert(sources, witness.source, () => ({
            family: witness.family,
            count: 0,
            surfaces: new Map<string, number>()
          }));
          stats.count += 1;
          stats.surfaces.set(
            token.text,
            (stats.surfaces.get(token.text) ?? 0) + 1
          );
        }
      }
    }
  }

  const strongsByForm = new Map<string, Set<string>>();
  for (const [strong, forms] of accumulator) {
    for (const normalized of forms.keys()) {
      getOrInsert(strongsByForm, normalized, () => new Set()).add(strong);
    }
  }

  const result = new Map<string, FrenchConcordanceForm[]>();
  for (const [strong, forms] of accumulator) {
    const normalizedForms: FrenchConcordanceForm[] = [];
    for (const [normalized, sources] of forms) {
      const families = new Map<string, SourceFormStats[]>();
      for (const stats of sources.values()) {
        getOrInsert(families, stats.family, () => []).push(stats);
      }
      const count = [...families.values()].reduce(
        (total, familySources) =>
          total + Math.max(...familySources.map((source) => source.count)),
        0
      );
      normalizedForms.push({
        surface: representativeSurface(families),
        normalized,
        count,
        strongCount: strongsByForm.get(normalized)?.size ?? 0,
        witnessFamilies: [...families.keys()].sort(),
        sources: [...sources.keys()].sort()
      });
    }
    result.set(
      strong,
      normalizedForms.sort(
        (left, right) =>
          right.count - left.count ||
          left.normalized.localeCompare(right.normalized)
      )
    );
  }
  return result;
}

export function renderFrenchPacketReport(
  summary: FrenchPacketBuildSummary
): string {
  const statusRows = Object.entries(summary.englishStatusCounts)
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join("\n");
  const digestRows = Object.entries(summary.sourceDigests)
    .map(([source, digest]) => `| ${source} | \`${digest}\` |`)
    .join("\n");
  return `# Lexicon v3 French evidence packets

Generated: ${summary.generatedAt}

- Input English audit records: ${summary.inputRecords}
- Output French packets: ${summary.outputPackets}
- Packets with legacy evidence: ${summary.withLegacy}
- Packets with current French evidence: ${summary.withExistingFrench}
- Packets with translated TFLSJ evidence: ${summary.withResourceFrench}
- Concordance forms attached: ${summary.concordanceForms}
- Darby and DarbyR are counted as one witness family using the maximum edition count.
- Repaired English entries use TFLSJ but remain \`review_needed\` until a human validates the repair. Bundled or quarantined entries remain \`source_issue\`.
- English release: \`${summary.englishRelease.releaseKey}\` (snapshot \`${summary.englishRelease.snapshotFingerprint}\`).
- Output SHA-256: \`${summary.outputDigest}\`

## English status

| Status | Count |
| --- | ---: |
${statusRows}

## Required source digests

| Source | SHA-256 |
| --- | --- |
${digestRows}
`;
}

async function* readEnglishEvidenceJsonl(
  path: string
): AsyncGenerator<EnglishEvidenceAuditRecord> {
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as EnglishEvidenceAuditRecord;
    } catch (error) {
      throw new Error(
        `invalid-english-evidence-json:${lineNumber}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function validateEnglishEvidenceRecord(
  record: EnglishEvidenceAuditRecord,
  databaseDigest: string
): void {
  if (record.schemaVersion !== ENGLISH_EVIDENCE_SCHEMA_VERSION) {
    throw new Error(`invalid-english-evidence-schema:${record.key}`);
  }
  const expectedKey = buildLexiconEntryKey(record.language, record.dStrong);
  if (record.key !== expectedKey) {
    throw new Error(`english-evidence-entry-key-mismatch:${record.key}`);
  }
  if (record.sourceDigests.database !== databaseDigest) {
    throw new Error(`english-evidence-database-digest-mismatch:${record.key}`);
  }
  if (englishEvidenceRecordDigest(record) !== record.recordDigest) {
    throw new Error(`english-evidence-record-digest-mismatch:${record.key}`);
  }
  const exactOccurrenceIssues = validateEnglishExactOccurrenceEvidence(record);
  if (exactOccurrenceIssues.length > 0) {
    throw new Error(
      `english-evidence-exact-occurrences-invalid:${record.key}:${exactOccurrenceIssues.join(",")}`
    );
  }
  const alternateAliasIssues =
    validateEnglishAlternateStrongAliasEvidence(record);
  if (alternateAliasIssues.length > 0) {
    throw new Error(
      `english-evidence-alternate-strong-alias-invalid:${record.key}:${alternateAliasIssues.join(",")}`
    );
  }
  const reconstructionIssues =
    validateEnglishGreekReconstructionEvidence(record);
  if (reconstructionIssues.length > 0) {
    throw new Error(
      `english-evidence-greek-reconstruction-invalid:${record.key}:${reconstructionIssues.join(",")}`
    );
  }
  const semanticGlossIssues = validateEnglishSemanticGlossEvidence(record);
  if (semanticGlossIssues.length > 0) {
    throw new Error(
      `english-evidence-semantic-gloss-invalid:${record.key}:${semanticGlossIssues.join(",")}`
    );
  }
}

function readFullDatabaseEvidence(
  path: string,
  databaseDigest: string
): FullDatabaseEvidence {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    assertDatabaseTables(database, [
      "StepEntries",
      "LexiconTranslations",
      "LexiconResources",
      "LexiconResourceTranslations"
    ]);
    const entryRows = database
      .prepare(
        `select id as stepEntryId, language, eStrong, dStrong, uStrong,
                original, transliteration, morph, gloss, meaning
         from StepEntries order by id`
      )
      .all() as unknown as FullDatabaseEntry[];
    if (entryRows.length === 0) throw new Error("empty-full-lexicon-database");
    const entries = new Map(
      entryRows.map((entry) => [entry.stepEntryId, entry])
    );

    const existingFrench = new Map<number, FrenchExistingTranslationEvidence>();
    const translationRows = database
      .prepare(
        `select stepEntryId, gloss, meaning, meaningHtml
         from LexiconTranslations where language='fr' order by stepEntryId`
      )
      .all() as unknown as Array<{
      stepEntryId: number;
      gloss: string;
      meaning: string;
      meaningHtml: string;
    }>;
    for (const row of translationRows) {
      if (!row.gloss && !row.meaning && !row.meaningHtml) continue;
      existingFrench.set(row.stepEntryId, {
        gloss: row.gloss ?? "",
        meaning: row.meaning ?? stripLexiconHtml(row.meaningHtml ?? ""),
        meaningHtml: row.meaningHtml ?? row.meaning ?? "",
        source: "strong_lexicon.full.production.sqlite:LexiconTranslations:fr",
        sourceHash: sha256(
          stableJson({ databaseDigest, table: "LexiconTranslations", ...row })
        ),
        trust: "untrusted-candidate"
      });
    }

    const resourceRows = database
      .prepare(
        `select lr.id as resourceId, lr.stepEntryId, lr.source, lr.kind,
                lrt.contentHtml, lrt.contentText
         from LexiconResources lr
         join LexiconResourceTranslations lrt on lrt.resourceId=lr.id
         where lr.source='TFLSJ' and lrt.language='fr'
         order by lr.stepEntryId, lr.id`
      )
      .all() as unknown as Array<{
      resourceId: number;
      stepEntryId: number;
      source: string;
      kind: string;
      contentHtml: string;
      contentText: string;
    }>;
    if (resourceRows.length === 0) {
      throw new Error("missing-required-tflsj-french-translations");
    }
    const resourceFrench = new Map<
      number,
      FrenchExistingTranslationEvidence[]
    >();
    for (const row of resourceRows) {
      const evidence: FrenchExistingTranslationEvidence = {
        gloss: "",
        meaning: row.contentText || stripLexiconHtml(row.contentHtml),
        meaningHtml: row.contentHtml,
        source: `${row.source}:${row.kind}:fr`,
        sourceHash: sha256(
          stableJson({
            databaseDigest,
            table: "LexiconResourceTranslations",
            ...row
          })
        ),
        trust: "untrusted-candidate"
      };
      getOrInsert(resourceFrench, row.stepEntryId, () => []).push(evidence);
    }
    return { entries, existingFrench, resourceFrench };
  } finally {
    database.close();
  }
}

function readLegacyEvidence(
  path: string,
  databaseDigest: string
): Map<string, FrenchLegacyEvidence> {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    assertDatabaseTables(database, ["Grec", "Hebreu"]);
    const result = new Map<string, FrenchLegacyEvidence>();
    for (const input of [
      { table: "Grec", prefix: "G" },
      { table: "Hebreu", prefix: "H" }
    ] as const) {
      const rows = database
        .prepare(
          `select Code as code, LSG as gloss, Definition as meaning from ${input.table} where Code > 0 order by Code`
        )
        .all() as unknown as Array<{
        code: number;
        gloss: string;
        meaning: string;
      }>;
      for (const row of rows) {
        const strong = `${input.prefix}${String(row.code).padStart(4, "0")}`;
        result.set(strong, {
          gloss: stripLexiconHtml(row.gloss ?? ""),
          meaning: stripLexiconHtml(row.meaning ?? ""),
          source: `strong.legacy.sqlite:${input.table}:${strong}`,
          sourceHash: sha256(
            stableJson({ databaseDigest, table: input.table, ...row })
          )
        });
      }
    }
    if (result.size === 0) throw new Error("empty-required-legacy-database");
    return result;
  } finally {
    database.close();
  }
}

export function assertMatchingDatabaseIdentity(
  record: EnglishEvidenceAuditRecord,
  databaseEntry: FullDatabaseEntry
): void {
  const exactRepairEvidence = record.evidence.fieldRepairs.filter(
    (repair) => "schemaVersion" in repair
  );
  if (
    record.evidence.fieldRepairs.some(
      (repair) => repair.field === "morph" && !("schemaVersion" in repair)
    )
  ) {
    throw new Error(`full-database-morph-repair-unauthenticated:${record.key}`);
  }
  let replay: ReturnType<typeof applyEnglishExactRepairs>;
  try {
    replay = applyEnglishExactRepairs(databaseEntry, {
      databaseDigest: record.sourceDigests.database,
      sourceDigests: {
        TBESG: record.sourceDigests.TBESG,
        TBESH: record.sourceDigests.TBESH,
        TIPNR: record.sourceDigests.greekReconstruction?.tipnrPeople
      }
    });
  } catch (error) {
    throw new Error(
      `full-database-exact-repair-proof-invalid:${record.key}:${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (record.reconstruction && replay) {
    throw new Error(`full-database-exact-repair-ambiguous:${record.key}`);
  }
  if (
    (replay &&
      exactRepairEvidence.length !== record.evidence.fieldRepairs.length) ||
    stableJson(replay?.repairs ?? []) !== stableJson(exactRepairEvidence)
  ) {
    throw new Error(`full-database-exact-repair-replay-mismatch:${record.key}`);
  }
  if (
    replay &&
    !record.decision.reasonCodes.includes(
      "curated-auto-validated-exact-source-field-repair"
    )
  ) {
    throw new Error(`full-database-exact-repair-reason-missing:${record.key}`);
  }
  if (
    replay &&
    (replay.entry.morph !== record.morph ||
      replay.entry.gloss !== record.gloss ||
      replay.entry.meaning !== record.meaning)
  ) {
    throw new Error(`full-database-exact-repair-value-mismatch:${record.key}`);
  }
  const replayedMorphRepair = replay?.repairs.find(
    (repair) => repair.field === "morph"
  );
  const expected = {
    stepEntryId: record.stepEntryId,
    language: record.reconstruction?.rawEntry.language ?? record.language,
    eStrong: record.reconstruction?.rawEntry.eStrong ?? record.eStrong,
    dStrong: record.reconstruction?.rawEntry.dStrong ?? record.dStrong,
    uStrong: record.reconstruction?.rawEntry.uStrong ?? record.uStrong,
    original: record.reconstruction?.rawEntry.original ?? record.original,
    transliteration:
      record.reconstruction?.rawEntry.transliteration ?? record.transliteration,
    morph:
      record.reconstruction?.rawEntry.morph ??
      replayedMorphRepair?.sourceValue ??
      record.morph
  };
  const rawIdentity = {
    stepEntryId: databaseEntry.stepEntryId,
    language: databaseEntry.language,
    eStrong: databaseEntry.eStrong,
    dStrong: databaseEntry.dStrong,
    uStrong: databaseEntry.uStrong,
    original: databaseEntry.original,
    transliteration: databaseEntry.transliteration,
    morph: databaseEntry.morph
  };
  if (stableJson(expected) !== stableJson(rawIdentity)) {
    throw new Error(`full-database-entry-mismatch:${record.key}`);
  }
}

function representativeSurface(
  families: Map<string, SourceFormStats[]>
): string {
  const scores = new Map<string, number>();
  for (const familySources of families.values()) {
    const surfaces = new Set(
      familySources.flatMap((source) => [...source.surfaces.keys()])
    );
    for (const surface of surfaces) {
      const familyCount = Math.max(
        ...familySources.map((source) => source.surfaces.get(surface) ?? 0)
      );
      scores.set(surface, (scores.get(surface) ?? 0) + familyCount);
    }
  }
  return (
    [...scores.entries()].sort(
      ([leftSurface, leftCount], [rightSurface, rightCount]) =>
        rightCount - leftCount ||
        leftSurface.length - rightSurface.length ||
        leftSurface.localeCompare(rightSurface)
    )[0]?.[0] ?? ""
  );
}

function recordMatchesSelection(
  record: EnglishEvidenceAuditRecord,
  only: Set<string>
): boolean {
  if (only.size === 0) return true;
  const dStrong = extractPrimaryDStrong(record.dStrong) ?? "";
  return [...only].some((rawValue) => {
    const value = rawValue.trim();
    const upper = value.toUpperCase();
    return (
      value === record.key ||
      value === String(record.stepEntryId) ||
      upper === record.eStrong.toUpperCase() ||
      value === dStrong
    );
  });
}

function normalizeClassicalStrong(value: string): string | null {
  const match = value.toUpperCase().match(/\b([GH])0*(\d{1,5})/u);
  if (!match) return null;
  return `${match[1]}${String(Number.parseInt(match[2] ?? "", 10)).padStart(4, "0")}`;
}

function assertDatabaseTables(
  database: DatabaseSync,
  requiredTables: string[]
): void {
  const existing = new Set(
    (
      database
        .prepare(`select name from sqlite_master where type='table'`)
        .all() as unknown as Array<{ name: string }>
    ).map((row) => row.name)
  );
  const missing = requiredTables.filter((table) => !existing.has(table));
  if (missing.length > 0) {
    throw new Error(`missing-required-database-tables:${missing.join(",")}`);
  }
}

function assertRequiredFiles(paths: string[]): void {
  const missing = paths.filter(
    (path) => !existsSync(path) || !statSync(path).isFile()
  );
  if (missing.length > 0) {
    throw new Error(`missing-required-sources:${missing.join(",")}`);
  }
  const empty = paths.filter((path) => statSync(path).size === 0);
  if (empty.length > 0) {
    throw new Error(`empty-required-sources:${empty.join(",")}`);
  }
}

async function readRequiredStrongCsv(
  path: string,
  source: string
): Promise<StrongRow[]> {
  const rows = await readStrongCsv(path);
  if (rows.length === 0)
    throw new Error(`empty-required-concordance:${source}`);
  return rows;
}

async function sourceFileDigests(
  options: BuildFrenchPacketsOptions
): Promise<FrenchPacketSourceDigests> {
  const [
    englishEvidence,
    fullDatabase,
    legacyDatabase,
    Sg1910,
    Darby,
    DarbyR,
    englishAuthoring
  ] = await Promise.all([
    sha256File(options.input),
    sha256File(options.database),
    sha256File(options.legacyDatabase),
    sha256File(options.sg1910),
    sha256File(options.darby),
    sha256File(options.darbyR),
    sha256File(options.authoring)
  ]);
  return {
    englishEvidence,
    fullDatabase,
    legacyDatabase,
    Sg1910,
    Darby,
    DarbyR,
    englishAuthoring
  };
}

async function sha256File(path: string): Promise<string> {
  return await new Promise<string>((resolveDigest, reject) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolveDigest(hash.digest("hex")));
  });
}

async function writeLine(
  output: ReturnType<typeof createWriteStream>,
  line: string
): Promise<void> {
  if (!output.write(`${line}\n`)) await once(output, "drain");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, content);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function getOrInsert<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = create();
  map.set(key, created);
  return created;
}

export function parseFrenchPacketsArgs(
  args: readonly string[]
): BuildFrenchPacketsOptions {
  const allowed = new Set([
    "input",
    "db",
    "legacy-db",
    "sg1910",
    "darby",
    "darby-r",
    "authoring",
    "release-key",
    "output",
    "summary-json",
    "report",
    "only",
    "offset",
    "limit"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) {
      throw new Error(`french-packets-unexpected-argument:${String(arg)}`);
    }
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key || !allowed.has(key)) {
      throw new Error(`french-packets-unknown-option:${String(key)}`);
    }
    if (values.has(key)) {
      throw new Error(`french-packets-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) {
        throw new Error(`french-packets-missing-option-value:${key}`);
      }
      values.set(key, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-packets-missing-option-value:${key}`);
    }
  }
  const limitValue = values.get("limit");
  const limit = limitValue ? Number(limitValue) : null;
  const offsetValue = values.get("offset") ?? "0";
  const offset = Number(offsetValue);
  if (
    limit !== null &&
    (!/^[1-9]\d*$/u.test(limitValue ?? "") ||
      !Number.isSafeInteger(limit) ||
      limit < 1)
  ) {
    throw new Error(`invalid-limit:${limitValue}`);
  }
  if (
    !/^(?:0|[1-9]\d*)$/u.test(offsetValue) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error(`invalid-offset:${offsetValue}`);
  }
  const authoring = values.get("authoring")?.trim();
  if (!authoring) {
    throw new Error("french-packets-authoring-required");
  }
  return {
    input: resolve(values.get("input") ?? DEFAULT_INPUT),
    database: resolve(values.get("db") ?? DEFAULT_DB),
    legacyDatabase: resolve(values.get("legacy-db") ?? DEFAULT_LEGACY_DB),
    sg1910: resolve(values.get("sg1910") ?? DEFAULT_SG1910),
    darby: resolve(values.get("darby") ?? DEFAULT_DARBY),
    darbyR: resolve(values.get("darby-r") ?? DEFAULT_DARBY_R),
    authoring: resolve(authoring),
    ...(values.get("release-key")?.trim()
      ? { releaseKey: values.get("release-key")!.trim() }
      : {}),
    output: resolve(values.get("output") ?? DEFAULT_OUTPUT),
    summaryJson: resolve(values.get("summary-json") ?? DEFAULT_SUMMARY),
    report: resolve(values.get("report") ?? DEFAULT_REPORT),
    only: new Set(
      (values.get("only") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
    offset,
    limit
  };
}

async function main(): Promise<void> {
  const summary = await runBuildFrenchPackets(
    parseFrenchPacketsArgs(process.argv.slice(2))
  );
  console.log(JSON.stringify(summary, null, 2));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchPackets")}: ${message}`
    );
    process.exitCode = 1;
  });
}
