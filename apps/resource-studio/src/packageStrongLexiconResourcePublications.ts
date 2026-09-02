import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  lstatSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { packageModularLexicon } from "./packageModularLexicon.js";
import {
  assertResourcePublicationArtifact,
  decodeResourcePublicationEnvelope,
  isNonEmptyString,
  isNonNegativeInteger,
  isRecord,
  isSha256,
  resolveResourcePublicationPath,
  sha256ResourcePublicationFile,
  type ResourcePublicationEnvelope
} from "./resourcePublicationEnvelope.js";
import { commitResourcePublicationBundle } from "./resourcePublicationCommit.js";

export type StrongLexiconModuleId = "core" | "resources" | "entities";

const MODULE_IDS: readonly StrongLexiconModuleId[] = [
  "core",
  "resources",
  "entities"
];
const CANONICAL_SCHEMA_VERSION = 2;
const SQLITE_SCHEMA_VERSION = 3;
const MAX_SQLITE_BYTES = 256 * 1024 * 1024;
const ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

const MODULE_FILES: Record<StrongLexiconModuleId, string> = {
  core: "strong_lexicon.core.sqlite",
  resources: "strong_lexicon.resources.sqlite",
  entities: "bible_entities.production.sqlite"
};

const TABLES: Record<StrongLexiconModuleId, readonly string[]> = {
  core: [
    "StepEntries",
    "StepEntryIdentities",
    "LexiconTranslations",
    "LexiconNameMeanings",
    "RelationKinds",
    "LexiconRelations",
    "MorphologyCodes",
    "MorphologyCodeTranslations"
  ],
  resources: ["LexiconResources", "LexiconResourceTranslations"],
  entities: [
    "Entities",
    "EntityTranslations",
    "EntityRefs",
    "EntityRelations",
    "EntityPlaces"
  ]
};

const TABLE_COLUMNS: Record<
  StrongLexiconModuleId,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: [
      "id",
      "language",
      "baseCode",
      "eStrong",
      "dStrong",
      "uStrong",
      "original",
      "transliteration",
      "morph",
      "gloss",
      "meaning",
      "classicTransliteration",
      "pronunciation"
    ],
    StepEntryIdentities: ["stepEntryId", "stepCode"],
    LexiconTranslations: [
      "stepEntryId",
      "language",
      "gloss",
      "meaning",
      "meaningHtml"
    ],
    LexiconNameMeanings: [
      "stepEntryId",
      "language",
      "valueHtml",
      "valueText",
      "source",
      "sourceField",
      "sourceTextSha256",
      "translationEngine"
    ],
    RelationKinds: ["id", "kind", "labelEn", "labelFr"],
    LexiconRelations: [
      "id",
      "fromStepEntryId",
      "toStepEntryId",
      "toStepCode",
      "groupKind",
      "relationKindId",
      "sortOrder"
    ],
    MorphologyCodes: [
      "id",
      "code",
      "normalizedCode",
      "language",
      "scope",
      "meaning",
      "description"
    ],
    MorphologyCodeTranslations: [
      "morphologyCodeId",
      "language",
      "meaning",
      "description"
    ]
  },
  resources: {
    LexiconResources: ["id", "stepEntryId", "source", "kind", "contentHtml"],
    LexiconResourceTranslations: ["resourceId", "language", "contentHtml"]
  },
  entities: {
    Entities: [
      "id",
      "uniqueName",
      "uStrong",
      "displayName",
      "category",
      "type",
      "description",
      "summaryHtml",
      "briefest",
      "brief",
      "shortDescription",
      "articleHtml"
    ],
    EntityTranslations: [
      "id",
      "entityId",
      "language",
      "displayName",
      "description",
      "summaryHtml",
      "briefest",
      "brief",
      "shortDescription",
      "articleHtml"
    ],
    EntityRefs: ["entityId", "book", "chapter", "verse", "suffix", "refText"],
    EntityRelations: [
      "fromEntityId",
      "relation",
      "toUniqueName",
      "toEntityId",
      "certainty"
    ],
    EntityPlaces: [
      "entityId",
      "openBibleName",
      "googleMapUrl",
      "palopenmapsUrl",
      "latitude",
      "longitude",
      "area"
    ]
  }
};

const TABLE_PRIMARY_KEYS: Record<
  StrongLexiconModuleId,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: ["id"],
    StepEntryIdentities: ["stepEntryId"],
    LexiconTranslations: ["stepEntryId", "language"],
    LexiconNameMeanings: ["stepEntryId", "language"],
    RelationKinds: ["id"],
    LexiconRelations: ["id"],
    MorphologyCodes: ["id"],
    MorphologyCodeTranslations: ["morphologyCodeId", "language"]
  },
  resources: {
    LexiconResources: ["id"],
    LexiconResourceTranslations: ["resourceId", "language"]
  },
  entities: {
    Entities: ["id"],
    EntityTranslations: ["id"],
    EntityRefs: ["entityId", "book", "chapter", "verse", "suffix"],
    EntityRelations: [],
    EntityPlaces: ["entityId"]
  }
};

const TABLE_UNIQUE_KEYS: Record<
  StrongLexiconModuleId,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntryIdentities: ["stepCode"],
    RelationKinds: ["kind"]
  },
  resources: {},
  entities: {
    Entities: ["uniqueName"],
    EntityRelations: ["fromEntityId", "relation", "toUniqueName", "toEntityId"]
  }
};

