import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { dirname, resolve } from "node:path";

type DisplayNameRecord = {
  displayName: string;
  category: "person" | "group" | "place" | "other";
  status: "accepted" | "review_needed";
  translation: {
    displayNameFr: string;
  };
};

type ImportRow = {
  displayName: string;
  category: string;
  displayNameFr: string;
};

const DEFAULT_DB = "data/entities/bible_entities.sqlite";
const DEFAULT_INPUT =
  "outputs/entity-fr/entity_display_names_fr.gemini.candidates.jsonl";
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
  const rows = buildRows(records, includeReviewNeeded);
  const importDbPath = write
    ? dbPath
    : `${dbPath}.display-name-import-dry-run.tmp`;
  if (!write) {
    rmSync(importDbPath, { force: true });
    copyFileSync(dbPath, importDbPath);
  }

  let backupPath: string | undefined;
  if (write) backupPath = createBackup(dbPath);

  try {
    validateRows(importDbPath, rows, language);
    importRows(importDbPath, rows, language);
    const changedRows = readChangedCount(importDbPath, language);
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
          translatedDisplayNamesDifferentFromSource: changedRows,
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

function readJsonl(path: string): DisplayNameRecord[] {
  const records: DisplayNameRecord[] = [];
  const seen = new Set<string>();
  let lineNumber = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    lineNumber += 1;
    if (!line.trim()) continue;
    const record = JSON.parse(line) as DisplayNameRecord;
    const key = `${record.category}\t${record.displayName}`;
    if (seen.has(key)) {
      throw new Error(
        `Duplicate displayName/category at ${path}:${lineNumber}`
      );
    }
    seen.add(key);
    records.push(record);
  }
  return records;
}

function buildRows(
  records: DisplayNameRecord[],
  includeReviewNeeded: boolean
): ImportRow[] {
  return records
    .filter(
      (record) =>
        record.status === "accepted" ||
        (includeReviewNeeded && record.status === "review_needed")
    )
    .map((record) => ({
      displayName: record.displayName,
      category: record.category,
      displayNameFr: record.translation.displayNameFr.trim()
    }))
    .filter((row) => row.displayNameFr);
}

function validateRows(
  dbPath: string,
  rows: ImportRow[],
  language: string
): void {
  if (rows.length === 0) throw new Error("No importable rows");
  const existing = new Set(
    JSON.parse(
      execFileSync(
        "sqlite3",
        [
          "-json",
          dbPath,
          "SELECT DISTINCT displayName || char(9) || category AS key FROM Entities"
        ],
        { encoding: "utf8", maxBuffer: 1024 * 1024 * 20 }
      )
    ).map((row: { key: string }) => row.key)
  );
  const missing = rows.filter(
    (row) => !existing.has(`${row.displayName}\t${row.category}`)
  );
  if (missing.length > 0) {
    throw new Error(
      `Import aborted: ${missing.length} display names do not exist. First: ${missing
        .slice(0, 10)
        .map((row) => `${row.category}:${row.displayName}`)
        .join(", ")}`
    );
  }

  const translatedCount = readTranslationCount(dbPath, language);
  if (translatedCount === 0) {
    throw new Error(`No EntityTranslations rows found for ${language}`);
  }
}

function importRows(dbPath: string, rows: ImportRow[], language: string): void {
  const values = rows
    .map(
      (row) =>
        `(${sqlString(row.displayName)}, ${sqlString(row.category)}, ${sqlString(row.displayNameFr)})`
    )
    .join(",\n");
  runSql(
    dbPath,
    `
      BEGIN;
      CREATE TEMP TABLE DisplayNameImportMap (
        displayName TEXT NOT NULL,
        category TEXT NOT NULL,
        displayNameFr TEXT NOT NULL,
        PRIMARY KEY(displayName, category)
      );
      INSERT INTO DisplayNameImportMap (displayName, category, displayNameFr)
      VALUES
        ${values};
      UPDATE EntityTranslations AS et
      SET
        displayName = (
          SELECT m.displayNameFr
          FROM Entities AS e
          JOIN DisplayNameImportMap AS m
            ON m.displayName = e.displayName
           AND m.category = e.category
          WHERE e.id = et.entityId
        ),
        updatedAt = datetime('now')
      WHERE et.language = ${sqlString(language)}
        AND et.entityId IN (
          SELECT e.id
          FROM Entities AS e
          JOIN DisplayNameImportMap AS m
            ON m.displayName = e.displayName
           AND m.category = e.category
        );
      DROP TABLE DisplayNameImportMap;
      COMMIT;
    `
  );
}

function readTranslationCount(dbPath: string, language: string): number {
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

function readChangedCount(dbPath: string, language: string): number {
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `SELECT count(*) AS count
       FROM EntityTranslations et
       JOIN Entities e ON e.id = et.entityId
       WHERE et.language=${sqlString(language)}
         AND et.displayName <> e.displayName`
    ],
    { encoding: "utf8" }
  );
  return (JSON.parse(raw) as [{ count: number }])[0]?.count ?? 0;
}

function createBackup(dbPath: string): string {
  const parsed = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.backup-${parsed}-before-entity-display-name-import`;
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
