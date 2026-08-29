import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  assertFrenchCandidateAuditRecords,
  assertFrenchCandidateAuditSummary,
  assertFrenchCandidateCorrectionRegistry,
  buildFrenchCandidateAuditCounts,
  buildFrenchCandidateAuditRecord,
  canonicalFrenchCandidateAuditJson,
  type FrenchCandidateAuditRecord,
  type FrenchCandidateAuditSummary,
  type FrenchCandidateEntityRecord,
  FRENCH_CANDIDATE_AUDIT_POLICY_VERSION,
  FRENCH_CANDIDATE_AUDIT_SUMMARY_SCHEMA_VERSION,
  frenchCandidateAuditSummaryHash,
  hashFrenchCandidateAudit,
  renderFrenchCandidateAuditRecords
} from "../src/lexiconV3/frenchCandidateAudit.js";
import { FRENCH_HTML_RENDERER_VERSION } from "../src/lexiconV3/frenchHtmlRenderer.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import {
  assertFrenchReuseManifest,
  FRENCH_REUSE_HISTORICAL_EN_1_BASELINE,
  type FrenchReuseManifestSummary,
  type FrenchReuseRecord
} from "../src/lexiconV3/frenchReuseManifest.js";
import {
  contentHash,
  FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION
} from "../src/lexiconV3/frenchEditorialPolicy.js";
import { HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST } from "../src/lexiconV3/hebrewIdentityCorrections.js";

const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_PACKET_SUMMARY =
  "outputs/lexicon-v3/fr-internal/french-packets.summary.json";
const DEFAULT_REUSE_RECORDS =
  "outputs/lexicon-v3/french-reuse/french-reuse.records.jsonl";
const DEFAULT_REUSE_SUMMARY =
  "outputs/lexicon-v3/french-reuse/french-reuse.summary.json";
const DEFAULT_ENTITY_REGISTRY =
  "outputs/lexicon-v3/french-editorial/entity-registry.jsonl";
const DEFAULT_ENTITY_SUMMARY =
  "outputs/lexicon-v3/french-editorial/summary.json";
const DEFAULT_OUTPUT_DIRECTORY = "outputs/lexicon-v3/french-candidate-audit";
const DEFAULT_REPORT = "reports/lexicon-v3-french-candidate-audit.md";
const DEFAULT_EXPECTED_ENTRIES = 22_717;

interface FrenchPacketBuildSummary {
  schemaVersion: string;
  outputPackets: number;
  withExistingFrench: number;
  englishStatusCounts: Record<string, number>;
  sourcePaths: { output: string };
  sourceDigests: {
    fullDatabase: string;
    englishAuthoring: string;
  };
  englishAuthoring: { digest: string };
  englishRelease: {
    releaseKey: string;
    snapshotFingerprint: string;
  };
  outputDigest: string;
}

interface FrenchEditorialSummary {
  schemaVersion: string;
  releaseKey: string;
  counts: {
    entityRegistry: number;
    entityStatus: Record<string, number>;
  };
  artifacts: {
    entityRegistry: {
      path: string;
      sha256: string;
      bytes: number;
      records: number;
    };
  };
}

export interface AuditLexiconV3FrenchCandidatesOptions {
  packets?: string;
  packetSummary?: string;
  reuseRecords?: string;
  reuseSummary?: string;
  entityRegistry?: string;
  entitySummary?: string;
  outputDirectory?: string;
  recordsOutput?: string;
  summaryOutput?: string;
  reportOutput?: string;
  expectedEntries?: number;
  generatedAt?: string;
  enforceHistoricalEn1Baseline?: boolean;
}

export interface AuditLexiconV3FrenchCandidatesResult {
  records: FrenchCandidateAuditRecord[];
  summary: FrenchCandidateAuditSummary;
  report: string;
}