const NON_EMPTY_COLUMNS: Record<
  StrongLexiconModuleId,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: ["language", "eStrong", "dStrong", "uStrong", "gloss"],
    StepEntryIdentities: ["stepCode"],
    LexiconTranslations: ["language"],
    LexiconNameMeanings: [
      "language",
      "valueHtml",
      "valueText",
      "source",
      "sourceField",
      "sourceTextSha256",
      "translationEngine"
    ],
    RelationKinds: ["kind"],
    LexiconRelations: ["toStepCode", "groupKind"],
    MorphologyCodes: ["code", "normalizedCode", "language", "scope"],
    MorphologyCodeTranslations: ["language"]
  },
  resources: {
    LexiconResources: ["source", "kind"],
    LexiconResourceTranslations: ["language"]
  },
  entities: {
    Entities: ["uniqueName", "uStrong", "displayName", "category", "type"],
    EntityTranslations: ["language"],
    EntityRefs: ["book", "refText"],
    EntityRelations: ["relation", "toUniqueName", "certainty"],
    EntityPlaces: []
  }
};

const POSITIVE_INTEGER_COLUMNS = new Set([
  "id",
  "baseCode",
  "stepEntryId",
  "resourceId",
  "morphologyCodeId",
  "entityId",
  "fromStepEntryId",
  "toStepEntryId",
  "fromEntityId",
  "toEntityId",
  "relationKindId",
  "sortOrder",
  "chapter",
  "verse"
]);

const REQUIRED_INTEGER_COLUMNS: Record<
  StrongLexiconModuleId,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntries: ["id", "baseCode"],
    StepEntryIdentities: ["stepEntryId"],
    LexiconTranslations: ["stepEntryId"],
    LexiconNameMeanings: ["stepEntryId"],
    RelationKinds: ["id"],
    LexiconRelations: ["id", "fromStepEntryId", "relationKindId"],
    MorphologyCodes: ["id"],
    MorphologyCodeTranslations: ["morphologyCodeId"]
  },
  resources: {
    LexiconResources: ["id", "stepEntryId"],
    LexiconResourceTranslations: ["resourceId"]
  },
  entities: {
    Entities: ["id"],
    EntityTranslations: ["id", "entityId"],
    EntityRefs: ["entityId", "chapter", "verse"],
    EntityRelations: ["fromEntityId"],
    EntityPlaces: ["entityId"]
  }
};

const SQLITE_INTEGER_COLUMNS = new Set([
  "id",
  "baseCode",
  "stepEntryId",
  "resourceId",
  "morphologyCodeId",
  "entityId",
  "fromStepEntryId",
  "toStepEntryId",
  "fromEntityId",
  "toEntityId",
  "relationKindId",
  "sortOrder",
  "chapter",
  "verse"
]);
const SQLITE_REAL_COLUMNS = new Set(["latitude", "longitude"]);
const SQLITE_OPTIONAL_COLUMNS = new Set([
  "toStepEntryId",
  "toEntityId",
  "latitude",
  "longitude"
]);
const SQLITE_UNIQUE_COLUMNS: Record<
  StrongLexiconModuleId,
  Record<string, readonly string[]>
> = {
  core: {
    StepEntryIdentities: ["stepCode"],
    RelationKinds: ["kind"]
  },
  resources: {},
  entities: { Entities: ["uniqueName"] }
};

type JsonRow = Record<string, string | number | null>;

export interface CanonicalStrongLexiconModule {
  format: "bible-strong-canonical-strong-lexicon-module";
  schemaVersion: 2;
  moduleId: StrongLexiconModuleId;
  revision: string;
  dependencies: Array<{
    resourceIdentity: "strong-lexicon:core";
    revision: string;
  }>;
  tables: Record<string, JsonRow[]>;
  counts: Record<string, number>;
}

export interface StrongLexiconResourcePublicationManifest extends ResourcePublicationEnvelope {
  identity: {
    kind: "strong-lexicon-module";
    moduleId: StrongLexiconModuleId;
    resourceId: `strong-lexicon:${StrongLexiconModuleId}`;
    language: "mul";
  };
  canonical: ResourcePublicationEnvelope["canonical"] & { schemaVersion: 2 };
  dependencies: CanonicalStrongLexiconModule["dependencies"];
  counts: Record<string, number>;
}

type PublicationConfig = {
  schemaVersion: 1;
  sourceVersion: string;
  rightsReviewedAt: string;
  modules: Record<
    StrongLexiconModuleId,
    {
      holder: string;
      termsReference: string;
      attribution: string;
      online: boolean;
      offline: boolean;
    }
  >;
};

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)])
    );
  }
  return value;
};

const stableJson = (value: unknown): string => JSON.stringify(normalize(value));

