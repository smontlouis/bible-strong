import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  LEXICAL_MORPHOLOGY_SUPPLEMENTS,
  normalizeMorphologyCode
} from "../src/lexiconV3/morphologySupplements.js";

const DEFAULT_DB = "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const DEFAULT_ARCHIVE = "data/dictionaries/archive";
const VERSION = "lexicon-morphology-completion@1";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const archiveDir = resolve(args.archive ?? DEFAULT_ARCHIVE);
  if (!existsSync(dbPath)) throw new Error(`missing-database:${dbPath}`);

  mkdirSync(archiveDir, { recursive: true });
  const beforeHash = sha256File(dbPath);
  const archivePath = resolve(
    archiveDir,
    `${basename(dbPath, ".sqlite")}.pre-morphology-${beforeHash.slice(0, 12)}.sqlite`
  );
  if (!existsSync(archivePath)) copyFileSync(dbPath, archivePath);

  const temporary = `${dbPath}.morphology-tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  copyFileSync(dbPath, temporary);
  try {
    const db = new DatabaseSync(temporary);
    try {
      applySupplements(db);
      db.exec("VACUUM;");
      verify(db);
    } finally {
      db.close();
    }
    renameSync(temporary, dbPath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }

  process.stdout.write(`${JSON.stringify({
    dbPath,
    archivePath,
    version: VERSION,
    supplements: LEXICAL_MORPHOLOGY_SUPPLEMENTS.length,
    beforeHash,
    afterHash: sha256File(dbPath)
  }, null, 2)}\n`);
}

export function applySupplements(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
  try {
    const insertCode = db.prepare(
      `INSERT INTO MorphologyCodes(
         code, normalizedCode, language, scope, example, meaning, description, source
       ) VALUES (?, ?, ?, 'lexical_brief', ?, ?, ?, ?)
       ON CONFLICT(source, scope, code) DO UPDATE SET
         normalizedCode=excluded.normalizedCode,
         language=excluded.language,
         example=excluded.example,
         meaning=excluded.meaning,
         description=excluded.description`
    );
    const findCode = db.prepare(
      `SELECT id FROM MorphologyCodes
       WHERE source=? AND scope='lexical_brief' AND code=?`
    );
    const insertTranslation = db.prepare(
      `INSERT INTO MorphologyCodeTranslations(
         morphologyCodeId, language, meaning, description, example, sourceHash
       ) VALUES (?, 'fr', ?, ?, ?, ?)
       ON CONFLICT(morphologyCodeId, language) DO UPDATE SET
         meaning=excluded.meaning,
         description=excluded.description,
         example=excluded.example,
         sourceHash=excluded.sourceHash`
    );

    for (const row of LEXICAL_MORPHOLOGY_SUPPLEMENTS) {
      insertCode.run(
        row.code,
        row.normalizedCode,
        row.language,
        row.example,
        row.meaning,
        row.description,
        row.source
      );
      const found = findCode.get(row.source, row.code) as { id: number } | undefined;
      if (!found) throw new Error(`failed-to-insert-morphology:${row.code}`);
      const sourceHash = sha256(JSON.stringify(row));
      insertTranslation.run(
        found.id,
        row.meaningFr,
        row.descriptionFr,
        row.exampleFr,
        sourceHash
      );
    }

    // The STEP brief-code files provide labels but no separate description.
    // Keep the label verbatim and derive only the missing explanatory sentence.
    db.exec(`
      UPDATE MorphologyCodes
      SET description='Lexical category: ' || trim(meaning) || '.'
      WHERE scope='lexical_brief'
        AND trim(description)=''
        AND trim(meaning)<>'';
    `);

    const setMeta = db.prepare(
      `INSERT INTO DictionaryMeta(key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    );
    setMeta.run("lexiconMorphologyCompletionVersion", VERSION);
    setMeta.run("lexiconMorphologyCompletionCount", String(LEXICAL_MORPHOLOGY_SUPPLEMENTS.length));
    setMeta.run("lexiconMorphologyCompletionHash", sha256(JSON.stringify(LEXICAL_MORPHOLOGY_SUPPLEMENTS)));
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function verify(db: DatabaseSync): void {
  const integrity = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
  if (integrity !== "ok") throw new Error(`integrity-check:${integrity}`);
  const known = new Set(
    (db.prepare("SELECT code, normalizedCode FROM MorphologyCodes WHERE scope='lexical_brief'").all() as unknown as Array<{ code: string; normalizedCode: string }>).flatMap(
      (row) => [row.code.trim(), row.normalizedCode]
    )
  );
  const used = db.prepare("SELECT DISTINCT trim(morph) AS morph FROM StepEntries WHERE trim(morph)<>''").all() as unknown as Array<{ morph: string }>;
  const missing = used
    .map((row) => row.morph)
    .filter((code) => !known.has(code) && !known.has(normalizeMorphologyCode(code)));
  if (missing.length !== 0) {
    throw new Error(`unresolved-used-morphology:${missing.join(",")}`);
  }
  const untranslated = Number(
    db.prepare(
      `SELECT count(*) AS n FROM MorphologyCodes mc
       LEFT JOIN MorphologyCodeTranslations mt
         ON mt.morphologyCodeId=mc.id AND mt.language='fr'
       WHERE mc.scope='lexical_brief'
         AND (mt.morphologyCodeId IS NULL OR trim(mt.meaning)='' OR trim(mt.description)='')`
    ).get()?.n ?? -1
  );
  if (untranslated !== 0) throw new Error(`untranslated-lexical-morphology:${untranslated}`);
  const missingEnglish = Number(
    db.prepare(
      `SELECT count(*) AS n FROM MorphologyCodes
       WHERE scope='lexical_brief'
         AND (trim(meaning)='' OR trim(description)='')`
    ).get()?.n ?? -1
  );
  if (missingEnglish !== 0) {
    throw new Error(`incomplete-english-lexical-morphology:${missingEnglish}`);
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) continue;
    result[token.slice(2)] = value;
    index += 1;
  }
  return result;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath: string): string {
  return sha256(readFileSync(filePath));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
