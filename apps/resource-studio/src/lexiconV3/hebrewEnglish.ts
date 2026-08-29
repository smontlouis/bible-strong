import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  buildLexiconEntryKey,
  extractPrimaryDStrong,
  normalizeStepStrongCode
} from "./identity.js";

export const HEBREW_ENGLISH_CANDIDATE_SCHEMA =
  "lexicon-v3-hebrew-english-candidate@5";
export const HEBREW_ENGLISH_SUMMARY_SCHEMA =
  "lexicon-v3-hebrew-english-summary@5";
export const OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT =
  "21c9add13bc727d3a951361778e97e3ff7afd1ce";

export const STEP_BIBLE_ENTITY_SOURCE_DIGESTS = {
  "TIPNR.txt":
    "1a3b7d7df5cfa1e96eefa07dec92900bea278370c6788fadb5d036f3223b637c",
  "tipnr-json/people.json":
    "af26347131e130f5abf060522437f1b03ebf0a9b60338065ce9b4e1e9a8ef4a1",
  "tipnr-json/places.json":
    "a607e1d822bd18eca22a6007092650eda371891cbca3ddd42be9ae93223977ed"
} as const;

export type StepBibleEntitySourceDigestMap = Record<
  keyof typeof STEP_BIBLE_ENTITY_SOURCE_DIGESTS,
  string
>;

export const HEBREW_ENGLISH_ALLOWED_COLUMNS_DIGESTS = {
  lexiconAllowedColumns:
    "6ed72a82748ad680cc8e5a9a80c670160257bf9f154ff1a9463386fac9bfbe0a",
  tipnrAllowedColumns:
    "102e6f88b0014fd7f48d4ed7d8907bdd71be8b44f6a4bada9e8353211aa0028a",
  tipnrEntityRefs:
    "7868b29bb33ecb5cd1543469e3532c23de0415a67a2c461f5891f15ddae3a892"
} as const;

export const OPEN_SCRIPTURES_HEBREW_FILES = {
  "AugIndex.xml": {
    sha256: "e7217ca8ff8ff3f21f9cf1bbe87411adf55f6aa88bcf5ed9ddc886cc6b160c5d"
  },
  "BrownDriverBriggs.xml": {
    sha256: "2b52658a4323d91674cda4090ab8b3ebddfff640f4f18143c28300e80b2c38f8"
  },
  "HebrewStrong.xml": {
    sha256: "a628f4f89f8bdaf2483fd3faf1abc8653cc6717758dfc9f24beb7571d9bdd0c4"
  },
  "LexicalIndex.xml": {
    sha256: "8f7a605c58899d2f44430149c143c00903976e1e91232476677972a69e5bc85f"
  },
  "readme.md": {
    sha256: "9a129c25674387c494571c3828aa3a8eb78459c165e275c313ae26994ce8ff22"
  }
} as const;

/**
 * The exact upstream inputs that are allowed to back the generated Hebrew
 * English artifact in authoring and production releases. The readme is pinned
 * by the fetcher too, but is not an input to the generated lexical content.
 */
export const OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST = {
  revision: OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
  sourceDigests: {
    ...HEBREW_ENGLISH_ALLOWED_COLUMNS_DIGESTS,
    tipnrSourceFiles: STEP_BIBLE_ENTITY_SOURCE_DIGESTS,
    hebrewStrong: OPEN_SCRIPTURES_HEBREW_FILES["HebrewStrong.xml"].sha256,
    augIndex: OPEN_SCRIPTURES_HEBREW_FILES["AugIndex.xml"].sha256,
    lexicalIndex: OPEN_SCRIPTURES_HEBREW_FILES["LexicalIndex.xml"].sha256,
    brownDriverBriggs:
      OPEN_SCRIPTURES_HEBREW_FILES["BrownDriverBriggs.xml"].sha256
  }
} as const;

export type OpenScripturesHebrewFileName =
  keyof typeof OPEN_SCRIPTURES_HEBREW_FILES;

export type HebrewEnglishCandidateStatus =
  | "validated"
  | "review_needed"
  | "source_issue";

export type HebrewEnglishFieldTier =
  | "auto"
  | "candidate_high"
  | "review"
  | "source_issue";

export type HebrewEnglishGlossAssessmentMethod =
  | "tipnr-exact-alias"
  | "open-scriptures-lexical-definition"
  | "open-scriptures-bdb-definition"
  | "hebrew-strong-meaning"
  | "hebrew-strong-usage"
  | "unsupported"
  | "source-issue";

export type HebrewEnglishCandidateMethod =
  | "tipnr-exact-dstrong"
  | "open-scriptures-augmented-exact"
  | "open-scriptures-lexical-exact"
  | "hebrew-strong-exact"
  | "hebrew-strong-substep-anchor"
  | "hebrew-strong-proper-name-fallback"
  | "missing-open-source";

export interface HebrewEnglishSourceAttestation {
  source:
    | "STEP-gloss-anchor"
    | "STEP-relation-graph"
    | "STEPBible-TIPNR"
    | "OpenScriptures-AugIndex"
    | "OpenScriptures-BrownDriverBriggs"
    | "OpenScriptures-HebrewStrong"
    | "OpenScriptures-LexicalIndex";
  recordId: string;
  license: string;
  revision: string;
  contentDigest: string;
}

export interface HebrewEnglishFieldEvidence {
  source: HebrewEnglishSourceAttestation["source"];
  recordId: string;
  contentDigest: string;
  matchKind:
    | "exact-alias"
    | "exact-definition"
    | "exact-bdb-definition"
    | "exact-strong-meaning"
    | "exact-strong-usage"
    | "source-context";
  matchedText: string;
}

export interface HebrewEnglishFieldAssessment {
  status: HebrewEnglishCandidateStatus;
  tier: HebrewEnglishFieldTier;
  method: HebrewEnglishGlossAssessmentMethod | HebrewEnglishCandidateMethod;
  confidence: number;
  issueCodes: string[];
  evidence: HebrewEnglishFieldEvidence[];
}

export interface HebrewEnglishCandidate {
  schema: typeof HEBREW_ENGLISH_CANDIDATE_SCHEMA;
  entryKey: string;
  identity: {
    stepEntryId: number;
    language: "hebrew";
    baseCode: number;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  english: {
    gloss: string;
    meaningHtml: string;
  };
  fieldAssessments: {
    gloss: HebrewEnglishFieldAssessment;
    meaning: HebrewEnglishFieldAssessment;
  };
  status: HebrewEnglishCandidateStatus;
  method: HebrewEnglishCandidateMethod;
  mapping: {
    classicalStrong: string | null;
    relation: string | null;
    /**
     * Compatibility projection for a single linear relation path. It is empty
     * for multi-component relations, whose independent branches are preserved
     * in relationPaths instead of being flattened into a false chain.
     */
    relationPath: string[];
    relationPaths: string[][];
    augmentedStrong: string | null;
    augmentedLexicalIndexId: string | null;
    tipnrEntityIds: number[];
    tipnrEntityReferences: string[];
    lexicalIndexIds: string[];
    bdbIds: string[];
    unresolvedBdbIds: string[];
    /**
     * Source-derived identity facts used by the publication gate. These facts
     * are deliberately more explicit than `method`: the authoring builder
     * authenticates the whole artifact by rebuilding it from the pinned
     * sources, then the publication proof checks the applicable facts again.
     */
    sourceIdentity: HebrewEnglishSourceIdentity;
  };
  issues: string[];
  provenance: HebrewEnglishSourceAttestation[];
  recordDigest: string;
}

export interface HebrewEnglishSourceIdentity {
  primaryDStrong: string;
  tipnr: {
    entityId: number | null;
    entityUnique: boolean;
  } | null;
  augmentedLexical: {
    augmentedStrong: string;
    lexicalIndexId: string;
    mappingUnique: boolean;
    originalFormExact: boolean;
    partOfSpeechExact: boolean;
  } | null;
  classicalLexical: {
    lexicalIndexId: string;
    matchCount: number;
    originalFormExact: boolean;
    partOfSpeechExact: boolean;
  } | null;
  hebrewStrong: {
    strongId: string;
    recordUnique: boolean;
    primaryDStrongExact: boolean;
    originalFormExact: boolean;
    partOfSpeechExact: boolean;
  } | null;
}

export interface HebrewEnglishArtifactSummary {
  schema: typeof HEBREW_ENGLISH_SUMMARY_SCHEMA;
  openScripturesRevision: string;
  sourceDigests: {
    lexiconAllowedColumns: string;
    tipnrAllowedColumns: string;
    tipnrEntityRefs: string;
    tipnrSourceFiles: StepBibleEntitySourceDigestMap;
    hebrewStrong: string | null;
    augIndex: string | null;
    lexicalIndex: string | null;
    brownDriverBriggs: string | null;
  };
  coverage: {
    total: number;
    validated: number;
    reviewNeeded: number;
    sourceIssue: number;
    properNames: number;
    lexemes: number;
    methods: Record<HebrewEnglishCandidateMethod, number>;
    fields: {
      gloss: HebrewEnglishFieldAssessmentCounts;
      meaning: HebrewEnglishFieldAssessmentCounts;
    };
  };
  recordsDigest: string;
  outputDigest: string;
}

export interface HebrewEnglishFieldAssessmentCounts {
  validated: number;
  reviewNeeded: number;
  sourceIssue: number;
  tiers: Record<HebrewEnglishFieldTier, number>;
}

export interface HebrewEnglishArtifact {
  records: HebrewEnglishCandidate[];
  jsonl: string;
  summary: HebrewEnglishArtifactSummary;
}

export function assertPinnedHebrewEnglishArtifactSummary(
  summary: HebrewEnglishArtifactSummary
): void {
  if (
    !summary ||
    summary.schema !== HEBREW_ENGLISH_SUMMARY_SCHEMA ||
    !summary.sourceDigests
  ) {
    throw new Error("hebrew-english-pinning-summary-invalid");
  }
  if (
    summary.openScripturesRevision !==
    OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.revision
  ) {
    throw new Error(
      `hebrew-english-unpinned-revision:expected=${OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.revision}:actual=${summary.openScripturesRevision}`
    );
  }
  for (const [source, expected] of Object.entries(
    OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.sourceDigests
  )) {
    const actual =
      summary.sourceDigests[
        source as keyof typeof OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.sourceDigests
      ];
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      throw new Error(
        `hebrew-english-unpinned-source-digest:${source}:expected=${canonicalJson(expected)}:actual=${canonicalJson(actual)}`
      );
    }
  }
}

export interface BuildHebrewEnglishArtifactOptions {
  lexiconDbPath: string;
  entitiesDbPath: string;
  hebrewStrongPath?: string;
  augIndexPath?: string;
  lexicalIndexPath?: string;
  brownDriverBriggsPath?: string;
  openScripturesRevision?: string;
  /** Explicit test/development escape hatch; production is pinned by default. */
  verifyPinnedSources?: boolean;
}

interface StepHebrewRow {
  stepEntryId: number;
  language: string;
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
}

interface TipnrRow {
  entityId: number;
  dStrong: string;
  entityDisplayName: string;
  nameDisplayName: string;
  brief: string;
  shortDescription: string;
  entityReferences: string[];
}

interface TipnrEntityRefRow {
  entityId: number;
  book: string;
  chapter: number;
  verse: number;
  suffix: string;
  refText: string;
}

interface HebrewStrongRecord {
  id: string;
  word: string;
  wordLanguage: string;
  partOfSpeech: string;
  source: string;
  meaning: string;
  meaningDefinitions: string[];
  usage: string;
  usageTerms: string[];
}

interface LexicalIndexRecord {
  id: string;
  word: string;
  transliteration: string;
  partOfSpeech: string;
  definition: string;
  bdbIds: string[];
  etymologyIds: string[];
}

interface LexicalIndexCatalog {
  byStrong: Map<string, LexicalIndexRecord[]>;
  byId: Map<string, LexicalIndexRecord>;
}

interface BrownDriverBriggsRecord {
  id: string;
  brief: string;
  definitions: string[];
}

interface RelationAssessment {
  kind: "none" | "coherent" | "unverified" | "conflict";
  strict?: boolean;
  paths: string[][];
  stepEvidence: StepRelationEdge[];
  issues?: string[];
  lexicalEvidence?: LexicalIndexRecord[];
  augmentedEvidence?: Array<{
    augmented: string;
    lexicalIndexId: string;
  }>;
  bdbEvidenceIds?: string[];
}

interface RelationPathResult {
  path: string[];
  stepEvidence: StepRelationEdge[];
}

interface StepRelationEdge {
  source: string;
  target: string;
  stepEntryId: number;
  dStrong: string;
  uStrong: string;
}

interface StrictRelationCatalog {
  rows: StepHebrewRow[];
  byBaseCode: Map<number, StepHebrewRow[]>;
  byEStrong: Map<string, StepHebrewRow[]>;
  byPrimaryDStrong: Map<string, StepHebrewRow[]>;
  augIndex: Map<string, string>;
  lexicalIndex: LexicalIndexCatalog;
}

interface StrictRelationTarget {
  row: StepHebrewRow;
  code: string;
  lexicalRecord: LexicalIndexRecord | null;
  augmentedEvidence: {
    augmented: string;
    lexicalIndexId: string;
  } | null;
  technicalMorpheme: boolean;
  stepEvidence: StepRelationEdge;
}

const STEP_ALLOWED_COLUMNS_SQL = `
  SELECT id AS stepEntryId, language, baseCode, eStrong, dStrong, uStrong,
         original, transliteration, morph, gloss
  FROM StepEntries
  WHERE language = 'hebrew'
  ORDER BY baseCode, eStrong, dStrong COLLATE BINARY, uStrong COLLATE BINARY, id
`;

