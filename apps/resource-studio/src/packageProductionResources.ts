import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { execFile } from "node:child_process";

import { DEFAULT_KAIKKI_FRENCH_JSONL } from "./frenchLemmaPilot.js";
import { JSONL_BIBLE_SOURCES } from "./jsonlBibleViewer.js";
import {
  compileStrongBibleJsonlToSqlite,
  STRONG_BIBLE_SQLITE_SCHEMA_VERSION,
  verifyStrongBibleSqlite,
  type StrongBibleSqliteSummary
} from "./strongBibleSqlite.js";

export const PRODUCTION_RESOURCE_RELEASE_SCHEMA_VERSION = 5;
export const DEFAULT_PRODUCTION_RESOURCE_RELEASE =
  "outputs/releases/bible-strong-production-v5";

const SHARED_RESOURCES = [
  {
    id: "lexicon",
    label: "Lexique STEP anglais-français",
    source: "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite",
    destination: "lexicon/strong-lexicon.sqlite",
    requiredTables: [
      "StepEntries",
      "StepEntryIdentities",
      "LexiconTranslations"
    ]
  },
  {
    id: "entities",
    label: "Entités bibliques STEP",
    source: "data/entities/bible_entities.production.sqlite",
    destination: "entities/bible-entities.sqlite",
    requiredTables: ["Entities", "EntityNames", "EntityRelations"]
  },
  {
    id: "step-original-occurrences",
    label: "Occurrences originales STEP",
    source: "data/dictionaries/strong_lexicon.occurrences.production.sqlite",
    destination: "optional/step-original-occurrences.sqlite",
    requiredTables: ["Occurrences", "OccurrenceMorphology", "OccurrenceStats"]
  }
] as const;
const execFileAsync = promisify(execFile);

export interface ProductionResourceCatalog {
  schemaVersion: number;
  format: "bible-strong-production-resources";
  generatedAt: string;
  bibles: Array<{
    id: string;
    label: string;
    version: string;
    sourceView: "reader" | "permissive";
    file: string;
    sha256: string;
    sizeBytes: number;
    sourceSha256: string;
    verseCount: number;
    occurrenceCount: number;
    identityCount: number;
    noteCount: number;
    lexemeAssignmentCount: number;
    lexemeCount: number;
    lemmaCoveragePercent: number;
    previousSizeBytes?: number;
    savedBytes?: number;
    reductionPercent?: number;
  }>;
  resources: Array<{
    id: string;
    label: string;
    file: string;
    sha256: string;
    sizeBytes: number;
    optional: boolean;
  }>;
}

