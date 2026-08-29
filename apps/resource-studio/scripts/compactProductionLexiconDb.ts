import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const DEFAULT_ARCHIVE = "data/dictionaries/archive";
const DEFAULT_REPORT =
  "outputs/lexicon-fr-quality/release/final/production-compaction.json";

const PRODUCT_TABLES = [
  "StepEntries",
  "LexiconTranslations",
  "StepEntryIdentities",
  "LexiconResources",
  "LexiconResourceTranslations",
  "LexiconRelations",
  "MorphologyCodes",
  "MorphologyCodeTranslations"
] as const;

const REMOVED_TABLES = [
  "LexiconCarrierTerms",
  "LexiconFieldStatus",
  "LexiconFrenchProvenance",
  "LexiconRelationProvenance",
  "LexiconResourceProvenance"
] as const;

const KEPT_META_KEYS = new Set([
  "attribution",
  "generatedAt",
  "lexiconFrenchQualityCoreFinalSha256",
  "lexiconFrenchQualityLsjFinalSha256",
  "lexiconFrenchQualityReleaseKey",
  "lexiconFrenchQualityReleaseVersion",
  "lexiconViewerProfile",
  "license",
  "productionProfile",
  "source",
  "sourceDigests"
]);

interface Options {
  database: string;
  archiveDirectory: string;
  report: string;
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  if (!existsSync(options.database)) {
    throw new Error(`production-lexicon-missing:${options.database}`);
  }

  mkdirSync(options.archiveDirectory, { recursive: true });
  mkdirSync(dirname(options.report), { recursive: true });

  const sourceSha256 = sha256File(options.database);
  const sourceBytes = statSync(options.database).size;
  const archive = archiveExisting(
    options.database,
    options.archiveDirectory,
    sourceSha256
  );
  const temporary = `${options.database}.compact-${process.pid}-${Date.now()}`;
  rmSync(temporary, { force: true });
  copyFileSync(options.database, temporary);

