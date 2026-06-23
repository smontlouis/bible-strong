import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { dirname, resolve } from "node:path";

type ResourceTranslationRecord = {
  resourceId: number;
  targetLanguage?: string;
  status: "accepted" | "review_needed" | "rejected";
  translation: {
    contentHtmlFr?: string;
    contentTextFr?: string;
    contentHtml?: string;
    contentText?: string;
  };
};

type ImportRow = {
  resourceId: number;
  language: string;
  contentHtml: string;
  contentText: string;
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_INPUT =
  "outputs/lexicon-resource-fr/lexicon_resource_fr.deepl.candidates.jsonl";
const DEFAULT_LANGUAGE = "fr";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const inputPath = resolve(args.input ?? DEFAULT_INPUT);
  const language = args.language ?? DEFAULT_LANGUAGE;
  const write = args.write === "true";
  const includeReviewNeeded = args.includeReviewNeeded === "true";

  if (!existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
  if (!existsSync(inputPath))
    throw new Error(`Input JSONL not found: ${inputPath}`);

  const records = readJsonl(inputPath);
  const rows = buildRows(records, language, includeReviewNeeded);
  const importDbPath = write ? dbPath : `${dbPath}.resource-import-dry-run.tmp`;
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

function readJsonl(path: string): ResourceTranslationRecord[] {
  const records: ResourceTranslationRecord[] = [];
  const seen = new Set<number>();
  let lineNumber = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    lineNumber += 1;
    if (!line.trim()) continue;
    const record = JSON.parse(line) as ResourceTranslationRecord;
    if (!Number.isInteger(record.resourceId)) {
      throw new Error(`Invalid resourceId at ${path}:${lineNumber}`);
    }
    if (seen.has(record.resourceId)) {
      throw new Error(
        `Duplicate resourceId ${record.resourceId} at ${path}:${lineNumber}`
      );
    }
    seen.add(record.resourceId);
    records.push(record);
  }
  return records;
}

function buildRows(
  records: ResourceTranslationRecord[],
  language: string,
  includeReviewNeeded: boolean
): ImportRow[] {
  return records
    .filter(
      (record) =>
        record.status === "accepted" ||
        (includeReviewNeeded && record.status === "review_needed")
    )
    .map((record) => {
      const contentHtml =
        record.translation.contentHtmlFr ??
        record.translation.contentHtml ??
        "";
      const contentText =
        record.translation.contentTextFr ??
        record.translation.contentText ??
        stripHtml(contentHtml);
      return {
        resourceId: record.resourceId,
        language,
        contentHtml: contentHtml.trim(),
        contentText: contentText.trim()
      };
    })
    .filter((row) => row.contentHtml && row.contentText);
}

function ensureSchema(dbPath: string): void {
  runSql(
    dbPath,
    `
      CREATE TABLE IF NOT EXISTS LexiconResourceTranslations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resourceId INTEGER NOT NULL,
        language TEXT NOT NULL,
        contentHtml TEXT NOT NULL,
        contentText TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(resourceId, language),
        FOREIGN KEY(resourceId) REFERENCES LexiconResources(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_LexiconResourceTranslations_language
        ON LexiconResourceTranslations(language);
    `
  );
}

function validateRows(dbPath: string, rows: ImportRow[]): void {
  if (rows.length === 0) throw new Error("No importable rows");
  const existingIds = new Set(
    JSON.parse(
      execFileSync(
        "sqlite3",
        ["-json", dbPath, "SELECT id FROM LexiconResources"],
        {
          encoding: "utf8",
          maxBuffer: 1024 * 1024 * 20
        }
      )
    ).map((row: { id: number }) => row.id)
  );
  const missing = rows.filter((row) => !existingIds.has(row.resourceId));
  if (missing.length > 0) {
    throw new Error(
      `Import aborted: ${missing.length} resourceId values do not exist. First: ${missing
        .slice(0, 20)
        .map((row) => row.resourceId)
        .join(", ")}`
    );
  }
}

function importRows(dbPath: string, rows: ImportRow[]): void {
  const values = rows
    .map(
      (row) =>
        `(${row.resourceId}, ${sqlString(row.language)}, ${sqlString(row.contentHtml)}, ${sqlString(row.contentText)}, datetime('now'), datetime('now'))`
    )
    .join(",\n");
  runSql(
    dbPath,
    `
      BEGIN;
      INSERT INTO LexiconResourceTranslations
        (resourceId, language, contentHtml, contentText, createdAt, updatedAt)
      VALUES
        ${values}
      ON CONFLICT(resourceId, language) DO UPDATE SET
        contentHtml = excluded.contentHtml,
        contentText = excluded.contentText,
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
      `SELECT count(*) AS count FROM LexiconResourceTranslations WHERE language=${sqlString(language)}`
    ],
    { encoding: "utf8" }
  );
  return (JSON.parse(raw) as [{ count: number }])[0]?.count ?? 0;
}

function createBackup(dbPath: string): string {
  const parsed = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.backup-${parsed}-before-resource-translation-import`;
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

function runSql(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80
  });
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