const TIPNR_ALLOWED_COLUMNS_SQL = `
  SELECT n.entityId, n.dStrong,
         e.displayName AS entityDisplayName,
         n.displayName AS nameDisplayName,
         e.brief, e.shortDescription
  FROM EntityNames n
  JOIN Entities e ON e.id = n.entityId
  WHERE n.dStrong LIKE 'H%'
  ORDER BY n.dStrong COLLATE BINARY, n.entityId,
           n.displayName COLLATE BINARY
`;

const TIPNR_ENTITY_REFS_SQL = `
  SELECT entityId, book, chapter, verse, suffix, refText
  FROM EntityRefs
  ORDER BY entityId, book COLLATE BINARY, chapter, verse,
           suffix COLLATE BINARY, refText COLLATE BINARY
`;

/**
 * Build an independent open-source corroboration/enrichment artifact using
 * an explicit allow-list of STEP identity, relation, and gloss columns.
 * StepEntries.meaning deliberately stays outside this companion artifact: the
 * canonical STEP HTML travels through the English evidence audit, while this
 * builder remains an independent witness against which it can be reviewed.
 */
export function buildHebrewEnglishArtifact(
  options: BuildHebrewEnglishArtifactOptions
): HebrewEnglishArtifact {
  requireFile(options.lexiconDbPath, "lexicon-database");
  requireFile(options.entitiesDbPath, "entities-database");
  if (options.hebrewStrongPath) {
    requireFile(options.hebrewStrongPath, "hebrew-strong");
  }
  if (options.augIndexPath) {
    requireFile(options.augIndexPath, "aug-index");
  }
  if (options.lexicalIndexPath) {
    requireFile(options.lexicalIndexPath, "lexical-index");
  }
  if (options.brownDriverBriggsPath) {
    requireFile(options.brownDriverBriggsPath, "brown-driver-briggs");
  }

  const lexicon = new DatabaseSync(options.lexiconDbPath, { readOnly: true });
  const entities = new DatabaseSync(options.entitiesDbPath, { readOnly: true });
  try {
    requireTable(lexicon, "StepEntries");
    requireTable(entities, "Entities");
    requireTable(entities, "EntityNames");
    requireTable(entities, "EntityRefs");
    requireTable(entities, "EntityMeta");

    const stepRows = lexicon
      .prepare(STEP_ALLOWED_COLUMNS_SQL)
      .all() as unknown as StepHebrewRow[];
    const tipnrAllowedRows = entities
      .prepare(TIPNR_ALLOWED_COLUMNS_SQL)
      .all() as unknown as Array<Omit<TipnrRow, "entityReferences">>;
    const tipnrEntityRefRows = entities
      .prepare(TIPNR_ENTITY_REFS_SQL)
      .all() as unknown as TipnrEntityRefRow[];
    const entityReferences = indexTipnrEntityReferences(tipnrEntityRefRows);
    const tipnrRows: TipnrRow[] = tipnrAllowedRows.map((row) => ({
      ...row,
      entityReferences: entityReferences.get(row.entityId) ?? []
    }));
    const tipnrSourceFiles = readEntitySourceDigests(entities);
    const hebrewStrongXml = options.hebrewStrongPath
      ? readFileSync(options.hebrewStrongPath, "utf8")
      : null;
    const augIndexXml = options.augIndexPath
      ? readFileSync(options.augIndexPath, "utf8")
      : null;
    const lexicalIndexXml = options.lexicalIndexPath
      ? readFileSync(options.lexicalIndexPath, "utf8")
      : null;
    const bdbXml = options.brownDriverBriggsPath
      ? readFileSync(options.brownDriverBriggsPath, "utf8")
      : null;
    const revision =
      options.openScripturesRevision ?? OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT;

    const hebrewStrong = hebrewStrongXml
      ? parseHebrewStrongXml(hebrewStrongXml)
      : new Map<string, HebrewStrongRecord>();
    const lexicalIndex = lexicalIndexXml
      ? parseLexicalIndexXml(lexicalIndexXml)
      : emptyLexicalIndexCatalog();
    const augIndex = augIndexXml
      ? parseAugIndexXml(augIndexXml)
      : new Map<string, string>();
    const bdbRecords = bdbXml ? parseBrownDriverBriggsXml(bdbXml) : null;
    const tipnr = indexTipnrRows(tipnrRows);
    const stepRelations = buildStepRelationGraph(stepRows);
    const strictRelations = buildStrictRelationCatalog(
      stepRows,
      augIndex,
      lexicalIndex
    );

    const records = stepRows.map((row) =>
      attestCandidate(
        buildCandidate({
          row,
          tipnr,
          hebrewStrong,
          augIndex,
          lexicalIndex,
          stepRelations,
          strictRelations,
          bdbRecords,
          revision
        })
      )
    );
    const jsonl = serializeHebrewEnglishCandidates(records);
    const methods = emptyMethodCounts();
    for (const record of records) methods[record.method] += 1;

    const summary: HebrewEnglishArtifactSummary = {
      schema: HEBREW_ENGLISH_SUMMARY_SCHEMA,
      openScripturesRevision: revision,
      sourceDigests: {
        // Logical rather than physical SQLite digests are intentional: a
        // change to the STEP meaning column cannot affect this deliberately
        // independent corroboration artifact.
        lexiconAllowedColumns: sha256(canonicalJson(stepRows)),
        tipnrAllowedColumns: sha256(canonicalJson(tipnrAllowedRows)),
        tipnrEntityRefs: sha256(canonicalJson(tipnrEntityRefRows)),
        tipnrSourceFiles,
        hebrewStrong: hebrewStrongXml ? sha256(hebrewStrongXml) : null,
        augIndex: augIndexXml ? sha256(augIndexXml) : null,
        lexicalIndex: lexicalIndexXml ? sha256(lexicalIndexXml) : null,
        brownDriverBriggs: bdbXml ? sha256(bdbXml) : null
      },
      coverage: {
        total: records.length,
        validated: records.filter((record) => record.status === "validated")
          .length,
        reviewNeeded: records.filter(
          (record) => record.status === "review_needed"
        ).length,
        sourceIssue: records.filter(
          (record) => record.status === "source_issue"
        ).length,
        properNames: stepRows.filter(isProperName).length,
        lexemes: stepRows.filter((row) => !isProperName(row)).length,
        methods,
        fields: {
          gloss: fieldAssessmentCounts(
            records.map((record) => record.fieldAssessments.gloss)
          ),
          meaning: fieldAssessmentCounts(
            records.map((record) => record.fieldAssessments.meaning)
          )
        }
      },
      recordsDigest: sha256(
        canonicalJson(records.map((record) => record.recordDigest))
      ),
      outputDigest: sha256(jsonl)
    };
    verifyHebrewEnglishArtifact(jsonl, summary);
    if (options.verifyPinnedSources !== false) {
      assertPinnedHebrewEnglishArtifactSummary(summary);
    }
    return { records, jsonl, summary };
  } finally {
    entities.close();
    lexicon.close();
  }
}