  let source: DatabaseSync | null = null;
  let compact: DatabaseSync | null = null;
  try {
    source = new DatabaseSync(options.database, { readOnly: true });
    compact = new DatabaseSync(temporary);
    assertHealthy(source, "source");
    const expected = inspectProductTables(source);

    compact.exec(
      "PRAGMA foreign_keys=OFF; PRAGMA secure_delete=ON; BEGIN IMMEDIATE;"
    );
    try {
      for (const table of REMOVED_TABLES) {
        compact.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(table)};`);
      }
      const deleteMeta = compact.prepare(
        `DELETE FROM DictionaryMeta WHERE key NOT IN (${[...KEPT_META_KEYS]
          .map(() => "?")
          .join(",")})`
      );
      deleteMeta.run(...[...KEPT_META_KEYS]);
      compact
        .prepare(
          `INSERT INTO DictionaryMeta(key,value) VALUES ('productionCompaction','lean-v1')
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`
        )
        .run();
      compact.exec("COMMIT;");
    } catch (error) {
      compact.exec("ROLLBACK;");
      throw error;
    }

    compact.exec("PRAGMA journal_mode=DELETE; VACUUM;");
    assertHealthy(compact, "compacted");
    const actual = inspectProductTables(compact);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error("production-lexicon-product-content-drift");
    }
    for (const table of REMOVED_TABLES) {
      if (tableExists(compact, table)) {
        throw new Error(`production-lexicon-debug-table-remains:${table}`);
      }
    }
    const metadata = Object.fromEntries(
      (
        compact
          .prepare("SELECT key,value FROM DictionaryMeta ORDER BY key")
          .all() as unknown as Array<{ key: string; value: string }>
      ).map((row) => [row.key, row.value])
    );
    const allowedMeta = new Set([...KEPT_META_KEYS, "productionCompaction"]);
    if (Object.keys(metadata).some((key) => !allowedMeta.has(key))) {
      throw new Error("production-lexicon-debug-metadata-remains");
    }

    compact.close();
    compact = null;
    source.close();
    source = null;

    const outputSha256 = sha256File(temporary);
    const outputBytes = statSync(temporary).size;
    renameSync(temporary, options.database);
    const report = {
      schemaVersion: "production-lexicon-compaction@1",
      compactedAt: new Date().toISOString(),
      database: options.database,
      archive,
      source: { sha256: sourceSha256, bytes: sourceBytes },
      output: {
        sha256: outputSha256,
        bytes: outputBytes,
        savedBytes: sourceBytes - outputBytes,
        reductionPercent: Number(
          (((sourceBytes - outputBytes) / sourceBytes) * 100).toFixed(2)
        )
      },
      removedTables: REMOVED_TABLES,
      keptMetadata: metadata,
      productTables: actual,
      integrity: "ok",
      foreignKeyErrors: 0
    };
    installText(options.report, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    compact?.close();
    source?.close();
    rmSync(temporary, { force: true });
  }
}

function inspectProductTables(
  database: DatabaseSync
): Record<string, { rows: number; fingerprint: string }> {
  return Object.fromEntries(
    PRODUCT_TABLES.map((table) => {
      if (!tableExists(database, table)) {
        throw new Error(`production-lexicon-product-table-missing:${table}`);
      }
      return [
        table,
        {
          rows: Number(
            database
              .prepare(
                `SELECT count(*) AS count FROM ${quoteIdentifier(table)}`
              )
              .get()?.count ?? 0
          ),
          fingerprint: tableFingerprint(database, table)
        }
      ];
    })
  );
}

function tableFingerprint(database: DatabaseSync, table: string): string {
  const columns = database
    .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
    .all() as unknown as Array<{ name: string; pk: number }>;
  const orderColumns = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk);
  const order = (orderColumns.length > 0 ? orderColumns : columns)
    .map((column) => quoteIdentifier(column.name))
    .join(",");
  const hash = createHash("sha256");
  const statement = database.prepare(
    `SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${order}`
  );
  for (const row of statement.iterate() as Iterable<Record<string, unknown>>) {
    hash.update(JSON.stringify(columns.map((column) => row[column.name])));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function assertHealthy(database: DatabaseSync, label: string): void {
  const integrity = String(
    database.prepare("PRAGMA integrity_check").get()?.integrity_check ?? ""
  );
  if (integrity !== "ok") {
    throw new Error(`production-lexicon-integrity:${label}:${integrity}`);
  }
  const foreignKeys = database.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeys.length > 0) {
    throw new Error(
      `production-lexicon-foreign-keys:${label}:${foreignKeys.length}`
    );
  }
}

function archiveExisting(
  database: string,
  directory: string,
  digest: string
): string {
  const path = resolve(
    directory,
    `${basename(database, ".sqlite")}.pre-compact-${digest.slice(0, 12)}.sqlite`
  );
  if (existsSync(path)) {
    if (sha256File(path) !== digest) {
      throw new Error("production-lexicon-archive-collision");
    }
    return path;
  }
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  copyFileSync(database, temporary);
  if (sha256File(temporary) !== digest) {
    rmSync(temporary, { force: true });
    throw new Error("production-lexicon-archive-hash");
  }
  renameSync(temporary, path);
  return path;
}

function installText(path: string, content: string): void {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, content, "utf8");
  renameSync(temporary, path);
}

function tableExists(database: DatabaseSync, table: string): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1"
      )
      .get(table)
  );
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseOptions(values: string[]): Options {
  const args = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith("--"))
      throw new Error(`unexpected-argument:${value}`);
    const [rawKey, inline] = value.slice(2).split("=", 2);
    if (args.has(rawKey!)) throw new Error(`duplicate-option:${rawKey}`);
    const option = inline ?? values[++index];
    if (!option || option.startsWith("--")) {
      throw new Error(`missing-option:${rawKey}`);
    }
    args.set(rawKey!, option);
  }
  const allowed = new Set(["database", "archive", "report"]);
  for (const key of args.keys()) {
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
  }
  return {
    database: resolve(args.get("database") ?? DEFAULT_DATABASE),
    archiveDirectory: resolve(args.get("archive") ?? DEFAULT_ARCHIVE),
    report: resolve(args.get("report") ?? DEFAULT_REPORT)
  };
}

main();
