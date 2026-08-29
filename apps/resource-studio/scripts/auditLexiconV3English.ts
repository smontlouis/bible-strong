import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_PATH,
  renderEnglishEvidenceAuditReport,
  summarizeEnglishEvidenceAudit,
  verifyEnglishGreekReconstructionCatalog,
  type EnglishEvidenceSourceDigests,
  type EnglishGreekReconstructionCatalog,
  type EnglishLexiconEntry,
  type EnglishLexiconResource
} from "../src/lexiconV3/evidence.js";
import {
  GREEK_RECONSTRUCTION_SOURCE_DIGESTS,
  PINNED_G0001H_PERSEUS_ARTIFACT_PATH,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_PATH,
  verifyPinnedG0001HPerseusArtifact,
  verifyPinnedG20464InternalAdjudicationArtifact
} from "../src/lexiconV3/greekReconstruction.js";
import { buildEnglishSemanticGlossSourceLines } from "../src/lexiconV3/englishSemanticGlossAttestations.js";
import { assertNoForeignFullMeaningSuffixes } from "../src/lexiconV3/englishMeaningContamination.js";
import { buildEnglishSupplementalGlossAuditWitnessContext } from "../src/lexiconV3/englishSupplementalGlossAudit.js";
import {
  buildLexiconEntryKey,
  extractPrimaryDStrong
} from "../src/lexiconV3/identity.js";
import { readStepOriginalTokens } from "../src/stepOriginals.js";

const DEFAULT_DB = "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/english-audit.jsonl";
const DEFAULT_SUMMARY_JSON = "outputs/lexicon-v3/english-audit.summary.json";
const DEFAULT_REPORT = "outputs/lexicon-v3/english-audit.summary.md";
const STEP_ROOT = "data/external/stepbible";
const TIPNR_PEOPLE = "data/external/stepbible/tipnr-json/people.json";
const LEGACY_DB = "data/dictionaries/strong.legacy.sqlite";
const KAIKKI_FRENCH =
  "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl";
const TAGNT_FILES = [
  "amalgamated/TAGNT Act-Rev.txt",
  "amalgamated/TAGNT Mat-Jhn.txt"
] as const;
const TAHOT_FILES = [
  "amalgamated/TAHOT Gen-Deu.txt",
  "amalgamated/TAHOT Isa-Mal.txt",
  "amalgamated/TAHOT Job-Sng.txt",
  "amalgamated/TAHOT Jos-Est.txt"
] as const;

interface CliOptions {
  db: string;
  output: string;
  summaryJson: string;
  report: string;
  limit: number | null;
  only: Set<string>;
}