const validateRows = (
  moduleId: StrongLexiconModuleId,
  tables: Record<string, JsonRow[]>
): void => {
  const ids = new Map<string, Set<number>>();
  for (const table of TABLES[moduleId]) {
    const expectedColumns = TABLE_COLUMNS[moduleId][table]!;
    const rows = tables[table]!;
    const seenKeys = new Set<string>();
    const uniqueColumns = TABLE_UNIQUE_KEYS[moduleId][table] ?? [];
    const seenUniqueKeys = new Set<string>();
    const nonEmpty = new Set(NON_EMPTY_COLUMNS[moduleId][table] ?? []);
    if (rows.length === 0) {
      throw new Error(
        `strong-lexicon-publication-table-empty:${moduleId}:${table}`
      );
    }
    for (const row of rows) {
      const keys = Object.keys(row).sort();
      if (keys.join("|") !== [...expectedColumns].sort().join("|")) {
        throw new Error(
          `strong-lexicon-publication-row-columns:${moduleId}:${table}`
        );
      }
      for (const [key, value] of Object.entries(row)) {
        if (
          value !== null &&
          typeof value !== "string" &&
          typeof value !== "number"
        ) {
          throw new Error(
            `strong-lexicon-publication-row-value:${moduleId}:${table}:${key}`
          );
        }
        if (POSITIVE_INTEGER_COLUMNS.has(key) && value !== null) {
          if (!isNonNegativeInteger(value) || value < 1) {
            throw new Error(
              `strong-lexicon-publication-row-identity:${moduleId}:${table}:${key}`
            );
          }
        }
        if (
          REQUIRED_INTEGER_COLUMNS[moduleId][table]?.includes(key) &&
          (!isNonNegativeInteger(value) || value < 1)
        ) {
          throw new Error(
            `strong-lexicon-publication-row-required-identity:${moduleId}:${table}:${key}`
          );
        }
        if (nonEmpty.has(key) && (typeof value !== "string" || !value.trim())) {
          throw new Error(
            `strong-lexicon-publication-row-required:${moduleId}:${table}:${key}`
          );
        }
      }
      const primaryColumns = TABLE_PRIMARY_KEYS[moduleId][table] ?? [];
      const keyColumns =
        primaryColumns.length > 0
          ? primaryColumns
          : (TABLE_UNIQUE_KEYS[moduleId][table] ?? []);
      const key = keyColumns
        .map((column) => String(row[column] ?? ""))
        .join("\u001f");
      if (keyColumns.length && seenKeys.has(key)) {
        throw new Error(
          `strong-lexicon-publication-row-duplicate:${moduleId}:${table}`
        );
      }
      if (keyColumns.length) seenKeys.add(key);
      if (uniqueColumns.length) {
        const uniqueKey = uniqueColumns
          .map((column) => String(row[column] ?? ""))
          .join("\u001f");
        if (seenUniqueKeys.has(uniqueKey)) {
          throw new Error("strong-lexicon-publication-row-unique-duplicate");
        }
        seenUniqueKeys.add(uniqueKey);
      }
    }
    const idColumn =
      table === "StepEntries" ||
      table === "RelationKinds" ||
      table === "MorphologyCodes" ||
      table === "LexiconResources" ||
      table === "Entities"
        ? "id"
        : undefined;
    if (idColumn)
      ids.set(table, new Set(rows.map((row) => Number(row[idColumn]))));
  }

  const references = (table: string, column: string, target: string): void => {
    const targetIds = ids.get(target);
    if (!targetIds) return;
    for (const row of tables[table] ?? []) {
      const value = row[column];
      if (value !== null && !targetIds.has(Number(value))) {
        throw new Error(
          `strong-lexicon-publication-reference:${moduleId}:${table}:${column}`
        );
      }
    }
  };
  if (moduleId === "core") {
    const entryById = new Map(
      (tables.StepEntries ?? []).map((row) => [Number(row.id), row])
    );
    for (const row of tables.StepEntryIdentities ?? []) {
      const entry = entryById.get(Number(row.stepEntryId));
      const identity = String(row.stepCode);
      const dStrongIdentity = String(entry?.dStrong ?? "").split(/\s+/u)[0];
      if (
        !entry ||
        ![entry.eStrong, entry.uStrong, dStrongIdentity].includes(identity)
      ) {
        throw new Error("strong-lexicon-publication-identity-mismatch");
      }
    }
    const languages = new Set(["greek", "hebrew"]);
    if (
      (tables.StepEntries ?? []).some(
        (row) => !languages.has(String(row.language))
      )
    ) {
      throw new Error("strong-lexicon-publication-language-invalid");
    }
    const relationGroups = new Set(["subentry", "identity", "family"]);
    if (
      (tables.LexiconRelations ?? []).some(
        (row) => !relationGroups.has(String(row.groupKind))
      )
    ) {
      throw new Error("strong-lexicon-publication-relation-group-invalid");
    }
    references("StepEntryIdentities", "stepEntryId", "StepEntries");
    references("LexiconTranslations", "stepEntryId", "StepEntries");
    references("LexiconNameMeanings", "stepEntryId", "StepEntries");
    references("LexiconRelations", "fromStepEntryId", "StepEntries");
    references("LexiconRelations", "toStepEntryId", "StepEntries");
    references("LexiconRelations", "relationKindId", "RelationKinds");
    references(
      "MorphologyCodeTranslations",
      "morphologyCodeId",
      "MorphologyCodes"
    );
    const identityCodes = new Map(
      (tables.StepEntryIdentities ?? []).map((row) => [
        Number(row.stepEntryId),
        String(row.stepCode)
      ])
    );
    for (const row of tables.LexiconRelations ?? []) {
      if (
        row.toStepEntryId !== null &&
        identityCodes.get(Number(row.toStepEntryId)) !== String(row.toStepCode)
      ) {
        throw new Error("strong-lexicon-publication-relation-target-mismatch");
      }
    }
  } else if (moduleId === "resources") {
    references("LexiconResourceTranslations", "resourceId", "LexiconResources");
  } else {
    references("EntityTranslations", "entityId", "Entities");
    references("EntityRefs", "entityId", "Entities");
    references("EntityRelations", "fromEntityId", "Entities");
    references("EntityRelations", "toEntityId", "Entities");
    references("EntityPlaces", "entityId", "Entities");
    const entityNames = new Map(
      (tables.Entities ?? []).map((row) => [
        Number(row.id),
        String(row.uniqueName)
      ])
    );
    for (const row of tables.EntityRelations ?? []) {
      if (
        row.toEntityId !== null &&
        entityNames.get(Number(row.toEntityId)) !==
          String(row.toUniqueName).split("|").at(-1)
      ) {
        throw new Error("strong-lexicon-publication-entity-target-mismatch");
      }
    }
  }
};