export function serializeHebrewEnglishCandidates(
  records: HebrewEnglishCandidate[]
): string {
  if (records.length === 0) return "";
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function writeHebrewEnglishArtifact(
  artifact: HebrewEnglishArtifact,
  outputPath: string,
  summaryPath: string
): void {
  verifyHebrewEnglishArtifact(artifact.jsonl, artifact.summary);
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(summaryPath), { recursive: true });
  const outputTemp = `${outputPath}.tmp-${process.pid}-${randomUUID()}`;
  const summaryTemp = `${summaryPath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(outputTemp, artifact.jsonl, "utf8");
    writeFileSync(
      summaryTemp,
      `${JSON.stringify(artifact.summary, null, 2)}\n`,
      "utf8"
    );
    if (sha256(readFileSync(outputTemp)) !== artifact.summary.outputDigest) {
      throw new Error("hebrew-english-temporary-output-digest-mismatch");
    }
    renameSync(outputTemp, outputPath);
    // The summary is the commit marker for the pair, so it is renamed last.
    renameSync(summaryTemp, summaryPath);
  } finally {
    rmSync(outputTemp, { force: true });
    rmSync(summaryTemp, { force: true });
  }
}

export function readHebrewEnglishArtifact(
  outputPath: string,
  summaryPath: string
): HebrewEnglishArtifact {
  const jsonl = readFileSync(outputPath, "utf8");
  const summary = JSON.parse(
    readFileSync(summaryPath, "utf8")
  ) as HebrewEnglishArtifactSummary;
  const records = verifyHebrewEnglishArtifact(jsonl, summary);
  return { records, jsonl, summary };
}

/**
 * Rebuild the deterministic artifact from its exact databases and pinned XML
 * inputs. Digest constants alone cannot authenticate a derived JSONL file: a
 * self-consistent forged file can recalculate its own unkeyed hashes. Authoring
 * therefore uses this comparison before importing any Hebrew field state.
 */
export function assertHebrewEnglishArtifactMatchesSources(
  artifact: HebrewEnglishArtifact,
  options: Omit<BuildHebrewEnglishArtifactOptions, "verifyPinnedSources">
): void {
  const rebuilt = buildHebrewEnglishArtifact({
    ...options,
    verifyPinnedSources: true
  });
  if (
    artifact.summary.recordsDigest !== rebuilt.summary.recordsDigest ||
    artifact.summary.outputDigest !== rebuilt.summary.outputDigest ||
    artifact.jsonl !== rebuilt.jsonl
  ) {
    throw new Error("hebrew-english-artifact-source-rebuild-mismatch");
  }
  if (
    canonicalJson(artifact.summary.sourceDigests) !==
    canonicalJson(rebuilt.summary.sourceDigests)
  ) {
    throw new Error("hebrew-english-artifact-source-digests-mismatch");
  }
}

export function verifyHebrewEnglishCandidate(
  candidate: HebrewEnglishCandidate
): HebrewEnglishCandidate {
  if (candidate.schema !== HEBREW_ENGLISH_CANDIDATE_SCHEMA) {
    throw new Error(
      `invalid-hebrew-english-candidate-schema:${candidate.schema}`
    );
  }
  if (!/^[a-f0-9]{64}$/.test(candidate.recordDigest)) {
    throw new Error("invalid-hebrew-english-record-digest");
  }
  verifyHebrewEnglishSourceIdentity(candidate);
  verifyHebrewEnglishFieldAssessments(candidate);
  const payload: Partial<HebrewEnglishCandidate> = { ...candidate };
  delete payload.recordDigest;
  const expected = sha256(canonicalJson(payload));
  if (candidate.recordDigest !== expected) {
    throw new Error(
      `hebrew-english-record-digest-mismatch:${candidate.entryKey}`
    );
  }
  return candidate;
}

function verifyHebrewEnglishSourceIdentity(
  candidate: HebrewEnglishCandidate
): void {
  const sourceIdentity = candidate.mapping?.sourceIdentity;
  const candidatePrimary = extractPrimaryDStrong(candidate.identity.dStrong);
  const normalizedCandidatePrimary = candidatePrimary
    ? normalizeRelationHebrewStrong(candidatePrimary)
    : null;
  const normalizedSourcePrimary = sourceIdentity?.primaryDStrong
    ? normalizeRelationHebrewStrong(sourceIdentity.primaryDStrong)
    : null;
  if (
    !sourceIdentity ||
    !normalizedCandidatePrimary ||
    normalizedSourcePrimary !== normalizedCandidatePrimary
  ) {
    throw new Error(
      `hebrew-english-source-identity-invalid:${candidate.entryKey}`
    );
  }
  const booleanFacts = [
    sourceIdentity.tipnr?.entityUnique,
    sourceIdentity.augmentedLexical?.mappingUnique,
    sourceIdentity.augmentedLexical?.originalFormExact,
    sourceIdentity.augmentedLexical?.partOfSpeechExact,
    sourceIdentity.classicalLexical?.originalFormExact,
    sourceIdentity.classicalLexical?.partOfSpeechExact,
    sourceIdentity.hebrewStrong?.recordUnique,
    sourceIdentity.hebrewStrong?.primaryDStrongExact,
    sourceIdentity.hebrewStrong?.originalFormExact,
    sourceIdentity.hebrewStrong?.partOfSpeechExact
  ].filter((value) => value !== undefined);
  if (booleanFacts.some((value) => typeof value !== "boolean")) {
    throw new Error(
      `hebrew-english-source-identity-fact-invalid:${candidate.entryKey}`
    );
  }
  if (
    sourceIdentity.classicalLexical &&
    (!Number.isSafeInteger(sourceIdentity.classicalLexical.matchCount) ||
      sourceIdentity.classicalLexical.matchCount < 1)
  ) {
    throw new Error(
      `hebrew-english-source-identity-match-count-invalid:${candidate.entryKey}`
    );
  }
}

function verifyHebrewEnglishFieldAssessments(
  candidate: HebrewEnglishCandidate
): void {
  const assessments = candidate.fieldAssessments;
  if (!assessments?.gloss || !assessments.meaning) {
    throw new Error(
      `hebrew-english-field-assessment-missing:${candidate.entryKey}`
    );
  }
  if (
    assessments.meaning.status !== candidate.status ||
    assessments.meaning.method !== candidate.method ||
    canonicalJson(assessments.meaning.issueCodes) !==
      canonicalJson(uniqueSorted(candidate.issues))
  ) {
    throw new Error(
      `hebrew-english-meaning-assessment-mismatch:${candidate.entryKey}`
    );
  }
  for (const [field, value] of Object.entries(assessments) as Array<
    ["gloss" | "meaning", HebrewEnglishFieldAssessment]
  >) {
    if (
      !Number.isFinite(value.confidence) ||
      value.confidence < 0 ||
      value.confidence > 1
    ) {
      throw new Error(
        `hebrew-english-field-confidence-invalid:${candidate.entryKey}:${field}`
      );
    }
    const expectedStatus =
      value.tier === "auto"
        ? "validated"
        : value.tier === "source_issue"
          ? "source_issue"
          : "review_needed";
    if (value.status !== expectedStatus) {
      throw new Error(
        `hebrew-english-field-tier-status-mismatch:${candidate.entryKey}:${field}`
      );
    }
    for (const evidence of value.evidence) {
      const attested = candidate.provenance.some(
        (item) =>
          item.source === evidence.source &&
          item.recordId === evidence.recordId &&
          item.contentDigest === evidence.contentDigest
      );
      if (!attested) {
        throw new Error(
          `hebrew-english-field-evidence-unattested:${candidate.entryKey}:${field}:${evidence.source}:${evidence.recordId}`
        );
      }
    }
  }
  const gloss = assessments.gloss;
  if (!candidate.english.gloss.trim() && gloss.status === "validated") {
    throw new Error(
      `hebrew-english-validated-gloss-empty:${candidate.entryKey}`
    );
  }
  if (gloss.tier === "auto") {
    const allowed = new Set<HebrewEnglishFieldAssessment["method"]>([
      "tipnr-exact-alias",
      "open-scriptures-lexical-definition",
      "open-scriptures-bdb-definition"
    ]);
    if (!allowed.has(gloss.method)) {
      throw new Error(
        `hebrew-english-gloss-auto-method-invalid:${candidate.entryKey}:${gloss.method}`
      );
    }
    if (!gloss.evidence.some((item) => item.source !== "STEP-gloss-anchor")) {
      throw new Error(
        `hebrew-english-gloss-auto-evidence-missing:${candidate.entryKey}`
      );
    }
  }
  if (
    gloss.tier === "candidate_high" &&
    gloss.method !== "hebrew-strong-meaning"
  ) {
    throw new Error(
      `hebrew-english-gloss-candidate-high-method-invalid:${candidate.entryKey}`
    );
  }
}

function fieldAssessmentCounts(
  assessments: HebrewEnglishFieldAssessment[]
): HebrewEnglishFieldAssessmentCounts {
  const tiers: Record<HebrewEnglishFieldTier, number> = {
    auto: 0,
    candidate_high: 0,
    review: 0,
    source_issue: 0
  };
  for (const value of assessments) tiers[value.tier] += 1;
  return {
    validated: assessments.filter((value) => value.status === "validated")
      .length,
    reviewNeeded: assessments.filter(
      (value) => value.status === "review_needed"
    ).length,
    sourceIssue: assessments.filter((value) => value.status === "source_issue")
      .length,
    tiers
  };
}

export function parseHebrewEnglishCandidateLine(
  line: string
): HebrewEnglishCandidate {
  const value = JSON.parse(line) as HebrewEnglishCandidate;
  return verifyHebrewEnglishCandidate(value);
}

export function verifyHebrewEnglishArtifact(
  jsonl: string,
  summary: HebrewEnglishArtifactSummary
): HebrewEnglishCandidate[] {
  if (summary.schema !== HEBREW_ENGLISH_SUMMARY_SCHEMA) {
    throw new Error(`invalid-hebrew-english-summary-schema:${summary.schema}`);
  }
  const records = jsonl
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseHebrewEnglishCandidateLine);
  if (records.length !== summary.coverage.total) {
    throw new Error("hebrew-english-summary-record-count-mismatch");
  }
  const recordsDigest = sha256(
    canonicalJson(records.map((record) => record.recordDigest))
  );
  if (recordsDigest !== summary.recordsDigest) {
    throw new Error("hebrew-english-summary-records-digest-mismatch");
  }
  if (sha256(jsonl) !== summary.outputDigest) {
    throw new Error("hebrew-english-summary-output-digest-mismatch");
  }
  const statusCounts = {
    validated: records.filter((record) => record.status === "validated").length,
    reviewNeeded: records.filter((record) => record.status === "review_needed")
      .length,
    sourceIssue: records.filter((record) => record.status === "source_issue")
      .length
  };
  if (
    statusCounts.validated !== summary.coverage.validated ||
    statusCounts.reviewNeeded !== summary.coverage.reviewNeeded ||
    statusCounts.sourceIssue !== summary.coverage.sourceIssue
  ) {
    throw new Error("hebrew-english-summary-status-count-mismatch");
  }
  const methods = emptyMethodCounts();
  for (const record of records) {
    if (!(record.method in methods)) {
      throw new Error(`invalid-hebrew-english-method:${record.method}`);
    }
    methods[record.method] += 1;
  }
  if (canonicalJson(methods) !== canonicalJson(summary.coverage.methods)) {
    throw new Error("hebrew-english-summary-method-count-mismatch");
  }
  const properNames = records.filter((record) =>
    record.identity.morph.trim().startsWith("N:")
  ).length;
  if (
    properNames !== summary.coverage.properNames ||
    records.length - properNames !== summary.coverage.lexemes
  ) {
    throw new Error("hebrew-english-summary-kind-count-mismatch");
  }
  const fieldCounts = {
    gloss: fieldAssessmentCounts(
      records.map((record) => record.fieldAssessments.gloss)
    ),
    meaning: fieldAssessmentCounts(
      records.map((record) => record.fieldAssessments.meaning)
    )
  };
  if (canonicalJson(fieldCounts) !== canonicalJson(summary.coverage.fields)) {
    throw new Error("hebrew-english-summary-field-count-mismatch");
  }
  return records;
}

export function assertOpenScripturesSourceDigest(
  fileName: OpenScripturesHebrewFileName,
  content: string | Uint8Array
): void {
  const expected = OPEN_SCRIPTURES_HEBREW_FILES[fileName].sha256;
  const actual = sha256(content);
  if (actual !== expected) {
    throw new Error(
      `open-scriptures-source-digest-mismatch:${fileName}:expected=${expected}:actual=${actual}`
    );
  }
}

export function verifyPinnedOpenScripturesSourceFile(
  fileName: OpenScripturesHebrewFileName,
  path: string
): void {
  requireFile(path, fileName);
  assertOpenScripturesSourceDigest(fileName, readFileSync(path));
}

function buildCandidate(input: {
  row: StepHebrewRow;
  tipnr: Map<string, TipnrRow[]>;
  hebrewStrong: Map<string, HebrewStrongRecord>;
  augIndex: Map<string, string>;
  lexicalIndex: LexicalIndexCatalog;
  stepRelations: Map<string, StepRelationEdge[]>;
  strictRelations: StrictRelationCatalog;
  bdbRecords: Map<string, BrownDriverBriggsRecord> | null;
  revision: string;
}): Omit<HebrewEnglishCandidate, "recordDigest"> {
  const { row } = input;
  if (row.language !== "hebrew") {
    throw new Error(
      `non-hebrew-row-in-hebrew-candidate-builder:${row.language}`
    );
  }
  const primaryDStrong = extractPrimaryDStrong(row.dStrong);
  if (!primaryDStrong) {
    throw new Error(`missing-primary-dstrong:${row.dStrong}`);
  }
  const entryKey = buildLexiconEntryKey("hebrew", row.dStrong);
  const base: Pick<HebrewEnglishCandidate, "schema" | "entryKey" | "identity"> =
    {
      schema: HEBREW_ENGLISH_CANDIDATE_SCHEMA,
      entryKey,
      identity: {
        stepEntryId: row.stepEntryId,
        language: "hebrew" as const,
        baseCode: row.baseCode,
        eStrong: row.eStrong,
        dStrong: row.dStrong,
        uStrong: row.uStrong,
        original: row.original,
        transliteration: row.transliteration,
        morph: row.morph
      }
    };

  const exactTipnrRows = input.tipnr.get(primaryDStrong) ?? [];
  if (exactTipnrRows.length > 0) {
    return {
      ...base,
      ...buildTipnrCandidate(row, exactTipnrRows)
    };
  }

  if (isProperName(row)) {
    const fallback = buildHebrewStrongCandidate(input, primaryDStrong);
    const status =
      fallback.status === "source_issue" ? "source_issue" : "review_needed";
    const method =
      fallback.method === "missing-open-source"
        ? "missing-open-source"
        : "hebrew-strong-proper-name-fallback";
    const issues = uniqueSorted([
      "tipnr-exact-dstrong-missing",
      ...fallback.issues
    ]);
    const glossAssessment = assessment({
      status:
        fallback.fieldAssessments.gloss.status === "source_issue"
          ? "source_issue"
          : "review_needed",
      tier:
        fallback.fieldAssessments.gloss.status === "source_issue"
          ? "source_issue"
          : "review",
      method:
        fallback.fieldAssessments.gloss.status === "source_issue"
          ? "source-issue"
          : "unsupported",
      confidence:
        fallback.fieldAssessments.gloss.status === "source_issue" ? 0.2 : 0.72,
      issueCodes: uniqueSorted([
        "tipnr-exact-dstrong-missing",
        ...fallback.fieldAssessments.gloss.issueCodes
      ]),
      evidence: fallback.fieldAssessments.gloss.evidence
    });
    return {
      ...base,
      ...fallback,
      method,
      status,
      issues,
      fieldAssessments: {
        gloss: glossAssessment,
        meaning: meaningAssessment(status, method, issues, fallback.provenance)
      }
    };
  }

  return {
    ...base,
    ...buildHebrewStrongCandidate(input, primaryDStrong)
  };
}

function buildTipnrCandidate(
  row: StepHebrewRow,
  rows: TipnrRow[]
): Pick<
  HebrewEnglishCandidate,
  | "english"
  | "fieldAssessments"
  | "status"
  | "method"
  | "mapping"
  | "issues"
  | "provenance"
> {
  const byEntity = new Map<number, TipnrRow>();
  for (const item of rows) {
    if (!byEntity.has(item.entityId)) byEntity.set(item.entityId, item);
  }
  const allEntities = [...byEntity.values()].sort(
    (left, right) => left.entityId - right.entityId
  );
  const entities = disambiguateExactTipnrEntities(row.gloss, allEntities);
  const descriptions = entities
    .map(
      (entity) => cleanText(entity.shortDescription) || cleanText(entity.brief)
    )
    .filter(Boolean);
  const gloss =
    cleanText(row.gloss) ||
    cleanText(entities[0]?.nameDisplayName ?? "") ||
    cleanText(entities[0]?.entityDisplayName ?? "");
  const properName = isProperName(row);
  const issues: string[] = [];
  if (entities.length > 1) issues.push("tipnr-exact-dstrong-ambiguous");
  if (descriptions.length === 0) issues.push("tipnr-description-missing");
  if (!gloss) issues.push("english-gloss-missing");
  if (!properName) {
    issues.push("tipnr-non-proper-entity-link-not-lexical-definition");
  }

  let status: HebrewEnglishCandidateStatus = properName
    ? "validated"
    : "review_needed";
  if (entities.length > 1 || descriptions.length === 0) {
    status = "source_issue";
  } else if (issues.length > 0) {
    status = "review_needed";
  }

  const meaningHtml =
    status === "source_issue"
      ? ""
      : properName
        ? descriptions
            .map((description) => `<p>${escapeHtml(description)}</p>`)
            .join("")
        : nonProperTipnrMeaningHtml(row, entities);
  const provenance = [
    glossAttestation(row),
    ...entities.map((entity) => ({
      source: "STEPBible-TIPNR" as const,
      recordId: `${extractPrimaryDStrong(row.dStrong)}:entity:${entity.entityId}`,
      license: "CC-BY-4.0",
      revision: "local-production-sqlite",
      contentDigest: sha256(
        canonicalJson({
          brief: entity.brief,
          dStrong: entity.dStrong,
          entityId: entity.entityId,
          entityDisplayName: entity.entityDisplayName,
          nameDisplayName: entity.nameDisplayName,
          shortDescription: entity.shortDescription,
          entityReferences: entity.entityReferences
        })
      )
    }))
  ].sort(compareAttestations);
  const method = "tipnr-exact-dstrong" as const;
  return {
    english: { gloss, meaningHtml },
    fieldAssessments: {
      gloss: assessTipnrGloss(row, entities, provenance),
      meaning: meaningAssessment(status, method, issues, provenance)
    },
    status,
    method,
    mapping: {
      classicalStrong: classicalStrong(row),
      relation: relationText(row.dStrong),
      relationPath: [],
      relationPaths: [],
      augmentedStrong: augmentedStrong(row),
      augmentedLexicalIndexId: null,
      tipnrEntityIds: entities.map((entity) => entity.entityId),
      tipnrEntityReferences: uniqueSorted(
        entities.flatMap((entity) => entity.entityReferences)
      ),
      lexicalIndexIds: [],
      bdbIds: [],
      unresolvedBdbIds: [],
      sourceIdentity: {
        primaryDStrong: extractPrimaryDStrong(row.dStrong) ?? "",
        tipnr: {
          entityId: entities.length === 1 ? entities[0]!.entityId : null,
          entityUnique: entities.length === 1
        },
        augmentedLexical: null,
        classicalLexical: null,
        hebrewStrong: null
      }
    },
    issues: uniqueSorted(issues),
    provenance
  };
}

/**
 * TIPNR can exceptionally attach several entities to the same exact dStrong.
 * An exact STEP gloss-to-EntityName alias match may select one entity, but an
 * absent or non-unique match must remain ambiguous. No fuzzy matching is used.
 */
export function disambiguateExactTipnrEntities<
  T extends {
    nameDisplayName: string;
  }
>(gloss: string, entities: T[]): T[] {
  if (entities.length < 2) return entities;
  const normalizedGloss = normalizeExactEnglishText(gloss);
  if (!normalizedGloss) return entities;
  const exactMatches = entities.filter((entity) =>
    tipnrAliases(entity).some(
      (alias) => normalizeExactEnglishText(alias) === normalizedGloss
    )
  );
  return exactMatches.length === 1 ? exactMatches : entities;
}

function nonProperTipnrMeaningHtml(
  row: StepHebrewRow,
  entities: TipnrRow[]
): string {
  const names = uniqueSorted(
    entities.map((entity) => cleanText(entity.nameDisplayName)).filter(Boolean)
  );
  const relation = relationText(row.dStrong);
  const details = [
    cleanText(row.gloss)
      ? `The disambiguated STEP sense is “${cleanText(row.gloss)}”.`
      : "",
    names.length > 0
      ? `TIPNR identifies this exact form as ${names.join("; ")}.`
      : "",
    relation && relation !== "=" ? `STEP relation: ${relation}.` : ""
  ].filter(Boolean);
  return `<p>${escapeHtml(details.join(" "))}</p>`;
}

function buildHebrewStrongCandidate(
  input: {
    row: StepHebrewRow;
    hebrewStrong: Map<string, HebrewStrongRecord>;
    augIndex: Map<string, string>;
    lexicalIndex: LexicalIndexCatalog;
    stepRelations: Map<string, StepRelationEdge[]>;
    strictRelations: StrictRelationCatalog;
    bdbRecords: Map<string, BrownDriverBriggsRecord> | null;
    revision: string;
  },
  primaryDStrong: string
): Pick<
  HebrewEnglishCandidate,
  | "english"
  | "fieldAssessments"
  | "status"
  | "method"
  | "mapping"
  | "issues"
  | "provenance"
> {
  const { row } = input;
  const classical = classicalStrong(row);
  const strongRecord = classical
    ? input.hebrewStrong.get(classical)
    : undefined;
  const normalizedClassical = classical
    ? normalizeStepStrongCode(classical)
    : null;
  const augmented = augmentedStrong(row);
  const augmentedKey = augmented ? augmented.slice(1) : null;
  const augmentedLexicalIndexId = augmentedKey
    ? (input.augIndex.get(augmentedKey) ?? null)
    : null;
  const augmentedRecord = augmentedLexicalIndexId
    ? input.lexicalIndex.byId.get(augmentedLexicalIndexId)
    : undefined;
  const exactAugmented = Boolean(augmented && augmentedRecord);
  const classicalLexicalRecords = classical
    ? (input.lexicalIndex.byStrong.get(classical) ?? [])
    : [];
  const exactClassicalMatches = classicalLexicalRecords.filter(
    (record) =>
      sameHebrewForm(row.original, record.word) &&
      compatiblePartOfSpeech(row.morph, record.partOfSpeech)
  );
  const exactClassicalRecord =
    primaryDStrong === normalizedClassical && exactClassicalMatches.length === 1
      ? exactClassicalMatches[0]
      : undefined;
  const selectedLexicalRecord = augmentedRecord ?? exactClassicalRecord;
  const exactClassical = Boolean(exactClassicalRecord && !augmentedRecord);
  const lexicalRecords = selectedLexicalRecord
    ? [selectedLexicalRecord]
    : classicalLexicalRecords;
  const lexicalIndexIds = uniqueSorted(
    lexicalRecords.map((record) => record.id)
  );
  const bdbIds = uniqueSorted(
    lexicalRecords.flatMap((record) => record.bdbIds)
  );
  const selectedBdbRecords = selectedLexicalRecord
    ? selectedLexicalRecord.bdbIds
        .map((id) => input.bdbRecords?.get(id))
        .filter((record): record is BrownDriverBriggsRecord => Boolean(record))
    : [];
  const unresolvedBdbIds = input.bdbRecords
    ? bdbIds.filter((id) => !input.bdbRecords?.has(id))
    : bdbIds;
  const relation = relationText(row.dStrong);
  const technicalMorpheme = isTechnicalMorphemeRow(
    row,
    normalizedPrimaryDStrong(row) ?? ""
  );
  const directIdentity =
    relation === "=" &&
    extractPrimaryDStrong(row.uStrong) === primaryDStrong &&
    (primaryDStrong === normalizedClassical || exactAugmented);
  const relationAssessment = assessStepRelation(
    row,
    classical,
    input.hebrewStrong,
    input.stepRelations,
    input.strictRelations,
    selectedLexicalRecord,
    Boolean(
      augmentedRecord &&
      (input.strictRelations.byEStrong.get(row.eStrong)?.length ?? 0) === 1 &&
      sameHebrewForm(row.original, augmentedRecord.word) &&
      compatiblePartOfSpeech(row.morph, augmentedRecord.partOfSpeech)
    )
  );
  const genericSubstep =
    !technicalMorpheme &&
    primaryDStrong !== normalizedClassical &&
    !exactAugmented;
  const method: HebrewEnglishCandidateMethod = exactAugmented
    ? "open-scriptures-augmented-exact"
    : exactClassical
      ? "open-scriptures-lexical-exact"
      : strongRecord
        ? primaryDStrong === normalizedClassical
          ? "hebrew-strong-exact"
          : "hebrew-strong-substep-anchor"
        : "missing-open-source";
  const issues: string[] = [];
  const gloss = cleanText(row.gloss);
  if (!gloss) issues.push("english-gloss-missing");
  if (technicalMorpheme) {
    issues.push("technical-morpheme-no-lexical-content");
  }
  if (!strongRecord && !selectedLexicalRecord) {
    issues.push("hebrew-strong-record-missing");
  }
  if (augmented && !augmentedLexicalIndexId) {
    issues.push("aug-index-mapping-missing");
  }
  if (augmentedLexicalIndexId && !augmentedRecord) {
    issues.push("aug-index-lexical-record-missing");
  }
  if (selectedLexicalRecord) {
    if (!input.bdbRecords) {
      issues.push("bdb-source-unavailable");
    }
    if (selectedLexicalRecord.bdbIds.length === 0) {
      issues.push("exact-lexical-bdb-reference-missing");
    }
    if (selectedLexicalRecord.bdbIds.length > 1) {
      issues.push("exact-lexical-multiple-bdb-references");
    }
    if (!selectedLexicalRecord.definition && selectedBdbRecords.length === 0) {
      issues.push("exact-lexical-definition-missing");
    }
  }
  if (augmentedRecord) {
    if (!augmentedRecord.definition) {
      issues.push("aug-index-definition-missing");
    }
    if (!sameHebrewForm(row.original, augmentedRecord.word)) {
      issues.push("aug-index-original-mismatch");
    }
    if (!compatiblePartOfSpeech(row.morph, augmentedRecord.partOfSpeech)) {
      issues.push("aug-index-pos-mismatch");
    }
  }
  if (genericSubstep) {
    issues.push("step-subsense-specificity-review-required");
  }
  issues.push(...(relationAssessment.issues ?? []));
  if (relationAssessment.kind === "unverified") {
    issues.push("step-open-source-relation-unverified");
  } else if (relationAssessment.kind === "conflict") {
    issues.push("step-open-source-relation-conflict");
  } else if (
    relationAssessment.kind === "none" &&
    !directIdentity &&
    !genericSubstep &&
    !technicalMorpheme
  ) {
    issues.push("step-relation-or-subsense-review-required");
  }
  if (!selectedLexicalRecord && exactClassicalMatches.length > 1) {
    issues.push("lexical-index-exact-match-ambiguous");
  }
  if (!selectedLexicalRecord && lexicalRecords.length > 1) {
    issues.push("lexical-index-multiple-matches");
  }
  if (unresolvedBdbIds.length > 0) {
    issues.push("lexical-index-bdb-reference-missing");
  }
  if (strongRecord && !selectedLexicalRecord) {
    if (strongEntityTypeConflicts(row, strongRecord)) {
      issues.push("strong-proper-name-common-lexeme-mismatch");
    }
    if (!strongRecord.source) issues.push("hebrew-strong-source-missing");
    if (!strongRecord.meaning) issues.push("hebrew-strong-meaning-missing");
    if (!strongRecord.usage) issues.push("hebrew-strong-usage-missing");
  }

  const hasDefinition = Boolean(
    selectedLexicalRecord?.definition ||
    selectedBdbRecords.some((record) => record.brief) ||
    strongRecord?.meaning ||
    strongRecord?.usage
  );
  let status: HebrewEnglishCandidateStatus = "validated";
  if (
    technicalMorpheme ||
    !hasDefinition ||
    relationAssessment.kind === "conflict" ||
    issues.includes("strong-proper-name-common-lexeme-mismatch")
  ) {
    status = "source_issue";
  } else if (issues.length > 0) status = "review_needed";

  const meaningHtml = selectedLexicalRecord
    ? lexicalMeaningHtml(
        row,
        selectedLexicalRecord,
        selectedBdbRecords,
        strongRecord,
        relationAssessment.paths
      )
    : strongRecord
      ? strongMeaningHtml(gloss, strongRecord, row, relationAssessment.paths)
      : "";
  const provenance: HebrewEnglishSourceAttestation[] = [glossAttestation(row)];
  const strongProvenanceIds = uniqueSorted(
    [strongRecord?.id ?? "", ...relationAssessment.paths.flat()].filter(Boolean)
  );
  for (const strongId of strongProvenanceIds) {
    const relationRecord = input.hebrewStrong.get(strongId);
    if (!relationRecord) continue;
    provenance.push({
      source: "OpenScriptures-HebrewStrong",
      recordId: relationRecord.id,
      license: "CC-BY-4.0; Strong dictionary text is public domain",
      revision: input.revision,
      contentDigest: sha256(canonicalJson(relationRecord))
    });
  }
  const augmentedEvidence = uniqueAugmentedEvidence([
    ...(augmented && augmentedLexicalIndexId
      ? [{ augmented, lexicalIndexId: augmentedLexicalIndexId }]
      : []),
    ...(relationAssessment.augmentedEvidence ?? [])
  ]);
  for (const evidence of augmentedEvidence) {
    provenance.push({
      source: "OpenScriptures-AugIndex",
      recordId: evidence.augmented,
      license: "CC-BY-4.0",
      revision: input.revision,
      contentDigest: sha256(canonicalJson(evidence))
    });
  }
  for (const evidence of relationAssessment.stepEvidence) {
    provenance.push({
      source: "STEP-relation-graph",
      recordId: String(evidence.stepEntryId),
      license: "CC-BY-4.0",
      revision: "local-production-sqlite",
      contentDigest: sha256(canonicalJson(evidence))
    });
  }
  for (const record of uniqueLexicalRecords([
    ...lexicalRecords,
    ...(relationAssessment.lexicalEvidence ?? [])
  ])) {
    provenance.push({
      source: "OpenScriptures-LexicalIndex",
      recordId: record.id,
      license: "CC-BY-4.0",
      revision: input.revision,
      contentDigest: sha256(canonicalJson(record))
    });
  }
  const relationBdbRecords = (relationAssessment.bdbEvidenceIds ?? [])
    .map((id) => input.bdbRecords?.get(id))
    .filter((record): record is BrownDriverBriggsRecord => Boolean(record));
  const bdbProvenanceById = new Map(
    [...selectedBdbRecords, ...relationBdbRecords].map((record) => [
      record.id,
      record
    ])
  );
  for (const record of [...bdbProvenanceById.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    provenance.push({
      source: "OpenScriptures-BrownDriverBriggs",
      recordId: record.id,
      license: "Public domain; OpenScriptures compilation CC-BY-4.0",
      revision: input.revision,
      contentDigest: sha256(canonicalJson(record))
    });
  }
  const sortedProvenance = provenance.sort(compareAttestations);
  const sortedIssues = uniqueSorted(issues);
  const normalizedPrimary = normalizedPrimaryDStrong(row) ?? primaryDStrong;
  return {
    english: { gloss, meaningHtml },
    fieldAssessments: {
      gloss: assessOpenGloss({
        row,
        primaryDStrong,
        normalizedClassical,
        exactClassicalRecord,
        augmentedRecord,
        selectedLexicalRecord,
        selectedBdbRecords,
        strongRecord,
        directIdentity,
        relationAssessment,
        technicalMorpheme,
        provenance: sortedProvenance,
        issues: sortedIssues
      }),
      meaning: meaningAssessment(status, method, sortedIssues, sortedProvenance)
    },
    status,
    method,
    mapping: {
      classicalStrong: classical,
      relation,
      relationPath:
        relationAssessment.paths.length === 1
          ? (relationAssessment.paths[0] ?? [])
          : [],
      relationPaths: relationAssessment.paths,
      augmentedStrong: augmented,
      augmentedLexicalIndexId,
      tipnrEntityIds: [],
      tipnrEntityReferences: [],
      lexicalIndexIds,
      bdbIds,
      unresolvedBdbIds,
      sourceIdentity: {
        primaryDStrong: normalizedPrimary,
        tipnr: null,
        augmentedLexical:
          augmented && augmentedLexicalIndexId && augmentedRecord
            ? {
                augmentedStrong: augmented,
                lexicalIndexId: augmentedLexicalIndexId,
                mappingUnique: true,
                originalFormExact: sameHebrewForm(
                  row.original,
                  augmentedRecord.word
                ),
                partOfSpeechExact: compatiblePartOfSpeech(
                  row.morph,
                  augmentedRecord.partOfSpeech
                )
              }
            : null,
        classicalLexical: exactClassicalRecord
          ? {
              lexicalIndexId: exactClassicalRecord.id,
              matchCount: exactClassicalMatches.length,
              originalFormExact: sameHebrewForm(
                row.original,
                exactClassicalRecord.word
              ),
              partOfSpeechExact: compatiblePartOfSpeech(
                row.morph,
                exactClassicalRecord.partOfSpeech
              )
            }
          : null,
        hebrewStrong:
          strongRecord && classical
            ? {
                strongId: strongRecord.id,
                recordUnique: true,
                primaryDStrongExact: normalizedPrimary === classical,
                originalFormExact: sameHebrewForm(
                  row.original,
                  strongRecord.word
                ),
                partOfSpeechExact: compatibleStrongPartOfSpeech(
                  row.morph,
                  strongRecord.partOfSpeech
                )
              }
            : null
      }
    },
    issues: sortedIssues,
    provenance: sortedProvenance
  };
}

function attestCandidate(
  candidate: Omit<HebrewEnglishCandidate, "recordDigest">
): HebrewEnglishCandidate {
  return {
    ...candidate,
    recordDigest: sha256(canonicalJson(candidate))
  };
}

function glossAttestation(row: StepHebrewRow): HebrewEnglishSourceAttestation {
  return {
    source: "STEP-gloss-anchor",
    recordId: String(row.stepEntryId),
    license: "CC-BY-4.0",
    revision: "local-production-sqlite",
    contentDigest: sha256(canonicalJson({ gloss: row.gloss, morph: row.morph }))
  };
}

function assessment(
  value: HebrewEnglishFieldAssessment
): HebrewEnglishFieldAssessment {
  return {
    ...value,
    issueCodes: uniqueSorted(value.issueCodes),
    evidence: [...value.evidence].sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.recordId.localeCompare(right.recordId) ||
        left.matchKind.localeCompare(right.matchKind) ||
        left.matchedText.localeCompare(right.matchedText)
    )
  };
}

function meaningAssessment(
  status: HebrewEnglishCandidateStatus,
  method: HebrewEnglishCandidateMethod,
  issues: string[],
  provenance: HebrewEnglishSourceAttestation[]
): HebrewEnglishFieldAssessment {
  const tier: HebrewEnglishFieldTier =
    status === "validated"
      ? "auto"
      : status === "source_issue"
        ? "source_issue"
        : "review";
  const confidence =
    status === "validated"
      ? [
          "tipnr-exact-dstrong",
          "open-scriptures-augmented-exact",
          "open-scriptures-lexical-exact"
        ].includes(method)
        ? 0.98
        : 0.94
      : status === "review_needed"
        ? 0.76
        : 0.2;
  return assessment({
    status,
    tier,
    method,
    confidence,
    issueCodes: issues,
    evidence: provenance
      .filter((item) => item.source !== "STEP-gloss-anchor")
      .map((item) => fieldEvidence(item, "source-context", item.recordId))
  });
}

function assessTipnrGloss(
  row: StepHebrewRow,
  entities: TipnrRow[],
  provenance: HebrewEnglishSourceAttestation[]
): HebrewEnglishFieldAssessment {
  const gloss = cleanText(row.gloss);
  if (!gloss) {
    return sourceIssueGloss("english-gloss-missing");
  }
  if (entities.length !== 1) {
    return sourceIssueGloss("tipnr-gloss-entity-ambiguous");
  }
  const entity = entities[0]!;
  const normalizedGloss = normalizeExactEnglishText(gloss);
  const matchedAlias = tipnrAliases(entity).find(
    (alias) => normalizeExactEnglishText(alias) === normalizedGloss
  );
  if (!normalizedGloss || !matchedAlias) {
    return reviewGloss(
      isProperName(row)
        ? "tipnr-gloss-alias-mismatch"
        : "tipnr-gloss-non-proper-link-not-lexical-definition"
    );
  }
  const attestation = provenance.find(
    (item) =>
      item.source === "STEPBible-TIPNR" &&
      item.recordId.endsWith(`:entity:${entity.entityId}`)
  );
  if (!attestation) {
    throw new Error(`tipnr-gloss-attestation-missing:${row.dStrong}`);
  }
  if (!isProperName(row)) {
    return assessment({
      status: "review_needed",
      tier: "review",
      method: "tipnr-exact-alias",
      confidence: 0.88,
      issueCodes: ["tipnr-gloss-non-proper-link-not-lexical-definition"],
      evidence: [fieldEvidence(attestation, "exact-alias", matchedAlias)]
    });
  }
  return assessment({
    status: "validated",
    tier: "auto",
    method: "tipnr-exact-alias",
    confidence: 0.98,
    issueCodes: [],
    evidence: [fieldEvidence(attestation, "exact-alias", matchedAlias)]
  });
}

function assessOpenGloss(input: {
  row: StepHebrewRow;
  primaryDStrong: string;
  normalizedClassical: string | null;
  exactClassicalRecord: LexicalIndexRecord | undefined;
  augmentedRecord: LexicalIndexRecord | undefined;
  selectedLexicalRecord: LexicalIndexRecord | undefined;
  selectedBdbRecords: BrownDriverBriggsRecord[];
  strongRecord: HebrewStrongRecord | undefined;
  directIdentity: boolean;
  relationAssessment: RelationAssessment;
  technicalMorpheme: boolean;
  provenance: HebrewEnglishSourceAttestation[];
  issues: string[];
}): HebrewEnglishFieldAssessment {
  const gloss = cleanText(input.row.gloss);
  if (!gloss) return sourceIssueGloss("english-gloss-missing");
  if (input.technicalMorpheme) {
    return sourceIssueGloss("technical-morpheme-no-lexical-content");
  }

  const fatalMappingIssue = [
    "aug-index-mapping-missing",
    "aug-index-lexical-record-missing",
    "aug-index-original-mismatch",
    "aug-index-pos-mismatch",
    "lexical-index-exact-match-ambiguous"
  ].find((code) => input.issues.includes(code));
  if (fatalMappingIssue) return sourceIssueGloss(fatalMappingIssue);

  const selected = input.selectedLexicalRecord;
  const classicalExact = Boolean(
    input.exactClassicalRecord && selected === input.exactClassicalRecord
  );
  const augmentedExact = Boolean(
    input.augmentedRecord &&
    selected === input.augmentedRecord &&
    sameHebrewForm(input.row.original, input.augmentedRecord.word) &&
    compatiblePartOfSpeech(
      input.row.morph,
      input.augmentedRecord.partOfSpeech
    ) &&
    (input.directIdentity || input.relationAssessment.strict === true)
  );
  if (selected && (classicalExact || augmentedExact)) {
    const lexicalTokens = new Set(
      normalizedEnglishContentTokens(selected.definition)
    );
    const bdbTokens = new Set(
      input.selectedBdbRecords.flatMap((record) =>
        record.definitions.flatMap(normalizedEnglishContentTokens)
      )
    );
    const allTokens = new Set([...lexicalTokens, ...bdbTokens]);
    const glossTokens = normalizedEnglishContentTokens(gloss);
    if (
      glossTokens.length > 0 &&
      glossTokens.every((token) => allTokens.has(token))
    ) {
      const lexicalCovers = glossTokens.every((token) =>
        lexicalTokens.has(token)
      );
      const lexicalAttestation = requiredAttestation(
        input.provenance,
        "OpenScriptures-LexicalIndex",
        selected.id
      );
      if (lexicalCovers) {
        return assessment({
          status: "validated",
          tier: "auto",
          method: "open-scriptures-lexical-definition",
          confidence: 0.98,
          issueCodes: [],
          evidence: [
            fieldEvidence(
              lexicalAttestation,
              "exact-definition",
              selected.definition
            )
          ]
        });
      }
      const matchingBdb = input.selectedBdbRecords.filter((record) =>
        record.definitions.some((definition) =>
          normalizedEnglishContentTokens(definition).some((token) =>
            glossTokens.includes(token)
          )
        )
      );
      return assessment({
        status: "validated",
        tier: "auto",
        method: "open-scriptures-bdb-definition",
        confidence: 0.98,
        issueCodes: [],
        evidence: [
          fieldEvidence(lexicalAttestation, "source-context", selected.id),
          ...matchingBdb.map((record) =>
            fieldEvidence(
              requiredAttestation(
                input.provenance,
                "OpenScriptures-BrownDriverBriggs",
                record.id
              ),
              "exact-bdb-definition",
              record.definitions.join("; ")
            )
          )
        ]
      });
    }
  }

  const exactClassicalIdentity =
    input.normalizedClassical === input.primaryDStrong &&
    input.strongRecord &&
    sameHebrewForm(input.row.original, input.strongRecord.word) &&
    compatibleStrongPartOfSpeech(
      input.row.morph,
      input.strongRecord.partOfSpeech
    );
  if (exactClassicalIdentity && input.strongRecord) {
    const glossTokens = normalizedEnglishContentTokens(gloss);
    const meaningTokens = new Set(
      input.strongRecord.meaningDefinitions.flatMap(
        normalizedEnglishContentTokens
      )
    );
    const usageTokens = new Set(
      input.strongRecord.usageTerms.flatMap(normalizedEnglishContentTokens)
    );
    const strongAttestation = requiredAttestation(
      input.provenance,
      "OpenScriptures-HebrewStrong",
      input.strongRecord.id
    );
    if (
      glossTokens.length > 0 &&
      glossTokens.every((token) => meaningTokens.has(token))
    ) {
      return assessment({
        status: "review_needed",
        tier: "candidate_high",
        method: "hebrew-strong-meaning",
        confidence: 0.88,
        issueCodes: ["hebrew-strong-meaning-only-gloss-candidate"],
        evidence: [
          fieldEvidence(
            strongAttestation,
            "exact-strong-meaning",
            input.strongRecord.meaningDefinitions.join("; ")
          )
        ]
      });
    }
    if (
      glossTokens.length > 0 &&
      glossTokens.every((token) => usageTokens.has(token))
    ) {
      return assessment({
        status: "review_needed",
        tier: "review",
        method: "hebrew-strong-usage",
        confidence: 0.72,
        issueCodes: ["hebrew-strong-usage-only-gloss-review-required"],
        evidence: [
          fieldEvidence(
            strongAttestation,
            "exact-strong-usage",
            input.strongRecord.usageTerms.join("; ")
          )
        ]
      });
    }
  }

  if (
    input.issues.includes("hebrew-strong-record-missing") &&
    !input.selectedLexicalRecord
  ) {
    return sourceIssueGloss("hebrew-open-gloss-source-missing");
  }
  if (selected) {
    return reviewGloss(
      augmentedExact || classicalExact
        ? "step-gloss-open-definition-mismatch"
        : "step-subsense-gloss-specificity-unverified"
    );
  }
  return reviewGloss("hebrew-open-gloss-support-missing");
}

function sourceIssueGloss(issueCode: string): HebrewEnglishFieldAssessment {
  return assessment({
    status: "source_issue",
    tier: "source_issue",
    method: "source-issue",
    confidence: 0.2,
    issueCodes: [issueCode],
    evidence: []
  });
}

function reviewGloss(issueCode: string): HebrewEnglishFieldAssessment {
  return assessment({
    status: "review_needed",
    tier: "review",
    method: "unsupported",
    confidence: 0.72,
    issueCodes: [issueCode],
    evidence: []
  });
}

function fieldEvidence(
  attestation: HebrewEnglishSourceAttestation,
  matchKind: HebrewEnglishFieldEvidence["matchKind"],
  matchedText: string
): HebrewEnglishFieldEvidence {
  return {
    source: attestation.source,
    recordId: attestation.recordId,
    contentDigest: attestation.contentDigest,
    matchKind,
    matchedText: cleanText(matchedText) || attestation.recordId
  };
}

function requiredAttestation(
  provenance: HebrewEnglishSourceAttestation[],
  source: HebrewEnglishSourceAttestation["source"],
  recordId: string
): HebrewEnglishSourceAttestation {
  const attestation = provenance.find(
    (item) => item.source === source && item.recordId === recordId
  );
  if (!attestation) {
    throw new Error(`hebrew-field-attestation-missing:${source}:${recordId}`);
  }
  return attestation;
}

function tipnrAliases(entity: { nameDisplayName: string }): string[] {
  // Entity displayName is deliberately excluded: it identifies the canonical
  // person or place, but it may differ from the exact name carried by this
  // case-sensitive dStrong. Only the name row and its explicit edition aliases
  // can corroborate the STEP gloss automatically.
  const aliases = [entity.nameDisplayName];
  const primary = entity.nameDisplayName.split(/\s+(?:\(|\[|=)/u)[0];
  if (primary) aliases.push(primary);
  for (const match of entity.nameDisplayName.matchAll(
    /(?:KJV|NIV|ESV|Qere|Ketiv)(?:\s*,\s*(?:KJV|NIV|ESV|Qere|Ketiv))*\s*=\s*([^;,)]+)/gu
  )) {
    if (match[1]) aliases.push(match[1]);
  }
  return stableUnique(aliases.map(cleanText).filter(Boolean));
}

function normalizeExactEnglishText(value: string): string {
  return cleanText(
    value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[’'`]/gu, "")
      .replace(/[^a-z0-9]+/gu, " ")
  );
}

