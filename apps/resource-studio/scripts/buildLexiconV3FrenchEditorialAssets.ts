import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { buildFrenchConcordanceIndex } from "./buildLexiconV3FrenchPackets.js";
import {
  buildFrenchMorphologyContent,
  classicalStrongCode,
  classifyFrenchEditorialPos,
  contentHash,
  FRENCH_BOOK_REGISTRY,
  FRENCH_BOOK_REGISTRY_SCHEMA_VERSION,
  FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
  FRENCH_EDITORIAL_POLICY_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
  FRENCH_MORPHOLOGY_SCHEMA_VERSION,
  FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION,
  normalizeFrenchEvidence,
  stableJson,
  THEOLOGICAL_REVIEW_BASE_STRONGS,
  validateFrenchBookRegistry,
  type FrenchEditorialPos,
  type FrenchEditorialStatus,
  type MorphologyCodeSourceRow
} from "../src/lexiconV3/frenchEditorialPolicy.js";
import {
  buildLexiconEntryKey,
  extractPrimaryDStrong
} from "../src/lexiconV3/identity.js";
import { readStrongCsv, type StrongRow } from "../src/strongCsv.js";
import { type FrenchConcordanceForm } from "../src/lexiconV3/frenchValidation.js";

const DEFAULT_CORE =
  "data/dictionaries/strong_lexicon.en.core.production.sqlite";
const DEFAULT_HISTORICAL =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_LEGACY = "data/dictionaries/strong.legacy.sqlite";
const DEFAULT_ENTITIES = "data/entities/bible_entities.production.sqlite";
const DEFAULT_SG1910 = "data/strongs/Sg1910.csv";
const DEFAULT_DARBY = "data/strongs/Darby.csv";
const DEFAULT_DARBY_R = "data/strongs/DarbyR.csv";
const DEFAULT_GUIDE = "src/lexiconV3/sources/french-editorial-guide.json";
const DEFAULT_OUTPUT_DIR = "outputs/lexicon-v3/french-editorial";
const DEFAULT_REPORT = "reports/lexicon-v3-french-editorial.md";

const DEFAULT_EXPECTED_ENTRIES = 22_717;
const DEFAULT_EXPECTED_PROPER_ENTRIES = 5_311;
const DEFAULT_EXPECTED_MORPHOLOGY = 2_740;

export interface BuildFrenchEditorialAssetsOptions {
  coreDatabase: string;
  historicalDatabase: string;
  legacyDatabase: string;
  entitiesDatabase: string;
  sg1910: string;
  darby: string;
  darbyR: string;
  editorialGuide: string;
  outputDir: string;
  report: string;
  expectedEntryCount?: number;
  expectedProperEntryCount?: number;
  expectedMorphologyCount?: number;
  generatedAt?: string;
}

export interface FrenchEditorialBuildSummary {
  schemaVersion: typeof FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  generatedAt: string;
  releaseKey: string;
  counts: {
    books: number;
    entries: number;
    entityRegistry: number;
    entityStatus: Record<FrenchEditorialStatus, number>;
    termbaseCandidates: number;
    termbaseStatus: Record<FrenchEditorialStatus, number>;
    morphologyTranslations: number;
    morphologyScopes: Record<string, number>;
    historicalFrenchCandidates: number;
    legacyCandidates: number;
    concordanceFormsAttached: number;
  };
  sourceDigests: Record<string, string>;
  artifacts: Record<
    "bookRegistry" | "entityRegistry" | "termbaseCandidates" | "morphology",
    { path: string; sha256: string; bytes: number; records: number }
  >;
  summaryContentHash: string;
}

interface StepEntryRow {
  id: number;
  language: "greek" | "hebrew";
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
}

interface EnglishFieldStatusRow {
  stepEntryId: number;
  field: "gloss" | "meaning";
  state: "auto_validated" | "human_validated";
  confidence: number;
  method: string;
  contentHash: string;
  releaseKey: string;
}

interface HistoricalFrenchRow {
  stepEntryId: number;
  language: string;
  dStrong: string;
  gloss: string;
  meaning: string;
  meaningHtml: string;
}

interface LegacyRow {
  code: number;
  mot: string;
  type: string;
  lsg: string;
  definition: string;
}

interface EntitySourceRow {
  dStrong: string;
  entityId: number;
  significance: string;
  aliasEn: string;
  entityEn: string;
  entityFr: string;
  category: string;
  type: string;
}

interface EditorialGuide {
  schemaVersion: string;
  locale: string;
  releaseRule: string;
}

interface EntityRegistryRecord {
  schemaVersion: typeof FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: {
    language: "greek" | "hebrew";
    primaryDStrong: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    morph: string;
  };
  englishGloss: string;
  status: FrenchEditorialStatus;
  canonicalFr: string | null;
  reasons: string[];
  matches: Array<{
    entityId: number;
    significance: string;
    aliasEn: string;
    entityEn: string;
    candidateFr: string;
    category: string;
    type: string;
  }>;
  referenceEvidence: FrenchConcordanceForm[];
  historicalCandidate: {
    gloss: string;
    trust: "untrusted-candidate";
    sourceHash: string;
  } | null;
  inputHash: string;
  contentHash: string;
}