const validateCrossModuleTables = (
  tablesByModule: Record<StrongLexiconModuleId, Record<string, JsonRow[]>>
): void => {
  const coreEntries = tablesByModule.core.StepEntries ?? [];
  const coreEntryIds = new Set(coreEntries.map((row) => Number(row.id)));
  const coreCodes = new Set(
    coreEntries.flatMap((row) =>
      [row.eStrong, row.dStrong, row.uStrong].filter(isNonEmptyString)
    )
  );
  const coreFamilies = new Set(
    [...coreCodes]
      .map((code) => code.match(/^([HG]\d+)/u)?.[1])
      .filter((code): code is string => Boolean(code))
  );
  for (const row of tablesByModule.resources.LexiconResources ?? []) {
    if (
      !isNonNegativeInteger(row.stepEntryId) ||
      !coreEntryIds.has(row.stepEntryId)
    ) {
      throw new Error(
        "strong-lexicon-publication-cross-module-resource-reference"
      );
    }
  }
  for (const row of tablesByModule.entities.Entities ?? []) {
    const code = isNonEmptyString(row.uStrong) ? row.uStrong : "";
    const family = code.match(/^([HG]\d+)/u)?.[1];
    if (!coreCodes.has(code) && (!family || !coreFamilies.has(family))) {
      throw new Error(
        "strong-lexicon-publication-cross-module-entity-reference"
      );
    }
  }
};

const validateSqliteTableSchema = (
  database: DatabaseSync,
  moduleId: StrongLexiconModuleId,
  table: string
): void => {
  const columns = database
    .prepare(`PRAGMA table_info("${table}")`)
    .all() as Array<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>;
  const expected = TABLE_COLUMNS[moduleId][table] ?? [];
  if (
    columns
      .map((column) => column.name)
      .sort()
      .join("|") !== [...expected].sort().join("|")
  ) {
    throw new Error(
      `strong-lexicon-publication-table-columns:${moduleId}:${table}`
    );
  }
  for (const column of columns) {
    const expectedType = SQLITE_REAL_COLUMNS.has(column.name)
      ? "REAL"
      : SQLITE_INTEGER_COLUMNS.has(column.name)
        ? "INTEGER"
        : "TEXT";
    if (String(column.type).toUpperCase() !== expectedType) {
      throw new Error(
        `strong-lexicon-publication-table-column-type:${moduleId}:${table}:${column.name}`
      );
    }
    const primaryIntegerColumn = column.pk === 1 && expectedType === "INTEGER";
    if (
      !SQLITE_OPTIONAL_COLUMNS.has(column.name) &&
      column.notnull !== 1 &&
      !primaryIntegerColumn
    ) {
      throw new Error(
        `strong-lexicon-publication-table-column-nullability:${moduleId}:${table}:${column.name}`
      );
    }
  }
  const primary = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);
  if (
    primary.join("|") !== (TABLE_PRIMARY_KEYS[moduleId][table] ?? []).join("|")
  ) {
    throw new Error(
      `strong-lexicon-publication-table-primary-key:${moduleId}:${table}`
    );
  }
  const uniqueColumns = SQLITE_UNIQUE_COLUMNS[moduleId][table] ?? [];
  if (uniqueColumns.length) {
    const quoted = uniqueColumns.map((column) => `"${column}"`).join(",");
    const duplicate = database
      .prepare(
        `SELECT ${quoted}, COUNT(*) AS count FROM "${table}" GROUP BY ${quoted} HAVING COUNT(*) > 1 LIMIT 1`
      )
      .get();
    if (duplicate) {
      throw new Error(
        `strong-lexicon-publication-table-unique:${moduleId}:${table}`
      );
    }
  }
};

export const deriveStrongLexiconModuleRevision = (
  moduleId: StrongLexiconModuleId,
  tables: Record<string, JsonRow[]>,
  dependencies: CanonicalStrongLexiconModule["dependencies"] = []
): string =>
  `strong-lexicon-${moduleId}-${createHash("sha256")
    .update(stableJson({ moduleId, dependencies, tables }))
    .digest("hex")
    .slice(0, 24)}`;