async function main(): Promise<void> {
  const options = parseLexiconV3EnglishAuditArgs(process.argv.slice(2));
  const requiredLexiconFiles = ["TBESG.txt", "TBESH.txt", "TFLSJ.txt"].map(
    (name) => resolve(STEP_ROOT, name)
  );
  const tagntFiles = TAGNT_FILES.map((name) => resolve(STEP_ROOT, name));
  const tahotFiles = TAHOT_FILES.map((name) => resolve(STEP_ROOT, name));
  const witnessCatalogPath = resolve(
    PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_PATH
  );
  const tipnrPeoplePath = resolve(TIPNR_PEOPLE);
  const legacyDbPath = resolve(LEGACY_DB);
  const perseusArtifactPath = resolve(PINNED_G0001H_PERSEUS_ARTIFACT_PATH);
  const g20464AdjudicationArtifactPath = resolve(
    PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_PATH
  );
  const kaikkiFrenchPath = resolve(KAIKKI_FRENCH);
  assertRequiredFiles([
    options.db,
    ...requiredLexiconFiles,
    ...tagntFiles,
    ...tahotFiles,
    witnessCatalogPath,
    tipnrPeoplePath,
    legacyDbPath,
    perseusArtifactPath,
    g20464AdjudicationArtifactPath,
    kaikkiFrenchPath
  ]);

  const catalogValue = readJsonFile(witnessCatalogPath);
  const initialCatalogVerification =
    verifyEnglishGreekReconstructionCatalog(catalogValue);
  if (
    !initialCatalogVerification.valid ||
    !initialCatalogVerification.catalog
  ) {
    throw new Error(
      `invalid-greek-reconstruction-witness-catalog:${initialCatalogVerification.issues.join(",")}`
    );
  }
  const greekReconstructionCatalog = initialCatalogVerification.catalog;
  const perseusVerification = verifyPinnedG0001HPerseusArtifact(
    readJsonFile(perseusArtifactPath)
  );
  if (!perseusVerification.valid) {
    throw new Error(
      `invalid-pinned-perseus-artifact:${perseusVerification.reasonCodes.join(",")}`
    );
  }
  const g20464AdjudicationVerification =
    verifyPinnedG20464InternalAdjudicationArtifact(
      readJsonFile(g20464AdjudicationArtifactPath)
    );
  if (!g20464AdjudicationVerification.valid) {
    throw new Error(
      `invalid-pinned-g20464-internal-adjudication:${g20464AdjudicationVerification.reasonCodes.join(",")}`
    );
  }

  const db = new DatabaseSync(options.db, { readOnly: true });
  try {
    assertRequiredDatabaseTables(db);
    const metadataDigests = readMetadataDigests(db);
    const sourceDigests = await buildSourceDigests({
      dbPath: options.db,
      tagntFiles,
      tahotFiles,
      witnessCatalogPath,
      tipnrPeoplePath,
      legacyDbPath,
      perseusArtifactPath,
      g20464AdjudicationArtifactPath,
      kaikkiFrenchPath,
      greekReconstructionCatalog,
      perseusArtifactDigest: perseusVerification.artifactDigest,
      g20464AdjudicationArtifactDigest:
        g20464AdjudicationVerification.artifactDigest,
      g20464AdjudicationPayloadDigest:
        g20464AdjudicationVerification.payloadDigest!
    });
    verifyDatabaseSourceDigests(metadataDigests, sourceDigests);
    const catalogVerification = verifyEnglishGreekReconstructionCatalog(
      greekReconstructionCatalog,
      sourceDigests
    );
    if (!catalogVerification.valid) {
      throw new Error(
        `greek-reconstruction-source-gate-failed:${catalogVerification.issues.join(",")}`
      );
    }

    const allEntries = readEntries(db);
    const resources = readResources(db);
    if (resources.length === 0) {
      throw new Error("missing-required-tflsj-resources");
    }
    const filteredEntries = selectEntries(allEntries, options);
    const supplementalGlossSourceTexts = {
      TBESG: readFileSync(resolve(STEP_ROOT, "TBESG.txt"), "utf8"),
      TFLSJ: readFileSync(resolve(STEP_ROOT, "TFLSJ.txt"), "utf8")
    } as const;
    const supplementalGlossWitnessContext =
      buildEnglishSupplementalGlossAuditWitnessContext(
        supplementalGlossSourceTexts
      );
    const tokens = [];
    for (const filePath of [...tagntFiles, ...tahotFiles]) {
      tokens.push(...(await readStepOriginalTokens(filePath)));
    }
    if (tokens.length === 0)
      throw new Error("missing-step-original-token-evidence");

    const context = buildEnglishEvidenceContext({
      entries: allEntries,
      tokens,
      sourceDigests,
      semanticGlossSourceLines: buildEnglishSemanticGlossSourceLines({
        TBESG: supplementalGlossSourceTexts.TBESG,
        TFLSJ: supplementalGlossSourceTexts.TFLSJ
      }),
      greekReconstructionCatalog
    });
    const resourcesByEntry = groupResourcesByEntry(resources);
    const records = filteredEntries.map((entry) =>
      auditEnglishEvidenceEntry(
        entry,
        resourcesByEntry.get(entry.stepEntryId) ?? [],
        context
      )
    );
    assertNoForeignFullMeaningSuffixes(records);
    const summary = summarizeEnglishEvidenceAudit(
      records,
      allEntries.length,
      sourceDigests
    );

    writeText(
      options.output,
      records.map((record) => JSON.stringify(record)).join("\n") +
        (records.length > 0 ? "\n" : "")
    );
    writeText(options.summaryJson, `${JSON.stringify(summary, null, 2)}\n`);
    writeText(options.report, renderEnglishEvidenceAuditReport(summary));

    console.log(
      JSON.stringify(
        {
          output: resolve(options.output),
          summaryJson: resolve(options.summaryJson),
          report: resolve(options.report),
          tokens: tokens.length,
          supplementalGlossWitnessReplay: {
            catalogDigest: supplementalGlossWitnessContext.catalogDigest,
            ruleSetDigest: supplementalGlossWitnessContext.ruleSetDigest,
            entryCount: supplementalGlossWitnessContext.entryCount,
            witnessCount: supplementalGlossWitnessContext.witnessCount,
            uniqueLocatorCount:
              supplementalGlossWitnessContext.uniqueLocatorCount,
            fragmentCount: supplementalGlossWitnessContext.fragmentCount,
            witnessCorpusDigest:
              supplementalGlossWitnessContext.witnessCorpusDigest,
            replayDigest: supplementalGlossWitnessContext.replayDigest
          },
          ...summary
        },
        null,
        2
      )
    );
  } finally {
    db.close();
  }
}