interface TermbaseCandidateRecord {
  schemaVersion: typeof FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: {
    language: "greek" | "hebrew";
    primaryDStrong: string;
    classicalStrong: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  english: {
    gloss: string;
    meaning: string;
    glossStatusHash: string;
    meaningStatusHash: string;
  };
  pos: FrenchEditorialPos;
  status: FrenchEditorialStatus;
  canonicalFr: string | null;
  reasons: string[];
  historicalFrench: {
    gloss: string;
    meaning: string;
    meaningHtml: string;
    trust: "untrusted-candidate";
    sourceHash: string;
  } | null;
  legacyFrench: {
    gloss: string;
    meaning: string;
    type: string;
    trust: "untrusted-candidate";
    evidenceScope: "classical-strong-only";
    sourceHash: string;
  } | null;
  concordanceForms: Array<
    FrenchConcordanceForm & {
      trust: "attested-carrier-review-only";
      evidenceScope: "classical-strong-only";
    }
  >;
  deterministicRepairCandidate: {
    gloss: string;
    rule: "remove-pour-before-infinitive-candidate";
    trust: "untrusted-candidate";
  } | null;
  inputHash: string;
  contentHash: string;
}

interface MorphologyArtifactRecord {
  schemaVersion: typeof FRENCH_MORPHOLOGY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  inputHash: string;
  contentHash: string;
  morphologyCodeId: number;
  code: string;
  normalizedCode: string;
  source: string;
  scope: string;
  sourceLanguage: string;
  language: "fr";
  meaning: string;
  description: string;
  example: string;
  structuredPairs: Array<{ field: string; source: string; french: string }>;
}

export async function runBuildFrenchEditorialAssets(
  options: BuildFrenchEditorialAssetsOptions
): Promise<FrenchEditorialBuildSummary> {
  validateFrenchBookRegistry();
  const expectedEntries =
    options.expectedEntryCount ?? DEFAULT_EXPECTED_ENTRIES;
  const expectedProper =
    options.expectedProperEntryCount ?? DEFAULT_EXPECTED_PROPER_ENTRIES;
  const expectedMorphology =
    options.expectedMorphologyCount ?? DEFAULT_EXPECTED_MORPHOLOGY;
  assertPositiveExpectedCount("entries", expectedEntries);
  assertPositiveExpectedCount("proper-entries", expectedProper);
  assertPositiveExpectedCount("morphology", expectedMorphology);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error("invalid-generated-at:" + generatedAt);
  }

  const sourcePaths = {
    coreDatabase: resolve(options.coreDatabase),
    historicalDatabase: resolve(options.historicalDatabase),
    legacyDatabase: resolve(options.legacyDatabase),
    entitiesDatabase: resolve(options.entitiesDatabase),
    Sg1910: resolve(options.sg1910),
    Darby: resolve(options.darby),
    DarbyR: resolve(options.darbyR),
    editorialGuide: resolve(options.editorialGuide)
  };
  const sourceDigests = Object.fromEntries(
    await Promise.all(
      Object.entries(sourcePaths).map(async ([key, path]) => [
        key,
        await sha256File(path)
      ])
    )
  );

  const guide = JSON.parse(
    await readFile(sourcePaths.editorialGuide, "utf8")
  ) as EditorialGuide;
  validateEditorialGuide(guide);

  const core = openValidatedDatabase(sourcePaths.coreDatabase, [
    "DictionaryMeta",
    "LexiconFieldStatus",
    "MorphologyCodes",
    "StepEntries"
  ]);
  const historical = openValidatedDatabase(sourcePaths.historicalDatabase, [
    "LexiconTranslations",
    "StepEntries"
  ]);
  const legacy = openValidatedDatabase(sourcePaths.legacyDatabase, [
    "Grec",
    "Hebreu"
  ]);
  const entities = openValidatedDatabase(sourcePaths.entitiesDatabase, [
    "Entities",
    "EntityNames",
    "EntityTranslations"
  ]);

