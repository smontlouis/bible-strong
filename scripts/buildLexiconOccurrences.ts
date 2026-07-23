import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "../src/books.js";
import {
  normalizeClassicalStrong,
  readStepOriginalTokens,
  type StepOriginalToken
} from "../src/stepOriginals.js";

const DEFAULT_OUTPUT =
  "data/dictionaries/strong_lexicon.occurrences.production.sqlite";
const DEFAULT_SUMMARY = `${DEFAULT_OUTPUT}.summary.json`;
const BUILDER_VERSION = "lexicon-occurrences@1";
const DEFAULT_SOURCES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const summaryPath = resolve(args.summary ?? DEFAULT_SUMMARY);
  const sourcePaths = (args.sources?.split(",") ?? DEFAULT_SOURCES).map(
    (item) => resolve(item.trim())
  );
  for (const sourcePath of sourcePaths) {
    if (!existsSync(sourcePath))
      throw new Error(`missing-source:${sourcePath}`);
  }
  if (existsSync(outputPath) && args.write !== "true") {
    throw new Error(`output-exists-requires-write:${outputPath}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(summaryPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });

  try {
    const db = new DatabaseSync(temporary);
    const sourceDigests: Record<string, string> = {};
    try {
      createSchema(db);
      db.exec("BEGIN IMMEDIATE;");
      try {
        for (const sourcePath of sourcePaths) {
          sourceDigests[sourcePath] = sha256File(sourcePath);
          const tokens = await readStepOriginalTokens(sourcePath);
          insertTokens(db, tokens);
        }
        writeMetadata(db, sourceDigests);
        buildStats(db);
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
      db.exec("VACUUM; ANALYZE;");
    } finally {
      db.close();
    }

    const verification = verifyDatabase(temporary);
    renameSync(temporary, outputPath);
    const result = {
      ...verification,
      outputPath,
      summaryPath,
      outputSha256: sha256File(outputPath),
      outputBytes: statSync(outputPath).size,
      sourceDigests,
      generatedAt: new Date().toISOString(),
      builderVersion: BUILDER_VERSION
    };
    writeFileSync(summaryPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function createSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys=OFF;
    PRAGMA journal_mode=OFF;
    PRAGMA synchronous=OFF;
    PRAGMA temp_store=MEMORY;

    CREATE TABLE Occurrences (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL CHECK(source IN ('TAHOT','TAGNT')),
      mainRef TEXT NOT NULL,
      alternateRefs TEXT NOT NULL,
      bookId TEXT NOT NULL,
      bookOrder INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      tokenIndex INTEGER NOT NULL,
      tokenType TEXT NOT NULL,
      surface TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      gloss TEXT NOT NULL,
      morphology TEXT NOT NULL,
      editions TEXT NOT NULL,
      baseStrong TEXT NOT NULL,
      stepCode TEXT NOT NULL,
      UNIQUE(source, mainRef, tokenIndex, tokenType, baseStrong, stepCode)
    );
    CREATE INDEX idx_Occurrences_stepCode
      ON Occurrences(stepCode, bookOrder, chapter, verse, tokenIndex);
    CREATE INDEX idx_Occurrences_baseStrong
      ON Occurrences(baseStrong, bookOrder, chapter, verse, tokenIndex);
    CREATE INDEX idx_Occurrences_ref
      ON Occurrences(bookOrder, chapter, verse, tokenIndex);
    CREATE INDEX idx_Occurrences_morphology
      ON Occurrences(morphology);

    CREATE TABLE OccurrenceMorphology (
      occurrenceId INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      code TEXT NOT NULL,
      PRIMARY KEY(occurrenceId, ordinal)
    ) WITHOUT ROWID;
    CREATE INDEX idx_OccurrenceMorphology_code
      ON OccurrenceMorphology(code);

    CREATE TABLE OccurrenceStats (
      identityKind TEXT NOT NULL CHECK(identityKind IN ('step','classical')),
      strongCode TEXT NOT NULL,
      totalCount INTEGER NOT NULL,
      oldTestamentCount INTEGER NOT NULL,
      newTestamentCount INTEGER NOT NULL,
      verseCount INTEGER NOT NULL,
      morphologyCount INTEGER NOT NULL,
      surfaceCount INTEGER NOT NULL,
      firstRef TEXT NOT NULL,
      PRIMARY KEY(identityKind, strongCode)
    ) WITHOUT ROWID;

    CREATE TABLE OccurrenceMeta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
  `);
}