function strongMeaningHtml(
  gloss: string,
  record: HebrewStrongRecord,
  row: StepHebrewRow,
  relationPaths: string[][]
): string {
  const paragraphs: string[] = [];
  if (gloss) {
    paragraphs.push(`<p><strong>STEP sense:</strong> ${escapeHtml(gloss)}</p>`);
  }
  if (record.source) {
    paragraphs.push(
      `<p><strong>Origin:</strong> ${escapeHtml(record.source)}</p>`
    );
  }
  if (record.meaning) {
    paragraphs.push(
      `<p><strong>Meaning:</strong> ${escapeHtml(record.meaning)}</p>`
    );
  }
  if (record.usage) {
    paragraphs.push(
      `<p><strong>Traditional usage:</strong> ${escapeHtml(record.usage)}</p>`
    );
  }
  const relation = renderedStepRelation(row);
  if (relation) {
    paragraphs.push(
      `<p><strong>STEP relation:</strong> ${escapeHtml(relation)}</p>`
    );
  }
  appendRenderedRelationPaths(paragraphs, relationPaths);
  return paragraphs.join("");
}

function lexicalMeaningHtml(
  row: StepHebrewRow,
  lexical: LexicalIndexRecord,
  bdbRecords: BrownDriverBriggsRecord[],
  strongRecord: HebrewStrongRecord | undefined,
  relationPaths: string[][]
): string {
  const paragraphs = [
    `<p><strong>STEP sense:</strong> ${escapeHtml(cleanText(row.gloss))}</p>`
  ];
  if (lexical.definition) {
    paragraphs.push(
      `<p><strong>Exact lexical definition:</strong> ${escapeHtml(
        lexical.definition
      )}</p>`
    );
  }
  if (lexical.partOfSpeech) {
    paragraphs.push(
      `<p><strong>Part of speech:</strong> ${escapeHtml(
        describePartOfSpeech(lexical.partOfSpeech)
      )}</p>`
    );
  }
  for (const bdb of bdbRecords) {
    paragraphs.push(
      `<p><strong>BDB context:</strong> ${escapeHtml(bdb.brief)}</p>`
    );
  }
  if (bdbRecords.length === 0 && strongRecord?.source) {
    paragraphs.push(
      `<p><strong>Traditional Strong origin:</strong> ${escapeHtml(
        strongRecord.source
      )}</p>`
    );
  }
  const relation = renderedStepRelation(row);
  if (relation) {
    paragraphs.push(
      `<p><strong>STEP relation:</strong> ${escapeHtml(relation)}</p>`
    );
  }
  appendRenderedRelationPaths(paragraphs, relationPaths);
  return paragraphs.join("");
}