  try {
    const releaseKey = readRequiredMeta(core, "lexiconV3ReleaseKey");
    const entries = readStepEntries(core);
    if (entries.length !== expectedEntries) {
      throw new Error(
        "step-entry-count-mismatch:" + entries.length + ":" + expectedEntries
      );
    }
    validateEntryIdentities(entries);

    const fieldStatuses = readEnglishFieldStatuses(core, releaseKey, entries);
    const historicalFrench = readHistoricalFrench(
      historical,
      entries,
      expectedEntries
    );
    const legacyByStrong = readLegacyFrench(legacy);
    const entitiesByDStrong = readEntitySources(entities);
    const morphologySource = readMorphologyCodes(core);
    if (morphologySource.length !== expectedMorphology) {
      throw new Error(
        "morphology-count-mismatch:" +
          morphologySource.length +
          ":" +
          expectedMorphology
      );
    }

    const [sg1910Rows, darbyRows, darbyRRows] = await Promise.all([
      readRequiredStrongRows(sourcePaths.Sg1910, "Sg1910"),
      readRequiredStrongRows(sourcePaths.Darby, "Darby"),
      readRequiredStrongRows(sourcePaths.DarbyR, "DarbyR")
    ]);
    const concordance = buildFrenchConcordanceIndex([
      {
        source: "Sg1910",
        family: "Sg1910",
        rows: sg1910Rows
      },
      {
        source: "Darby",
        family: "Darby-family",
        rows: darbyRows
      },
      {
        source: "DarbyR",
        family: "Darby-family",
        rows: darbyRRows
      }
    ]);

    const properEntries = entries.filter(
      (entry) => classifyFrenchEditorialPos(entry.morph) === "proper-name"
    );
    if (properEntries.length !== expectedProper) {
      throw new Error(
        "proper-entry-count-mismatch:" +
          properEntries.length +
          ":" +
          expectedProper
      );
    }

    const entityRegistry = properEntries.map((entry) =>
      buildEntityRegistryRecord(
        entry,
        entitiesByDStrong,
        concordance,
        historicalFrench
      )
    );
    assertUniqueRecords(entityRegistry, "entity-registry");
    const entityByKey = new Map(
      entityRegistry.map((record) => [record.entryKey, record])
    );

    const termbase = entries.map((entry) =>
      buildTermbaseCandidate(
        entry,
        fieldStatuses,
        historicalFrench,
        legacyByStrong,
        concordance,
        entityByKey
      )
    );
    assertUniqueRecords(termbase, "termbase-candidates");

    const morphology = morphologySource.map((row) => {
      const translated = buildFrenchMorphologyContent(row);
      const inputHash = contentHash(row);
      const withoutHashes = {
        schemaVersion: FRENCH_MORPHOLOGY_SCHEMA_VERSION,
        policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
        inputHash,
        ...translated
      };
      return {
        ...withoutHashes,
        contentHash: contentHash(withoutHashes)
      } satisfies MorphologyArtifactRecord;
    });
    assertUniqueMorphology(morphology);

    const outputDir = resolve(options.outputDir);
    const artifactContents = buildArtifactContents(
      generatedAt,
      sourceDigests.editorialGuide ?? "",
      entityRegistry,
      termbase,
      morphology
    );
    const artifactPaths = {
      bookRegistry: join(outputDir, "book-registry.json"),
      entityRegistry: join(outputDir, "entity-registry.jsonl"),
      termbaseCandidates: join(outputDir, "termbase-candidates.jsonl"),
      morphology: join(outputDir, "morphology-translations.jsonl")
    };
    const artifactRecordCounts = {
      bookRegistry: FRENCH_BOOK_REGISTRY.length,
      entityRegistry: entityRegistry.length,
      termbaseCandidates: termbase.length,
      morphology: morphology.length
    };
    const artifacts = Object.fromEntries(
      (Object.keys(artifactPaths) as Array<keyof typeof artifactPaths>).map(
        (key) => {
          const body = artifactContents[key];
          return [
            key,
            {
              path: artifactPaths[key],
              sha256: sha256Text(body),
              bytes: Buffer.byteLength(body),
              records: artifactRecordCounts[key]
            }
          ];
        }
      )
    ) as FrenchEditorialBuildSummary["artifacts"];

    const summaryWithoutHash = {
      schemaVersion: FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
      policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
      generatedAt,
      releaseKey,
      counts: {
        books: FRENCH_BOOK_REGISTRY.length,
        entries: entries.length,
        entityRegistry: entityRegistry.length,
        entityStatus: countStatuses(entityRegistry),
        termbaseCandidates: termbase.length,
        termbaseStatus: countStatuses(termbase),
        morphologyTranslations: morphology.length,
        morphologyScopes: countValues(morphology.map((row) => row.scope)),
        historicalFrenchCandidates: historicalFrench.size,
        legacyCandidates: termbase.filter((row) => row.legacyFrench !== null)
          .length,
        concordanceFormsAttached: termbase.reduce(
          (total, row) => total + row.concordanceForms.length,
          0
        )
      },
      sourceDigests,
      artifacts
    };
    const summary: FrenchEditorialBuildSummary = {
      ...summaryWithoutHash,
      summaryContentHash: contentHash(summaryWithoutHash)
    };
    validateSummary(
      summary,
      expectedEntries,
      expectedProper,
      expectedMorphology
    );

    const summaryPath = join(outputDir, "summary.json");
    const reportPath = resolve(options.report);
    const summaryBody = JSON.stringify(summary, null, 2) + "\n";
    const reportBody = renderReport(summary, summaryPath);

    await Promise.all([
      ...(Object.keys(artifactPaths) as Array<keyof typeof artifactPaths>).map(
        (key) => writeAtomic(artifactPaths[key], artifactContents[key])
      ),
      writeAtomic(summaryPath, summaryBody),
      writeAtomic(reportPath, reportBody)
    ]);
    return summary;
  } finally {
    core.close();
    historical.close();
    legacy.close();
    entities.close();
  }
}