export function parseLexiconV3EnglishAuditArgs(
  args: readonly string[]
): CliOptions {
  const allowed = new Set([
    "db",
    "output",
    "summary-json",
    "report",
    "limit",
    "only"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected-argument:${arg}`);
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (!allowed.has(rawKey)) throw new Error(`unknown-option:${rawKey}`);
    if (values.has(rawKey)) throw new Error(`duplicate-option:${rawKey}`);
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`missing-value:${rawKey}`);
      values.set(rawKey, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    } else {
      throw new Error(`missing-value:${rawKey}`);
    }
  }

  const limitValue = values.get("limit");
  const limit = limitValue ? Number(limitValue) : null;
  if (
    limit !== null &&
    (!/^[1-9]\d*$/u.test(limitValue ?? "") ||
      !Number.isSafeInteger(limit) ||
      limit < 1)
  ) {
    throw new Error(`invalid-limit:${limitValue}`);
  }
  const only = new Set(
    (values.get("only") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return {
    db: resolve(values.get("db") ?? DEFAULT_DB),
    output: values.get("output") ?? DEFAULT_OUTPUT,
    summaryJson: values.get("summary-json") ?? DEFAULT_SUMMARY_JSON,
    report: values.get("report") ?? DEFAULT_REPORT,
    limit,
    only
  };
}

function assertRequiredFiles(paths: string[]): void {
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`missing-required-sources:${missing.join(",")}`);
  }
}

function assertRequiredDatabaseTables(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `select name from sqlite_master where type='table' and name in ('StepEntries','LexiconResources','DictionaryMeta')`
    )
    .all() as Array<{ name: string }>;
  const names = new Set(rows.map((row) => row.name));
  const missing = ["StepEntries", "LexiconResources", "DictionaryMeta"].filter(
    (name) => !names.has(name)
  );
  if (missing.length > 0) {
    throw new Error(`missing-required-database-tables:${missing.join(",")}`);
  }
}

function readEntries(db: DatabaseSync): EnglishLexiconEntry[] {
  return db
    .prepare(
      `select id as stepEntryId, language, baseCode, eStrong, dStrong, uStrong,
              original, transliteration, morph, gloss, meaning,
              classicTransliteration, pronunciation
       from StepEntries
       order by language, baseCode, eStrong, dStrong, uStrong`
    )
    .all() as unknown as EnglishLexiconEntry[];
}

function readResources(db: DatabaseSync): EnglishLexiconResource[] {
  return db
    .prepare(
      `select id as resourceId, stepEntryId, source, kind, contentHtml
       from LexiconResources
       where source = 'TFLSJ'
       order by stepEntryId, id`
    )
    .all() as unknown as EnglishLexiconResource[];
}

function readMetadataDigests(db: DatabaseSync): Record<string, string> {
  const row = db
    .prepare(`select value from DictionaryMeta where key='sourceDigests'`)
    .get() as { value?: string } | undefined;
  if (!row?.value) throw new Error("missing-database-source-digests");
  const parsed = JSON.parse(row.value) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed).filter((item): item is [string, string] =>
      Boolean(typeof item[1] === "string")
    )
  );
}

async function buildSourceDigests(input: {
  dbPath: string;
  tagntFiles: string[];
  tahotFiles: string[];
  witnessCatalogPath: string;
  tipnrPeoplePath: string;
  legacyDbPath: string;
  perseusArtifactPath: string;
  g20464AdjudicationArtifactPath: string;
  kaikkiFrenchPath: string;
  greekReconstructionCatalog: EnglishGreekReconstructionCatalog;
  perseusArtifactDigest: string;
  g20464AdjudicationArtifactDigest: string;
  g20464AdjudicationPayloadDigest: string;
}): Promise<EnglishEvidenceSourceDigests> {
  const [
    database,
    TBESG,
    TBESH,
    TFLSJ,
    tagntDigests,
    tahotDigests,
    witnessCatalogFile,
    tipnrPeople,
    legacyDatabase,
    perseusArtifactFile,
    g20464AdjudicationArtifactFile,
    kaikkiFrench
  ] = await Promise.all([
    sha256File(input.dbPath),
    sha256File(resolve(STEP_ROOT, "TBESG.txt")),
    sha256File(resolve(STEP_ROOT, "TBESH.txt")),
    sha256File(resolve(STEP_ROOT, "TFLSJ.txt")),
    Promise.all(input.tagntFiles.map(sha256File)),
    Promise.all(input.tahotFiles.map(sha256File)),
    sha256File(input.witnessCatalogPath),
    sha256File(input.tipnrPeoplePath),
    sha256File(input.legacyDbPath),
    sha256File(input.perseusArtifactPath),
    sha256File(input.g20464AdjudicationArtifactPath),
    sha256File(input.kaikkiFrenchPath)
  ]);
  return {
    database,
    TBESG,
    TBESH,
    TFLSJ,
    TAGNT: Object.fromEntries(
      input.tagntFiles.map((path, index) => [
        basename(path),
        tagntDigests[index]!
      ])
    ),
    TAHOT: Object.fromEntries(
      input.tahotFiles.map((path, index) => [
        basename(path),
        tahotDigests[index]!
      ])
    ),
    greekReconstruction: {
      witnessCatalog: input.greekReconstructionCatalog.catalogDigest,
      witnessCatalogFile,
      tipnrPeople,
      legacyDatabase,
      perseusArtifact: input.perseusArtifactDigest,
      perseusArtifactFile,
      perseusSourceFile: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.perseusLsj,
      g20464AdjudicationArtifact: input.g20464AdjudicationArtifactDigest,
      g20464AdjudicationArtifactFile,
      g20464AdjudicationPayload: input.g20464AdjudicationPayloadDigest,
      kaikkiFrench
    }
  };
}

function verifyDatabaseSourceDigests(
  metadata: Record<string, string>,
  actual: EnglishEvidenceSourceDigests
): void {
  const expected = {
    "TBESG.txt": actual.TBESG,
    "TBESH.txt": actual.TBESH,
    "TFLSJ.txt": actual.TFLSJ
  };
  for (const [name, digest] of Object.entries(expected)) {
    if (!metadata[name])
      throw new Error(`missing-database-source-digest:${name}`);
    if (metadata[name] !== digest) {
      throw new Error(
        `database-source-digest-mismatch:${name}:${metadata[name]}:${digest}`
      );
    }
  }
}

function selectEntries(
  entries: EnglishLexiconEntry[],
  options: CliOptions
): EnglishLexiconEntry[] {
  let selected = entries;
  if (options.only.size > 0) {
    selected = selected.filter((entry) => {
      const key = buildLexiconEntryKey(entry.language, entry.dStrong);
      const dStrong = extractPrimaryDStrong(entry.dStrong) ?? "";
      return [...options.only].some((value) => {
        const normalized = value.toUpperCase();
        return (
          value === key ||
          value === String(entry.stepEntryId) ||
          normalized === entry.eStrong.toUpperCase() ||
          normalized === dStrong.toUpperCase()
        );
      });
    });
  }
  return options.limit === null ? selected : selected.slice(0, options.limit);
}

function groupResourcesByEntry(
  resources: EnglishLexiconResource[]
): Map<number, EnglishLexiconResource[]> {
  const grouped = new Map<number, EnglishLexiconResource[]>();
  for (const resource of resources) {
    const target = grouped.get(resource.stepEntryId) ?? [];
    target.push(resource);
    grouped.set(resource.stepEntryId, target);
  }
  return grouped;
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, content);
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

async function sha256File(path: string): Promise<string> {
  return await new Promise<string>((resolveDigest, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveDigest(hash.digest("hex")));
  });
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${basename(process.argv[1] ?? "auditLexiconV3English")}: ${message}`
    );
    process.exitCode = 1;
  });
}
