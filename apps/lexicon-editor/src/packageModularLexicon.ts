import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { containsLsjAbsenceMarker } from "./stepLexiconResourceAvailability.js";

export const MODULAR_LEXICON_SCHEMA_VERSION = 2;
export const MODULAR_LEXICON_BUILDER_VERSION = "modular-lexicon@3";
export const DEFAULT_MODULAR_LEXICON_RELEASE =
  "outputs/releases/strong-lexicon-modular-v2-candidate";

const DEFAULT_SOURCE =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const DEFAULT_ENTITIES = "data/entities/bible_entities.production.sqlite";
const ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

interface Artifact {
  id: "core" | "resources" | "entities";
  required: boolean;
  file: string;
  sha256: string;
  bytes: number;
  archive: string;
  archiveSha256: string;
  archiveBytes: number;
  entry: string;
  counts: Record<string, number>;
}

interface ModularLexiconCatalog {
  format: "strong-lexicon-modular-release";
  schemaVersion: number;
  builderVersion: string;
  generatedAt: string;
  lexiconRevision: string;
  source: {
    file: string;
    sha256: string;
    bytes: number;
  };
  filtering: {
    tflsjAbsencePlaceholdersRemoved: number;
  };
  artifacts: Artifact[];
  totals: {
    sqliteBytes: number;
    archiveBytes: number;
    sourceLexiconBytes: number;
    lexiconSqliteBytes: number;
    lexiconSavedBytes: number;
    lexiconReductionRatio: number;
  };
}