function buildEntityRegistryRecord(
  entry: StepEntryRow,
  entitiesByDStrong: Map<string, EntitySourceRow[]>,
  concordance: Map<string, FrenchConcordanceForm[]>,
  historicalFrench: Map<number, HistoricalFrenchRow>
): EntityRegistryRecord {
  const primaryDStrong = requiredPrimaryDStrong(entry);
  const entryKey = buildLexiconEntryKey(entry.language, entry.dStrong);
  const matches = (entitiesByDStrong.get(primaryDStrong) ?? []).map((row) => ({
    entityId: row.entityId,
    significance: row.significance,
    aliasEn: row.aliasEn,
    entityEn: row.entityEn,
    candidateFr: row.entityFr,
    category: row.category,
    type: row.type
  }));
  const entityIds = uniqueSortedNumbers(matches.map((row) => row.entityId));
  const frenchCandidates = uniqueSorted(
    matches.map((row) => row.candidateFr.trim()).filter(Boolean)
  );
  const reasons: string[] = [];
  let status: FrenchEditorialStatus = "yellow";

  if (matches.length === 0) {
    status = "red";
    reasons.push("no-exact-dstrong-entity");
    if (entry.morph === "G:N-PRI") {
      reasons.push("reconstructed-lxx-name-without-tipnr-entity");
    }
  } else if (entityIds.length !== 1) {
    status = "red";
    reasons.push("multiple-exact-dstrong-entities");
  } else if (frenchCandidates.length !== 1) {
    status = "red";
    reasons.push("missing-or-ambiguous-entity-french-name");
  }

  const strictAlias =
    matches.length > 0 &&
    matches.every(
      (row) =>
        row.aliasEn === row.entityEn && row.aliasEn === entry.gloss.trim()
    );
  if (status !== "red" && !strictAlias) {
    reasons.push("entity-name-is-alias-title-gentilic-or-combined-form");
  }

  const classicalStrong = classicalStrongCode(entry.language, entry.baseCode);
  const candidateNormalized =
    frenchCandidates.length === 1
      ? normalizeFrenchEvidence(frenchCandidates[0] ?? "")
      : "";
  const referenceEvidence = (concordance.get(classicalStrong) ?? []).filter(
    (form) => form.normalized === candidateNormalized
  );
  const twoFamilies = referenceEvidence.some(
    (form) =>
      form.witnessFamilies.includes("Sg1910") &&
      form.witnessFamilies.includes("Darby-family")
  );
  if (status !== "red" && !twoFamilies) {
    reasons.push("canonical-name-not-attested-by-two-reference-families");
  }
  if (status !== "red" && strictAlias && twoFamilies) {
    status = "green";
    reasons.push("exact-entity-alias-and-two-family-french-attestation");
  }
  if (status === "yellow" && reasons.length === 0) {
    reasons.push("requires-editorial-adjudication");
  }

  const historical = historicalFrench.get(entry.id);
  const historicalCandidate = historical
    ? {
        gloss: historical.gloss,
        trust: "untrusted-candidate" as const,
        sourceHash: contentHash(historical)
      }
    : null;
  const input = {
    entry,
    matches,
    referenceEvidence,
    historicalCandidate
  };
  const withoutContentHash = {
    schemaVersion: FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    entryKey,
    stepEntryId: entry.id,
    identity: {
      language: entry.language,
      primaryDStrong,
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      morph: entry.morph
    },
    englishGloss: entry.gloss,
    status,
    canonicalFr: status === "green" ? (frenchCandidates[0] ?? null) : null,
    reasons: uniqueSorted(reasons),
    matches,
    referenceEvidence,
    historicalCandidate,
    inputHash: contentHash(input)
  };
  return {
    ...withoutContentHash,
    contentHash: contentHash(withoutContentHash)
  };
}