function appendRenderedRelationPaths(
  paragraphs: string[],
  relationPaths: string[][]
): void {
  const paths = relationPaths.filter((path) => path.length > 1);
  if (paths.length === 0) return;
  const label = paths.length === 1 ? "path" : "paths";
  paragraphs.push(
    `<p><strong>Open-source relation ${label}:</strong> ${escapeHtml(
      paths.map((path) => path.join(" → ")).join("; ")
    )}</p>`
  );
}

function describePartOfSpeech(value: string): string {
  const code = cleanText(value);
  const descriptions: Record<string, string> = {
    A: "adjective",
    Ag: "gentilic adjective",
    Ao: "ordinal adjective",
    C: "conjunction",
    D: "adverb",
    N: "noun",
    Ng: "gentilic noun",
    Np: "proper noun",
    P: "pronoun",
    Pd: "demonstrative pronoun",
    Pf: "reflexive pronoun",
    Pi: "interrogative pronoun",
    Pp: "personal pronoun",
    Pr: "relative pronoun",
    R: "preposition",
    T: "particle",
    Td: "definite article",
    Ti: "interrogative particle",
    Tj: "interjection",
    Tm: "demonstrative particle",
    To: "direct-object marker",
    V: "verb"
  };
  return descriptions[code] ?? `OpenScriptures code ${code}`;
}