export function packageModularLexicon(
  options: {
    root?: string;
    sourcePath?: string;
    entitiesPath?: string;
    outputDir?: string;
    generatedAt?: string;
  } = {}
): {
  outputDir: string;
  catalogPath: string;
  catalogSha256: string;
  lexiconRevision: string;
  artifacts: Artifact[];
  tflsjAbsencePlaceholdersRemoved: number;
} {
  const root = path.resolve(options.root ?? process.cwd());
  const sourcePath = path.resolve(root, options.sourcePath ?? DEFAULT_SOURCE);
  const entitiesPath = path.resolve(
    root,
    options.entitiesPath ?? DEFAULT_ENTITIES
  );
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_MODULAR_LEXICON_RELEASE
  );
  if (!existsSync(sourcePath)) {
    throw new Error(`modular-lexicon-source-missing:${sourcePath}`);
  }
  if (!existsSync(entitiesPath)) {
    throw new Error(`modular-lexicon-entities-missing:${entitiesPath}`);
  }
  if (existsSync(outputDir)) {
    throw new Error(`modular-lexicon-release-already-exists:${outputDir}`);
  }

  const temporaryDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const sourceSha256 = sha256File(sourcePath);
  const sourceBytes = statSync(sourcePath).size;
  const lexiconRevision = createHash("sha256")
    .update(sourceSha256)
    .update("\u0000")
    .update(MODULAR_LEXICON_BUILDER_VERSION)
    .digest("hex");
  const placeholderResourceIds = collectTflsjPlaceholderResourceIds(sourcePath);

  mkdirSync(temporaryDir, { recursive: true });
  try {
    const corePath = path.join(temporaryDir, "strong_lexicon.core.sqlite");
    const resourcesPath = path.join(
      temporaryDir,
      "strong_lexicon.resources.sqlite"
    );
    const entitiesOutputPath = path.join(
      temporaryDir,
      "bible_entities.production.sqlite"
    );

    buildCoreDatabase({
      sourcePath,
      outputPath: corePath,
      generatedAt,
      lexiconRevision
    });
    buildResourcesDatabase({
      sourcePath,
      outputPath: resourcesPath,
      generatedAt,
      lexiconRevision,
      placeholderResourceIds
    });
    copyFileSync(entitiesPath, entitiesOutputPath);

    validateProjection({
      sourcePath,
      corePath,
      resourcesPath,
      entitiesSourcePath: entitiesPath,
      entitiesOutputPath,
      placeholderResourceIds
    });

    const artifactInputs = [
      {
        id: "core" as const,
        required: true,
        path: corePath,
        counts: databaseCounts(corePath, [
          "StepEntries",
          "LexiconTranslations",
          "LexiconNameMeanings",
          "StepEntryIdentities",
          "RelationKinds",
          "LexiconRelations",
          "MorphologyCodes",
          "MorphologyCodeTranslations"
        ])
      },
      {
        id: "resources" as const,
        required: false,
        path: resourcesPath,
        counts: databaseCounts(resourcesPath, [
          "LexiconResources",
          "LexiconResourceTranslations"
        ])
      },
      {
        id: "entities" as const,
        required: false,
        path: entitiesOutputPath,
        counts: databaseCounts(entitiesOutputPath, [
          "Entities",
          "EntityTranslations",
          "EntityRefs",
          "EntityRelations",
          "EntityPlaces"
        ])
      }
    ];
    const artifacts: Artifact[] = artifactInputs.map((input) => {
      const entry = path.basename(input.path);
      const archive = `${entry}.zip`;
      const archivePath = path.join(temporaryDir, archive);
      createDeterministicZip({
        inputPath: input.path,
        entryName: entry,
        archivePath,
        stagingRoot: path.join(temporaryDir, ".zip", input.id)
      });
      return {
        id: input.id,
        required: input.required,
        file: entry,
        sha256: sha256File(input.path),
        bytes: statSync(input.path).size,
        archive,
        archiveSha256: sha256File(archivePath),
        archiveBytes: statSync(archivePath).size,
        entry,
        counts: input.counts
      };
    });
    const lexiconBytes = artifacts
      .filter((artifact) => artifact.id !== "entities")
      .reduce((total, artifact) => total + artifact.bytes, 0);
    const catalog: ModularLexiconCatalog = {
      format: "strong-lexicon-modular-release",
      schemaVersion: MODULAR_LEXICON_SCHEMA_VERSION,
      builderVersion: MODULAR_LEXICON_BUILDER_VERSION,
      generatedAt,
      lexiconRevision,
      source: {
        file: path.relative(root, sourcePath),
        sha256: sourceSha256,
        bytes: sourceBytes
      },
      filtering: {
        tflsjAbsencePlaceholdersRemoved: placeholderResourceIds.length
      },
      artifacts,
      totals: {
        sqliteBytes: artifacts.reduce(
          (total, artifact) => total + artifact.bytes,
          0
        ),
        archiveBytes: artifacts.reduce(
          (total, artifact) => total + artifact.archiveBytes,
          0
        ),
        sourceLexiconBytes: sourceBytes,
        lexiconSqliteBytes: lexiconBytes,
        lexiconSavedBytes: sourceBytes - lexiconBytes,
        lexiconReductionRatio: ratio(sourceBytes - lexiconBytes, sourceBytes)
      }
    };
    const catalogPath = path.join(temporaryDir, "catalog.json");
    writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    writeChecksums(temporaryDir, artifacts);
    rmSync(path.join(temporaryDir, ".zip"), {
      recursive: true,
      force: true
    });
    mkdirSync(path.dirname(outputDir), { recursive: true });
    renameSync(temporaryDir, outputDir);
    return {
      outputDir,
      catalogPath: path.join(outputDir, "catalog.json"),
      catalogSha256: sha256File(path.join(outputDir, "catalog.json")),
      lexiconRevision,
      artifacts,
      tflsjAbsencePlaceholdersRemoved: placeholderResourceIds.length
    };
  } catch (error) {
    rmSync(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

function buildCoreDatabase(options: {
  sourcePath: string;
  outputPath: string;
  generatedAt: string;
  lexiconRevision: string;
}): void {
  const database = new DatabaseSync(options.outputPath);
  try {
    database.exec(`
      PRAGMA journal_mode=DELETE;
      PRAGMA foreign_keys=OFF;
      ATTACH DATABASE ${sqlString(options.sourcePath)} AS source;
      BEGIN IMMEDIATE;

      CREATE TABLE DictionaryMeta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;
      INSERT INTO DictionaryMeta SELECT key,value FROM source.DictionaryMeta;

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
        classicTransliteration TEXT NOT NULL,
        pronunciation TEXT NOT NULL
      );
      INSERT INTO StepEntries
      SELECT id,language,baseCode,eStrong,dStrong,uStrong,original,
             transliteration,morph,gloss,meaning,classicTransliteration,
             pronunciation
        FROM source.StepEntries ORDER BY id;
      CREATE INDEX idx_StepEntries_language_baseCode
        ON StepEntries(language,baseCode);
      CREATE INDEX idx_StepEntries_eStrong ON StepEntries(eStrong);

      CREATE TABLE StepEntryIdentities (
        stepEntryId INTEGER PRIMARY KEY,
        stepCode TEXT NOT NULL
      );
      INSERT INTO StepEntryIdentities
      SELECT stepEntryId,stepCode
        FROM source.StepEntryIdentities ORDER BY stepEntryId;
      CREATE UNIQUE INDEX idx_StepEntryIdentities_stepCode
        ON StepEntryIdentities(stepCode);

      CREATE TABLE LexiconTranslations (
        stepEntryId INTEGER NOT NULL,
        language TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        meaningHtml TEXT NOT NULL,
        PRIMARY KEY(stepEntryId,language)
      ) WITHOUT ROWID;
      INSERT INTO LexiconTranslations
      SELECT stepEntryId,language,gloss,meaning,meaningHtml
        FROM source.LexiconTranslations ORDER BY stepEntryId,language;

      CREATE TABLE LexiconNameMeanings (
        stepEntryId INTEGER NOT NULL,
        language TEXT NOT NULL,
        valueHtml TEXT NOT NULL,
        valueText TEXT NOT NULL,
        source TEXT NOT NULL,
        sourceField TEXT NOT NULL,
        sourceTextSha256 TEXT NOT NULL,
        translationEngine TEXT NOT NULL,
        PRIMARY KEY(stepEntryId,language)
      ) WITHOUT ROWID;
      INSERT INTO LexiconNameMeanings
      SELECT stepEntryId,language,valueHtml,valueText,source,sourceField,
             sourceTextSha256,translationEngine
        FROM source.LexiconNameMeanings ORDER BY stepEntryId,language;
      CREATE INDEX idx_LexiconNameMeanings_language
        ON LexiconNameMeanings(language,stepEntryId);

      CREATE TABLE RelationKinds (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL UNIQUE,
        labelEn TEXT NOT NULL,
        labelFr TEXT NOT NULL
      );
      INSERT INTO RelationKinds(id,kind,labelEn,labelFr)
      SELECT row_number() OVER (ORDER BY relationKind),
             relationKind,min(labelEn),min(labelFr)
        FROM source.LexiconRelations
       GROUP BY relationKind
       ORDER BY relationKind;

      CREATE TABLE LexiconRelations (
        id INTEGER PRIMARY KEY,
        fromStepEntryId INTEGER NOT NULL,
        toStepEntryId INTEGER,
        toStepCode TEXT NOT NULL,
        groupKind TEXT NOT NULL,
        relationKindId INTEGER NOT NULL,
        sortOrder INTEGER NOT NULL
      );
      INSERT INTO LexiconRelations
      SELECT relation.id,relation.fromStepEntryId,relation.toStepEntryId,
             relation.toStepCode,relation.groupKind,kind.id,
             relation.sortOrder
        FROM source.LexiconRelations relation
        JOIN RelationKinds kind ON kind.kind=relation.relationKind
       ORDER BY relation.id;
      CREATE INDEX idx_LexiconRelations_from
        ON LexiconRelations(fromStepEntryId,groupKind,sortOrder);

      CREATE TABLE MorphologyCodes (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL,
        normalizedCode TEXT NOT NULL,
        language TEXT NOT NULL,
        scope TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL
      );
      INSERT INTO MorphologyCodes
      SELECT id,code,normalizedCode,language,scope,meaning,description
        FROM source.MorphologyCodes ORDER BY id;
      CREATE INDEX idx_MorphologyCodes_scope ON MorphologyCodes(scope);

      CREATE TABLE MorphologyCodeTranslations (
        morphologyCodeId INTEGER NOT NULL,
        language TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL,
        PRIMARY KEY(morphologyCodeId,language)
      ) WITHOUT ROWID;
      INSERT INTO MorphologyCodeTranslations
      SELECT morphologyCodeId,language,meaning,description
        FROM source.MorphologyCodeTranslations
       ORDER BY morphologyCodeId,language;

      INSERT OR REPLACE INTO DictionaryMeta(key,value)
      VALUES
        ('moduleKind','core'),
        ('moduleSchemaVersion','${MODULAR_LEXICON_SCHEMA_VERSION}'),
        ('moduleBuilderVersion','${MODULAR_LEXICON_BUILDER_VERSION}'),
        ('moduleGeneratedAt',${sqlString(options.generatedAt)}),
        ('lexiconRevision',${sqlString(options.lexiconRevision)});
      COMMIT;
      DETACH DATABASE source;
      ANALYZE;
      VACUUM;
    `);
  } finally {
    database.close();
  }
}

function buildResourcesDatabase(options: {
  sourcePath: string;
  outputPath: string;
  generatedAt: string;
  lexiconRevision: string;
  placeholderResourceIds: number[];
}): void {
  const exclusion = excludedIdsSql("id", options.placeholderResourceIds);
  const database = new DatabaseSync(options.outputPath);
  try {
    database.exec(`
      PRAGMA journal_mode=DELETE;
      ATTACH DATABASE ${sqlString(options.sourcePath)} AS source;
      BEGIN IMMEDIATE;

      CREATE TABLE DictionaryMeta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;
      INSERT INTO DictionaryMeta SELECT key,value FROM source.DictionaryMeta;

      CREATE TABLE LexiconResources (
        id INTEGER PRIMARY KEY,
        stepEntryId INTEGER NOT NULL,
        source TEXT NOT NULL,
        kind TEXT NOT NULL,
        contentHtml TEXT NOT NULL
      );
      INSERT INTO LexiconResources
      SELECT id,stepEntryId,source,kind,contentHtml
        FROM source.LexiconResources
       WHERE ${exclusion}
       ORDER BY id;
      CREATE INDEX idx_LexiconResources_stepEntryId
        ON LexiconResources(stepEntryId);

      CREATE TABLE LexiconResourceTranslations (
        resourceId INTEGER NOT NULL,
        language TEXT NOT NULL,
        contentHtml TEXT NOT NULL,
        PRIMARY KEY(resourceId,language)
      ) WITHOUT ROWID;
      INSERT INTO LexiconResourceTranslations
      SELECT translation.resourceId,translation.language,
             translation.contentHtml
        FROM source.LexiconResourceTranslations translation
        JOIN LexiconResources resource
          ON resource.id=translation.resourceId
       ORDER BY translation.resourceId,translation.language;

      INSERT OR REPLACE INTO DictionaryMeta(key,value)
      VALUES
        ('moduleKind','resources'),
        ('moduleSchemaVersion','${MODULAR_LEXICON_SCHEMA_VERSION}'),
        ('moduleBuilderVersion','${MODULAR_LEXICON_BUILDER_VERSION}'),
        ('moduleGeneratedAt',${sqlString(options.generatedAt)}),
        ('lexiconRevision',${sqlString(options.lexiconRevision)});
      COMMIT;
      DETACH DATABASE source;
      ANALYZE;
      VACUUM;
    `);
  } finally {
    database.close();
  }
}

function validateProjection(options: {
  sourcePath: string;
  corePath: string;
  resourcesPath: string;
  entitiesSourcePath: string;
  entitiesOutputPath: string;
  placeholderResourceIds: number[];
}): void {
  for (const file of [
    options.sourcePath,
    options.corePath,
    options.resourcesPath,
    options.entitiesOutputPath
  ]) {
    assertHealthy(file);
  }
  if (
    sha256File(options.entitiesSourcePath) !==
    sha256File(options.entitiesOutputPath)
  ) {
    throw new Error("modular-lexicon-entities-copy-drift");
  }

  const source = new DatabaseSync(options.sourcePath, { readOnly: true });
  const core = new DatabaseSync(options.corePath, { readOnly: true });
  const resources = new DatabaseSync(options.resourcesPath, {
    readOnly: true
  });
  try {
    compareFingerprints({
      label: "StepEntries",
      left: source,
      leftSql: "SELECT * FROM StepEntries ORDER BY id",
      right: core,
      rightSql: "SELECT * FROM StepEntries ORDER BY id"
    });
    compareFingerprints({
      label: "LexiconTranslations",
      left: source,
      leftSql:
        "SELECT stepEntryId,language,gloss,meaning,meaningHtml FROM LexiconTranslations ORDER BY stepEntryId,language",
      right: core,
      rightSql:
        "SELECT stepEntryId,language,gloss,meaning,meaningHtml FROM LexiconTranslations ORDER BY stepEntryId,language"
    });
    compareFingerprints({
      label: "LexiconNameMeanings",
      left: source,
      leftSql:
        "SELECT stepEntryId,language,valueHtml,valueText,source,sourceField,sourceTextSha256,translationEngine FROM LexiconNameMeanings ORDER BY stepEntryId,language",
      right: core,
      rightSql:
        "SELECT stepEntryId,language,valueHtml,valueText,source,sourceField,sourceTextSha256,translationEngine FROM LexiconNameMeanings ORDER BY stepEntryId,language"
    });
    compareFingerprints({
      label: "StepEntryIdentities",
      left: source,
      leftSql:
        "SELECT stepEntryId,stepCode FROM StepEntryIdentities ORDER BY stepEntryId",
      right: core,
      rightSql:
        "SELECT stepEntryId,stepCode FROM StepEntryIdentities ORDER BY stepEntryId"
    });
    compareFingerprints({
      label: "LexiconRelations",
      left: source,
      leftSql:
        "SELECT id,fromStepEntryId,toStepEntryId,toStepCode,groupKind,relationKind,labelEn,labelFr,sortOrder FROM LexiconRelations ORDER BY id",
      right: core,
      rightSql:
        "SELECT relation.id,relation.fromStepEntryId,relation.toStepEntryId,relation.toStepCode,relation.groupKind,kind.kind AS relationKind,kind.labelEn,kind.labelFr,relation.sortOrder FROM LexiconRelations relation JOIN RelationKinds kind ON kind.id=relation.relationKindId ORDER BY relation.id"
    });
    compareFingerprints({
      label: "MorphologyCodes",
      left: source,
      leftSql:
        "SELECT id,code,normalizedCode,language,scope,meaning,description FROM MorphologyCodes ORDER BY id",
      right: core,
      rightSql:
        "SELECT id,code,normalizedCode,language,scope,meaning,description FROM MorphologyCodes ORDER BY id"
    });
    compareFingerprints({
      label: "MorphologyCodeTranslations",
      left: source,
      leftSql:
        "SELECT morphologyCodeId,language,meaning,description FROM MorphologyCodeTranslations ORDER BY morphologyCodeId,language",
      right: core,
      rightSql:
        "SELECT morphologyCodeId,language,meaning,description FROM MorphologyCodeTranslations ORDER BY morphologyCodeId,language"
    });
    compareFingerprints({
      label: "LexiconResources",
      left: source,
      leftSql: `SELECT id,stepEntryId,source,kind,contentHtml
                  FROM LexiconResources
                 WHERE ${excludedIdsSql("id", options.placeholderResourceIds)}
                 ORDER BY id`,
      right: resources,
      rightSql:
        "SELECT id,stepEntryId,source,kind,contentHtml FROM LexiconResources ORDER BY id"
    });
    compareFingerprints({
      label: "LexiconResourceTranslations",
      left: source,
      leftSql: `SELECT translation.resourceId,translation.language,
                       translation.contentHtml
                  FROM LexiconResourceTranslations translation
                  JOIN LexiconResources resource
                    ON resource.id=translation.resourceId
                 WHERE ${excludedIdsSql(
                   "resource.id",
                   options.placeholderResourceIds
                 )}
                 ORDER BY translation.resourceId,translation.language`,
      right: resources,
      rightSql:
        "SELECT resourceId,language,contentHtml FROM LexiconResourceTranslations ORDER BY resourceId,language"
    });

    validateResourceEntryIds(core, resources);
    validateResourceTranslations(resources);
    validateNoLsjAbsencePlaceholders(resources);
  } finally {
    source.close();
    core.close();
    resources.close();
  }
}

function collectTflsjPlaceholderResourceIds(sourcePath: string): number[] {
  const database = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    return (
      database
        .prepare(
          `SELECT id,contentHtml
             FROM LexiconResources
            WHERE source='TFLSJ'
            ORDER BY id`
        )
        .all() as Array<{ id: number; contentHtml: string }>
    )
      .filter((row) => containsLsjAbsenceMarker(row.contentHtml))
      .map((row) => row.id);
  } finally {
    database.close();
  }
}

function excludedIdsSql(column: string, ids: number[]): string {
  return ids.length === 0 ? "1=1" : `${column} NOT IN (${ids.join(",")})`;
}

function validateResourceEntryIds(
  core: DatabaseSync,
  resources: DatabaseSync
): void {
  const ids = new Set(
    (
      core.prepare("SELECT id FROM StepEntries").all() as Array<{
        id: number;
      }>
    ).map((row) => row.id)
  );
  const orphanCount = (
    resources
      .prepare("SELECT DISTINCT stepEntryId FROM LexiconResources")
      .all() as Array<{ stepEntryId: number }>
  ).filter((row) => !ids.has(row.stepEntryId)).length;
  if (orphanCount !== 0) {
    throw new Error(`modular-lexicon-orphan-resources:${orphanCount}`);
  }
}

function validateResourceTranslations(resources: DatabaseSync): void {
  const orphanCount = Number(
    (
      resources
        .prepare(
          `SELECT count(*) AS count
             FROM LexiconResourceTranslations translation
             LEFT JOIN LexiconResources resource
               ON resource.id=translation.resourceId
            WHERE resource.id IS NULL`
        )
        .get() as { count: number }
    ).count
  );
  if (orphanCount !== 0) {
    throw new Error(
      `modular-lexicon-orphan-resource-translations:${orphanCount}`
    );
  }
}

function validateNoLsjAbsencePlaceholders(resources: DatabaseSync): void {
  const values = [
    ...(resources
      .prepare(
        `SELECT contentHtml
           FROM LexiconResources
          WHERE source='TFLSJ'`
      )
      .all() as Array<{ contentHtml: string }>),
    ...(resources
      .prepare(
        `SELECT translation.contentHtml
           FROM LexiconResourceTranslations translation
           JOIN LexiconResources resource
             ON resource.id=translation.resourceId
          WHERE resource.source='TFLSJ'`
      )
      .all() as Array<{ contentHtml: string }>)
  ];
  const placeholderCount = values.filter((row) =>
    containsLsjAbsenceMarker(row.contentHtml)
  ).length;
  if (placeholderCount !== 0) {
    throw new Error(
      `modular-lexicon-lsj-absence-placeholders:${placeholderCount}`
    );
  }
}

function compareFingerprints(options: {
  label: string;
  left: DatabaseSync;
  leftSql: string;
  right: DatabaseSync;
  rightSql: string;
}): void {
  const left = queryFingerprint(options.left, options.leftSql);
  const right = queryFingerprint(options.right, options.rightSql);
  if (left !== right) {
    throw new Error(`modular-lexicon-projection-drift:${options.label}`);
  }
}

function queryFingerprint(database: DatabaseSync, sql: string): string {
  const hash = createHash("sha256");
  const statement = database.prepare(sql);
  for (const row of statement.all() as Record<string, unknown>[]) {
    hash.update(JSON.stringify(row));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function assertHealthy(filePath: string): void {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = String(
      (
        database.prepare("PRAGMA integrity_check").get() as {
          integrity_check: string;
        }
      ).integrity_check
    );
    const foreignKeys = (
      database.prepare("PRAGMA foreign_key_check").all() as unknown[]
    ).length;
    if (integrity !== "ok" || foreignKeys !== 0) {
      throw new Error(
        `modular-lexicon-integrity-failed:${path.basename(filePath)}:${integrity}:${foreignKeys}`
      );
    }
  } finally {
    database.close();
  }
}

function databaseCounts(
  filePath: string,
  tables: string[]
): Record<string, number> {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    return Object.fromEntries(
      tables.map((table) => [
        table,
        Number(
          (
            database
              .prepare(`SELECT count(*) AS count FROM ${table}`)
              .get() as { count: number }
          ).count
        )
      ])
    );
  } finally {
    database.close();
  }
}

function createDeterministicZip(options: {
  inputPath: string;
  entryName: string;
  archivePath: string;
  stagingRoot: string;
}): void {
  mkdirSync(options.stagingRoot, { recursive: true });
  const stagedPath = path.join(options.stagingRoot, options.entryName);
  copyFileSync(options.inputPath, stagedPath);
  utimesSync(stagedPath, ZIP_TIME, ZIP_TIME);
  execFileSync(
    "zip",
    ["-X", "-9", "-q", options.archivePath, options.entryName],
    { cwd: options.stagingRoot, env: { ...process.env, TZ: "UTC" } }
  );
}

function writeChecksums(directory: string, artifacts: Artifact[]): void {
  const files = [
    ...artifacts.flatMap((artifact) => [artifact.file, artifact.archive]),
    "catalog.json"
  ];
  const lines = files.map(
    (file) => `${sha256File(path.join(directory, file))}  ${file}`
  );
  writeFileSync(path.join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
}

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = openSync(filePath, "r");
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

function main(): void {
  const args = process.argv.slice(2);
  const value = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index < 0) return undefined;
    const result = args[index + 1];
    if (!result || result.startsWith("--")) {
      throw new Error(`modular-lexicon-missing-argument:${flag}`);
    }
    return result;
  };
  const result = packageModularLexicon({
    sourcePath: value("--source-path"),
    entitiesPath: value("--entities-path"),
    outputDir: value("--output-dir"),
    generatedAt: value("--generated-at")
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) main();