function buildTermbaseCandidate(
  entry: StepEntryRow,
  fieldStatuses: Map<number, Map<"gloss" | "meaning", EnglishFieldStatusRow>>,
  historicalFrench: Map<number, HistoricalFrenchRow>,
  legacyByStrong: Map<string, LegacyRow>,
  concordance: Map<string, FrenchConcordanceForm[]>,
  entityByKey: Map<string, EntityRegistryRecord>
): TermbaseCandidateRecord {
  const entryKey = buildLexiconEntryKey(entry.language, entry.dStrong);
  const primaryDStrong = requiredPrimaryDStrong(entry);
  const classicalStrong = classicalStrongCode(entry.language, entry.baseCode);
  const statuses = fieldStatuses.get(entry.id);
  const glossStatus = statuses?.get("gloss");
  const meaningStatus = statuses?.get("meaning");
  if (!glossStatus || !meaningStatus) {
    throw new Error("missing-current-english-field-status:" + entryKey);
  }
  const pos = classifyFrenchEditorialPos(entry.morph);
  const entity = entityByKey.get(entryKey);
  let status: FrenchEditorialStatus =
    pos === "proper-name" ? (entity?.status ?? "red") : "yellow";
  const reasons: string[] = [];
  if (pos === "proper-name") {
    reasons.push("status-derived-from-exact-entity-registry");
  } else {
    reasons.push("lexical-translation-requires-internal-agent-review");
  }
  if (pos === "unknown") {
    status = "red";
    reasons.push("unknown-or-missing-lexical-morphology");
  }
  if (THEOLOGICAL_REVIEW_BASE_STRONGS.has(classicalStrong)) {
    if (status === "green") status = "yellow";
    reasons.push("theological-or-tradition-sensitive-base-strong");
  }

  const historical = historicalFrench.get(entry.id);
  const historicalCandidate = historical
    ? {
        gloss: historical.gloss,
        meaning: historical.meaning,
        meaningHtml: historical.meaningHtml,
        trust: "untrusted-candidate" as const,
        sourceHash: contentHash(historical)
      }
    : null;
  if (!historicalCandidate) reasons.push("missing-historical-french-candidate");

  const legacy = legacyByStrong.get(classicalStrong);
  const legacyCandidate = legacy
    ? {
        gloss: legacy.lsg || legacy.mot,
        meaning: legacy.definition,
        type: legacy.type,
        trust: "untrusted-candidate" as const,
        evidenceScope: "classical-strong-only" as const,
        sourceHash: contentHash(legacy)
      }
    : null;
  const concordanceForms = (concordance.get(classicalStrong) ?? []).map(
    (form) => ({
      ...form,
      trust: "attested-carrier-review-only" as const,
      evidenceScope: "classical-strong-only" as const
    })
  );
  const deterministicRepairCandidate = buildVerbRepairCandidate(
    entry,
    pos,
    historicalCandidate?.gloss ?? ""
  );
  const canonicalFr =
    status === "green" && entity?.canonicalFr ? entity.canonicalFr : null;
  const input = {
    entry,
    glossStatus,
    meaningStatus,
    historicalCandidate,
    legacyCandidate,
    concordanceForms,
    entityContentHash: entity?.contentHash ?? null
  };
  const withoutContentHash = {
    schemaVersion: FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    entryKey,
    stepEntryId: entry.id,
    identity: {
      language: entry.language,
      primaryDStrong,
      classicalStrong,
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph
    },
    english: {
      gloss: entry.gloss,
      meaning: entry.meaning,
      glossStatusHash: glossStatus.contentHash,
      meaningStatusHash: meaningStatus.contentHash
    },
    pos,
    status,
    canonicalFr,
    reasons: uniqueSorted(reasons),
    historicalFrench: historicalCandidate,
    legacyFrench: legacyCandidate,
    concordanceForms,
    deterministicRepairCandidate,
    inputHash: contentHash(input)
  };
  return {
    ...withoutContentHash,
    contentHash: contentHash(withoutContentHash)
  };
}

function buildVerbRepairCandidate(
  entry: StepEntryRow,
  pos: FrenchEditorialPos,
  oldGloss: string
): TermbaseCandidateRecord["deterministicRepairCandidate"] {
  if (
    pos !== "verb" ||
    !/^to\s+/iu.test(entry.gloss.trim()) ||
    !/^pour\s+/iu.test(oldGloss.trim())
  ) {
    return null;
  }
  const gloss = oldGloss
    .trim()
    .replace(/^pour\s+/iu, "")
    .trim();
  if (!gloss || /[.!?;:]$/u.test(gloss)) return null;
  return {
    gloss,
    rule: "remove-pour-before-infinitive-candidate",
    trust: "untrusted-candidate"
  };
}

function buildArtifactContents(
  generatedAt: string,
  editorialGuideDigest: string,
  entityRegistry: EntityRegistryRecord[],
  termbase: TermbaseCandidateRecord[],
  morphology: MorphologyArtifactRecord[]
): Record<
  "bookRegistry" | "entityRegistry" | "termbaseCandidates" | "morphology",
  string
> {
  const books = FRENCH_BOOK_REGISTRY.map((book) => {
    const withoutHash = {
      schemaVersion: FRENCH_BOOK_REGISTRY_SCHEMA_VERSION,
      policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
      ...book
    };
    return { ...withoutHash, contentHash: contentHash(withoutHash) };
  });
  const bookEnvelopeWithoutHash = {
    schemaVersion: FRENCH_BOOK_REGISTRY_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    generatedAt,
    editorialGuideDigest,
    books
  };
  return {
    bookRegistry:
      JSON.stringify(
        {
          ...bookEnvelopeWithoutHash,
          contentHash: contentHash(bookEnvelopeWithoutHash)
        },
        null,
        2
      ) + "\n",
    entityRegistry: toJsonl(entityRegistry),
    termbaseCandidates: toJsonl(termbase),
    morphology: toJsonl(morphology)
  };
}