function parseHebrewStrongXml(xml: string): Map<string, HebrewStrongRecord> {
  const records = new Map<string, HebrewStrongRecord>();
  for (const match of xml.matchAll(/<entry\b([^>]*)>([\s\S]*?)<\/entry>/gi)) {
    const attributes = match[1] ?? "";
    const content = match[2] ?? "";
    const rawId = attributeValue(attributes, "id");
    if (!rawId) continue;
    const id = normalizeClassicalHebrewStrong(rawId);
    if (!id) continue;
    if (records.has(id)) throw new Error(`duplicate-hebrew-strong-entry:${id}`);
    const wordMatch = /<w\b([^>]*)>([\s\S]*?)<\/w>/i.exec(content);
    records.set(id, {
      id,
      word: wordMatch ? xmlText(wordMatch[2] ?? "") : "",
      wordLanguage: wordMatch
        ? cleanText(attributeValue(wordMatch[1] ?? "", "xml:lang") ?? "")
        : "",
      partOfSpeech: wordMatch
        ? cleanText(attributeValue(wordMatch[1] ?? "", "pos") ?? "")
        : "",
      source: xmlElementText(content, "source"),
      meaning: xmlElementText(content, "meaning"),
      meaningDefinitions: xmlElementTexts(
        xmlElementInnerXml(content, "meaning"),
        "def"
      ),
      usage: xmlElementText(content, "usage"),
      usageTerms: splitStrongUsageTerms(xmlElementText(content, "usage"))
    });
  }
  return records;
}

function parseLexicalIndexXml(xml: string): LexicalIndexCatalog {
  const byStrong = new Map<string, LexicalIndexRecord[]>();
  const byId = new Map<string, LexicalIndexRecord>();
  for (const match of xml.matchAll(/<entry\b([^>]*)>([\s\S]*?)<\/entry>/gi)) {
    const attributes = match[1] ?? "";
    const content = match[2] ?? "";
    const id = attributeValue(attributes, "id");
    if (!id) continue;
    if (byId.has(id)) throw new Error(`duplicate-lexical-index-entry:${id}`);
    const wordMatch = /<w\b([^>]*)>([\s\S]*?)<\/w>/i.exec(content);
    const xref = /<xref\b([^>]*?)\/?\s*>/i.exec(content)?.[1] ?? "";
    const etymology = /<etym\b[^>]*?(?:\/>|>([\s\S]*?)<\/etym>)/i.exec(content);
    const strongValues = (attributeValue(xref, "strong") ?? "")
      .split(/[\s,;]+/)
      .filter(Boolean);
    const record: LexicalIndexRecord = {
      id,
      word: wordMatch ? xmlText(wordMatch[2] ?? "") : "",
      transliteration: wordMatch
        ? cleanText(attributeValue(wordMatch[1] ?? "", "xlit") ?? "")
        : "",
      partOfSpeech: xmlElementText(content, "pos"),
      definition: xmlElementText(content, "def"),
      bdbIds: uniqueSorted(
        (attributeValue(xref, "bdb") ?? "").split(/[\s,;]+/).filter(Boolean)
      ),
      etymologyIds: stableUnique(
        (etymology?.[1] ?? "").match(/[a-z]{3}/g) ?? []
      )
    };
    byId.set(id, record);
    for (const strongValue of strongValues) {
      const strong = normalizeClassicalHebrewStrong(strongValue);
      if (!strong) continue;
      const records = byStrong.get(strong) ?? [];
      records.push(record);
      byStrong.set(strong, records);
    }
  }
  for (const [strong, records] of byStrong) {
    byStrong.set(
      strong,
      [...records].sort((left, right) => left.id.localeCompare(right.id))
    );
  }
  return { byStrong, byId };
}

function parseAugIndexXml(xml: string): Map<string, string> {
  const records = new Map<string, string>();
  for (const match of xml.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/gi)) {
    const augmented = cleanText(attributeValue(match[1] ?? "", "aug") ?? "");
    const lexicalIndexId = xmlText(match[2] ?? "");
    if (!augmented || !lexicalIndexId) continue;
    if (records.has(augmented)) {
      throw new Error(`duplicate-aug-index-entry:${augmented}`);
    }
    records.set(augmented, lexicalIndexId);
  }
  return records;
}

function emptyLexicalIndexCatalog(): LexicalIndexCatalog {
  return {
    byStrong: new Map<string, LexicalIndexRecord[]>(),
    byId: new Map<string, LexicalIndexRecord>()
  };
}

function parseBrownDriverBriggsXml(
  xml: string
): Map<string, BrownDriverBriggsRecord> {
  const records = new Map<string, BrownDriverBriggsRecord>();
  for (const match of xml.matchAll(/<entry\b([^>]*)>([\s\S]*?)<\/entry>/gi)) {
    const id = attributeValue(match[1] ?? "", "id");
    if (!id) continue;
    if (records.has(id)) throw new Error(`duplicate-bdb-entry:${id}`);
    const content = (match[2] ?? "")
      .replace(/<status\b[^>]*>[\s\S]*?<\/status>/gi, " ")
      .replace(/<page\b[^>]*\/?\s*>/gi, " ");
    records.set(id, {
      id,
      brief: truncateAtWord(xmlText(content), 800),
      definitions: xmlElementTexts(content, "def")
    });
  }
  return records;
}

function xmlElementText(xml: string, element: string): string {
  const match = new RegExp(
    `<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`,
    "i"
  ).exec(xml);
  if (!match) return "";
  let content = match[1] ?? "";
  content = content.replace(
    /<w\b([^>]*)>([\s\S]*?)<\/w>/gi,
    (_whole, attributes: string, inner: string) => {
      const label = xmlText(inner);
      const source = attributeValue(attributes, "src");
      return source ? `${label} [${source}]` : label;
    }
  );
  return xmlText(content);
}

function xmlElementInnerXml(xml: string, element: string): string {
  return (
    new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, "i").exec(
      xml
    )?.[1] ?? ""
  );
}

function xmlElementTexts(xml: string, element: string): string[] {
  const values = [
    ...xml.matchAll(
      new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, "gi")
    )
  ]
    .map((match) => xmlText(match[1] ?? ""))
    .filter(Boolean);
  return stableUnique(values);
}

function splitStrongUsageTerms(value: string): string[] {
  return stableUnique(
    value
      .split(/[,;]/u)
      .map((term) => cleanText(term.replace(/^×\s*/u, "")))
      .filter(Boolean)
  );
}

function xmlText(xml: string): string {
  return cleanText(
    decodeXmlEntities(
      xml.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ")
    )
  );
}

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (whole, entity: string) => {
      const lowered = entity.toLowerCase();
      if (lowered === "amp") return "&";
      if (lowered === "lt") return "<";
      if (lowered === "gt") return ">";
      if (lowered === "quot") return '"';
      if (lowered === "apos") return "'";
      const radix = lowered.startsWith("#x") ? 16 : 10;
      const raw = lowered.replace(/^#x?/, "");
      const codePoint = Number.parseInt(raw, radix);
      if (
        !Number.isInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff
      ) {
        return whole;
      }
      return String.fromCodePoint(codePoint);
    }
  );
}

function attributeValue(attributes: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|\\s)${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "i"
  ).exec(attributes);
  return match?.[2] ? decodeXmlEntities(match[2]) : null;
}

function indexTipnrRows(rows: TipnrRow[]): Map<string, TipnrRow[]> {
  const result = new Map<string, TipnrRow[]>();
  for (const row of rows) {
    // Deliberately do not normalize the suffix: TIPNR joins are exact and
    // case-sensitive, so H2148V and H2148v remain different people.
    const records = result.get(row.dStrong) ?? [];
    records.push(row);
    result.set(row.dStrong, records);
  }
  return result;
}

function indexTipnrEntityReferences(
  rows: TipnrEntityRefRow[]
): Map<number, string[]> {
  const result = new Map<number, string[]>();
  for (const row of rows) {
    const references = result.get(row.entityId) ?? [];
    references.push(row.refText);
    result.set(row.entityId, references);
  }
  return new Map(
    [...result].map(([entityId, references]) => [
      entityId,
      stableUnique(references)
    ])
  );
}

function classicalStrong(row: StepHebrewRow): string | null {
  if (
    Number.isInteger(row.baseCode) &&
    row.baseCode > 0 &&
    row.baseCode < 9000
  ) {
    return `H${row.baseCode}`;
  }
  const match = /^H0*(\d{1,5})/i.exec(row.eStrong.trim());
  if (!match) return null;
  const number = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(number) || number < 1 || number >= 9000) return null;
  return `H${number}`;
}

function augmentedStrong(row: StepHebrewRow): string | null {
  // OpenScriptures AugIndex keys use the unpadded Strong number followed by
  // the lower-case augmentation letter (for example 122a). eStrong is the
  // only STEP field carrying that identity; dStrong suffixes have different
  // semantics and remain case-sensitive.
  const match = /^H0*(\d{1,5})([a-z])$/.exec(row.eStrong.trim());
  if (!match) return null;
  const number = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(number) || number < 1) return null;
  return `H${number}${match[2]}`;
}

function normalizeClassicalHebrewStrong(value: string): string | null {
  const match = /^(?:H)?0*(\d{1,5})(?:[a-z])?$/i.exec(value.trim());
  if (!match) return null;
  const number = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(number) || number < 1) return null;
  return `H${number}`;
}

function normalizeRelationHebrewStrong(value: string): string | null {
  const normalized = normalizeStepStrongCode(value);
  const match = normalized?.match(/^H0*(\d{1,5})([A-Za-z]?)(?:_([A-Za-z]))?$/u);
  if (!match) return null;
  const number = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(number) || number < 1) return null;
  const suffix = match[2] ?? "";
  const variant = match[3] ? `_${match[3]}` : "";
  return `H${number}${suffix}${variant}`;
}