export async function runAuditLexiconV3FrenchCandidates(
  input: AuditLexiconV3FrenchCandidatesOptions = {}
): Promise<AuditLexiconV3FrenchCandidatesResult> {
  const expectedEntries = input.expectedEntries ?? DEFAULT_EXPECTED_ENTRIES;
  const outputDirectory = resolve(
    input.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY
  );
  const paths = {
    packets: resolve(input.packets ?? DEFAULT_PACKETS),
    packetSummary: resolve(input.packetSummary ?? DEFAULT_PACKET_SUMMARY),
    reuseRecords: resolve(input.reuseRecords ?? DEFAULT_REUSE_RECORDS),
    reuseSummary: resolve(input.reuseSummary ?? DEFAULT_REUSE_SUMMARY),
    entityRegistry: resolve(input.entityRegistry ?? DEFAULT_ENTITY_REGISTRY),
    entitySummary: resolve(input.entitySummary ?? DEFAULT_ENTITY_SUMMARY),
    recordsOutput: resolve(
      input.recordsOutput ?? resolve(outputDirectory, "records.jsonl")
    ),
    summaryOutput: resolve(
      input.summaryOutput ?? resolve(outputDirectory, "summary.json")
    ),
    reportOutput: resolve(input.reportOutput ?? DEFAULT_REPORT)
  };
  assertDistinctOutputs(
    paths.recordsOutput,
    paths.summaryOutput,
    paths.reportOutput
  );
  assertFrenchCandidateCorrectionRegistry();

  const sourceDigests = await hashSources({
    packets: paths.packets,
    packetSummary: paths.packetSummary,
    reuseRecords: paths.reuseRecords,
    reuseSummary: paths.reuseSummary,
    entityRegistry: paths.entityRegistry,
    entitySummary: paths.entitySummary
  });
  const packetSummary = readJson<FrenchPacketBuildSummary>(paths.packetSummary);
  const reuseSummary = readJson<FrenchReuseManifestSummary>(paths.reuseSummary);
  const entitySummary = readJson<FrenchEditorialSummary>(paths.entitySummary);
  const reuseRecords = await readJsonl<FrenchReuseRecord>(paths.reuseRecords);
  assertFrenchReuseManifest(
    { records: reuseRecords, summary: reuseSummary },
    input.enforceHistoricalEn1Baseline === true
      ? FRENCH_REUSE_HISTORICAL_EN_1_BASELINE
      : null
  );
  validateSourceLineage({
    paths,
    expectedEntries,
    sourceDigests,
    packetSummary,
    reuseSummary,
    entitySummary
  });

  const entityRecords = await readJsonl<FrenchCandidateEntityRecord>(
    paths.entityRegistry
  );
  const entities = validateEntityRegistry(entityRecords, entitySummary);
  const reuseByKey = uniqueMap(
    reuseRecords,
    (record) => record.entryKey,
    "reuse-record"
  );
  const seenPacketKeys = new Set<string>();
  const seenPacketIds = new Set<number>();
  const seenEntities = new Set<string>();
  const records: FrenchCandidateAuditRecord[] = [];

  for await (const packet of readJsonlStream<LexiconV3FrenchPacket>(
    paths.packets
  )) {
    if (seenPacketKeys.has(packet.entryKey)) {
      throw new Error(
        `french-candidate-packet-duplicate-key:${packet.entryKey}`
      );
    }
    if (seenPacketIds.has(packet.identity.stepEntryId)) {
      throw new Error(
        `french-candidate-packet-duplicate-step-id:${packet.identity.stepEntryId}`
      );
    }
    const reuse = reuseByKey.get(packet.entryKey);
    if (!reuse)
      throw new Error(`french-candidate-reuse-missing:${packet.entryKey}`);
    const entity = entities.get(packet.entryKey) ?? null;
    if (entity) seenEntities.add(packet.entryKey);
    records.push(buildFrenchCandidateAuditRecord({ packet, reuse, entity }));
    seenPacketKeys.add(packet.entryKey);
    seenPacketIds.add(packet.identity.stepEntryId);
    reuseByKey.delete(packet.entryKey);
  }
  if (reuseByKey.size > 0) {
    throw new Error(
      `french-candidate-orphan-reuse-records:${[...reuseByKey.keys()].slice(0, 5).join(",")}`
    );
  }
  const orphanEntities = [...entities.keys()].filter(
    (entryKey) => !seenEntities.has(entryKey)
  );
  if (orphanEntities.length > 0) {
    throw new Error(
      `french-candidate-orphan-entities:${orphanEntities.slice(0, 5).join(",")}`
    );
  }
  records.sort((left, right) => left.entryKey.localeCompare(right.entryKey));
  assertFrenchCandidateAuditRecords(records, expectedEntries);
  const aggregate = buildFrenchCandidateAuditCounts(records);
  const expectedCorrections =
    reuseSummary.counts.glossRiskFlags["hebrew-identity-correction"] ?? 0;
  if (aggregate.counts.sealedIdentityCorrections !== expectedCorrections) {
    throw new Error(
      `french-candidate-identity-correction-count:${aggregate.counts.sealedIdentityCorrections}:${expectedCorrections}`
    );
  }

  const recordsText = renderFrenchCandidateAuditRecords(records);
  const recordsLogicalDigest = hashFrenchCandidateAudit(
    records.map((record) => ({
      entryKey: record.entryKey,
      auditHash: record.auditHash
    }))
  );
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const report = renderFrenchCandidateAuditReport({
    generatedAt,
    expectedEntries,
    releaseKey: reuseSummary.englishRelease.releaseKey,
    sourceDigests,
    counts: aggregate.counts,
    reasonCounts: aggregate.reasonCounts,
    recordsLogicalDigest
  });
  const summaryWithoutDigest: Omit<
    FrenchCandidateAuditSummary,
    "summaryDigest"
  > = {
    schemaVersion: FRENCH_CANDIDATE_AUDIT_SUMMARY_SCHEMA_VERSION,
    policyVersion: FRENCH_CANDIDATE_AUDIT_POLICY_VERSION,
    generatedAt,
    rendererVersion: FRENCH_HTML_RENDERER_VERSION,
    expectedEntries,
    release: {
      releaseKey: reuseSummary.englishRelease.releaseKey,
      releaseSnapshotFingerprint:
        reuseSummary.englishRelease.snapshotFingerprint,
      reuseManifestDigest: reuseSummary.manifestDigest,
      hebrewIdentityCorrectionsDigest:
        HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
    },
    sourcePaths: {
      packets: paths.packets,
      packetSummary: paths.packetSummary,
      reuseRecords: paths.reuseRecords,
      reuseSummary: paths.reuseSummary,
      entityRegistry: paths.entityRegistry,
      entitySummary: paths.entitySummary
    },
    sourceDigests,
    counts: aggregate.counts,
    reasonCounts: aggregate.reasonCounts,
    recordsLogicalDigest,
    artifacts: {
      records: {
        path: paths.recordsOutput,
        sha256: sha256(recordsText),
        bytes: Buffer.byteLength(recordsText),
        records: records.length
      },
      report: {
        path: paths.reportOutput,
        sha256: sha256(report),
        bytes: Buffer.byteLength(report)
      }
    }
  };
  const summary: FrenchCandidateAuditSummary = {
    ...summaryWithoutDigest,
    summaryDigest: frenchCandidateAuditSummaryHash(summaryWithoutDigest)
  };
  assertFrenchCandidateAuditSummary(summary, records, recordsText, report);
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`;
  writeTransactionally([
    { path: paths.recordsOutput, content: recordsText },
    { path: paths.summaryOutput, content: summaryText },
    { path: paths.reportOutput, content: report }
  ]);
  await verifyWrittenArtifacts(paths, summary, summaryText);
  return { records, summary, report };
}

function validateSourceLineage(input: {
  paths: {
    packets: string;
    packetSummary: string;
    reuseRecords: string;
    reuseSummary: string;
    entityRegistry: string;
    entitySummary: string;
  };
  expectedEntries: number;
  sourceDigests: FrenchCandidateAuditSummary["sourceDigests"];
  packetSummary: FrenchPacketBuildSummary;
  reuseSummary: FrenchReuseManifestSummary;
  entitySummary: FrenchEditorialSummary;
}): void {
  const {
    paths,
    expectedEntries,
    sourceDigests,
    packetSummary,
    reuseSummary,
    entitySummary
  } = input;
  if (packetSummary.schemaVersion !== "lexicon-v3-french-packet-build@3") {
    throw new Error("french-candidate-packet-summary-schema");
  }
  if (
    packetSummary.outputPackets !== expectedEntries ||
    packetSummary.withExistingFrench !== expectedEntries
  ) {
    throw new Error("french-candidate-packet-summary-count");
  }
  if (
    (packetSummary.englishStatusCounts.validated ?? 0) !== expectedEntries ||
    Object.entries(packetSummary.englishStatusCounts).some(
      ([status, count]) => status !== "validated" && count !== 0
    )
  ) {
    throw new Error("french-candidate-packet-english-not-fully-validated");
  }
  if (
    packetSummary.outputDigest !== sourceDigests.packets ||
    resolve(packetSummary.sourcePaths.output) !== paths.packets
  ) {
    throw new Error("french-candidate-packet-output-attestation");
  }
  if (
    packetSummary.sourceDigests.englishAuthoring !==
      reuseSummary.sourceDigests.authoring ||
    packetSummary.englishAuthoring.digest !==
      reuseSummary.sourceDigests.authoring
  ) {
    throw new Error("french-candidate-authoring-lineage-mismatch");
  }
  if (
    packetSummary.englishRelease.releaseKey !==
      reuseSummary.englishRelease.releaseKey ||
    packetSummary.englishRelease.snapshotFingerprint !==
      reuseSummary.englishRelease.snapshotFingerprint
  ) {
    throw new Error("french-candidate-release-lineage-mismatch");
  }
  if (
    packetSummary.sourceDigests.fullDatabase !==
    reuseSummary.sourceDigests.legacyFull
  ) {
    throw new Error("french-candidate-historical-source-lineage-mismatch");
  }
  if (
    reuseSummary.counts.entries !== expectedEntries ||
    reuseSummary.sourceDigests.authoring !==
      packetSummary.sourceDigests.englishAuthoring ||
    reuseSummary.recordsOutputDigest !== sourceDigests.reuseRecords ||
    resolve(reuseSummary.sourcePaths.records ?? "") !== paths.reuseRecords
  ) {
    throw new Error("french-candidate-reuse-summary-attestation");
  }
  if (
    reuseSummary.registryDigests.hebrewIdentityCorrections !==
    HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
  ) {
    throw new Error("french-candidate-reuse-correction-registry-mismatch");
  }
  if (entitySummary.schemaVersion !== FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION) {
    throw new Error("french-candidate-entity-summary-schema");
  }
  if (entitySummary.releaseKey !== reuseSummary.englishRelease.releaseKey) {
    throw new Error("french-candidate-entity-release-mismatch");
  }
  const artifact = entitySummary.artifacts.entityRegistry;
  if (
    artifact.sha256 !== sourceDigests.entityRegistry ||
    artifact.bytes !== statSync(paths.entityRegistry).size ||
    artifact.records !== entitySummary.counts.entityRegistry ||
    resolve(artifact.path) !== paths.entityRegistry
  ) {
    throw new Error("french-candidate-entity-artifact-attestation");
  }
}

function validateEntityRegistry(
  records: readonly FrenchCandidateEntityRecord[],
  summary: FrenchEditorialSummary
): Map<string, FrenchCandidateEntityRecord> {
  if (records.length !== summary.counts.entityRegistry) {
    throw new Error("french-candidate-entity-count");
  }
  const counts: Record<string, number> = { green: 0, yellow: 0, red: 0 };
  const keys = new Set<string>();
  const ids = new Set<number>();
  for (const record of records) {
    if (record.schemaVersion !== FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION) {
      throw new Error(`french-candidate-entity-schema:${record.entryKey}`);
    }
    if (keys.has(record.entryKey) || ids.has(record.stepEntryId)) {
      throw new Error(`french-candidate-entity-duplicate:${record.entryKey}`);
    }
    const { contentHash: recordHash, ...content } = record;
    if (contentHash(content) !== recordHash) {
      throw new Error(`french-candidate-entity-hash:${record.entryKey}`);
    }
    if (record.status === "green" && !record.canonicalFr?.trim()) {
      throw new Error(`french-candidate-green-entity-empty:${record.entryKey}`);
    }
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    keys.add(record.entryKey);
    ids.add(record.stepEntryId);
  }
  if (
    canonicalFrenchCandidateAuditJson(counts) !==
    canonicalFrenchCandidateAuditJson(summary.counts.entityStatus)
  ) {
    throw new Error("french-candidate-entity-status-counts");
  }
  return new Map(records.map((record) => [record.entryKey, record]));
}

function renderFrenchCandidateAuditReport(input: {
  generatedAt: string;
  expectedEntries: number;
  releaseKey: string;
  sourceDigests: FrenchCandidateAuditSummary["sourceDigests"];
  counts: FrenchCandidateAuditSummary["counts"];
  reasonCounts: Record<string, number>;
  recordsLogicalDigest: string;
}): string {
  const topReasons = Object.entries(input.reasonCounts)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, 30)
    .map(([reason, count]) => `| \`${reason}\` | ${count} |`)
    .join("\n");
  return `# Audit déterministe des candidats français du lexique v3

Généré : ${input.generatedAt}

- Release anglaise : \`${input.releaseKey}\`
- Politique : \`${FRENCH_CANDIDATE_AUDIT_POLICY_VERSION}\`
- Renderer HTML : \`${FRENCH_HTML_RENDERER_VERSION}\`
- Entrées attendues et auditées : ${input.expectedEntries}
- Digest logique des records : \`${input.recordsLogicalDigest}\`

Les champs historiques \`gloss\`, \`meaning\` et \`meaningHtml\` restent des candidats non fiables. Un statut green n'autorise au maximum que le gloss d'un nom propre attesté par le registre canonique; aucune identité textuelle avec l'anglais ne promeut un contenu et aucun meaning historique n'est auto-publié.

## Résultats

| Mesure | Nombre |
|---|---:|
| Records green | ${input.counts.status.green} |
| Records yellow | ${input.counts.status.yellow} |
| Records red | ${input.counts.status.red} |
| Glosses canoniques de noms propres green | ${input.counts.canonicalNameGlossGreen} |
| Divergences meaning texte ↔ HTML | ${input.counts.pairTextHtmlDivergence} |
| Squelettes HTML divergents | ${input.counts.htmlSkeletonMismatch} |
| Pertes de contenu protégé | ${input.counts.protectedContentFailure} |
| Résidus anglais | ${input.counts.englishResidue} |
| Artefacts de traduction | ${input.counts.translationArtifact} |
| Corrections d'identité hébraïque scellées | ${input.counts.sealedIdentityCorrections} |
| Segments source traduisibles | ${input.counts.sourceTranslatableSegments} |
| Normalisations HTML source | ${input.counts.sourceHtmlNormalizations} |

## Statuts par champ

| Champ | Green | Yellow | Red |
|---|---:|---:|---:|
| gloss | ${input.counts.fieldStatus.gloss.green} | ${input.counts.fieldStatus.gloss.yellow} | ${input.counts.fieldStatus.gloss.red} |
| meaning | ${input.counts.fieldStatus.meaning.green} | ${input.counts.fieldStatus.meaning.yellow} | ${input.counts.fieldStatus.meaning.red} |
| meaningHtml | ${input.counts.fieldStatus.meaningHtml.green} | ${input.counts.fieldStatus.meaningHtml.yellow} | ${input.counts.fieldStatus.meaningHtml.red} |
| couple texte/HTML | ${input.counts.fieldStatus.pair.green} | ${input.counts.fieldStatus.pair.yellow} | ${input.counts.fieldStatus.pair.red} |

## Raisons principales

| Raison | Nombre |
|---|---:|
${topReasons}

## Sources scellées

| Source | SHA-256 |
|---|---|
${Object.entries(input.sourceDigests)
  .map(([source, digest]) => `| ${source} | \`${digest}\` |`)
  .join("\n")}