export async function packageProductionResources(
  options: {
    root?: string;
    outputDir?: string;
    generatedAt?: string;
  } = {}
): Promise<{
  outputDir: string;
  catalogPath: string;
  catalogSha256: string;
  bibleCount: number;
  totalSizeBytes: number;
}> {
  const root = path.resolve(options.root ?? process.cwd());
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_PRODUCTION_RESOURCE_RELEASE
  );
  if (existsSync(outputDir)) {
    throw new Error(`production-resource-release-already-exists:${outputDir}`);
  }
  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  await mkdir(path.join(temporaryDir, "bibles"), { recursive: true });
  const bibleEntries: ProductionResourceCatalog["bibles"] = [];
  const resourceEntries: ProductionResourceCatalog["resources"] = [];

  try {
    const compiledBibles: Array<{
      source: (typeof JSONL_BIBLE_SOURCES)[number];
      file: string;
      summary: StrongBibleSqliteSummary;
    }> = [];
    for (const source of JSONL_BIBLE_SOURCES) {
      const inputPath = path.resolve(root, source.relativePath);
      const file = `bibles/bible-${source.id.toLowerCase()}-strong.sqlite`;
      const summary = await compileStrongBibleJsonlToSqlite({
        inputPath,
        outputPath: path.join(temporaryDir, file),
        datasetId: source.id,
        expectedVersion: source.sourceVersion
      });
      compiledBibles.push({ source, file, summary });
    }

    const lemmaEnrichments = [];
    for (const { source, file } of compiledBibles.filter(({ source }) =>
      source.relativePath.includes("permissive")
    )) {
      lemmaEnrichments.push(
        await enrichGeneratedBibleLemmas({
          root,
          temporaryDir,
          datasetId: source.id,
          file
        })
      );
    }
    await writeJson(
      path.join(temporaryDir, "manifests", "generated-french-lemmas.json"),
      {
        format: "generated-french-lemma-manifest",
        version: PRODUCTION_RESOURCE_RELEASE_SCHEMA_VERSION,
        enrichments: lemmaEnrichments
      }
    );

    for (const compiled of compiledBibles) {
      const { source, file } = compiled;
      const outputPath = path.join(temporaryDir, file);
      const verification = verifyStrongBibleSqlite({
        sqlitePath: outputPath,
        expectedDatasetId: source.id,
        expectedVersion: source.sourceVersion,
        expectedSourceSha256: compiled.summary.sourceSha256
      });
      const outputStats = await stat(outputPath);
      const summary: StrongBibleSqliteSummary = {
        ...compiled.summary,
        ...verification,
        outputSha256: await sha256File(outputPath),
        outputBytes: outputStats.size
      };
      const previousPath = path.resolve(
        root,
        "outputs/releases/bible-strong-production-v4",
        file
      );
      const previousSizeBytes = existsSync(previousPath)
        ? (await stat(previousPath)).size
        : undefined;
      bibleEntries.push({
        id: source.id,
        label: source.label,
        version: source.sourceVersion,
        sourceView: source.relativePath.includes("permissive")
          ? "permissive"
          : "reader",
        file,
        sha256: summary.outputSha256,
        sizeBytes: summary.outputBytes,
        sourceSha256: summary.sourceSha256,
        verseCount: summary.verseCount,
        occurrenceCount: summary.occurrenceCount,
        identityCount: summary.identityCount,
        noteCount: summary.noteCount,
        lexemeAssignmentCount: summary.lexemeAssignmentCount,
        lexemeCount: summary.lexemeCount,
        lemmaCoveragePercent: Number(
          (
            (summary.lexemeAssignmentCount / summary.occurrenceCount) *
            100
          ).toFixed(2)
        ),
        ...(previousSizeBytes === undefined
          ? {}
          : {
              previousSizeBytes,
              savedBytes: previousSizeBytes - summary.outputBytes,
              reductionPercent: Number(
                (
                  ((previousSizeBytes - summary.outputBytes) /
                    previousSizeBytes) *
                  100
                ).toFixed(2)
              )
            })
      });
      await writeJson(
        path.join(temporaryDir, "manifests", `${source.id.toLowerCase()}.json`),
        bibleManifest(source.id, summary)
      );
    }

    for (const resource of SHARED_RESOURCES) {
      const sourcePath = path.resolve(root, resource.source);
      if (!existsSync(sourcePath)) {
        throw new Error(`production-resource-missing:${resource.id}`);
      }
      verifySharedSqlite(sourcePath, resource.requiredTables);
      const destinationPath = path.join(temporaryDir, resource.destination);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
      verifySharedSqlite(destinationPath, resource.requiredTables);
      const [sha256, fileStats] = await Promise.all([
        sha256File(destinationPath),
        stat(destinationPath)
      ]);
      resourceEntries.push({
        id: resource.id,
        label: resource.label,
        file: resource.destination,
        sha256,
        sizeBytes: fileStats.size,
        optional: resource.id === "step-original-occurrences"
      });
    }

    const catalog: ProductionResourceCatalog = {
      schemaVersion: PRODUCTION_RESOURCE_RELEASE_SCHEMA_VERSION,
      format: "bible-strong-production-resources",
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      bibles: bibleEntries,
      resources: resourceEntries
    };
    const catalogPath = path.join(temporaryDir, "catalog.json");
    await writeJson(catalogPath, catalog);
    await writeChecksums(temporaryDir, catalog);
    const catalogSha256 = await sha256File(catalogPath);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return {
      outputDir,
      catalogPath: path.join(outputDir, "catalog.json"),
      catalogSha256,
      bibleCount: bibleEntries.length,
      totalSizeBytes: [...bibleEntries, ...resourceEntries].reduce(
        (total, entry) => total + entry.sizeBytes,
        0
      )
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

async function enrichGeneratedBibleLemmas(options: {
  root: string;
  temporaryDir: string;
  datasetId: string;
  file: string;
}): Promise<Record<string, unknown>> {
  const source = path.join(options.temporaryDir, options.file);
  const output = `${source}.contextual`;
  const reportPath = path.join(
    options.temporaryDir,
    "manifests",
    `${options.datasetId.toLowerCase()}-french-lemmas.json`
  );
  const python = path.join(
    options.root,
    "outputs/tools/french-lemmas-venv/bin/python"
  );
  const script = path.join(
    options.root,
    "scripts/build_french_lemma_context_pilot.py"
  );
  if (!existsSync(python)) {
    throw new Error(
      `production-resource-french-lemma-runtime-missing:${python}`
    );
  }
  await mkdir(path.dirname(reportPath), { recursive: true });
  await execFileAsync(
    python,
    [
      script,
      "--source",
      source,
      "--kaikki",
      path.join(options.root, DEFAULT_KAIKKI_FRENCH_JSONL),
      "--output",
      output,
      "--report",
      reportPath,
      "--dataset",
      options.datasetId
    ],
    { maxBuffer: 1024 * 1024 }
  );
  await rm(source);
  await rename(output, source);
  const report = JSON.parse(await readFile(reportPath, "utf8")) as Record<
    string,
    unknown
  >;
  const normalizedReport = {
    ...report,
    datasetId: options.datasetId,
    sourceDatabase: options.file,
    outputDatabase: options.file
  };
  await writeJson(reportPath, normalizedReport);
  return normalizedReport;
}

function bibleManifest(
  id: string,
  summary: StrongBibleSqliteSummary
): Record<string, unknown> {
  return {
    format: "strong-bible-sqlite-manifest",
    id,
    ...summary,
    releaseSchemaVersion: PRODUCTION_RESOURCE_RELEASE_SCHEMA_VERSION,
    sqliteSchemaVersion: STRONG_BIBLE_SQLITE_SCHEMA_VERSION
  };
}

function verifySharedSqlite(
  filePath: string,
  requiredTables: readonly string[]
): void {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = String(
      (
        database.prepare("PRAGMA integrity_check").get() as Record<
          string,
          unknown
        >
      ).integrity_check
    );
    if (integrity !== "ok") {
      throw new Error(
        `production-resource-integrity:${path.basename(filePath)}:${integrity}`
      );
    }
    const tables = new Set(
      (
        database
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all() as Array<{ name: string }>
      ).map(({ name }) => name)
    );
    for (const table of requiredTables) {
      if (!tables.has(table)) {
        throw new Error(
          `production-resource-missing-table:${path.basename(filePath)}:${table}`
        );
      }
    }
  } finally {
    database.close();
  }
}

async function writeChecksums(
  directory: string,
  catalog: ProductionResourceCatalog
): Promise<void> {
  const lines = [
    ...(await Promise.all(
      catalog.bibles.map(async ({ file }) => [
        await sha256File(path.join(directory, file)),
        file
      ])
    )),
    ...(await Promise.all(
      catalog.resources.map(async ({ file }) => [
        await sha256File(path.join(directory, file)),
        file
      ])
    )),
    [await sha256File(path.join(directory, "catalog.json")), "catalog.json"]
  ]
    .map(([sha256, file]) => `${sha256}  ${file}`)
    .join("\n");
  await writeFile(path.join(directory, "SHA256SUMS"), `${lines}\n`, "utf8");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output-dir");
  const outputDir = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const result = await packageProductionResources({ outputDir });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