const readTables = (
  sqlitePath: string,
  moduleId: StrongLexiconModuleId
): Record<string, JsonRow[]> => {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const integrity = database
      .prepare("PRAGMA integrity_check")
      .all() as Array<{
      integrity_check: string;
    }>;
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
      throw new Error(
        `strong-lexicon-publication-sqlite-integrity:${moduleId}`
      );
    }
    const foreignKeys = database.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeys.length > 0) {
      throw new Error(
        `strong-lexicon-publication-sqlite-foreign-key:${moduleId}`
      );
    }
    const metadataTable =
      moduleId === "entities" ? "EntityMeta" : "DictionaryMeta";
    const actualTables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as Array<{ name: string }>;
    const allowedTables = new Set([
      ...TABLES[moduleId],
      metadataTable,
      ...(moduleId === "entities"
        ? ["EntityNames", "EntityTranslationProvenance"]
        : [])
    ]);
    if (actualTables.some(({ name }) => !allowedTables.has(name))) {
      throw new Error(`strong-lexicon-publication-sqlite-tables:${moduleId}`);
    }
    const metadataColumns = database
      .prepare(`PRAGMA table_info("${metadataTable}")`)
      .all() as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>;
    if (
      metadataColumns.length !== 2 ||
      metadataColumns.map((column) => column.name).join("|") !== "key|value" ||
      metadataColumns.some(
        (column) =>
          column.type.toUpperCase() !== "TEXT" ||
          column.notnull !== 1 ||
          (column.name === "key" && column.pk !== 1) ||
          (column.name === "value" && column.pk !== 0)
      )
    ) {
      throw new Error(`strong-lexicon-publication-metadata-schema:${moduleId}`);
    }
    const tables = Object.fromEntries(
      TABLES[moduleId].map((table) => {
        validateSqliteTableSchema(database, moduleId, table);
        const columns = database
          .prepare(`PRAGMA table_info(${table})`)
          .all() as Array<{ name: string; pk: number }>;
        const order = columns
          .filter((column) => column.pk > 0)
          .sort((left, right) => left.pk - right.pk)
          .map((column) => `"${column.name}"`);
        const fallbackOrder = columns.map((column) => `"${column.name}"`);
        const rows = database
          .prepare(
            `SELECT * FROM "${table}" ORDER BY ${(order.length ? order : fallbackOrder).join(",")}`
          )
          .all() as JsonRow[];
        return [table, rows];
      })
    );
    validateRows(moduleId, tables);
    return tables;
  } finally {
    database.close();
  }
};

const bindRevision = (
  sqlitePath: string,
  moduleId: StrongLexiconModuleId,
  revision: string,
  coreRevision: string
): void => {
  const database = new DatabaseSync(sqlitePath);
  const table = moduleId === "entities" ? "EntityMeta" : "DictionaryMeta";
  try {
    database.exec("BEGIN IMMEDIATE");
    const insert = database.prepare(
      `INSERT OR REPLACE INTO ${table}(key,value) VALUES (?,?)`
    );
    insert.run("resourceIdentity", `strong-lexicon:${moduleId}`);
    insert.run("resourceRevision", revision);
    insert.run("moduleKind", moduleId);
    insert.run("moduleSchemaVersion", String(SQLITE_SCHEMA_VERSION));
    if (moduleId !== "core") insert.run("coreRevision", coreRevision);
    database.exec("COMMIT; VACUUM");
  } catch (cause) {
    try {
      database.exec("ROLLBACK");
    } catch {}
    throw cause;
  } finally {
    database.close();
  }
};

const createZip = (sqlitePath: string, archivePath: string): void => {
  utimesSync(sqlitePath, ZIP_TIME, ZIP_TIME);
  execFileSync("zip", ["-X", "-q", "-j", archivePath, sqlitePath]);
};

const readConfig = (configPath: string): PublicationConfig => {
  const value = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  const modules =
    isRecord(value) && isRecord(value.modules) ? value.modules : undefined;
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isNonEmptyString(value.sourceVersion) ||
    !isNonEmptyString(value.rightsReviewedAt) ||
    !modules ||
    MODULE_IDS.some((moduleId) => {
      const item = modules[moduleId];
      return (
        !isRecord(item) ||
        !isNonEmptyString(item.holder) ||
        !isNonEmptyString(item.termsReference) ||
        !isNonEmptyString(item.attribution) ||
        typeof item.online !== "boolean" ||
        typeof item.offline !== "boolean"
      );
    })
  ) {
    throw new Error("strong-lexicon-publication-config-invalid");
  }
  return value as unknown as PublicationConfig;
};