function readStepEntries(db: DatabaseSync): StepEntryRow[] {
  return db
    .prepare(
      `select id, language, baseCode, eStrong, dStrong, uStrong,
              original, transliteration, morph, gloss, meaning
       from StepEntries order by id`
    )
    .all() as unknown as StepEntryRow[];
}

function readEnglishFieldStatuses(
  db: DatabaseSync,
  releaseKey: string,
  entries: StepEntryRow[]
): Map<number, Map<"gloss" | "meaning", EnglishFieldStatusRow>> {
  const rows = db
    .prepare(
      `select stepEntryId, field, state, confidence, method, contentHash,
              releaseKey
       from LexiconFieldStatus
       where locale='en'
       order by stepEntryId, field`
    )
    .all() as unknown as EnglishFieldStatusRow[];
  const result = new Map<
    number,
    Map<"gloss" | "meaning", EnglishFieldStatusRow>
  >();
  for (const row of rows) {
    if (
      row.releaseKey !== releaseKey ||
      !/^[a-f0-9]{64}$/u.test(row.contentHash)
    ) {
      throw new Error("invalid-english-field-status:" + row.stepEntryId);
    }
    const fields = result.get(row.stepEntryId) ?? new Map();
    if (fields.has(row.field)) {
      throw new Error(
        "duplicate-english-field-status:" + row.stepEntryId + ":" + row.field
      );
    }
    fields.set(row.field, row);
    result.set(row.stepEntryId, fields);
  }
  for (const entry of entries) {
    const fields = result.get(entry.id);
    if (fields?.size !== 2 || !fields.has("gloss") || !fields.has("meaning")) {
      throw new Error("incomplete-english-field-status:" + entry.id);
    }
  }
  if (rows.length !== entries.length * 2) {
    throw new Error("unexpected-english-field-status-count:" + rows.length);
  }
  return result;
}

function readHistoricalFrench(
  db: DatabaseSync,
  currentEntries: StepEntryRow[],
  expectedCount: number
): Map<number, HistoricalFrenchRow> {
  const rows = db
    .prepare(
      `select se.id as stepEntryId, se.language, se.dStrong,
              t.gloss, t.meaning, t.meaningHtml
       from StepEntries se
       join LexiconTranslations t on t.stepEntryId=se.id
       where t.language='fr'
       order by se.id`
    )
    .all() as unknown as HistoricalFrenchRow[];
  if (rows.length !== expectedCount) {
    throw new Error(
      "historical-french-count-mismatch:" + rows.length + ":" + expectedCount
    );
  }
  const currentById = new Map(currentEntries.map((entry) => [entry.id, entry]));
  const result = new Map<number, HistoricalFrenchRow>();
  for (const row of rows) {
    const current = currentById.get(row.stepEntryId);
    if (
      !current ||
      row.language !== current.language ||
      extractPrimaryDStrong(row.dStrong) !== requiredPrimaryDStrong(current)
    ) {
      throw new Error("historical-french-identity-mismatch:" + row.stepEntryId);
    }
    if (!row.gloss.trim() || !row.meaning.trim() || !row.meaningHtml.trim()) {
      throw new Error("empty-historical-french-candidate:" + row.stepEntryId);
    }
    result.set(row.stepEntryId, row);
  }
  return result;
}

function readLegacyFrench(db: DatabaseSync): Map<string, LegacyRow> {
  const result = new Map<string, LegacyRow>();
  const tables: Array<["Grec" | "Hebreu", "G" | "H"]> = [
    ["Grec", "G"],
    ["Hebreu", "H"]
  ];
  for (const [table, prefix] of tables) {
    const rows = db
      .prepare(
        `select Code as code, Mot as mot, Type as type, LSG as lsg,
                Definition as definition
         from ${table} where Code > 0 order by Code`
      )
      .all() as unknown as LegacyRow[];
    for (const row of rows) {
      result.set(prefix + String(row.code).padStart(4, "0"), row);
    }
  }
  return result;
}

function readEntitySources(db: DatabaseSync): Map<string, EntitySourceRow[]> {
  const rows = db
    .prepare(
      `select n.dStrong, n.entityId, n.significance,
              n.displayName as aliasEn, e.displayName as entityEn,
              coalesce(t.displayName, '') as entityFr,
              e.category, e.type
       from EntityNames n
       join Entities e on e.id=n.entityId
       left join EntityTranslations t
         on t.entityId=e.id and t.language='fr'
       order by n.dStrong collate binary, n.entityId, n.significance,
                n.displayName`
    )
    .all() as unknown as EntitySourceRow[];
  const result = new Map<string, EntitySourceRow[]>();
  for (const row of rows) {
    const list = result.get(row.dStrong) ?? [];
    list.push(row);
    result.set(row.dStrong, list);
  }
  return result;
}