function insertTokens(db: DatabaseSync, tokens: StepOriginalToken[]): void {
  const insertOccurrence = db.prepare(
    `INSERT OR IGNORE INTO Occurrences(
       source, mainRef, alternateRefs, bookId, bookOrder, chapter, verse,
       tokenIndex, tokenType, surface, transliteration, gloss, morphology,
       editions, baseStrong, stepCode
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMorphology = db.prepare(
    `INSERT OR IGNORE INTO OccurrenceMorphology(occurrenceId, ordinal, code)
     VALUES (?, ?, ?)`
  );

  for (const token of tokens) {
    const parsedRef = parseRef(token.ref);
    const bookOrder = BOOK_IDS.indexOf(
      parsedRef.bookId as (typeof BOOK_IDS)[number]
    );
    if (bookOrder < 0) throw new Error(`unknown-book:${token.ref}`);
    for (const [baseStrongRaw, stepCodes] of token.strongByBase) {
      const baseStrong = normalizeClassicalStrong(baseStrongRaw);
      if (!baseStrong) continue;
      for (const stepCode of stepCodes) {
        const result = insertOccurrence.run(
          token.source,
          token.ref,
          JSON.stringify(token.alternateRefs),
          parsedRef.bookId,
          bookOrder + 1,
          parsedRef.chapter,
          parsedRef.verse,
          token.tokenIndex,
          token.type,
          token.surface,
          token.transliteration,
          token.gloss,
          token.morphology,
          token.editions,
          baseStrong,
          stepCode
        );
        if (result.changes === 0) continue;
        const occurrenceId = Number(result.lastInsertRowid);
        const morphologyCodes = normalizeMorphologyCodes(
          token.morphology,
          token.source
        );
        morphologyCodes.forEach((code, ordinal) =>
          insertMorphology.run(occurrenceId, ordinal, code)
        );
      }
    }
  }
}

function normalizeMorphologyCodes(
  morphology: string,
  source: "TAHOT" | "TAGNT"
): string[] {
  return morphology
    .split(/[+/]/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      source === "TAHOT" && !part.startsWith("H") ? `H${part}` : part
    );
}

function buildStats(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO OccurrenceStats(
      identityKind, strongCode, totalCount, oldTestamentCount,
      newTestamentCount, verseCount, morphologyCount, surfaceCount, firstRef
    )
    SELECT
      'step', stepCode, count(*),
      sum(CASE WHEN source='TAHOT' THEN 1 ELSE 0 END),
      sum(CASE WHEN source='TAGNT' THEN 1 ELSE 0 END),
      count(DISTINCT mainRef), count(DISTINCT morphology),
      count(DISTINCT surface),
      (SELECT o2.mainRef FROM Occurrences o2
       WHERE o2.stepCode=o.stepCode
       ORDER BY o2.bookOrder, o2.chapter, o2.verse, o2.tokenIndex LIMIT 1)
    FROM Occurrences o
    GROUP BY stepCode;

    INSERT INTO OccurrenceStats(
      identityKind, strongCode, totalCount, oldTestamentCount,
      newTestamentCount, verseCount, morphologyCount, surfaceCount, firstRef
    )
    SELECT
      'classical', baseStrong, count(*),
      sum(CASE WHEN source='TAHOT' THEN 1 ELSE 0 END),
      sum(CASE WHEN source='TAGNT' THEN 1 ELSE 0 END),
      count(DISTINCT mainRef), count(DISTINCT morphology),
      count(DISTINCT surface),
      (SELECT o2.mainRef FROM Occurrences o2
       WHERE o2.baseStrong=o.baseStrong
       ORDER BY o2.bookOrder, o2.chapter, o2.verse, o2.tokenIndex LIMIT 1)
    FROM Occurrences o
    GROUP BY baseStrong;
  `);
}

function writeMetadata(
  db: DatabaseSync,
  sourceDigests: Record<string, string>
): void {
  const insert = db.prepare(
    "INSERT INTO OccurrenceMeta(key, value) VALUES (?, ?)"
  );
  insert.run("schemaVersion", BUILDER_VERSION);
  insert.run("generatedAt", new Date().toISOString());
  insert.run("sourceDigests", JSON.stringify(sourceDigests));
}

function verifyDatabase(filePath: string): Record<string, unknown> {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = String(
      db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "unknown"
    );
    const counts = {
      occurrences: scalar(db, "SELECT count(*) FROM Occurrences"),
      physicalTokens: scalar(
        db,
        `SELECT count(*) FROM (
           SELECT source, mainRef, tokenIndex, tokenType
           FROM Occurrences GROUP BY source, mainRef, tokenIndex, tokenType
         )`
      ),
      morphologyLinks: scalar(db, "SELECT count(*) FROM OccurrenceMorphology"),
      stepStats: scalar(
        db,
        "SELECT count(*) FROM OccurrenceStats WHERE identityKind='step'"
      ),
      classicalStats: scalar(
        db,
        "SELECT count(*) FROM OccurrenceStats WHERE identityKind='classical'"
      ),
      missingRefs: scalar(
        db,
        "SELECT count(*) FROM Occurrences WHERE mainRef='' OR bookOrder<=0"
      )
    };
    if (integrity !== "ok") throw new Error(`integrity-check:${integrity}`);
    if (counts.occurrences <= 0 || counts.physicalTokens <= 0) {
      throw new Error("empty-occurrence-database");
    }
    if (counts.missingRefs !== 0) {
      throw new Error(`invalid-occurrence-refs:${counts.missingRefs}`);
    }
    return { integrity, counts };
  } finally {
    db.close();
  }
}

function parseRef(ref: string): {
  bookId: string;
  chapter: number;
  verse: number;
} {
  const match = /^([^.]+)\.(\d+)\.(\d+)$/u.exec(ref);
  if (!match) throw new Error(`invalid-reference:${ref}`);
  return {
    bookId: match[1] ?? "",
    chapter: Number.parseInt(match[2] ?? "", 10),
    verse: Number.parseInt(match[3] ?? "", 10)
  };
}

function scalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(Object.values(row ?? {})[0] ?? 0);
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const allowed = new Set(["output", "summary", "sources", "write"]);
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
