import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  parseStepCompiledNameMeanings,
  stripNameMeaningHtml
} from "../src/lexiconNameMeanings.js";
import {
  assertPinnedStepLexicon,
  STEP_GREEK_LEXICON_SHA256,
  STEP_HEBREW_LEXICON_SHA256
} from "../src/stepRelatedNumbers.js";

const DEFAULT_LEXICON =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const DEFAULT_GREEK = "data/external/stepbible/lexicon_greek.txt";
const DEFAULT_HEBREW = "data/external/stepbible/lexicon_hebrew.txt";
const DEFAULT_TRANSLATIONS =
  "config/lexicon-name-meaning-translations.fr.jsonl";
const BUILDER_VERSION = "lexicon-name-meanings@1";

interface TranslationRecord {
  sourceTextSha256: string;
  sourceText: string;
  language: "fr";
  valueHtml: string;
  engine: string;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const lexiconPath = resolve(args.lexicon ?? DEFAULT_LEXICON);
  const greekPath = resolve(args.greek ?? DEFAULT_GREEK);
  const hebrewPath = resolve(args.hebrew ?? DEFAULT_HEBREW);
  const translationsPath = resolve(args.translations ?? DEFAULT_TRANSLATIONS);
  const summaryPath = resolve(
    args.summary ?? `${lexiconPath}.name-meanings.json`
  );
  const generatedAt = args["generated-at"] ?? new Date().toISOString();
  for (const filePath of [
    lexiconPath,
    greekPath,
    hebrewPath,
    translationsPath
  ]) {
    if (!existsSync(filePath)) throw new Error(`missing-source:${filePath}`);
  }