export async function buildAllStrongLexiconResourcePublications(
  options: {
    root?: string;
    sourcePath?: string;
    entitiesPath?: string;
    configPath?: string;
    outputDir?: string;
    generatedAt?: string;
  } = {}
): Promise<{
  outputDir: string;
  manifests: StrongLexiconResourcePublicationManifest[];
}> {
  const root = path.resolve(options.root ?? process.cwd());
  const sourcePath = path.resolve(
    root,
    options.sourcePath ??
      "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite"
  );
  const entitiesPath = path.resolve(
    root,
    options.entitiesPath ?? "data/entities/bible_entities.production.sqlite"
  );
  const configPath = path.resolve(
    root,
    options.configPath ?? "config/strong-lexicon-resource-publications.json"
  );
  const outputDir = path.resolve(
    root,
    options.outputDir ?? "outputs/publications/strong-lexicon-issue-305"
  );
  if (existsSync(outputDir)) {
    throw new Error(`strong-lexicon-publication-output-exists:${outputDir}`);
  }
  const config = readConfig(configPath);
  return commitResourcePublicationBundle({
    outputDir,
    build: async (staging) => {
      const projection = `${staging}-projection`;
      try {
        packageModularLexicon({
          root,
          sourcePath,
          entitiesPath,
          outputDir: projection,
          generatedAt: options.generatedAt
        });
        const sourceSha256 = await sha256ResourcePublicationFile(sourcePath);
        const entitiesSourceSha256 =
          await sha256ResourcePublicationFile(entitiesPath);
        const generatedAt = options.generatedAt ?? new Date().toISOString();
        const tablesByModule = Object.fromEntries(
          MODULE_IDS.map((moduleId) => [
            moduleId,
            readTables(path.join(projection, MODULE_FILES[moduleId]), moduleId)
          ])
        ) as Record<StrongLexiconModuleId, Record<string, JsonRow[]>>;
        validateCrossModuleTables(tablesByModule);
        const coreRevision = deriveStrongLexiconModuleRevision(
          "core",
          tablesByModule.core,
          []
        );
        const coreDependency = [
          {
            resourceIdentity: "strong-lexicon:core" as const,
            revision: coreRevision
          }
        ];
        const revisions = {
          core: coreRevision,
          resources: deriveStrongLexiconModuleRevision(
            "resources",
            tablesByModule.resources,
            coreDependency
          ),
          entities: deriveStrongLexiconModuleRevision(
            "entities",
            tablesByModule.entities,
            coreDependency
          )
        } as Record<StrongLexiconModuleId, string>;
        const manifests: StrongLexiconResourcePublicationManifest[] = [];

        for (const moduleId of MODULE_IDS) {
          const bundleDir = path.join(staging, moduleId);
          const canonicalDir = path.join(bundleDir, "canonical");
          const offlineDir = path.join(bundleDir, "offline");
          mkdirSync(canonicalDir, { recursive: true });
          mkdirSync(offlineDir, { recursive: true });
          const dependencies =
            moduleId === "core"
              ? []
              : [
                  {
                    resourceIdentity: "strong-lexicon:core" as const,
                    revision: revisions.core
                  }
                ];
          const tables = tablesByModule[moduleId];
          const counts = Object.fromEntries(
            Object.entries(tables).map(([table, rows]) => [table, rows.length])
          );
          const canonical: CanonicalStrongLexiconModule = {
            format: "bible-strong-canonical-strong-lexicon-module",
            schemaVersion: CANONICAL_SCHEMA_VERSION,
            moduleId,
            revision: revisions[moduleId],
            dependencies,
            tables,
            counts
          };
          const canonicalPath = path.join(canonicalDir, `${moduleId}.json`);
          writeFileSync(canonicalPath, `${JSON.stringify(canonical)}\n`);

          const sqlitePath = path.join(offlineDir, MODULE_FILES[moduleId]);
          copyFileSync(
            path.join(projection, MODULE_FILES[moduleId]),
            sqlitePath
          );
          bindRevision(
            sqlitePath,
            moduleId,
            revisions[moduleId],
            revisions.core
          );
          const archivePath = `${sqlitePath}.zip`;
          createZip(sqlitePath, archivePath);
          rmSync(sqlitePath);

          const rights = config.modules[moduleId];
          const manifest: StrongLexiconResourcePublicationManifest = {
            format: "bible-strong-resource-publication",
            schemaVersion: 1,
            identity: {
              kind: "strong-lexicon-module",
              moduleId,
              resourceId: `strong-lexicon:${moduleId}`,
              language: "mul"
            },
            revision: revisions[moduleId],
            canonical: {
              path: `canonical/${moduleId}.json`,
              mediaType: "application/json",
              schemaVersion: CANONICAL_SCHEMA_VERSION,
              sha256: await sha256ResourcePublicationFile(canonicalPath),
              bytes: statSync(canonicalPath).size
            },
            offlineArtifact: {
              path: `offline/${MODULE_FILES[moduleId]}.zip`,
              mediaType: "application/zip",
              entry: MODULE_FILES[moduleId],
              sha256: await sha256ResourcePublicationFile(archivePath),
              bytes: statSync(archivePath).size,
              contentSha256: await sha256ZipEntry(
                archivePath,
                MODULE_FILES[moduleId]
              )
            },
            provenance: {
              generator: "bible-lexicon-maker",
              sourceVersion: config.sourceVersion,
              sourceSha256:
                moduleId === "entities" ? entitiesSourceSha256 : sourceSha256,
              generatedAt
            },
            rights: {
              holder: rights.holder,
              termsReference: rights.termsReference,
              attribution: rights.attribution,
              reviewedAt: config.rightsReviewedAt,
              online: rights.online,
              offline: rights.offline
            },
            deliveryCapabilities: {
              onlineAccess: rights.online,
              offlineDownload: rights.offline,
              localDevelopmentAccess: true
            },
            dependencies,
            counts
          };
          writeFileSync(
            path.join(bundleDir, "manifest.json"),
            `${JSON.stringify(manifest, null, 2)}\n`
          );
          manifests.push(manifest);
        }
        return { outputDir, manifests };
      } finally {
        rmSync(projection, { recursive: true, force: true });
      }
    },
    validate: async (staging) => {
      await Promise.all(
        MODULE_IDS.map((moduleId) =>
          validateStrongLexiconResourcePublication(path.join(staging, moduleId))
        )
      );
    }
  });
}