`;
}

async function hashSources(paths: {
  packets: string;
  packetSummary: string;
  reuseRecords: string;
  reuseSummary: string;
  entityRegistry: string;
  entitySummary: string;
}): Promise<FrenchCandidateAuditSummary["sourceDigests"]> {
  const entries = await Promise.all(
    Object.entries(paths).map(
      async ([key, path]) => [key, await sha256File(path)] as const
    )
  );
  return Object.fromEntries(
    entries
  ) as FrenchCandidateAuditSummary["sourceDigests"];
}

async function verifyWrittenArtifacts(
  paths: { recordsOutput: string; summaryOutput: string; reportOutput: string },
  summary: FrenchCandidateAuditSummary,
  summaryText: string
): Promise<void> {
  const [recordsDigest, reportDigest, summaryDigest] = await Promise.all([
    sha256File(paths.recordsOutput),
    sha256File(paths.reportOutput),
    sha256File(paths.summaryOutput)
  ]);
  if (
    recordsDigest !== summary.artifacts.records.sha256 ||
    reportDigest !== summary.artifacts.report.sha256 ||
    summaryDigest !== sha256(summaryText)
  ) {
    throw new Error("french-candidate-written-artifact-digest-mismatch");
  }
  const written = readJson<FrenchCandidateAuditSummary>(paths.summaryOutput);
  if (frenchCandidateAuditSummaryHash(written) !== written.summaryDigest) {
    throw new Error("french-candidate-written-summary-invalid");
  }
}

function writeTransactionally(
  files: ReadonlyArray<{ path: string; content: string }>
): void {
  const transaction = randomUUID();
  const staged = files.map((file) => ({
    ...file,
    temporary: resolve(
      dirname(file.path),
      `.${basename(file.path)}.${transaction}.tmp`
    ),
    backup: resolve(
      dirname(file.path),
      `.${basename(file.path)}.${transaction}.bak`
    ),
    hadOriginal: existsSync(file.path),
    promoted: false
  }));
  try {
    for (const file of staged) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.temporary, file.content, "utf8");
    }
    for (const file of staged) {
      if (file.hadOriginal) renameSync(file.path, file.backup);
      renameSync(file.temporary, file.path);
      file.promoted = true;
    }
    for (const file of staged) rmSync(file.backup, { force: true });
  } catch (error) {
    for (const file of [...staged].reverse()) {
      rmSync(file.temporary, { force: true });
      if (file.promoted) rmSync(file.path, { force: true });
      if (file.hadOriginal && existsSync(file.backup)) {
        renameSync(file.backup, file.path);
      }
    }
    throw error;
  }
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const records: T[] = [];
  for await (const record of readJsonlStream<T>(path)) records.push(record);
  return records;
}

async function* readJsonlStream<T>(path: string): AsyncGenerator<T> {
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as T;
    } catch {
      throw new Error(`french-candidate-jsonl-invalid:${path}:${lineNumber}`);
    }
  }
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(`french-candidate-json-invalid:${path}`);
  }
}

function uniqueMap<T, K>(
  records: readonly T[],
  key: (record: T) => K,
  label: string
): Map<K, T> {
  const result = new Map<K, T>();
  for (const record of records) {
    const value = key(record);
    if (result.has(value))
      throw new Error(`french-candidate-${label}-duplicate`);
    result.set(value, record);
  }
  return result;
}

function assertDistinctOutputs(...paths: string[]): void {
  if (new Set(paths.map((path) => resolve(path))).size !== paths.length) {
    throw new Error("french-candidate-output-path-collision");
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseFrenchCandidateAuditArgs(
  argv: readonly string[]
): AuditLexiconV3FrenchCandidatesOptions {
  const allowed = new Set([
    "packets",
    "packet-summary",
    "reuse-records",
    "reuse-summary",
    "entity-registry",
    "entity-summary",
    "output-dir",
    "records",
    "summary",
    "report",
    "generated-at",
    "expected-entries"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith("--")) {
      throw new Error(`french-candidate-unknown-argument:${argument}`);
    }
    const key = argument.slice(2);
    if (!allowed.has(key)) {
      throw new Error(`french-candidate-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-candidate-duplicate-option:${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`french-candidate-missing-argument-value:${key}`);
    }
    values.set(key, value);
    index += 1;
  }
  const number = values.get("expected-entries");
  if (
    number !== undefined &&
    (!/^[1-9]\d*$/u.test(number) || !Number.isSafeInteger(Number(number)))
  ) {
    throw new Error("french-candidate-invalid-expected-entries");
  }
  return {
    packets: values.get("packets"),
    packetSummary: values.get("packet-summary"),
    reuseRecords: values.get("reuse-records"),
    reuseSummary: values.get("reuse-summary"),
    entityRegistry: values.get("entity-registry"),
    entitySummary: values.get("entity-summary"),
    outputDirectory: values.get("output-dir"),
    recordsOutput: values.get("records"),
    summaryOutput: values.get("summary"),
    reportOutput: values.get("report"),
    generatedAt: values.get("generated-at"),
    expectedEntries: number === undefined ? undefined : Number(number)
  };
}

async function main(): Promise<void> {
  const options = parseFrenchCandidateAuditArgs(process.argv.slice(2));
  if (
    options.expectedEntries !== undefined &&
    (!Number.isInteger(options.expectedEntries) || options.expectedEntries <= 0)
  ) {
    throw new Error("french-candidate-invalid-expected-entries");
  }
  const result = await runAuditLexiconV3FrenchCandidates(options);
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