function relationText(dStrong: string): string | null {
  const match = /[GH]0*\d{1,5}[A-Za-z]?(?:_[A-Za-z])?/i.exec(dStrong);
  if (!match) return null;
  return cleanText(dStrong.slice(match.index + match[0].length)) || null;
}

function renderedStepRelation(row: StepHebrewRow): string | null {
  const relation = relationText(row.dStrong);
  if (!relation || relation === "=") return null;
  const label = cleanText(relation.replace(/^=\s*/, ""));
  const targets = extractStrongCodes(row.uStrong);
  return (
    cleanText([label, targets.join(", ")].filter(Boolean).join(" ")) || null
  );
}

function isCombinationRelation(relation: string): boolean {
  return /\bcombination\s+of\b/iu.test(relation);
}

function extractStepRelationTargets(
  row: StepHebrewRow,
  relation: string
): string[] {
  return uniqueSorted(extractOrderedStepRelationTargets(row, relation));
}

function extractOrderedStepRelationTargets(
  row: StepHebrewRow,
  relation: string
): string[] {
  let targetText = row.uStrong;
  if (isCombinationRelation(relation)) {
    const componentGroups = [...row.uStrong.matchAll(/\(([^()]*)\)/gu)].map(
      (match) => match[1] ?? ""
    );
    if (componentGroups.length > 0) targetText = componentGroups.join(" ");
  }
  return stableUnique(
    (targetText.match(/H0*\d{1,5}[A-Za-z]?(?:_[A-Za-z])?/g) ?? [])
      .map(normalizeRelationHebrewStrong)
      .filter((value): value is string => Boolean(value))
  );
}

function buildStrictRelationCatalog(
  rows: StepHebrewRow[],
  augIndex: Map<string, string>,
  lexicalIndex: LexicalIndexCatalog
): StrictRelationCatalog {
  const byBaseCode = new Map<number, StepHebrewRow[]>();
  const byEStrong = new Map<string, StepHebrewRow[]>();
  const byPrimaryDStrong = new Map<string, StepHebrewRow[]>();
  for (const row of rows) {
    appendMapValue(byBaseCode, row.baseCode, row);
    appendMapValue(byEStrong, row.eStrong, row);
    const primary = normalizedPrimaryDStrong(row);
    if (primary) appendMapValue(byPrimaryDStrong, primary, row);
  }
  return {
    rows,
    byBaseCode,
    byEStrong,
    byPrimaryDStrong,
    augIndex,
    lexicalIndex
  };
}

function appendMapValue<Key, Value>(
  map: Map<Key, Value[]>,
  key: Key,
  value: Value
): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function assessStrictStepRelation(input: {
  row: StepHebrewRow;
  relation: string;
  targets: string[];
  classical: string | null;
  records: Map<string, HebrewStrongRecord>;
  catalog: StrictRelationCatalog;
  selectedLexicalRecord: LexicalIndexRecord | undefined;
  strictAugmentedSource: boolean;
}): RelationAssessment | null {
  const sourceCode = normalizedPrimaryDStrong(input.row);
  const sourceLexical = strictSourceLexicalRecord(input);
  if (!sourceCode || !sourceLexical) return null;

  if (isSpellingOrFormRelation(input.relation)) {
    if (input.targets.length !== 1) return null;
    const target = resolveStrictRelationTarget(
      input.targets[0]!,
      input.catalog
    );
    if (!target?.lexicalRecord) return null;
    if (!hasDirectLexicalRelation(sourceLexical, target.lexicalRecord)) {
      return null;
    }
    return applyStrictGlossGate(
      input.row,
      strictCoherentAssessment(
        input.row,
        sourceCode,
        [target],
        [sourceLexical, target.lexicalRecord]
      )
    );
  }

  if (/\bin\s+Aramaic\s+of\b/iu.test(input.relation)) {
    if (input.targets.length !== 1 || !input.classical) return null;
    const target = resolveStrictRelationTarget(
      input.targets[0]!,
      input.catalog
    );
    if (!target?.lexicalRecord || target.technicalMorpheme) return null;
    const strongRecord = input.records.get(input.classical);
    const targetClassical = classicalStrong(target.row);
    if (
      !strongRecord ||
      strongRecord.wordLanguage.toLowerCase() !== "arc" ||
      !targetClassical ||
      !extractStrongCodes(strongRecord.source)
        .map(normalizeClassicalHebrewStrong)
        .includes(targetClassical) ||
      !input.row.morph.startsWith("A:") ||
      !target.row.morph.startsWith("H:") ||
      !sameHebrewForm(input.row.original, target.row.original) ||
      !compatibleStepPartsOfSpeech(input.row.morph, target.row.morph)
    ) {
      return null;
    }
    return applyStrictGlossGate(
      input.row,
      strictCoherentAssessment(
        input.row,
        sourceCode,
        [target],
        [sourceLexical, target.lexicalRecord]
      )
    );
  }

  if (isCombinationRelation(input.relation)) {
    const targets = input.targets.map((target) =>
      resolveStrictRelationTarget(target, input.catalog)
    );
    if (
      targets.length === 0 ||
      targets.some(
        (target) =>
          !target || (!target.technicalMorpheme && !target.lexicalRecord)
      )
    ) {
      return null;
    }
    const resolved = targets as StrictRelationTarget[];
    if (
      !sameHebrewForm(
        input.row.original,
        resolved.map((target) => target.row.original).join("")
      )
    ) {
      return null;
    }
    return applyStrictGlossGate(
      input.row,
      strictCoherentAssessment(input.row, sourceCode, resolved, [
        sourceLexical,
        ...resolved
          .map((target) => target.lexicalRecord)
          .filter((record): record is LexicalIndexRecord => Boolean(record))
      ])
    );
  }

  return null;
}

function strictSourceLexicalRecord(input: {
  row: StepHebrewRow;
  classical: string | null;
  selectedLexicalRecord: LexicalIndexRecord | undefined;
  strictAugmentedSource: boolean;
}): LexicalIndexRecord | null {
  if (!input.selectedLexicalRecord) return null;
  const primary = normalizedPrimaryDStrong(input.row);
  const normalizedClassical = input.classical
    ? normalizeRelationHebrewStrong(input.classical)
    : null;
  if (input.strictAugmentedSource) return input.selectedLexicalRecord;
  return primary && primary === normalizedClassical
    ? input.selectedLexicalRecord
    : null;
}

function resolveStrictRelationTarget(
  code: string,
  catalog: StrictRelationCatalog
): StrictRelationTarget | null {
  const rows = catalog.byPrimaryDStrong.get(code) ?? [];
  if (rows.length !== 1) return null;
  const row = rows[0]!;
  if (!isExactSelfAnchor(row, code)) return null;

  const technicalMorpheme = isTechnicalMorphemeRow(row, code);
  if (technicalMorpheme) {
    return {
      row,
      code,
      lexicalRecord: null,
      augmentedEvidence: null,
      technicalMorpheme: true,
      stepEvidence: exactStepEvidence(row, code, code)
    };
  }

  const lexical = resolveExactTargetLexicalRecord(row, catalog);
  if (!lexical) return null;
  if (isSuffixedRelationCode(code)) {
    const competitors = (catalog.byBaseCode.get(row.baseCode) ?? []).filter(
      (candidate) =>
        sameHebrewForm(candidate.original, lexical.record.word) &&
        compatiblePartOfSpeech(candidate.morph, lexical.record.partOfSpeech)
    );
    if (
      competitors.length !== 1 ||
      normalizedPrimaryDStrong(competitors[0]!) !== code
    ) {
      return null;
    }
  }

  return {
    row,
    code,
    lexicalRecord: lexical.record,
    augmentedEvidence: lexical.augmentedEvidence,
    technicalMorpheme: false,
    stepEvidence: exactStepEvidence(row, code, code)
  };
}

function resolveExactTargetLexicalRecord(
  row: StepHebrewRow,
  catalog: StrictRelationCatalog
): {
  record: LexicalIndexRecord;
  augmentedEvidence: {
    augmented: string;
    lexicalIndexId: string;
  } | null;
} | null {
  const augmented = augmentedStrong(row);
  if (augmented) {
    const lexicalIndexId = catalog.augIndex.get(augmented.slice(1));
    const record = lexicalIndexId
      ? catalog.lexicalIndex.byId.get(lexicalIndexId)
      : undefined;
    if (
      !record ||
      !sameHebrewForm(row.original, record.word) ||
      !compatiblePartOfSpeech(row.morph, record.partOfSpeech)
    ) {
      return null;
    }
    return {
      record,
      augmentedEvidence: { augmented, lexicalIndexId: record.id }
    };
  }

  const classical = classicalStrong(row);
  if (!classical) return null;
  const matches = (catalog.lexicalIndex.byStrong.get(classical) ?? []).filter(
    (record) =>
      sameHebrewForm(row.original, record.word) &&
      compatiblePartOfSpeech(row.morph, record.partOfSpeech)
  );
  return matches.length === 1
    ? { record: matches[0]!, augmentedEvidence: null }
    : null;
}

function strictCoherentAssessment(
  sourceRow: StepHebrewRow,
  sourceCode: string,
  targets: StrictRelationTarget[],
  lexicalEvidence: LexicalIndexRecord[]
): RelationAssessment {
  const stepEvidence = [
    ...targets.map((target) => target.stepEvidence),
    ...targets.map((target) =>
      exactStepEvidence(sourceRow, sourceCode, target.code)
    )
  ];
  return {
    kind: "coherent",
    strict: true,
    paths: targets.map((target) => [sourceCode, target.code]),
    stepEvidence: mergeRelationEvidence([{ path: [], stepEvidence }])
      .stepEvidence,
    lexicalEvidence: uniqueLexicalRecords(lexicalEvidence),
    augmentedEvidence: uniqueAugmentedEvidence(
      targets
        .map((target) => target.augmentedEvidence)
        .filter(
          (
            evidence
          ): evidence is { augmented: string; lexicalIndexId: string } =>
            Boolean(evidence)
        )
    ),
    bdbEvidenceIds: uniqueSorted(
      lexicalEvidence.flatMap((record) => record.bdbIds)
    )
  };
}

function exactStepEvidence(
  row: StepHebrewRow,
  source: string,
  target: string
): StepRelationEdge {
  return {
    source,
    target,
    stepEntryId: row.stepEntryId,
    dStrong: row.dStrong,
    uStrong: row.uStrong
  };
}

function normalizedPrimaryDStrong(row: StepHebrewRow): string | null {
  const primary = extractPrimaryDStrong(row.dStrong);
  return primary ? normalizeRelationHebrewStrong(primary) : null;
}

function isExactSelfAnchor(row: StepHebrewRow, code: string): boolean {
  const relation = relationText(row.dStrong);
  const targets = stableUnique(
    extractStrongCodes(row.uStrong)
      .map(normalizeRelationHebrewStrong)
      .filter((value): value is string => Boolean(value))
  );
  return relation === "=" && targets.length === 1 && targets[0] === code;
}

function isSuffixedRelationCode(code: string): boolean {
  return /^H\d+(?:[A-Za-z](?:_[A-Za-z])?|_[A-Za-z])$/u.test(code);
}

function isTechnicalMorphemeRow(row: StepHebrewRow, code: string): boolean {
  return (
    row.baseCode >= 9001 &&
    row.baseCode <= 9049 &&
    code === `H${row.baseCode}` &&
    !isSuffixedRelationCode(code)
  );
}

function isSpellingOrFormRelation(relation: string): boolean {
  return /\ba\s+(?:Spelling|form)\s+of\b/iu.test(relation);
}

function hasDirectLexicalRelation(
  left: LexicalIndexRecord,
  right: LexicalIndexRecord
): boolean {
  return (
    left.bdbIds.some((id) => right.bdbIds.includes(id)) ||
    left.etymologyIds.includes(right.id) ||
    right.etymologyIds.includes(left.id)
  );
}

function compatibleStepPartsOfSpeech(left: string, right: string): boolean {
  const categories = (value: string) =>
    stableUnique(
      [...value.matchAll(/(?:^|[+/\s])(?:[HA]:)?([A-Za-z]+)/gu)].map((match) =>
        (match[1] ?? "").toLowerCase()
      )
    );
  const compatible = (leftCategory: string, rightCategory: string) =>
    leftCategory === rightCategory ||
    (leftCategory.startsWith("n") && rightCategory.startsWith("n"));
  return categories(left).some((leftCategory) =>
    categories(right).some((rightCategory) =>
      compatible(leftCategory, rightCategory)
    )
  );
}

function hasDeterministicGlossSupport(
  gloss: string,
  definitions: string[]
): boolean {
  const glossTokens = normalizedEnglishContentTokens(gloss);
  if (glossTokens.length === 0) return false;
  const definitionTokens = new Set(
    definitions.flatMap(normalizedEnglishContentTokens)
  );
  return glossTokens.every((token) => definitionTokens.has(token));
}

function applyStrictGlossGate(
  row: StepHebrewRow,
  assessment: RelationAssessment
): RelationAssessment {
  if (
    !hasDeterministicGlossSupport(
      row.gloss,
      (assessment.lexicalEvidence ?? []).map((record) => record.definition)
    )
  ) {
    assessment.issues = stableUnique([
      ...(assessment.issues ?? []),
      "step-gloss-open-source-mismatch"
    ]);
  }
  return assessment;
}

function normalizedEnglishContentTokens(value: string): string[] {
  const stopWords = new Set(["a", "an", "be", "of", "the", "to"]);
  return stableUnique(
    cleanText(value)
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .match(/[a-z]+/g)
      ?.map(normalizeEnglishContentToken)
      .filter((token) => token.length >= 2 && !stopWords.has(token)) ?? []
  );
}