export async function validateStrongLexiconResourcePublication(
  bundleDir: string
): Promise<StrongLexiconResourcePublicationManifest> {
  const resolvedBundleDir = realpathSync(bundleDir);
  const manifestPath = path.join(bundleDir, "manifest.json");
  const manifestStat = lstatSync(manifestPath);
  const resolvedManifestPath = realpathSync(manifestPath);
  if (
    !manifestStat.isFile() ||
    manifestStat.size > 1024 * 1024 ||
    !resolvedManifestPath.startsWith(`${resolvedBundleDir}${path.sep}`)
  ) {
    throw new Error("strong-lexicon-publication-manifest-path-invalid");
  }
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  const envelope = decodeResourcePublicationEnvelope(raw);
  const manifest = decodeManifest(raw, envelope);
  const canonicalPath = resolveResourcePublicationPath(
    bundleDir,
    manifest.canonical.path
  );
  const archivePath = resolveResourcePublicationPath(
    bundleDir,
    manifest.offlineArtifact.path
  );
  await Promise.all([
    assertResourcePublicationArtifact(
      canonicalPath,
      manifest.canonical,
      "canonical",
      bundleDir
    ),
    assertResourcePublicationArtifact(
      archivePath,
      manifest.offlineArtifact,
      "offline",
      bundleDir
    )
  ]);
  const canonical = decodeCanonical(
    JSON.parse(await readFile(canonicalPath, "utf8")) as unknown
  );
  if (
    canonical.moduleId !== manifest.identity.moduleId ||
    canonical.revision !== manifest.revision ||
    stableJson(canonical.dependencies) !== stableJson(manifest.dependencies) ||
    stableJson(canonical.counts) !== stableJson(manifest.counts) ||
    deriveStrongLexiconModuleRevision(
      canonical.moduleId,
      canonical.tables,
      canonical.dependencies
    ) !== canonical.revision
  ) {
    throw new Error("strong-lexicon-publication-canonical-mismatch");
  }
  await assertSingleBoundedZipEntry(
    archivePath,
    manifest.offlineArtifact.entry,
    manifest.offlineArtifact.bytes
  );
  const extraction = await mkdtemp(
    path.join(tmpdir(), "strong-lexicon-publication-")
  );
  try {
    execFileSync("unzip", [
      "-qq",
      archivePath,
      manifest.offlineArtifact.entry,
      "-d",
      extraction
    ]);
    const sqlitePath = path.join(extraction, manifest.offlineArtifact.entry);
    if (
      statSync(sqlitePath).size > MAX_SQLITE_BYTES ||
      (await sha256ResourcePublicationFile(sqlitePath)) !==
        manifest.offlineArtifact.contentSha256
    ) {
      throw new Error("strong-lexicon-publication-offline-content-mismatch");
    }
    const tables = readTables(sqlitePath, canonical.moduleId);
    if (stableJson(tables) !== stableJson(canonical.tables)) {
      throw new Error("strong-lexicon-publication-offline-parity-mismatch");
    }
    const database = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      const metaTable =
        canonical.moduleId === "entities" ? "EntityMeta" : "DictionaryMeta";
      const metadata = Object.fromEntries(
        (
          database
            .prepare(`SELECT key,value FROM ${metaTable}`)
            .all() as Array<{
            key: string;
            value: string;
          }>
        ).map(({ key, value }) => [key, value])
      );
      if (
        metadata.resourceIdentity !== `strong-lexicon:${canonical.moduleId}` ||
        metadata.resourceRevision !== canonical.revision ||
        metadata.moduleKind !== canonical.moduleId ||
        metadata.moduleSchemaVersion !== String(SQLITE_SCHEMA_VERSION) ||
        (canonical.moduleId !== "core" &&
          metadata.coreRevision !== canonical.dependencies[0]?.revision)
      ) {
        throw new Error("strong-lexicon-publication-offline-metadata-mismatch");
      }
    } finally {
      database.close();
    }
  } finally {
    rmSync(extraction, { recursive: true, force: true });
  }
  return manifest;
}

const decodeCanonical = (value: unknown): CanonicalStrongLexiconModule => {
  const tables =
    isRecord(value) && isRecord(value.tables) ? value.tables : undefined;
  const counts =
    isRecord(value) && isRecord(value.counts) ? value.counts : undefined;
  if (
    !isRecord(value) ||
    value.format !== "bible-strong-canonical-strong-lexicon-module" ||
    value.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
    !MODULE_IDS.includes(value.moduleId as StrongLexiconModuleId) ||
    !isNonEmptyString(value.revision) ||
    !Array.isArray(value.dependencies) ||
    !tables ||
    !counts
  ) {
    throw new Error("strong-lexicon-publication-canonical-invalid");
  }
  const moduleId = value.moduleId as StrongLexiconModuleId;
  if (
    Object.keys(tables).sort().join("|") !==
      [...TABLES[moduleId]].sort().join("|") ||
    Object.keys(counts).sort().join("|") !==
      [...TABLES[moduleId]].sort().join("|") ||
    TABLES[moduleId].some(
      (table) =>
        !Array.isArray(tables[table]) ||
        !isNonNegativeInteger(counts[table]) ||
        tables[table].length !== counts[table]
    )
  ) {
    throw new Error("strong-lexicon-publication-canonical-invalid");
  }
  if (
    (moduleId === "core" && value.dependencies.length !== 0) ||
    (moduleId !== "core" &&
      (value.dependencies.length !== 1 ||
        !isRecord(value.dependencies[0]) ||
        value.dependencies[0].resourceIdentity !== "strong-lexicon:core" ||
        !isNonEmptyString(value.dependencies[0].revision)))
  ) {
    throw new Error("strong-lexicon-publication-canonical-dependency-invalid");
  }
  validateRows(moduleId, tables as Record<string, JsonRow[]>);
  return value as unknown as CanonicalStrongLexiconModule;
};