function readMorphologyCodes(db: DatabaseSync): MorphologyCodeSourceRow[] {
  return db
    .prepare(
      `select id, code, normalizedCode, language, scope, example, meaning,
              description, source
       from MorphologyCodes order by id`
    )
    .all() as unknown as MorphologyCodeSourceRow[];
}

function validateEntryIdentities(entries: StepEntryRow[]): void {
  const ids = new Set<number>();
  const keys = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id))
      throw new Error("duplicate-step-entry-id:" + entry.id);
    ids.add(entry.id);
    const key = buildLexiconEntryKey(entry.language, entry.dStrong);
    if (keys.has(key)) throw new Error("duplicate-step-entry-key:" + key);
    keys.add(key);
    if (!entry.gloss.trim() || !entry.meaning.trim()) {
      throw new Error("empty-current-english-content:" + key);
    }
  }
}

function requiredPrimaryDStrong(entry: StepEntryRow): string {
  const value = extractPrimaryDStrong(entry.dStrong);
  if (!value) throw new Error("missing-primary-dstrong:" + entry.id);
  return value;
}

function openValidatedDatabase(
  path: string,
  requiredTables: string[]
): DatabaseSync {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = db.prepare("pragma integrity_check").get() as
      | Record<string, unknown>
      | undefined;
    if (!integrity || Object.values(integrity)[0] !== "ok") {
      throw new Error("sqlite-integrity-failed:" + path);
    }
    const present = new Set(
      (
        db
          .prepare("select name from sqlite_master where type='table'")
          .all() as unknown as Array<{ name: string }>
      ).map((row) => row.name)
    );
    for (const table of requiredTables) {
      if (!present.has(table))
        throw new Error("missing-table:" + path + ":" + table);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function readRequiredMeta(db: DatabaseSync, key: string): string {
  const row = db
    .prepare("select value from DictionaryMeta where key=?")
    .get(key) as { value?: string } | undefined;
  const value = row?.value?.trim() ?? "";
  if (!value) throw new Error("missing-required-dictionary-meta:" + key);
  return value;
}

async function readRequiredStrongRows(
  path: string,
  label: string
): Promise<StrongRow[]> {
  const rows = await readStrongCsv(path);
  if (rows.length === 0) throw new Error("empty-strong-witness:" + label);
  return rows;
}

function validateEditorialGuide(guide: EditorialGuide): void {
  if (
    guide.schemaVersion !== "lexicon-v3-french-editorial-guide@1" ||
    guide.locale !== "fr" ||
    !guide.releaseRule?.trim()
  ) {
    throw new Error("invalid-french-editorial-guide");
  }
}

function validateSummary(
  summary: FrenchEditorialBuildSummary,
  expectedEntries: number,
  expectedProper: number,
  expectedMorphology: number
): void {
  if (
    summary.counts.books !== 66 ||
    summary.counts.entries !== expectedEntries ||
    summary.counts.entityRegistry !== expectedProper ||
    summary.counts.termbaseCandidates !== expectedEntries ||
    summary.counts.morphologyTranslations !== expectedMorphology ||
    summary.counts.historicalFrenchCandidates !== expectedEntries
  ) {
    throw new Error("french-editorial-summary-gate-failed");
  }
  const entityStatuses = Object.values(summary.counts.entityStatus).reduce(
    (total, count) => total + count,
    0
  );
  const termStatuses = Object.values(summary.counts.termbaseStatus).reduce(
    (total, count) => total + count,
    0
  );
  if (entityStatuses !== expectedProper || termStatuses !== expectedEntries) {
    throw new Error("french-editorial-status-count-gate-failed");
  }
  if (!/^[a-f0-9]{64}$/u.test(summary.summaryContentHash)) {
    throw new Error("invalid-french-editorial-summary-hash");
  }
}

function renderReport(
  summary: FrenchEditorialBuildSummary,
  summaryPath: string
): string {
  const sources = Object.entries(summary.sourceDigests)
    .map(([source, hash]) => "| " + source + " | `" + hash + "` |")
    .join("\n");
  const artifacts = Object.entries(summary.artifacts)
    .map(
      ([name, artifact]) =>
        "| " +
        name +
        " | " +
        artifact.records +
        " | " +
        artifact.bytes +
        " | `" +
        artifact.sha256 +
        "` |"
    )
    .join("\n");
  return `# Artefacts éditoriaux français du lexique v3

Généré : ${summary.generatedAt}

- Release anglaise : \`${summary.releaseKey}\`
- Politique : \`${summary.policyVersion}\`
- Résumé : \`${summaryPath}\`
- Hash logique du résumé : \`${summary.summaryContentHash}\`
- Les traductions historiques et legacy restent exclusivement des candidats non fiables.
- Les concordances françaises portent sur le Strong classique et ne prouvent jamais seules un sous-STEP.

## Comptes

| Élément | Nombre |
| --- | ---: |
| Livres | ${summary.counts.books} |
| Entrées anglaises | ${summary.counts.entries} |
| Entités green | ${summary.counts.entityStatus.green} |
| Entités yellow | ${summary.counts.entityStatus.yellow} |
| Entités red | ${summary.counts.entityStatus.red} |
| Candidats de termbase | ${summary.counts.termbaseCandidates} |
| Morphologies françaises | ${summary.counts.morphologyTranslations} |
| Candidats FR historiques | ${summary.counts.historicalFrenchCandidates} |
| Candidats legacy | ${summary.counts.legacyCandidates} |
| Formes de concordance attachées | ${summary.counts.concordanceFormsAttached} |

## Artefacts

| Artefact | Enregistrements | Octets | SHA-256 |
| --- | ---: | ---: | --- |
${artifacts}

## Sources

| Source | SHA-256 |
| --- | --- |
${sources}
`;
}

function countStatuses(
  rows: Array<{ status: FrenchEditorialStatus }>
): Record<FrenchEditorialStatus, number> {
  const result: Record<FrenchEditorialStatus, number> = {
    green: 0,
    yellow: 0,
    red: 0
  };
  for (const row of rows) result[row.status] += 1;
  return result;
}

function countValues(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function assertUniqueRecords(
  rows: Array<{ entryKey: string; contentHash: string }>,
  label: string
): void {
  const keys = new Set<string>();
  for (const row of rows) {
    if (keys.has(row.entryKey))
      throw new Error("duplicate-" + label + ":" + row.entryKey);
    if (!/^[a-f0-9]{64}$/u.test(row.contentHash)) {
      throw new Error("invalid-content-hash:" + label + ":" + row.entryKey);
    }
    keys.add(row.entryKey);
  }
}

function assertUniqueMorphology(rows: MorphologyArtifactRecord[]): void {
  const keys = new Set<string>();
  for (const row of rows) {
    const key = row.source + "\u0000" + row.scope + "\u0000" + row.code;
    if (keys.has(key)) throw new Error("duplicate-french-morphology:" + key);
    keys.add(key);
  }
}

function assertPositiveExpectedCount(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("invalid-expected-" + label + ":" + value);
  }
}

function toJsonl(rows: unknown[]): string {
  return rows.map((row) => stableJson(row)).join("\n") + "\n";
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  const temporary =
    absolute + ".tmp-" + process.pid + "-" + contentHash(absolute);
  await rm(temporary, { force: true });
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, absolute);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function sha256File(path: string): Promise<string> {
  return await new Promise<string>((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueSortedNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function parseFrenchEditorialAssetsArgs(
  args: readonly string[]
): BuildFrenchEditorialAssetsOptions {
  const allowed = new Set([
    "core-db",
    "historical-db",
    "legacy-db",
    "entities-db",
    "sg1910",
    "darby",
    "darby-r",
    "guide",
    "output-dir",
    "report",
    "expected-entries",
    "expected-proper",
    "expected-morphology",
    "generated-at"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected-argument:${arg}`);
    }
    const [key, inline] = arg.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) throw new Error(`missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else throw new Error(`missing-value:${key}`);
  }
  return {
    coreDatabase: resolve(values.get("core-db") ?? DEFAULT_CORE),
    historicalDatabase: resolve(
      values.get("historical-db") ?? DEFAULT_HISTORICAL
    ),
    legacyDatabase: resolve(values.get("legacy-db") ?? DEFAULT_LEGACY),
    entitiesDatabase: resolve(values.get("entities-db") ?? DEFAULT_ENTITIES),
    sg1910: resolve(values.get("sg1910") ?? DEFAULT_SG1910),
    darby: resolve(values.get("darby") ?? DEFAULT_DARBY),
    darbyR: resolve(values.get("darby-r") ?? DEFAULT_DARBY_R),
    editorialGuide: resolve(values.get("guide") ?? DEFAULT_GUIDE),
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    report: resolve(values.get("report") ?? DEFAULT_REPORT),
    expectedEntryCount: parseOptionalPositiveInt(
      values.get("expected-entries")
    ),
    expectedProperEntryCount: parseOptionalPositiveInt(
      values.get("expected-proper")
    ),
    expectedMorphologyCount: parseOptionalPositiveInt(
      values.get("expected-morphology")
    ),
    generatedAt: values.get("generated-at")
  };
}

function parseOptionalPositiveInt(
  value: string | undefined
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("invalid-positive-integer:" + value);
  }
  return parsed;
}

async function main(): Promise<void> {
  const summary = await runBuildFrenchEditorialAssets(
    parseFrenchEditorialAssetsArgs(process.argv.slice(2))
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
      basename(process.argv[1] ?? "buildLexiconV3FrenchEditorialAssets") +
        ": " +
        message
    );
    process.exitCode = 1;
  });
}
