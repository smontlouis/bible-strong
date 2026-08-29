import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { dirname, resolve } from "node:path";

type LexiconTranslationRecord = {
  stepEntryId: number;
  targetLanguage: string;
  status: "accepted" | "review_needed" | "rejected";
  translation: Record<string, unknown> & {
    confidence?: number;
  };
  validation?: {
    issues?: string[];
  };
  model?: string;
  finalization?: {
    finalizedAt?: string;
  };
};

type ImportRow = {
  stepEntryId: number;
  language: string;
  gloss: string;
  meaning: string;
  meaningHtml: string;
};

type ImportSummary = {
  mode: "dry-run" | "write";
  database: string;
  input: string;
  language: string;
  inputRecords: number;
  importedRecords: number;
  existingStepEntries: number;
  accepted: number;
  reviewNeeded: number;
  rejected: number;
  missingStepEntryIds: number;
  dbCountForLanguage: number;
  backupPath?: string;
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_INPUT = "outputs/lexicon-fr/strong_lexicon_fr.final.jsonl";
const DEFAULT_TARGET_LANGUAGE = "fr";
const DEFAULT_EXPECTED_COUNT = 22717;

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const inputPath = resolve(args.input ?? DEFAULT_INPUT);
  const language =
    args.language ?? args.targetLanguage ?? DEFAULT_TARGET_LANGUAGE;
  const expectedCount = Number(args.expectedCount ?? DEFAULT_EXPECTED_COUNT);
  const write = args.write === "true";

  if (!existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }
  if (!existsSync(inputPath)) {
    throw new Error(`Input JSONL not found: ${inputPath}`);
  }

  const records = readFinalJsonl(inputPath);
  const rows = buildRows(records, language);
  validateInput(records, rows, language, expectedCount);

  const importDbPath = write ? dbPath : `${dbPath}.dry-run-import.tmp`;
  if (!write) {
    rmSync(importDbPath, { force: true });
    copyFileSync(dbPath, importDbPath);
  }

  let backupPath: string | undefined;
  if (write) {
    backupPath = createBackup(dbPath);
  }

  try {
    const stepEntryIds = readStepEntryIds(importDbPath);
    const missingIds = rows.filter((row) => !stepEntryIds.has(row.stepEntryId));
    if (missingIds.length > 0) {
      throw new Error(
        `Import aborted: ${missingIds.length} stepEntryId values are missing from StepEntries. First missing ids: ${missingIds
          .slice(0, 20)
          .map((row) => row.stepEntryId)
          .join(", ")}`
      );
    }

    ensureTranslationSchema(importDbPath);
    runSql(importDbPath, buildImportSql(rows, language));
    const dbCountForLanguage = readLanguageCount(importDbPath, language);

    if (dbCountForLanguage !== rows.length) {
      throw new Error(
        `Import verification failed: expected ${rows.length} ${language} rows, found ${dbCountForLanguage}`
      );
    }

    const summary: ImportSummary = {
      mode: write ? "write" : "dry-run",
      database: dbPath,
      input: inputPath,
      language,
      inputRecords: records.length,
      importedRecords: rows.length,
      existingStepEntries: stepEntryIds.size,
      accepted: records.filter((record) => record.status === "accepted").length,
      reviewNeeded: records.filter(
        (record) => record.status === "review_needed"
      ).length,
      rejected: records.filter((record) => record.status === "rejected").length,
      missingStepEntryIds: 0,
      dbCountForLanguage,
      backupPath
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (!write) {
      rmSync(importDbPath, { force: true });
    }
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    const key = toCamelCase(rawKey);
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

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}

function readFinalJsonl(path: string): LexiconTranslationRecord[] {
  const records: LexiconTranslationRecord[] = [];
  const seenIds = new Set<number>();
  let lineNumber = 0;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    lineNumber += 1;
    if (!line.trim()) continue;

    const record = JSON.parse(line) as LexiconTranslationRecord;
    if (!Number.isInteger(record.stepEntryId)) {
      throw new Error(`Invalid stepEntryId at ${path}:${lineNumber}`);
    }
    if (seenIds.has(record.stepEntryId)) {
      throw new Error(
        `Duplicate stepEntryId ${record.stepEntryId} at ${path}:${lineNumber}`
      );
    }
    seenIds.add(record.stepEntryId);
    records.push(record);
  }

  return records;
}

function buildRows(
  records: LexiconTranslationRecord[],
  language: string
): ImportRow[] {
  return records.map((record) => {
    const gloss = readTranslationText(record, language, "gloss");
    const meaningHtml =
      readTranslationText(record, language, "meaningHtml") ||
      readTranslationText(record, language, "meaning");
    const meaning =
      readTranslationText(record, language, "meaning") ||
      stripHtml(meaningHtml);
    return {
      stepEntryId: record.stepEntryId,
      language,
      gloss,
      meaning,
      meaningHtml
    };
  });
}

function readTranslationText(
  record: LexiconTranslationRecord,
  language: string,
  baseField: "gloss" | "meaning" | "meaningHtml" | "notes"
): string {
  const suffix = language
    .split(/[-_]/)
    .map(
      (part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join("");
  const languageField = `${baseField}${suffix}`;
  const value =
    record.translation[languageField] ?? record.translation[baseField];
  return typeof value === "string" ? value.trim() : "";
}

function validateInput(
  records: LexiconTranslationRecord[],
  rows: ImportRow[],
  language: string,
  expectedCount: number
): void {
  if (records.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} records, found ${records.length}`
    );
  }

  const invalidTarget = records.filter(
    (record) => record.targetLanguage !== language
  );
  if (invalidTarget.length > 0) {
    throw new Error(
      `Input contains ${invalidTarget.length} records whose targetLanguage is not ${language}`
    );
  }

  const nonAccepted = records.filter((record) => record.status !== "accepted");
  if (nonAccepted.length > 0) {
    throw new Error(
      `Input contains ${nonAccepted.length} non-accepted records; refusing to import`
    );
  }

  const withIssues = records.filter(
    (record) => (record.validation?.issues ?? []).length > 0
  );
  if (withIssues.length > 0) {
    throw new Error(
      `Input contains ${withIssues.length} records with validation issues; refusing to import`
    );
  }

  const emptyFields = rows.filter((row) => !row.meaningHtml);
  if (emptyFields.length > 0) {
    throw new Error(
      `Input contains ${emptyFields.length} rows with empty meaningHtml; refusing to import`
    );
  }
}

function createBackup(dbPath: string): string {
  mkdirSync(dirname(dbPath), { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.backup-${timestamp}`;
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

function readStepEntryIds(dbPath: string): Set<number> {
  const raw = runSqlJson<{ id: number }>(
    dbPath,
    "SELECT id FROM StepEntries ORDER BY id"
  );
  return new Set(raw.map((row) => row.id));
}

function readLanguageCount(dbPath: string, language: string): number {
  const rows = runSqlJson<{ count: number }>(
    dbPath,
    `SELECT COUNT(*) AS count FROM LexiconTranslations WHERE language = ${sqlString(
      language
    )}`
  );
  return rows[0]?.count ?? 0;
}

function ensureTranslationSchema(dbPath: string): void {
  const columns = runSqlJson<{ name: string }>(
    dbPath,
    "PRAGMA table_info(LexiconTranslations)"
  );
  const columnNames = new Set(columns.map((column) => column.name));
  const expected = [
    "id",
    "stepEntryId",
    "language",
    "gloss",
    "meaning",
    "meaningHtml",
    "createdAt",
    "updatedAt"
  ];
  if (
    expected.every((name) => columnNames.has(name)) &&
    !columnNames.has("targetLanguage") &&
    !columnNames.has("status") &&
    !columnNames.has("notes") &&
    !columnNames.has("confidence") &&
    !columnNames.has("sourceModel") &&
    !columnNames.has("reviewedAt")
  ) {
    return;
  }

  const languageExpression = columnNames.has("language")
    ? "language"
    : "targetLanguage";
  const meaningHtmlExpression = columnNames.has("meaningHtml")
    ? "meaningHtml"
    : "''";
  runSql(
    dbPath,
    `
PRAGMA foreign_keys = OFF;
BEGIN;
DROP TABLE IF EXISTS LexiconTranslations_new;
CREATE TABLE LexiconTranslations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stepEntryId INTEGER NOT NULL,
  language TEXT NOT NULL,
  gloss TEXT NOT NULL,
  meaning TEXT NOT NULL,
  meaningHtml TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(stepEntryId, language),
  FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
);
INSERT INTO LexiconTranslations_new (
  id,
  stepEntryId,
  language,
  gloss,
  meaning,
  meaningHtml,
  createdAt,
  updatedAt
)
SELECT
  id,
  stepEntryId,
  ${languageExpression},
  gloss,
  meaning,
  ${meaningHtmlExpression},
  createdAt,
  updatedAt
FROM LexiconTranslations;
DROP TABLE LexiconTranslations;
ALTER TABLE LexiconTranslations_new RENAME TO LexiconTranslations;
CREATE INDEX IF NOT EXISTS idx_lexicon_translations_language
  ON LexiconTranslations(language);
COMMIT;
PRAGMA foreign_keys = ON;
`
  );
}

function buildImportSql(rows: ImportRow[], language: string): string {
  const now = new Date().toISOString();
  const values = rows
    .map(
      (row) =>
        `(${[
          row.stepEntryId.toString(),
          sqlString(row.language),
          sqlString(row.gloss),
          sqlString(row.meaning),
          sqlString(row.meaningHtml),
          sqlString(now),
          sqlString(now)
        ].join(", ")})`
    )
    .join(",\n");

  return `
PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE IF NOT EXISTS LexiconTranslations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stepEntryId INTEGER NOT NULL,
  language TEXT NOT NULL,
  gloss TEXT NOT NULL,
  meaning TEXT NOT NULL,
  meaningHtml TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(stepEntryId, language),
  FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lexicon_translations_language
  ON LexiconTranslations(language);

DELETE FROM LexiconTranslations
WHERE language = ${sqlString(language)}
  AND stepEntryId NOT IN (${rows.map((row) => row.stepEntryId).join(", ")});

INSERT INTO LexiconTranslations (
  stepEntryId,
  language,
  gloss,
  meaning,
  meaningHtml,
  createdAt,
  updatedAt
)
VALUES
${values}
ON CONFLICT(stepEntryId, language) DO UPDATE SET
  gloss = excluded.gloss,
  meaning = CASE
    WHEN LexiconTranslations.meaning IS NULL OR LexiconTranslations.meaning = ''
      THEN excluded.meaning
    ELSE LexiconTranslations.meaning
  END,
  meaningHtml = excluded.meaningHtml,
  updatedAt = excluded.updatedAt;

COMMIT;
`;
}

function runSql(dbPath: string, sql: string): void {
  const result = spawnSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50
  });
  if (result.status !== 0) {
    throw new Error(
      `sqlite3 failed for ${dbPath} with status ${result.status}\n${result.stderr}`
    );
  }
}

function runSqlJson<T>(dbPath: string, sql: string): T[] {
  const result = spawnSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50
  });
  if (result.status !== 0) {
    throw new Error(
      `sqlite3 failed for ${dbPath} with status ${result.status}\n${result.stderr}`
    );
  }
  return JSON.parse(result.stdout || "[]") as T[];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

main();