  const greek = readFileSync(greekPath);
  const hebrew = readFileSync(hebrewPath);
  assertPinnedStepLexicon(greek, STEP_GREEK_LEXICON_SHA256, "greek");
  assertPinnedStepLexicon(hebrew, STEP_HEBREW_LEXICON_SHA256, "hebrew");
  const meanings = parseStepCompiledNameMeanings({
    greek: greek.toString("utf8"),
    hebrew: hebrew.toString("utf8")
  });
  const translations = new Map(
    readFileSync(translationsPath, "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as TranslationRecord)
      .map((record) => [record.sourceTextSha256, record])
  );
  const sourceSha256 = sha256File(lexiconPath);
  const inputFingerprint = sha256(
    `${STEP_GREEK_LEXICON_SHA256}:${STEP_HEBREW_LEXICON_SHA256}:${sha256File(
      translationsPath
    )}`
  );
  if (isCurrent(lexiconPath, inputFingerprint)) {
    const summary = verify(new DatabaseSync(lexiconPath, { readOnly: true }));
    writeSummary(summaryPath, {
      ...summary,
      unchanged: true,
      lexiconPath,
      sourceSha256,
      outputSha256: sourceSha256,
      generatedAt
    });
    return;
  }

  const temporary = `${lexiconPath}.name-meanings-tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  copyFileSync(lexiconPath, temporary);
  try {
    const db = new DatabaseSync(temporary);
    try {
      db.exec("PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE;");
      db.exec(`
        DROP TABLE IF EXISTS LexiconNameMeanings;
        CREATE TABLE LexiconNameMeanings (
          stepEntryId INTEGER NOT NULL,
          language TEXT NOT NULL,
          valueHtml TEXT NOT NULL,
          valueText TEXT NOT NULL,
          source TEXT NOT NULL,
          sourceField TEXT NOT NULL,
          sourceTextSha256 TEXT NOT NULL,
          translationEngine TEXT NOT NULL,
          PRIMARY KEY(stepEntryId, language)
        ) WITHOUT ROWID;
        CREATE INDEX idx_LexiconNameMeanings_language
          ON LexiconNameMeanings(language, stepEntryId);
      `);
      const identityRows = db
        .prepare("SELECT stepEntryId,stepCode FROM StepEntryIdentities")
        .all() as unknown as Array<{ stepEntryId: number; stepCode: string }>;
      const entryIdByCode = new Map(
        identityRows.map((row) => [row.stepCode, row.stepEntryId])
      );
      const entryRows = db
        .prepare("SELECT id,language,baseCode,gloss FROM StepEntries")
        .all() as unknown as Array<{
        id: number;
        language: "greek" | "hebrew";
        baseCode: number;
        gloss: string;
      }>;
      const entriesByClassicCode = new Map<string, typeof entryRows>();
      for (const row of entryRows) {
        const code = `${row.language === "greek" ? "G" : "H"}${String(
          row.baseCode
        ).padStart(4, "0")}`;
        const group = entriesByClassicCode.get(code) ?? [];
        group.push(row);
        entriesByClassicCode.set(code, group);
      }
      const insert = db.prepare(
        `INSERT INTO LexiconNameMeanings
           (stepEntryId,language,valueHtml,valueText,source,sourceField,
            sourceTextSha256,translationEngine)
         VALUES (?,?,?,?,?,?,?,?)`
      );
      const candidates = meanings.flatMap((meaning) => {
        const direct = entryIdByCode.get(meaning.stepCode);
        if (direct !== undefined) {
          return [{ meaning, stepEntryId: direct, direct: true, score: 100 }];
        }
        const match = meaning.stepCode.match(/^([GH]\d{4,5})/u);
        const possible = match
          ? (entriesByClassicCode.get(match[1]!) ?? [])
          : [];
        if (possible.length !== 1) return [];
        const entry = possible[0]!;
        return [
          {
            meaning,
            stepEntryId: entry.id,
            direct: false,
            score: nameMatchScore(meaning.sourceText, entry.gloss)
          }
        ];
      });
      const candidatesByEntry = new Map<number, typeof candidates>();
      for (const candidate of candidates) {
        const group = candidatesByEntry.get(candidate.stepEntryId) ?? [];
        group.push(candidate);
        candidatesByEntry.set(candidate.stepEntryId, group);
      }
      const selected = [...candidatesByEntry.values()].flatMap((group) => {
        const direct = group.filter((candidate) => candidate.direct);
        const pool = direct.length ? direct : group;
        const bestScore = Math.max(...pool.map((candidate) => candidate.score));
        const best = pool.filter((candidate) => candidate.score === bestScore);
        const unique = new Map(
          best.map((candidate) => [
            candidate.meaning.sourceTextSha256,
            candidate
          ])
        );
        return [[...unique.values()][0]!];
      });
      for (const { meaning, stepEntryId } of selected) {
        const translation = translations.get(meaning.sourceTextSha256);
        if (!translation || translation.sourceText !== meaning.sourceText) {
          throw new Error(`missing-translation:${meaning.stepCode}`);
        }
        insert.run(
          stepEntryId,
          "en",
          meaning.sourceText,
          stripNameMeaningHtml(meaning.sourceText),
          "STEP_COMPILED_LEXICON",
          meaning.sourceField,
          meaning.sourceTextSha256,
          "source"
        );
        insert.run(
          stepEntryId,
          "fr",
          translation.valueHtml,
          stripNameMeaningHtml(translation.valueHtml),
          "STEP_COMPILED_LEXICON",
          meaning.sourceField,
          meaning.sourceTextSha256,
          translation.engine
        );
      }
      const setMeta = db.prepare(
        `INSERT INTO DictionaryMeta(key,value) VALUES (?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`
      );
      setMeta.run("lexiconNameMeaningsVersion", BUILDER_VERSION);
      setMeta.run("lexiconNameMeaningsInputFingerprint", inputFingerprint);
      setMeta.run("lexiconNameMeaningsGeneratedAt", generatedAt);
      setMeta.run(
        "lexiconNameMeaningsSourceCandidates",
        String(meanings.length)
      );
      setMeta.run(
        "lexiconNameMeaningsPublishedEntries",
        String(selected.length)
      );
      db.exec("COMMIT; VACUUM;");
      verify(db);
    } catch (error) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // The transaction may already have been rolled back by SQLite.
      }
      throw error;
    } finally {
      db.close();
    }
    renameSync(temporary, lexiconPath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }

  const db = new DatabaseSync(lexiconPath, { readOnly: true });
  const summary = verify(db);
  db.close();
  writeSummary(summaryPath, {
    ...summary,
    lexiconPath,
    sourceSha256,
    outputSha256: sha256File(lexiconPath),
    generatedAt
  });
}

function nameMatchScore(sourceText: string, gloss: string): number {
  const sourceName = normalizeName(sourceText.split(/[=,]/u, 1)[0] ?? "");
  const targetName = normalizeName(gloss);
  if (!sourceName || !targetName) return 0;
  if (sourceName === targetName) return 10;
  if (sourceName.includes(targetName) || targetName.includes(sourceName))
    return 5;
  return 0;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "")
    .toLowerCase();
}

function isCurrent(filePath: string, inputFingerprint: string): boolean {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const row = db
      .prepare(
        `SELECT value FROM DictionaryMeta
         WHERE key='lexiconNameMeaningsInputFingerprint'`
      )
      .get() as { value?: string } | undefined;
    return (
      row?.value === inputFingerprint && tableExists(db, "LexiconNameMeanings")
    );
  } finally {
    db.close();
  }
}

function verify(db: DatabaseSync): Record<string, unknown> {
  const integrity = String(
    db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "unknown"
  );
  const entries = scalar(
    db,
    "SELECT count(DISTINCT stepEntryId) FROM LexiconNameMeanings"
  );
  const english = scalar(
    db,
    "SELECT count(*) FROM LexiconNameMeanings WHERE language='en'"
  );
  const french = scalar(
    db,
    "SELECT count(*) FROM LexiconNameMeanings WHERE language='fr'"
  );
  const orphans = scalar(
    db,
    `SELECT count(*) FROM LexiconNameMeanings n
     LEFT JOIN StepEntries e ON e.id=n.stepEntryId WHERE e.id IS NULL`
  );
  if (integrity !== "ok") throw new Error(`integrity:${integrity}`);
  if (!entries || english !== entries || french !== entries || orphans) {
    throw new Error(
      `invalid-name-meaning-coverage:${entries}:${english}:${french}:${orphans}`
    );
  }
  return {
    integrity,
    entries,
    english,
    french,
    rows: english + french,
    orphans
  };
}

function scalar(db: DatabaseSync, sql: string): number {
  return Number(Object.values(db.prepare(sql).get() ?? {})[0] ?? 0);
}

function tableExists(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name)
  );
}

function sha256File(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeSummary(filePath: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith("--")) continue;
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      result[value.slice(2)] = next;
      index += 1;
    } else result[value.slice(2)] = "true";
  }
  return result;
}

main();