function normalizeEnglishContentToken(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function uniqueLexicalRecords(
  records: LexicalIndexRecord[]
): LexicalIndexRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return [...byId.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function uniqueAugmentedEvidence(
  evidence: Array<{ augmented: string; lexicalIndexId: string }>
): Array<{ augmented: string; lexicalIndexId: string }> {
  const byKey = new Map(
    evidence.map((item) => [`${item.augmented}:${item.lexicalIndexId}`, item])
  );
  return [...byKey.values()].sort(
    (left, right) =>
      left.augmented.localeCompare(right.augmented) ||
      left.lexicalIndexId.localeCompare(right.lexicalIndexId)
  );
}

function assessStepRelation(
  row: StepHebrewRow,
  classical: string | null,
  records: Map<string, HebrewStrongRecord>,
  stepRelations: Map<string, StepRelationEdge[]>,
  strictRelations: StrictRelationCatalog,
  selectedLexicalRecord: LexicalIndexRecord | undefined,
  strictAugmentedSource: boolean
): RelationAssessment {
  const relation = relationText(row.dStrong);
  if (!relation || relation === "=") {
    return { kind: "none", paths: [], stepEvidence: [] };
  }
  if (!classical) {
    return { kind: "unverified", paths: [], stepEvidence: [] };
  }

  const targets = extractStepRelationTargets(row, relation);
  if (targets.length === 0) {
    return { kind: "unverified", paths: [], stepEvidence: [] };
  }

  if (isCombinationRelation(relation)) {
    const componentResults: RelationPathResult[] = [];
    for (const target of targets) {
      const result =
        target === classical
          ? { path: [classical], stepEvidence: [] }
          : findStrongRelationPath(
              classical,
              new Set([target]),
              records,
              stepRelations,
              row.stepEntryId,
              6
            );
      if (!result) break;
      componentResults.push(result);
    }
    if (componentResults.length === targets.length) {
      const merged = mergeRelationEvidence(componentResults);
      return {
        kind: "coherent",
        paths: componentResults.map((result) => result.path),
        stepEvidence: merged.stepEvidence
      };
    }
  } else {
    if (targets.includes(classical)) {
      return { kind: "coherent", paths: [[classical]], stepEvidence: [] };
    }
    const result = findStrongRelationPath(
      classical,
      new Set(targets),
      records,
      stepRelations,
      row.stepEntryId,
      6
    );
    if (result) {
      return {
        kind: "coherent",
        paths: [result.path],
        stepEvidence: result.stepEvidence
      };
    }
  }
  const strictAssessment = assessStrictStepRelation({
    row,
    relation,
    targets: extractOrderedStepRelationTargets(row, relation),
    classical,
    records,
    catalog: strictRelations,
    selectedLexicalRecord,
    strictAugmentedSource
  });
  if (strictAssessment) return strictAssessment;
  // A classical Strong path can corroborate the broad lexical relation, but
  // it cannot prove a suffixed STEP sense. Keep that case in review instead
  // of misreporting it as a source conflict.
  if (
    hasClassicalRelationCoverage(
      row,
      classical,
      targets,
      relation,
      records,
      stepRelations
    )
  ) {
    return { kind: "unverified", paths: [], stepEvidence: [] };
  }
  const declaredByOpenSource = extractStrongCodes(
    records.get(classical)?.source ?? ""
  ).length;
  const isAramaicRelation = /\bin\s+aramaic\s+of\b/iu.test(relation);
  return declaredByOpenSource > 0 && isAramaicRelation
    ? { kind: "conflict", paths: [], stepEvidence: [] }
    : { kind: "unverified", paths: [], stepEvidence: [] };
}

function hasClassicalRelationCoverage(
  row: StepHebrewRow,
  classical: string,
  exactTargets: string[],
  relation: string,
  records: Map<string, HebrewStrongRecord>,
  stepRelations: Map<string, StepRelationEdge[]>
): boolean {
  const classicalTargets = uniqueSorted(
    exactTargets
      .map(normalizeClassicalHebrewStrong)
      .filter((value): value is string => Boolean(value))
  );
  if (classicalTargets.length === 0) return false;

  const reaches = (target: string): boolean =>
    target === classical ||
    Boolean(
      findStrongRelationPath(
        classical,
        new Set([target]),
        records,
        stepRelations,
        row.stepEntryId,
        6
      )
    );
  return isCombinationRelation(relation)
    ? classicalTargets.every(reaches)
    : classicalTargets.some(reaches);
}

function findStrongRelationPath(
  start: string,
  targets: Set<string>,
  records: Map<string, HebrewStrongRecord>,
  stepRelations: Map<string, StepRelationEdge[]>,
  excludedStepEntryId: number,
  maxDepth: number
): RelationPathResult | null {
  const queue: Array<{
    path: string[];
    stepEvidence: StepRelationEdge[];
  }> = [{ path: [start], stepEvidence: [] }];
  const visited = new Set<string>([start]);
  while (queue.length > 0) {
    const state = queue.shift()!;
    const { path } = state;
    const current = path[path.length - 1]!;
    if (targets.has(current)) return state;
    if (path.length - 1 >= maxDepth) continue;
    const openRelated = uniqueSorted(
      extractStrongCodes(records.get(current)?.source ?? "")
        .map(normalizeRelationHebrewStrong)
        .filter((value): value is string => Boolean(value))
    );
    const stepRelated = (stepRelations.get(current) ?? []).filter(
      (edge) => edge.stepEntryId !== excludedStepEntryId
    );
    const related = [
      ...openRelated.map((target) => ({ target, evidence: null })),
      ...stepRelated.map((edge) => ({ target: edge.target, evidence: edge }))
    ].sort(
      (left, right) =>
        left.target.localeCompare(right.target) ||
        (left.evidence?.stepEntryId ?? 0) - (right.evidence?.stepEntryId ?? 0)
    );
    for (const edge of related) {
      const { target } = edge;
      if (visited.has(target)) continue;
      visited.add(target);
      queue.push({
        path: [...path, target],
        stepEvidence: edge.evidence
          ? [...state.stepEvidence, edge.evidence]
          : state.stepEvidence
      });
    }
  }
  return null;
}

function mergeRelationEvidence(results: RelationPathResult[]): {
  stepEvidence: StepRelationEdge[];
} {
  const evidenceByKey = new Map<string, StepRelationEdge>();
  for (const result of results) {
    for (const evidence of result.stepEvidence) {
      evidenceByKey.set(
        `${evidence.stepEntryId}:${evidence.source}:${evidence.target}`,
        evidence
      );
    }
  }
  return {
    stepEvidence: [...evidenceByKey.values()].sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.target.localeCompare(right.target) ||
        left.stepEntryId - right.stepEntryId
    )
  };
}

function buildStepRelationGraph(
  rows: StepHebrewRow[]
): Map<string, StepRelationEdge[]> {
  const graph = new Map<string, StepRelationEdge[]>();
  for (const row of rows) {
    const relation = relationText(row.dStrong);
    const source = classicalStrong(row);
    const primary = extractPrimaryDStrong(row.dStrong);
    // A suffixed source is a distinct STEP sense. Collapsing it to the
    // classical number would let a sibling prove an unrelated sibling path.
    if (
      !source ||
      !primary ||
      /^H0*\d{1,5}(?:[A-Za-z]|_[A-Za-z])/.test(primary) ||
      !relation ||
      relation === "="
    ) {
      continue;
    }
    const targets = extractStepRelationTargets(row, relation);
    for (const target of targets) {
      if (target === source) continue;
      const edges = graph.get(source) ?? [];
      edges.push({
        source,
        target,
        stepEntryId: row.stepEntryId,
        dStrong: row.dStrong,
        uStrong: row.uStrong
      });
      graph.set(source, edges);
    }
  }
  for (const [source, edges] of graph) {
    graph.set(
      source,
      [...edges].sort(
        (left, right) =>
          left.target.localeCompare(right.target) ||
          left.stepEntryId - right.stepEntryId
      )
    );
  }
  return graph;
}

function extractStrongCodes(value: string): string[] {
  return uniqueSorted(value.match(/H0*\d{1,5}[A-Za-z]?(?:_[A-Za-z])?/g) ?? []);
}

function sameHebrewForm(left: string, right: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "")
      .replace(/[\p{P}\p{Z}]/gu, "")
      .replace(/\s+/g, "");
  return Boolean(left && right && normalize(left) === normalize(right));
}

function compatiblePartOfSpeech(
  stepMorph: string,
  lexicalPos: string
): boolean {
  const stepCategories = new Set(
    [...stepMorph.matchAll(/(?:^|[+/\s])(?:[HA]:)?([A-Za-z]+)/gu)].map(
      (match) => (match[1] ?? "").toLowerCase()
    )
  );
  const lexical = cleanText(lexicalPos).toLowerCase();
  if (stepCategories.size === 0 || !lexical) return false;
  const matches = (step: string): boolean => {
    if (step === "adv") return lexical === "d";
    if (step === "prep") return lexical === "r";
    if (step === "part") return ["d", "r", "t"].includes(lexical);
    if (step === "neg") return ["d", "t"].includes(lexical);
    if (step === "cond") return lexical === "t";
    if (step === "conj") return lexical === "c";
    if (step === "intg") return ["d", "pi", "ti"].includes(lexical);
    if (step === "intj") return ["tj", "tm"].includes(lexical);
    if (step === "relp") return ["pr", "t"].includes(lexical);
    if (step === "demp") return ["pd", "pp"].includes(lexical);
    if (step === "n") return lexical.startsWith("n");
    if (step === "v") return lexical === "v";
    if (step === "a") return lexical.startsWith("a");
    return step[0] === lexical[0];
  };
  return [...stepCategories].some(matches);
}

function compatibleStrongPartOfSpeech(
  stepMorph: string,
  strongPos: string
): boolean {
  const stepCategories = stableUnique(
    [...stepMorph.matchAll(/(?:^|[+/\s])(?:[HA]:)?([A-Za-z]+)/gu)].map(
      (match) => (match[1] ?? "").toLowerCase()
    )
  );
  const strongCategories = cleanText(strongPos)
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
  if (stepCategories.length === 0 || strongCategories.length === 0) {
    return false;
  }
  const matches = (step: string, strong: string): boolean => {
    if (step === "n") return strong === "n" || strong.startsWith("n-");
    if (step === "v") return strong === "v";
    if (step === "a") return strong === "a" || strong.startsWith("a-");
    if (step === "adv") return strong === "adv" || strong === "d";
    if (step === "prep") return strong === "prep" || strong === "r";
    if (step === "conj") return strong === "conj";
    if (["p", "relp", "demp", "indp"].includes(step)) {
      return strong === "p" || strong === "pron" || strong === "dp";
    }
    if (["part", "neg", "cond", "intg", "intj"].includes(step)) {
      return ["prt", "inj", "adv", "conj", "d", "i", "t"].includes(strong);
    }
    return step[0] === strong[0];
  };
  return stepCategories.some((step) =>
    strongCategories.some((strong) => matches(step, strong))
  );
}

function isProperName(row: StepHebrewRow): boolean {
  return row.morph.trim().startsWith("N:");
}

function strongEntityTypeConflicts(
  row: StepHebrewRow,
  record: HebrewStrongRecord
): boolean {
  return (
    !isProperName(row) &&
    (/(?:^|-)pr(?:$|-)/iu.test(record.partOfSpeech) ||
      record.wordLanguage.toLowerCase() === "x-pn")
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const prefix = value.slice(0, maxLength + 1);
  const boundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, boundary > maxLength / 2 ? boundary : maxLength).trim()}…`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function compareAttestations(
  left: HebrewEnglishSourceAttestation,
  right: HebrewEnglishSourceAttestation
): number {
  return (
    left.source.localeCompare(right.source) ||
    left.recordId.localeCompare(right.recordId)
  );
}

function emptyMethodCounts(): Record<HebrewEnglishCandidateMethod, number> {
  return {
    "tipnr-exact-dstrong": 0,
    "open-scriptures-augmented-exact": 0,
    "open-scriptures-lexical-exact": 0,
    "hebrew-strong-exact": 0,
    "hebrew-strong-substep-anchor": 0,
    "hebrew-strong-proper-name-fallback": 0,
    "missing-open-source": 0
  };
}

function readEntitySourceDigests(
  db: DatabaseSync
): StepBibleEntitySourceDigestMap {
  const row = db
    .prepare("SELECT value FROM EntityMeta WHERE key = 'sourceDigests'")
    .get() as { value?: string } | undefined;
  if (!row?.value) throw new Error("missing-entity-source-digests");

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value) as unknown;
  } catch {
    throw new Error("invalid-entity-source-digests-json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid-entity-source-digests");
  }
  const digests = parsed as Record<string, unknown>;
  for (const source of Object.keys(STEP_BIBLE_ENTITY_SOURCE_DIGESTS)) {
    const digest = digests[source];
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/u.test(digest)) {
      throw new Error(`invalid-entity-source-digest:${source}`);
    }
  }
  for (const [source, digest] of Object.entries(digests)) {
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/u.test(digest)) {
      throw new Error(`invalid-entity-source-digest:${source}`);
    }
  }
  return digests as StepBibleEntitySourceDigestMap;
}

function requireTable(db: DatabaseSync, name: string): void {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  if (!exists) throw new Error(`missing-required-table:${name}`);
}

function requireFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`missing-${label}:${path}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
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