const decodeManifest = (
  value: unknown,
  envelope: ResourcePublicationEnvelope
): StrongLexiconResourcePublicationManifest => {
  if (!isRecord(value) || !isRecord(value.identity)) {
    throw new Error("strong-lexicon-publication-manifest-invalid");
  }
  const moduleId = value.identity.moduleId as StrongLexiconModuleId;
  if (
    value.identity.kind !== "strong-lexicon-module" ||
    !MODULE_IDS.includes(moduleId) ||
    value.identity.resourceId !== `strong-lexicon:${moduleId}` ||
    value.identity.language !== "mul" ||
    envelope.canonical.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
    !Array.isArray(value.dependencies) ||
    !isRecord(value.counts) ||
    Object.values(value.counts).some((count) => !isNonNegativeInteger(count)) ||
    (moduleId === "core"
      ? value.dependencies.length !== 0
      : value.dependencies.length !== 1)
  ) {
    throw new Error("strong-lexicon-publication-manifest-invalid");
  }
  if (envelope.offlineArtifact.entry !== MODULE_FILES[moduleId]) {
    throw new Error("strong-lexicon-publication-offline-entry-invalid");
  }
  if (moduleId !== "core") {
    const dependency = value.dependencies[0];
    if (
      !isRecord(dependency) ||
      dependency.resourceIdentity !== "strong-lexicon:core" ||
      !isNonEmptyString(dependency.revision)
    ) {
      throw new Error("strong-lexicon-publication-dependency-invalid");
    }
  }
  return value as unknown as StrongLexiconResourcePublicationManifest;
};

const sha256ZipEntry = async (
  archivePath: string,
  entry: string
): Promise<string> => {
  const bytes = execFileSync("unzip", ["-p", archivePath, entry], {
    maxBuffer: MAX_SQLITE_BYTES
  });
  return createHash("sha256").update(bytes).digest("hex");
};

const assertSingleBoundedZipEntry = async (
  archivePath: string,
  expectedEntry: string,
  archiveBytes: number
): Promise<void> => {
  if (
    archiveBytes > MAX_SQLITE_BYTES ||
    statSync(archivePath).size > MAX_SQLITE_BYTES
  ) {
    throw new Error("strong-lexicon-publication-offline-size-invalid");
  }
  const names = execFileSync("unzip", ["-Z1", archivePath], {
    encoding: "utf8"
  })
    .split(/\r?\n/u)
    .filter(Boolean);
  if (names.length !== 1 || names[0] !== expectedEntry) {
    throw new Error("strong-lexicon-publication-offline-entries-invalid");
  }
  const listing = execFileSync("zipinfo", ["-l", archivePath, expectedEntry], {
    encoding: "utf8"
  });
  const line = listing
    .split(/\r?\n/u)
    .find((candidate) => candidate.trimEnd().endsWith(` ${expectedEntry}`));
  const bytes = line?.trim().split(/\s+/u)[3];
  if (
    !line?.trimStart().startsWith("-") ||
    !bytes ||
    !/^\d+$/u.test(bytes) ||
    Number(bytes) > MAX_SQLITE_BYTES
  ) {
    throw new Error("strong-lexicon-publication-offline-size-invalid");
  }
};

const parseCli = (args: readonly string[]) => {
  const allowed = new Set([
    "--root",
    "--source",
    "--entities",
    "--config",
    "--output",
    "--generated-at"
  ]);
  const result: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const next = args[index + 1];
    if (!key || !allowed.has(key))
      throw new Error(
        `strong-lexicon-publication-cli-option-unknown:${key ?? ""}`
      );
    if (!next || next.startsWith("--"))
      throw new Error(
        `strong-lexicon-publication-cli-option-value-missing:${key}`
      );
    if (result[key])
      throw new Error(`strong-lexicon-publication-cli-option-duplicate:${key}`);
    result[key] = next;
  }
  return result;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "validate") {
    if (args.length !== 3 || args[1] !== "--bundle") {
      throw new Error("strong-lexicon-publication-cli-validate-invalid");
    }
    process.stdout.write(
      `${JSON.stringify(await validateStrongLexiconResourcePublication(args[2]!), null, 2)}\n`
    );
    return;
  }
  const values = parseCli(args);
  const result = await buildAllStrongLexiconResourcePublications({
    root: values["--root"],
    sourcePath: values["--source"],
    entitiesPath: values["--entities"],
    configPath: values["--config"],
    outputDir: values["--output"],
    generatedAt: values["--generated-at"]
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain)
  main().catch((cause) => {
    console.error(cause);
    process.exitCode = 1;
  });
