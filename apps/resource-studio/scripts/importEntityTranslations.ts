import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { dirname, resolve } from "node:path";

type EntityTranslationRecord = {
  entityId: number;
  targetLanguage?: string;
  status: "accepted" | "review_needed" | "rejected";
  translation: {
    displayName?: string;
    description?: string;
    summaryHtml?: string;
    briefest?: string;
    brief?: string;
    shortDescription?: string;
    articleHtml?: string;
  };
};

type ImportRow = {
  entityId: number;
  language: string;
  displayName: string;
  description: string;
  summaryHtml: string;
  briefest: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
};

const DEFAULT_DB = "data/entities/bible_entities.sqlite";
const DEFAULT_INPUT = "outputs/entity-fr/entity_fr.gemini.candidates.jsonl";
const DEFAULT_LANGUAGE = "fr";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const inputPath = resolve(args.input ?? DEFAULT_INPUT);
  const language = args.language ?? DEFAULT_LANGUAGE;
  const write = args.write === "true";
  const includeReviewNeeded = args.includeReviewNeeded === "true";

  if (!existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
  if (!existsSync(inputPath)) {
    throw new Error(`Input JSONL not found: ${inputPath}`);
  }

  const records = readJsonl(inputPath);
  const rows = buildRows(records, language, includeReviewNeeded);
  const importDbPath = write ? dbPath : `${dbPath}.entity-import-dry-run.tmp`;
  if (!write) {
    rmSync(importDbPath, { force: true });
    copyFileSync(dbPath, importDbPath);
  }

  let backupPath: string | undefined;
  if (write) backupPath = createBackup(dbPath);

  try {
    ensureSchema(importDbPath);
    validateRows(importDbPath, rows);
    importRows(importDbPath, rows);
    const dbCount = readDbCount(importDbPath, language);
    console.log(
      JSON.stringify(
        {
          mode: write ? "write" : "dry-run",
          database: dbPath,
          input: inputPath,
          language,
          records: records.length,
          importableRows: rows.length,
          accepted: records.filter((record) => record.status === "accepted")
            .length,
          reviewNeeded: records.filter(
            (record) => record.status === "review_needed"
          ).length,
          includedReviewNeeded: includeReviewNeeded,
          dbCountForLanguage: dbCount,
          backupPath
        },
        null,
        2
      )
    );
  } finally {
    if (!write) rmSync(importDbPath, { force: true });
  }
}

function readJsonl(path: string): EntityTranslationRecord[] {
  const records: EntityTranslationRecord[] = [];
  const seen = new Set<number>();
  let lineNumber = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    lineNumber += 1;
    if (!line.trim()) continue;
    const record = JSON.parse(line) as EntityTranslationRecord;
    if (!Number.isInteger(record.entityId)) {
      throw new Error(`Invalid entityId at ${path}:${lineNumber}`);
    }
    if (seen.has(record.entityId)) {
      throw new Error(
        `Duplicate entityId ${record.entityId} at ${path}:${lineNumber}`
      );
    }
    seen.add(record.entityId);
    records.push(record);
  }
  return records;
}

function buildRows(
  records: EntityTranslationRecord[],
  language: string,
  includeReviewNeeded: boolean
): ImportRow[] {
  return records
    .filter(
      (record) =>
        record.status === "accepted" ||
        (includeReviewNeeded && record.status === "review_needed")
    )
    .map((record) => ({
      entityId: record.entityId,
      language,
      displayName: record.translation.displayName?.trim() ?? "",
      description: record.translation.description?.trim() ?? "",
      summaryHtml: record.translation.summaryHtml?.trim() ?? "",
      briefest: record.translation.briefest?.trim() ?? "",
      brief: record.translation.brief?.trim() ?? "",
      shortDescription: record.translation.shortDescription?.trim() ?? "",
      articleHtml: record.translation.articleHtml?.trim() ?? ""
    }))
    .filter((row) => row.displayName);
}

function ensureSchema(dbPath: string): void {
  runSql(
    dbPath,
    `
      CREATE TABLE IF NOT EXISTS EntityTranslations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entityId INTEGER NOT NULL,
        language TEXT NOT NULL,
        displayName TEXT NOT NULL,
        description TEXT NOT NULL,
        summaryHtml TEXT NOT NULL,
        briefest TEXT NOT NULL,
        brief TEXT NOT NULL,
        shortDescription TEXT NOT NULL,
        articleHtml TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(entityId, language),
        FOREIGN KEY(entityId) REFERENCES Entities(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_EntityTranslations_language
        ON EntityTranslations(language);
      CREATE INDEX IF NOT EXISTS idx_EntityTranslations_entityId
        ON EntityTranslations(entityId);
    `
  );
}

function validateRows(dbPath: string, rows: ImportRow[]): void {
  if (rows.length === 0) throw new Error("No importable rows");
  const existingIds = new Set(
    JSON.parse(
      execFileSync("sqlite3", ["-json", dbPath, "SELECT id FROM Entities"], {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 20
      })
    ).map((row: { id: number }) => row.id)
  );
  const missing = rows.filter((row) => !existingIds.has(row.entityId));
  if (missing.length > 0) {
    throw new Error(
      `Import aborted: ${missing.length} entityId values do not exist. First: ${missing
        .slice(0, 20)
        .map((row) => row.entityId)
        .join(", ")}`
    );
  }
}

function importRows(dbPath: string, rows: ImportRow[]): void {
  const values = rows
    .map(
      (row) =>
        `(${row.entityId}, ${sqlString(row.language)}, ${sqlString(row.displayName)}, ${sqlString(row.description)}, ${sqlString(row.summaryHtml)}, ${sqlString(row.briefest)}, ${sqlString(row.brief)}, ${sqlString(row.shortDescription)}, ${sqlString(row.articleHtml)}, datetime('now'), datetime('now'))`
    )
    .join(",\n");
  runSql(
    dbPath,
    `
      BEGIN;
      INSERT INTO EntityTranslations
        (entityId, language, displayName, description, summaryHtml, briefest,
         brief, shortDescription, articleHtml, createdAt, updatedAt)
      VALUES
        ${values}
      ON CONFLICT(entityId, language) DO UPDATE SET
        displayName = excluded.displayName,
        description = excluded.description,
        summaryHtml = excluded.summaryHtml,
        briefest = excluded.briefest,
        brief = excluded.brief,
        shortDescription = excluded.shortDescription,
        articleHtml = excluded.articleHtml,
        updatedAt = excluded.updatedAt;
      COMMIT;
    `
  );
}

function readDbCount(dbPath: string, language: string): number {
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `SELECT count(*) AS count FROM EntityTranslations WHERE language=${sqlString(language)}`
    ],
    { encoding: "utf8" }
  );
  return (JSON.parse(raw) as [{ count: number }])[0]?.count ?? 0;
}

function createBackup(dbPath: string): string {
  const parsed = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.backup-${parsed}-before-entity-translation-import`;
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

function runSql(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 120
  });
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    const key = rawKey.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[key] = nextValue;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main();
